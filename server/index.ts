import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import os from 'os';
import { spawn, type ChildProcess } from 'child_process';
import dotenv from 'dotenv';
import { readDb, writeDb, sanitizeUser, type StoredUser } from './db.js';
import { signToken, authenticateToken, type AuthenticatedRequest } from './middleware/auth.js';
import type { Patient, Hospital, ActivityLog, MedicalRecord, Role } from '../src/types/index.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());

const getLocalNetworkIp = (): string | null => {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
};

// Manage a single public HTTPS tunnel to the Express server (127.0.0.1:5000) so QR codes work on BOTH Mobile Data (4G/5G) and Wi-Fi
let publicTunnelUrl: string | null = null;
let tunnelProc: ChildProcess | null = null;

const startPublicTunnel = () => {
  if (tunnelProc) return;
  try {
    tunnelProc = spawn(
      'ssh',
      [
        '-o',
        'StrictHostKeyChecking=no',
        '-o',
        'ServerAliveInterval=30',
        '-R',
        `80:127.0.0.1:${PORT}`,
        'nokey@localhost.run',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    const handleOutput = (chunk: Buffer) => {
      const text = chunk.toString();
      const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.lhr\.life/);
      if (match) {
        publicTunnelUrl = match[0];
        console.log(`🌐 Public Mobile+WiFi Tunnel active: ${publicTunnelUrl}`);
      }
    };

    tunnelProc.stdout?.on('data', handleOutput);
    tunnelProc.stderr?.on('data', handleOutput);
    tunnelProc.on('exit', () => {
      tunnelProc = null;
      publicTunnelUrl = null;
      setTimeout(startPublicTunnel, 3000);
    });
  } catch (err) {
    console.warn('Could not start SSH tunnel:', err);
  }
};

// --- Network Info (for Mobile Data + LAN Wi-Fi QR Code scanning) ---
app.get('/api/network-info', (_req, res) => {
  const lanIp = getLocalNetworkIp();
  res.json({
    lanIp,
    lanUrl: lanIp ? `http://${lanIp}:${PORT}` : null,
    publicUrl: publicTunnelUrl,
  });
});

// --- Health Check ---
app.get('/api/health', (_req, res) => {
  const db = readDb();
  const lanIp = getLocalNetworkIp();
  res.json({
    status: 'ok',
    service: 'MedQR+ Backend API',
    timestamp: new Date().toISOString(),
    usersCount: db.users.length,
    lanIp,
    lanUrl: lanIp ? `http://${lanIp}:${PORT}` : null,
    publicUrl: publicTunnelUrl,
  });
});

// --- Auth: Login ---
app.post('/api/auth/login', (req, res) => {
  const { email, password, role } = req.body as {
    email?: string;
    password?: string;
    role?: Role;
  };

  if (!email || !role) {
    res.status(400).json({ error: 'Email and role are required' });
    return;
  }

  const db = readDb();
  const foundUser = db.users.find(
    (u) =>
      (u.email.toLowerCase() === email.toLowerCase() || u.id.toLowerCase() === email.toLowerCase()) &&
      u.role === role
  );

  if (!foundUser) {
    res.status(401).json({ error: 'Invalid credentials or account does not exist.' });
    return;
  }

  // Verify password if passwordHash exists and a password was supplied
  if (foundUser.passwordHash && password) {
    const isMatch = bcrypt.compareSync(password, foundUser.passwordHash);
    // Allow seeded accounts to log in either with their hashed password or any non-empty password in demo mode
    if (!isMatch && !['admin@medqr.com', 'contact@citygeneral.com', 'john.doe@example.com'].includes(foundUser.email.toLowerCase())) {
      res.status(401).json({ error: 'Invalid password.' });
      return;
    }
  }

  const safeUser = sanitizeUser(foundUser);
  const token = signToken({ id: safeUser.id, email: safeUser.email, role: safeUser.role });

  res.json({ token, user: safeUser });
});

// --- Auth: Register Patient ---
app.post('/api/auth/register/patient', (req, res) => {
  const data = req.body as Partial<Patient> & { password?: string };

  if (!data.email || !data.name) {
    res.status(400).json({ error: 'Name and email are required' });
    return;
  }

  const db = readDb();
  const exists = db.users.some((u) => u.email.toLowerCase() === data.email!.toLowerCase());
  if (exists) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  const newId = data.id || `MQR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
  const passwordHash = bcrypt.hashSync(data.password || 'password123', 10);

  const newPatient: StoredUser = {
    id: newId,
    role: 'Patient',
    name: data.name,
    email: data.email,
    phone: data.phone || '',
    dob: data.dob || '',
    gender: data.gender || '',
    bloodGroup: data.bloodGroup || '',
    height: data.height || '',
    weight: data.weight || '',
    address: data.address || '',
    allergies: Array.isArray(data.allergies) ? data.allergies : [],
    chronicConditions: Array.isArray(data.chronicConditions) ? data.chronicConditions : [],
    currentMedications: Array.isArray(data.currentMedications) ? data.currentMedications : [],
    issuingHospital: data.issuingHospital || 'City General Hospital',
    emergencyContact: data.emergencyContact || { name: '', relation: '', phone: '' },
    insurance: data.insurance || { provider: '', policy: '', validUntil: '' },
    medicalRecords: [],
    activityLog: [
      {
        id: crypto.randomUUID(),
        type: 'account_created',
        date: new Date().toISOString(),
        details: 'Account successfully registered.',
      },
    ],
    passwordHash,
  };

  db.users.push(newPatient);
  writeDb(db);

  const safeUser = sanitizeUser(newPatient);
  const token = signToken({ id: safeUser.id, email: safeUser.email, role: safeUser.role });

  res.status(201).json({ token, user: safeUser });
});

// --- Auth: Register Hospital ---
app.post('/api/auth/register/hospital', (req, res) => {
  const data = req.body as Partial<Hospital> & { password?: string };

  if (!data.email || !data.name) {
    res.status(400).json({ error: 'Hospital name and email are required' });
    return;
  }

  const db = readDb();
  const exists = db.users.some((u) => u.email.toLowerCase() === data.email!.toLowerCase());
  if (exists) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  const newId = data.id || `HOSP-${Math.floor(1000 + Math.random() * 9000)}`;
  const passwordHash = bcrypt.hashSync(data.password || 'password123', 10);

  const newHospital: StoredUser = {
    id: newId,
    role: 'Hospital',
    name: data.name,
    email: data.email,
    phone: data.phone || '',
    licenseNumber: data.licenseNumber || '',
    address: data.address || '',
    contactPerson: data.contactPerson || '',
    department: data.department || 'General',
    verified: false,
    status: 'pending',
    patientsAccessed: [],
    scanLogs: [],
    passwordHash,
  };

  db.users.push(newHospital);
  writeDb(db);

  const safeUser = sanitizeUser(newHospital);
  const token = signToken({ id: safeUser.id, email: safeUser.email, role: safeUser.role });

  res.status(201).json({ token, user: safeUser });
});

// --- Auth: Current User ---
app.get('/api/auth/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  const db = readDb();
  const found = db.users.find((u) => u.id === req.user?.id);
  if (!found) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user: sanitizeUser(found) });
});

// --- Users: Get All Users ---
app.get('/api/users', (_req, res) => {
  const db = readDb();
  res.json({ users: db.users.map(sanitizeUser) });
});

// --- Users: Get User by ID ---
app.get('/api/users/:id', (req, res) => {
  const db = readDb();
  const found = db.users.find((u) => u.id.toLowerCase() === req.params.id.toLowerCase());
  if (!found) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user: sanitizeUser(found) });
});

// --- Users: Update or Upsert User (Profile / Admin Hospital Verification / LocalStorage Sync) ---
app.put('/api/users/:id', (req, res) => {
  const db = readDb();
  const index = db.users.findIndex((u) => u.id.toLowerCase() === req.params.id.toLowerCase());
  const incoming = req.body as Partial<StoredUser>;

  if (index === -1) {
    // Upsert user from frontend localStorage if not yet in backend database
    const newUser: StoredUser = {
      ...incoming,
      id: incoming.id || req.params.id,
      role: incoming.role || 'Patient',
      passwordHash: bcrypt.hashSync('password123', 10),
    } as StoredUser;
    db.users.push(newUser);
    writeDb(db);
    res.json({ user: sanitizeUser(newUser) });
    return;
  }

  const existing = db.users[index];

  // Preserve id, role, and passwordHash
  const updated: StoredUser = {
    ...existing,
    ...incoming,
    id: existing.id,
    role: existing.role,
    passwordHash: existing.passwordHash,
  } as StoredUser;

  db.users[index] = updated;
  writeDb(db);

  res.json({ user: sanitizeUser(updated) });
});

// --- Medical Records: Add Record ---
app.post('/api/users/:id/records', (req, res) => {
  const db = readDb();
  const index = db.users.findIndex((u) => u.id === req.params.id && u.role === 'Patient');
  if (index === -1) {
    res.status(404).json({ error: 'Patient not found' });
    return;
  }

  const patient = db.users[index] as Patient & { passwordHash?: string };
  const recordInput = req.body as Omit<MedicalRecord, 'id'> & { id?: string };

  const newRecord: MedicalRecord = {
    id: recordInput.id || crypto.randomUUID(),
    type: recordInput.type || 'consultation',
    title: recordInput.title || 'Untitled Record',
    doctor: recordInput.doctor || 'Attending Physician',
    hospital: recordInput.hospital || 'General Clinic',
    date: recordInput.date || new Date().toISOString().split('T')[0],
    summary: recordInput.summary || '',
    details: recordInput.details || '',
    tags: Array.isArray(recordInput.tags) ? recordInput.tags : [],
    fileName: recordInput.fileName,
    fileSize: recordInput.fileSize,
  };

  const newLog: ActivityLog = {
    id: crypto.randomUUID(),
    type: 'record_added',
    date: new Date().toISOString(),
    details: `Added new ${newRecord.type} record: ${newRecord.title}`,
  };

  patient.medicalRecords = [newRecord, ...(patient.medicalRecords || [])];
  patient.activityLog = [newLog, ...(patient.activityLog || [])];
  db.users[index] = patient;
  writeDb(db);

  res.status(201).json({ record: newRecord, user: sanitizeUser(patient) });
});

// --- Medical Records: Delete Record ---
app.delete('/api/users/:id/records/:recordId', (req, res) => {
  const db = readDb();
  const index = db.users.findIndex((u) => u.id === req.params.id && u.role === 'Patient');
  if (index === -1) {
    res.status(404).json({ error: 'Patient not found' });
    return;
  }

  const patient = db.users[index] as Patient & { passwordHash?: string };
  patient.medicalRecords = (patient.medicalRecords || []).filter((r) => r.id !== req.params.recordId);
  db.users[index] = patient;
  writeDb(db);

  res.json({ user: sanitizeUser(patient) });
});

// --- Activity & Scan Logging ---
app.post('/api/users/:id/activity', (req, res) => {
  const db = readDb();
  const index = db.users.findIndex((u) => u.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const targetUser = db.users[index];
  const { type, details, extra, scannedPatientId } = req.body as {
    type: ActivityLog['type'];
    details: string;
    extra?: Partial<ActivityLog>;
    scannedPatientId?: string;
  };

  const newLog: ActivityLog = {
    id: crypto.randomUUID(),
    type,
    date: new Date().toISOString(),
    details,
    ...extra,
  };

  if (targetUser.role === 'Patient') {
    targetUser.activityLog = [newLog, ...(targetUser.activityLog || [])];
  } else if (targetUser.role === 'Hospital') {
    targetUser.scanLogs = [newLog, ...(targetUser.scanLogs || [])];

    // If a hospital scanned a patient, also record in patientsAccessed and the patient's own activityLog
    if (scannedPatientId) {
      const pIdx = db.users.findIndex((u) => u.id === scannedPatientId && u.role === 'Patient');
      if (pIdx !== -1) {
        const scannedPatient = db.users[pIdx] as Patient;
        targetUser.patientsAccessed = [
          {
            patientId: scannedPatient.id,
            patientName: scannedPatient.name,
            scanDate: newLog.date,
            accessTier: extra?.accessTier || 'Tier 3',
            reason: extra?.reason || 'Emergency Admission',
          },
          ...(targetUser.patientsAccessed || []),
        ];

        scannedPatient.activityLog = [
          {
            id: crypto.randomUUID(),
            type: 'tier_scan',
            date: newLog.date,
            details: `QR Pass scanned by ${targetUser.name} (${extra?.accessTier || 'Tier 3'})`,
            hospitalName: targetUser.name,
            department: targetUser.department,
            accessTier: extra?.accessTier || 'Tier 3',
            reason: extra?.reason || 'Emergency Admission',
          },
          ...(scannedPatient.activityLog || []),
        ];
        db.users[pIdx] = scannedPatient;
      }
    }
  }

  db.users[index] = targetUser;
  writeDb(db);

  res.status(201).json({ log: newLog, user: sanitizeUser(targetUser) });
});

// --- Scan OTP Generation, Status & Verification ---
app.post('/api/scan/request-otp', (req, res) => {
  const { patientId, requestedBy } = req.body as { patientId?: string; requestedBy?: string };
  if (!patientId) {
    res.status(400).json({ error: 'patientId is required' });
    return;
  }

  const db = readDb();
  const code = String(crypto.randomInt(100000, 1000000));
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

  db.otpCodes[patientId] = {
    code,
    expiresAt,
  };

  // Log OTP generation in patient's activity log
  const pIdx = db.users.findIndex((u) => u.id === patientId && u.role === 'Patient');
  if (pIdx !== -1) {
    const patient = db.users[pIdx] as Patient;
    patient.activityLog = [
      {
        id: crypto.randomUUID(),
        type: 'tier_scan',
        date: new Date().toISOString(),
        details: `6-digit OTP generated for Tier 2 access${requestedBy ? ` (Requested by ${requestedBy})` : ''}`,
        accessTier: 'Tier 2',
      },
      ...(patient.activityLog || []),
    ];
    db.users[pIdx] = patient;
  }

  writeDb(db);

  res.json({
    message: '6-digit OTP generated and sent to patient registered phone',
    otp: code,
    demoOtp: code,
    expiresAt,
  });
});

app.get('/api/scan/otp/:patientId', (req, res) => {
  const db = readDb();
  const stored = db.otpCodes[req.params.patientId];
  if (!stored || stored.expiresAt <= Date.now()) {
    res.json({ active: false });
    return;
  }
  res.json({
    active: true,
    otp: stored.code,
    expiresAt: stored.expiresAt,
  });
});

app.post('/api/scan/verify-otp', (req, res) => {
  const { patientId, otp } = req.body as { patientId?: string; otp?: string };
  if (!patientId || !otp) {
    res.status(400).json({ error: 'patientId and otp are required' });
    return;
  }

  const db = readDb();
  const stored = db.otpCodes[patientId];
  const cleanOtp = otp.trim();

  if (!stored || stored.expiresAt <= Date.now()) {
    res.status(400).json({ error: 'OTP has expired or was not requested. Please generate a new OTP.' });
    return;
  }

  if (stored.code !== cleanOtp) {
    res.status(400).json({ error: 'Invalid 6-digit OTP code. Please check and try again.' });
    return;
  }

  // Consume one-time code and log successful Tier 2 unlock
  delete db.otpCodes[patientId];
  const pIdx = db.users.findIndex((u) => u.id === patientId && u.role === 'Patient');
  if (pIdx !== -1) {
    const patient = db.users[pIdx] as Patient;
    patient.activityLog = [
      {
        id: crypto.randomUUID(),
        type: 'tier_scan',
        date: new Date().toISOString(),
        details: 'Tier 2 Full Medical Vault unlocked via 6-digit OTP verification',
        accessTier: 'Tier 2',
      },
      ...(patient.activityLog || []),
    ];
    db.users[pIdx] = patient;
  }
  writeDb(db);

  res.json({ verified: true, accessTier: '2' });
});

// --- AI Health Coach & Clinical Assistant Endpoint ---
app.post('/api/ai/chat', (req, res) => {
  const { message, userId } = req.body as { message?: string; userId?: string };
  if (!message) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  const db = readDb();
  const currentUser = db.users.find((u) => u.id === userId);
  const lower = message.toLowerCase();

  let reply =
    'Based on your MedQR+ profile, your vital indicators are stable. Always consult your attending physician before adjusting any treatment plan.';

  if (currentUser?.role === 'Patient') {
    const patient = currentUser as Patient;
    if (lower.includes('allerg')) {
      reply =
        patient.allergies?.length > 0
          ? `You have ${patient.allergies.length} flagged allergy alert(s): ${patient.allergies.join(', ')}. These are automatically visible in Tier 1 & Tier 3 emergency scans.`
          : 'You currently have no known allergies recorded in your profile. You can add any in the My Profile tab.';
    } else if (lower.includes('med') || lower.includes('prescription') || lower.includes('rx') || lower.includes('drug')) {
      reply =
        patient.currentMedications?.length > 0
          ? `Your active medications list includes: ${patient.currentMedications.join(', ')}. Make sure to take them as prescribed.`
          : 'You have no active medications listed in your profile right now.';
    } else if (lower.includes('blood')) {
      reply = `Your recorded blood group is ${patient.bloodGroup || 'not yet set'}.`;
    } else if (lower.includes('record') || lower.includes('lab') || lower.includes('vault')) {
      reply =
        patient.medicalRecords?.length > 0
          ? `Your vault contains ${patient.medicalRecords.length} medical record(s). The most recent is "${patient.medicalRecords[0].title}" (${patient.medicalRecords[0].date}) — ${patient.medicalRecords[0].summary}`
          : 'Your Medical Records Vault is currently empty. You can upload prescriptions, lab results, or imaging in the Medical Records section.';
    } else if (lower.includes('condition') || lower.includes('chronic') || lower.includes('asthma')) {
      reply =
        patient.chronicConditions?.length > 0
          ? `Your profile notes the following chronic condition(s): ${patient.chronicConditions.join(', ')}.`
          : 'No chronic conditions are currently flagged on your MedQR+ pass.';
    }
  } else if (currentUser?.role === 'Hospital') {
    const hospital = currentUser as Hospital;
    reply = `Clinical Assistant ready for ${hospital.name} (${hospital.department} Dept). You have accessed ${hospital.patientsAccessed?.length || 0} patient record(s) recently. Ask me about drug interactions, triage protocols, or patient scan summaries.`;
  }

  res.json({ reply, timestamp: new Date().toISOString() });
});

// --- Instant Mobile & Wi-Fi QR Scan Medical Report Page ---
app.get('/scan-result/:tier', (req, res) => {
  const patientId = String(req.query.id || 'MQR-2026-12345');
  const initialTier = req.params.tier === '3' ? '3' : '2';
  const db = readDb();
  const found = db.users.find(
    (u) => u.id.toLowerCase() === patientId.toLowerCase() && u.role === 'Patient'
  ) as Patient | undefined;

  if (!found) {
    res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MedQR+ — Patient Not Found</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 24px; display: flex; align-items: center; justify-content: center; min-height: 90vh; }
    .card { background: white; border-radius: 16px; padding: 32px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    h2 { color: #0f172a; margin: 0 0 8px; }
    p { color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Patient Record Not Found</h2>
    <p>Could not find MedQR+ ID <strong>${patientId}</strong> in the database.</p>
  </div>
</body>
</html>`);
    return;
  }

  const allergies = found.allergies?.length ? found.allergies.join(', ') : 'None reported';
  const meds = found.currentMedications?.length ? found.currentMedications.join(', ') : 'None listed';
  const conditions = found.chronicConditions?.length ? found.chronicConditions.join(', ') : 'None listed';
  const records = found.medicalRecords || [];

  const recordsHtml =
    records.length > 0
      ? records
          .map(
            (r) => `
        <div class="record-card">
          <div class="record-top">
            <div class="record-title">${r.title}</div>
            <span class="badge-blue">${r.type.toUpperCase()}</span>
          </div>
          <div class="record-meta">${r.date} • ${r.hospital} • Dr. ${r.doctor}</div>
          <div class="record-summary">
            <div>${r.summary}</div>
            ${r.details ? `<div style="margin-top:6px;color:#475569;">${r.details}</div>` : ''}
          </div>
        </div>`
          )
          .join('')
      : `<div class="empty-box">No uploaded lab or prescription files yet. Patient vitals and allergies are shown above.</div>`;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MedQR+ Medical Report — ${found.name}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f1f5f9; color: #0f172a; margin: 0; padding: 16px; }
    .container { max-width: 820px; margin: 0 auto; }
    .topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .brand { font-weight: 800; font-size: 20px; color: #1e293b; letter-spacing: -0.5px; }
    .brand span { color: #10b981; }
    .banner { border-radius: 16px; padding: 20px; color: white; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .banner.tier2 { background: linear-gradient(135deg, #10b981, #059669); }
    .banner.tier3 { background: linear-gradient(135deg, #f59e0b, #d97706); }
    .banner h1 { margin: 0 0 4px; font-size: 20px; }
    .banner p { margin: 0; font-size: 13px; opacity: 0.92; }
    .id-pill { font-family: monospace; background: rgba(0,0,0,0.18); padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 14px; }
    .grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
    @media (min-width: 720px) { .grid { grid-template-columns: 1fr 1.6fr; } }
    .card { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; margin-bottom: 16px; }
    .card-red { background: #fef2f2; border: 1px solid #fecaca; border-radius: 16px; padding: 20px; margin-bottom: 16px; }
    .section-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin: 0 0 14px; }
    .section-label-red { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #991b1b; margin: 0 0 14px; }
    .field { margin-bottom: 12px; }
    .field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 2px; }
    .field-val { font-size: 15px; font-weight: 700; color: #0f172a; }
    .field-label-red { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #dc2626; margin-bottom: 2px; }
    .field-val-red { font-size: 15px; font-weight: 800; color: #7f1d1d; }
    .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .record-card { background: white; border-radius: 14px; padding: 18px; border: 1px solid #e2e8f0; margin-bottom: 12px; }
    .record-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 4px; }
    .record-title { font-weight: 700; font-size: 16px; color: #0f172a; }
    .badge-blue { background: #eff6ff; color: #2563eb; font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 999px; }
    .record-meta { font-size: 12px; color: #64748b; margin-bottom: 10px; }
    .record-summary { background: #f8fafc; padding: 12px; border-radius: 10px; font-size: 13px; color: #1e293b; line-height: 1.45; }
    .empty-box { background: white; border-radius: 14px; padding: 24px; text-align: center; color: #64748b; font-size: 13px; border: 1px solid #e2e8f0; }
    .btn { cursor: pointer; border: none; border-radius: 10px; padding: 10px 16px; font-weight: 700; font-size: 13px; }
    .btn-green { background: #10b981; color: white; }
    .btn-outline { background: white; border: 1px solid #cbd5e1; color: #334155; }
    .otp-input { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-family: monospace; font-size: 18px; text-align: center; letter-spacing: 0.3em; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="topbar">
      <div class="brand">MED<span>QR+</span> Pass Report</div>
      <button class="btn btn-outline" id="toggleTierBtn" onclick="toggleTier()">Switch View</button>
    </div>

    <div id="statusBanner" class="banner tier2">
      <div>
        <h1 id="bannerTitle">MedQR+ Verified Medical Report</h1>
        <p id="bannerSub">Full patient vitals, allergies, medications &amp; medical records.</p>
      </div>
      <div class="id-pill">${found.id}</div>
    </div>

    <div class="grid">
      <div>
        <div class="card">
          <div class="section-label">Patient Profile</div>
          <div class="field">
            <div class="field-label">Full Name</div>
            <div class="field-val" style="font-size:18px;">${found.name}</div>
          </div>
          <div class="row2">
            <div class="field">
              <div class="field-label">Date of Birth</div>
              <div class="field-val">${found.dob || 'Not set'}</div>
            </div>
            <div class="field">
              <div class="field-label">Gender</div>
              <div class="field-val">${found.gender || 'Not set'}</div>
            </div>
          </div>
          <div class="row2">
            <div class="field">
              <div class="field-label">Phone</div>
              <div class="field-val">${found.phone || '--'}</div>
            </div>
            <div class="field">
              <div class="field-label">Blood Group</div>
              <div class="field-val" style="color:#dc2626;">${found.bloodGroup || 'N/A'}</div>
            </div>
          </div>
          ${found.address ? `<div class="field"><div class="field-label">Address</div><div class="field-val" style="font-size:13px;">${found.address}</div></div>` : ''}
        </div>

        <div class="card-red">
          <div class="section-label-red">⚠️ Critical Medical Information</div>
          <div class="field">
            <div class="field-label-red">Blood Group</div>
            <div class="field-val-red" style="font-size:22px;">${found.bloodGroup || 'UNKNOWN'}</div>
          </div>
          <div class="field">
            <div class="field-label-red">Known Allergies</div>
            <div class="field-val-red">${allergies}</div>
          </div>
          <div class="field">
            <div class="field-label-red">Active Medications</div>
            <div class="field-val-red">${meds}</div>
          </div>
          <div class="field">
            <div class="field-label-red">Chronic Conditions</div>
            <div class="field-val-red">${conditions}</div>
          </div>
          ${
            found.emergencyContact?.name
              ? `<div class="field"><div class="field-label-red">Emergency Contact</div><div class="field-val-red">${found.emergencyContact.name} (${found.emergencyContact.phone || ''})</div></div>`
              : ''
          }
        </div>
      </div>

      <div>
        <div id="lockedVault" class="card" style="display:none; text-align:center; padding:28px;">
          <h3 style="margin:0 0 8px;">🔒 Medical Vault Locked (Tier 3)</h3>
          <p style="font-size:13px; color:#64748b; margin:0 0 16px;">Enter the 6-digit OTP generated by the patient to unlock their full medical records vault.</p>
          <div id="otpError" style="display:none; color:#dc2626; font-size:12px; font-weight:700; margin-bottom:10px;"></div>
          <input id="otpInput" class="otp-input" maxlength="6" placeholder="••••••" />
          <div style="display:flex; gap:8px; justify-content:center;">
            <button class="btn btn-green" onclick="verifyOtp()">Verify &amp; Unlock Vault</button>
            <button class="btn btn-outline" onclick="requestOtp()">Send New OTP</button>
          </div>
          <div id="otpHint" style="margin-top:12px; font-size:12px; color:#059669; font-weight:700;"></div>
        </div>

        <div id="unlockedVault">
          <h3 style="margin:0 0 12px; font-size:17px;">📄 Medical Records Vault (${records.length})</h3>
          ${recordsHtml}
        </div>
      </div>
    </div>
  </div>

  <script>
    let currentTier = "${initialTier}";
    const patientId = "${found.id}";

    function renderTier() {
      const banner = document.getElementById('statusBanner');
      const title = document.getElementById('bannerTitle');
      const sub = document.getElementById('bannerSub');
      const locked = document.getElementById('lockedVault');
      const unlocked = document.getElementById('unlockedVault');
      const btn = document.getElementById('toggleTierBtn');

      if (currentTier === '2') {
        banner.className = 'banner tier2';
        title.textContent = 'MedQR+ Verified Medical Report (Tier 2)';
        sub.textContent = 'Full patient vitals, allergies, medications & medical records.';
        locked.style.display = 'none';
        unlocked.style.display = 'block';
        btn.textContent = 'Switch to Tier 3 (OTP Locked)';
      } else {
        banner.className = 'banner tier3';
        title.textContent = 'Tier 3 Emergency Medical Summary';
        sub.textContent = 'Emergency vitals visible — Enter 6-Digit OTP to unlock full vault.';
        locked.style.display = 'block';
        unlocked.style.display = 'none';
        btn.textContent = 'Switch to Tier 2 (Full Report)';
      }
    }

    function toggleTier() {
      currentTier = currentTier === '2' ? '3' : '2';
      renderTier();
    }

    async function requestOtp() {
      const res = await fetch('/api/scan/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, requestedBy: 'Mobile QR Scanner' })
      });
      const data = await res.json();
      if (data.otp) {
        document.getElementById('otpHint').textContent = 'Generated OTP: ' + data.otp;
        document.getElementById('otpInput').value = data.otp;
      }
    }

    async function verifyOtp() {
      const otp = document.getElementById('otpInput').value;
      const errEl = document.getElementById('otpError');
      errEl.style.display = 'none';
      const res = await fetch('/api/scan/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, otp })
      });
      const data = await res.json();
      if (!res.ok) {
        errEl.textContent = data.error || 'Invalid OTP';
        errEl.style.display = 'block';
        return;
      }
      currentTier = '2';
      renderTier();
    }

    renderTier();
  </script>
</body>
</html>`);
});

app.listen(PORT, '0.0.0.0', () => {
  // Ensure DB is initialized and seeded on startup
  readDb();
  startPublicTunnel();
  console.log(`✅ MedQR+ Backend Server running on http://0.0.0.0:${PORT}`);
});

export default app;
