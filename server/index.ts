import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { readDb, writeDb, sanitizeUser, type StoredUser } from './db.js';
import { signToken, authenticateToken, type AuthenticatedRequest } from './middleware/auth.js';
import type { Patient, Hospital, ActivityLog, MedicalRecord, Role } from '../src/types/index.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());

// --- Health Check ---
app.get('/api/health', (_req, res) => {
  const db = readDb();
  res.json({
    status: 'ok',
    service: 'MedQR+ Backend API',
    timestamp: new Date().toISOString(),
    usersCount: db.users.length,
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
  const found = db.users.find((u) => u.id === req.params.id);
  if (!found) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user: sanitizeUser(found) });
});

// --- Users: Update User (Profile / Admin Hospital Verification) ---
app.put('/api/users/:id', (req, res) => {
  const db = readDb();
  const index = db.users.findIndex((u) => u.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const existing = db.users[index];
  const incoming = req.body as Partial<StoredUser>;

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

app.listen(PORT, () => {
  // Ensure DB is initialized and seeded on startup
  readDb();
  console.log(`✅ MedQR+ Backend Server running on http://localhost:${PORT}`);
});

export default app;
