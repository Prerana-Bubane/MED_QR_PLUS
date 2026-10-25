import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import os from 'os';
import { spawn, type ChildProcess } from 'child_process';
import {
  runInTransaction,
  getUserById,
  getUserByLogin,
  userEmailExists,
  userIdExists,
  getAllUsers,
  getUsersCount,
  insertUser,
  saveUser,
  getOtpCode,
  upsertOtpCode,
  incrementOtpAttempts,
  deleteOtpCode,
  sanitizeUser,
  type StoredUser,
} from './db.js';
import {
  signToken,
  signVaultToken,
  verifyVaultToken,
  authenticateToken,
  type AuthenticatedRequest,
} from './middleware/auth.js';
import {
  loginRateLimiter,
  registerRateLimiter,
  otpRequestRateLimiter,
  otpVerifyRateLimiter,
  otpStatusRateLimiter,
} from './middleware/rateLimit.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  userIdParamSchema,
  patientIdParamSchema,
  deleteRecordParamSchema,
  scanResultParamSchema,
  scanResultQuerySchema,
  loginBodySchema,
  registerPatientBodySchema,
  registerHospitalBodySchema,
  updateUserBodySchema,
  addMedicalRecordBodySchema,
  logActivityBodySchema,
  requestOtpBodySchema,
  verifyOtpBodySchema,
  aiChatBodySchema,
} from './validation.js';
import type { Patient, Hospital, ActivityLog, MedicalRecord } from '../src/types/index.js';

const app = express();
const PORT = Number(process.env.PORT) || 5000;

const ALLOWED_ORIGINS = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin / non-browser requests (no Origin header) or explicitly whitelisted frontend origins
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-vault-token'],
    credentials: true,
  })
);
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

// Public SSH tunnel is strictly opt-in for local mobile testing (ENABLE_PUBLIC_TUNNEL=true) and never runs in production
const isTunnelOptIn =
  process.env.ENABLE_PUBLIC_TUNNEL === 'true' && process.env.NODE_ENV !== 'production';
let publicTunnelUrl: string | null = null;
let tunnelProc: ChildProcess | null = null;
let tunnelDisabled = !isTunnelOptIn;
let tunnelRetryCount = 0;
const MAX_TUNNEL_RETRIES = 3;

const startPublicTunnel = () => {
  if (tunnelProc || tunnelDisabled) return;
  try {
    const proc = spawn(
      'ssh',
      [
        '-o',
        'StrictHostKeyChecking=accept-new',
        '-o',
        'ServerAliveInterval=30',
        '-R',
        `80:127.0.0.1:${PORT}`,
        'nokey@localhost.run',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    tunnelProc = proc;

    const handleOutput = (chunk: Buffer) => {
      const text = chunk.toString();
      const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.lhr\.life/);
      if (match) {
        publicTunnelUrl = match[0];
        tunnelRetryCount = 0; // Reset retry counter on successful connection
        console.log(`🌐 Public Mobile+WiFi Tunnel active: ${publicTunnelUrl}`);
      }
    };

    proc.stdout?.on('data', handleOutput);
    proc.stderr?.on('data', handleOutput);

    proc.on('error', (err: NodeJS.ErrnoException) => {
      tunnelDisabled = true;
      tunnelProc = null;
      publicTunnelUrl = null;
      console.warn(
        `⚠️ SSH tunnel unavailable (${err.code || err.message}). Running without public SSH tunnel.`
      );
    });

    proc.on('exit', () => {
      tunnelProc = null;
      publicTunnelUrl = null;
      if (tunnelDisabled) return;

      tunnelRetryCount += 1;
      if (tunnelRetryCount > MAX_TUNNEL_RETRIES) {
        tunnelDisabled = true;
        console.warn(
          `⚠️ SSH tunnel exited ${MAX_TUNNEL_RETRIES} times consecutively. Disabling automatic tunnel restarts.`
        );
        return;
      }

      const backoffMs = 5000 * Math.pow(2, tunnelRetryCount - 1);
      setTimeout(startPublicTunnel, backoffMs);
    });
  } catch (err) {
    tunnelDisabled = true;
    tunnelProc = null;
    publicTunnelUrl = null;
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
  const lanIp = getLocalNetworkIp();
  res.json({
    status: 'ok',
    service: 'MedQR+ Backend API (SQLite)',
    timestamp: new Date().toISOString(),
    usersCount: getUsersCount(),
    lanIp,
    lanUrl: lanIp ? `http://${lanIp}:${PORT}` : null,
    publicUrl: publicTunnelUrl,
  });
});

// --- Auth: Login (Strict Backend Password Verification — No Demo Bypasses) ---
app.post('/api/auth/login', loginRateLimiter, validateBody(loginBodySchema), (req, res) => {
  const { email, password, role } = req.body as {
    email: string;
    password: string;
    role: 'Patient' | 'Hospital' | 'Admin';
  };

  const foundUser = getUserByLogin(email, role);

  if (!foundUser || typeof foundUser.passwordHash !== 'string' || !foundUser.passwordHash) {
    res.status(401).json({ error: 'Invalid credentials or account does not exist.' });
    return;
  }

  const isMatch = bcrypt.compareSync(password, foundUser.passwordHash);
  if (!isMatch) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const safeUser = sanitizeUser(foundUser);
  const token = signToken({ id: safeUser.id, email: safeUser.email, role: safeUser.role });

  res.json({ token, user: safeUser });
});

const generateUniqueUserId = (prefix: string, digits = 5): string => {
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits);
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = `${prefix}-${crypto.randomInt(min, max)}`;
    if (!userIdExists(candidate)) {
      return candidate;
    }
  }
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
};

// --- Auth: Register Patient ---
app.post('/api/auth/register/patient', registerRateLimiter, validateBody(registerPatientBodySchema), (req, res) => {
  const data = req.body as Omit<Partial<Patient>, 'id' | 'role'> & { password: string; name: string; email: string };
  const passwordHash = bcrypt.hashSync(data.password, 10);

  const createdPatient = runInTransaction(() => {
    if (userEmailExists(data.email)) {
      return null;
    }
    const newId = generateUniqueUserId(`MQR-${new Date().getFullYear()}`, 5);
    const newPatient: StoredUser = {
      id: newId,
      role: 'Patient',
      name: data.name.trim(),
      email: data.email.trim(),
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
    insertUser(newPatient);
    return newPatient;
  });

  if (!createdPatient) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const safeUser = sanitizeUser(createdPatient);
  const token = signToken({ id: safeUser.id, email: safeUser.email, role: safeUser.role });

  res.status(201).json({ token, user: safeUser });
});

// --- Auth: Register Hospital ---
app.post('/api/auth/register/hospital', registerRateLimiter, validateBody(registerHospitalBodySchema), (req, res) => {
  const data = req.body as Omit<Partial<Hospital>, 'id' | 'role'> & { password: string; name: string; email: string };
  const passwordHash = bcrypt.hashSync(data.password, 10);

  const createdHospital = runInTransaction(() => {
    if (userEmailExists(data.email)) {
      return null;
    }
    const newId = generateUniqueUserId('HOSP', 4);
    const newHospital: StoredUser = {
      id: newId,
      role: 'Hospital',
      name: data.name.trim(),
      email: data.email.trim(),
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
    insertUser(newHospital);
    return newHospital;
  });

  if (!createdHospital) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const safeUser = sanitizeUser(createdHospital);
  const token = signToken({ id: safeUser.id, email: safeUser.email, role: safeUser.role });

  res.status(201).json({ token, user: safeUser });
});

// --- Auth: Current User ---
app.get('/api/auth/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  const found = req.user?.id ? getUserById(req.user.id) : undefined;
  if (!found) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user: sanitizeUser(found) });
});

// --- Users: Get All Users (Admin Only — Patient Medical Data Redacted) ---
app.get('/api/users', authenticateToken, (req: AuthenticatedRequest, res) => {
  if (req.user?.role !== 'Admin') {
    res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    return;
  }

  const directoryUsers = getAllUsers().map((u) => {
    const safe = sanitizeUser(u);
    if (safe.role === 'Patient') {
      // Redact confidential patient medical data from bulk directory listings
      return {
        id: safe.id,
        role: safe.role,
        name: safe.name,
        email: safe.email,
        phone: safe.phone,
        issuingHospital: safe.issuingHospital,
      };
    }
    return safe;
  });

  res.json({ users: directoryUsers });
});

const toTier3PatientSummary = (patient: Patient): Partial<Patient> => ({
  id: patient.id,
  role: 'Patient',
  name: patient.name,
  dob: patient.dob,
  gender: patient.gender,
  bloodGroup: patient.bloodGroup,
  allergies: patient.allergies || [],
  chronicConditions: patient.chronicConditions || [],
  currentMedications: patient.currentMedications || [],
  emergencyContact: patient.emergencyContact,
  issuingHospital: patient.issuingHospital,
  medicalRecords: [],
});

// --- Users: Get User by ID (Authenticated & Server-Enforced Tier Locking) ---
app.get(
  '/api/users/:id',
  authenticateToken,
  validateParams(userIdParamSchema),
  (req: AuthenticatedRequest, res) => {
    const found = getUserById(req.params.id);
    if (!found) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const requester = req.user!;
    const isSelf = requester.id.toLowerCase() === found.id.toLowerCase();

    if (requester.role === 'Patient' && !isSelf) {
      res.status(403).json({ error: 'Access denied. Patients can only view their own profile.' });
      return;
    }

    if (requester.role === 'Hospital' && !isSelf) {
      const callerUser = getUserById(requester.id);
      const callerHospital = callerUser?.role === 'Hospital' ? (callerUser as Hospital) : undefined;

      if (!callerHospital?.verified) {
        res.status(403).json({ error: 'Access denied. Hospital account must be verified by an Admin.' });
        return;
      }

      if (found.role !== 'Patient') {
        res.status(403).json({ error: 'Access denied.' });
        return;
      }
    }

    if (found.role === 'Patient' && !isSelf) {
      const headerVaultToken =
        typeof req.headers['x-vault-token'] === 'string' ? req.headers['x-vault-token'] : undefined;
      const queryVaultToken =
        typeof req.query.vaultToken === 'string' ? req.query.vaultToken : undefined;
      const isVaultUnlocked = verifyVaultToken(headerVaultToken || queryVaultToken, found.id);

      if (!isVaultUnlocked) {
        res.json({
          user: toTier3PatientSummary(found as Patient),
          accessTier: '3',
          tierLocked: true,
        });
        return;
      }
    }

    res.json({
      user: sanitizeUser(found),
      accessTier: '2',
      tierLocked: false,
    });
  }
);

// --- Users: Update User (Authenticated Owner or Admin Only) ---
app.put(
  '/api/users/:id',
  authenticateToken,
  validateParams(userIdParamSchema),
  validateBody(updateUserBodySchema),
  (req: AuthenticatedRequest, res) => {
    const incoming = req.body as Partial<StoredUser>;
    const requester = req.user!;
    const isAdmin = requester.role === 'Admin';

    const outcome = runInTransaction(() => {
      const existing = getUserById(req.params.id);
      if (!existing) {
        return { status: 404 as const, error: 'User not found' };
      }

      const isSelf = requester.id.toLowerCase() === existing.id.toLowerCase();
      if (!isSelf && !isAdmin) {
        return { status: 403 as const, error: 'Access denied. You can only update your own profile.' };
      }

      const updated: StoredUser = {
        ...existing,
        ...incoming,
        id: existing.id,
        role: existing.role,
        passwordHash: existing.passwordHash,
      } as StoredUser;

      if (existing.role === 'Patient') {
        (updated as Patient).medicalRecords = existing.medicalRecords || [];
        (updated as Patient).activityLog = existing.activityLog || [];
      } else if (existing.role === 'Hospital') {
        (updated as Hospital).patientsAccessed = existing.patientsAccessed || [];
        (updated as Hospital).scanLogs = existing.scanLogs || [];
        if (!isAdmin) {
          (updated as Hospital).verified = existing.verified;
          (updated as Hospital).status = existing.status;
        }
      }

      saveUser(updated);
      return { status: 200 as const, user: updated };
    });

    if (outcome.status !== 200) {
      res.status(outcome.status).json({ error: outcome.error });
      return;
    }

    res.json({ user: sanitizeUser(outcome.user) });
  }
);

// --- Medical Records: Add Record (Authenticated Patient Owner Only) ---
app.post(
  '/api/users/:id/records',
  authenticateToken,
  validateParams(userIdParamSchema),
  validateBody(addMedicalRecordBodySchema),
  (req: AuthenticatedRequest, res) => {
    const recordInput = req.body as Omit<MedicalRecord, 'id'>;

    const outcome = runInTransaction(() => {
      const found = getUserById(req.params.id);
      if (!found || found.role !== 'Patient') {
        return { status: 404 as const, error: 'Patient not found' };
      }

      const patient = found as Patient & { passwordHash?: string };
      if (req.user?.id.toLowerCase() !== patient.id.toLowerCase()) {
        return {
          status: 403 as const,
          error: 'Access denied. You can only add records to your own medical vault.',
        };
      }

      const newRecord: MedicalRecord = {
        id: crypto.randomUUID(),
        type: recordInput.type,
        title: recordInput.title,
        doctor: recordInput.doctor,
        hospital: recordInput.hospital,
        date: recordInput.date,
        summary: recordInput.summary,
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
      saveUser(patient);

      return { status: 201 as const, record: newRecord, user: patient };
    });

    if (outcome.status !== 201) {
      res.status(outcome.status).json({ error: outcome.error });
      return;
    }

    res.status(201).json({ record: outcome.record, user: sanitizeUser(outcome.user) });
  }
);

// --- Medical Records: Delete Record (Authenticated Patient Owner Only) ---
app.delete(
  '/api/users/:id/records/:recordId',
  authenticateToken,
  validateParams(deleteRecordParamSchema),
  (req: AuthenticatedRequest, res) => {
    const outcome = runInTransaction(() => {
      const found = getUserById(req.params.id);
      if (!found || found.role !== 'Patient') {
        return { status: 404 as const, error: 'Patient not found' };
      }

      const patient = found as Patient & { passwordHash?: string };
      if (req.user?.id.toLowerCase() !== patient.id.toLowerCase()) {
        return {
          status: 403 as const,
          error: 'Access denied. You can only delete records from your own medical vault.',
        };
      }

      patient.medicalRecords = (patient.medicalRecords || []).filter(
        (r) => r.id !== req.params.recordId
      );
      saveUser(patient);
      return { status: 200 as const, user: patient };
    });

    if (outcome.status !== 200) {
      res.status(outcome.status).json({ error: outcome.error });
      return;
    }

    res.json({ user: sanitizeUser(outcome.user) });
  }
);

// --- Activity & Scan Logging (Authenticated Owner Only) ---
app.post(
  '/api/users/:id/activity',
  authenticateToken,
  validateParams(userIdParamSchema),
  validateBody(logActivityBodySchema),
  (req: AuthenticatedRequest, res) => {
    const { type, details, extra, scannedPatientId } = req.body as {
      type: ActivityLog['type'];
      details: string;
      extra?: Partial<ActivityLog>;
      scannedPatientId?: string;
    };

    const outcome = runInTransaction(() => {
      const targetUser = getUserById(req.params.id);
      if (!targetUser) {
        return { status: 404 as const, error: 'User not found' };
      }

      if (req.user?.id.toLowerCase() !== targetUser.id.toLowerCase()) {
        return {
          status: 403 as const,
          error: 'Access denied. You can only log activity for your own account.',
        };
      }

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

        if (scannedPatientId) {
          const foundPatient = getUserById(scannedPatientId);
          if (foundPatient && foundPatient.role === 'Patient') {
            const scannedPatient = foundPatient as Patient & { passwordHash?: string };
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
            saveUser(scannedPatient);
          }
        }
      }

      saveUser(targetUser);
      return { status: 201 as const, log: newLog, user: targetUser };
    });

    if (outcome.status !== 201) {
      res.status(outcome.status).json({ error: outcome.error });
      return;
    }

    res.status(201).json({ log: outcome.log, user: sanitizeUser(outcome.user) });
  }
);

// --- Scan OTP Generation, Status & Verification (Rate-Limited & Brute-Force Protected) ---
const OTP_VERIFY_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_OTP_ATTEMPTS = 5;
const OTP_REQUEST_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_OTP_REQUESTS = 5;

const otpVerifyRateMap = new Map<string, { count: number; resetAt: number }>();
const otpRequestRateMap = new Map<string, { count: number; resetAt: number }>();

const checkRateLimit = (
  map: Map<string, { count: number; resetAt: number }>,
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } => {
  const now = Date.now();
  const entry = map.get(key);
  if (!entry || entry.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { allowed: true, retryAfterSec: 0 };
};

app.post(
  '/api/scan/request-otp',
  otpRequestRateLimiter,
  authenticateToken,
  validateBody(requestOtpBodySchema),
  (req: AuthenticatedRequest, res) => {
    const { patientId, requestedBy } = req.body as { patientId: string; requestedBy?: string };
    const normalizedPatientId = patientId.trim();
    const requester = req.user!;
    const isPatientSelf =
      requester.role === 'Patient' && requester.id.toLowerCase() === normalizedPatientId.toLowerCase();
    const isHospital = requester.role === 'Hospital';

    if (!isPatientSelf && !isHospital) {
      res.status(403).json({ error: 'Access denied. Only the patient or an authorized hospital can request an OTP.' });
      return;
    }

    const rateKey = `${req.ip || 'unknown'}:${normalizedPatientId.toLowerCase()}`;
    const rateCheck = checkRateLimit(otpRequestRateMap, rateKey, MAX_OTP_REQUESTS, OTP_REQUEST_WINDOW_MS);
    if (!rateCheck.allowed) {
      res.setHeader('Retry-After', String(rateCheck.retryAfterSec));
      res.status(429).json({
        error: `Too many OTP requests. Please wait ${rateCheck.retryAfterSec} seconds before requesting another code.`,
      });
      return;
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

    const created = runInTransaction(() => {
      const found = getUserById(normalizedPatientId);
      if (!found || found.role !== 'Patient') {
        return false;
      }
      const patient = found as Patient & { passwordHash?: string };
      upsertOtpCode(patient.id, {
        code,
        expiresAt,
        attempts: 0,
      });

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
      saveUser(patient);
      return true;
    });

    if (!created) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    // Reset verification lockout for this patient when a fresh OTP is legitimately generated by the patient
    if (isPatientSelf) {
      otpVerifyRateMap.delete(rateKey);
    }

    // Never expose otp or demoOtp in POST /api/scan/request-otp response
    res.json({
      message: '6-digit OTP generated. The patient can view the active code on their authenticated QR Pass.',
      expiresAt,
    });
  }
);

app.get(
  '/api/scan/otp/:patientId',
  otpStatusRateLimiter,
  authenticateToken,
  validateParams(patientIdParamSchema),
  (req: AuthenticatedRequest, res) => {
    if (
      req.user?.role !== 'Patient' ||
      req.user.id.toLowerCase() !== req.params.patientId.toLowerCase()
    ) {
      res.status(403).json({ error: 'Access denied. Only the authenticated patient can view their active OTP.' });
      return;
    }

    const stored = getOtpCode(req.params.patientId);

    if (!stored || stored.expiresAt <= Date.now()) {
      res.json({ active: false });
      return;
    }
    res.json({
      active: true,
      otp: stored.code,
      expiresAt: stored.expiresAt,
    });
  }
);

app.post(
  '/api/scan/verify-otp',
  otpVerifyRateLimiter,
  authenticateToken,
  validateBody(verifyOtpBodySchema),
  (req: AuthenticatedRequest, res) => {
    const { patientId, otp } = req.body as { patientId: string; otp: string };

    const normalizedPatientId = patientId.trim();
    const rateKey = `${req.ip || 'unknown'}:${normalizedPatientId.toLowerCase()}`;
    const rateCheck = checkRateLimit(otpVerifyRateMap, rateKey, MAX_OTP_ATTEMPTS, OTP_VERIFY_WINDOW_MS);
    if (!rateCheck.allowed) {
      res.setHeader('Retry-After', String(rateCheck.retryAfterSec));
      res.status(429).json({
        error: `Too many OTP verification attempts. Locked for ${rateCheck.retryAfterSec} seconds.`,
      });
      return;
    }

    const cleanOtp = otp.trim();

    const outcome = runInTransaction(() => {
      const foundPatient = getUserById(normalizedPatientId);
      const canonicalId =
        foundPatient && foundPatient.role === 'Patient' ? foundPatient.id : normalizedPatientId;
      const stored = getOtpCode(canonicalId);

      if (!stored || stored.expiresAt <= Date.now()) {
        if (stored) {
          deleteOtpCode(canonicalId);
        }
        return {
          status: 400 as const,
          error: 'OTP has expired or was not requested. Please generate a new OTP.',
        };
      }

      const currentAttempts = (stored.attempts || 0) + 1;
      const storedBuf = Buffer.from(stored.code, 'utf-8');
      const inputBuf = Buffer.from(cleanOtp, 'utf-8');
      const isValidOtp =
        storedBuf.length === inputBuf.length && crypto.timingSafeEqual(storedBuf, inputBuf);

      if (!isValidOtp) {
        if (currentAttempts >= MAX_OTP_ATTEMPTS) {
          deleteOtpCode(canonicalId);
          return {
            status: 429 as const,
            error:
              'Maximum failed OTP attempts exceeded. This OTP has been invalidated; please generate a new code.',
          };
        }

        incrementOtpAttempts(canonicalId, currentAttempts);
        return {
          status: 400 as const,
          error: `Invalid 6-digit OTP code (${MAX_OTP_ATTEMPTS - currentAttempts} attempt(s) remaining).`,
        };
      }

      // Consume one-time code and log successful Tier 2 unlock for both patient and hospital audit log
      deleteOtpCode(canonicalId);

      const nowIso = new Date().toISOString();
      let auditLogged = false;
      const callerUser = req.user?.id ? getUserById(req.user.id) : undefined;
      const callerHospital =
        callerUser && callerUser.role === 'Hospital'
          ? (callerUser as Hospital & { passwordHash?: string })
          : undefined;

      if (foundPatient && foundPatient.role === 'Patient') {
        const patient = foundPatient as Patient & { passwordHash?: string };
        patient.activityLog = [
          {
            id: crypto.randomUUID(),
            type: 'tier_scan',
            date: nowIso,
            details: callerHospital
              ? `Tier 2 Full Medical Vault unlocked by ${callerHospital.name} via 6-digit OTP verification`
              : 'Tier 2 Full Medical Vault unlocked via 6-digit OTP verification',
            hospitalName: callerHospital?.name,
            department: callerHospital?.department,
            accessTier: 'Tier 2',
            reason: 'OTP Verified Clinical Access',
          },
          ...(patient.activityLog || []),
        ];
        saveUser(patient);

        if (callerHospital) {
          const hospitalLog: ActivityLog = {
            id: crypto.randomUUID(),
            type: 'tier_scan',
            date: nowIso,
            details: `Unlocked Tier 2 full records for ${patient.name} (${patient.id}) via OTP`,
            hospitalName: callerHospital.name,
            department: callerHospital.department,
            accessTier: 'Tier 2',
            reason: 'OTP Verified Clinical Access',
          };
          callerHospital.scanLogs = [hospitalLog, ...(callerHospital.scanLogs || [])];
          callerHospital.patientsAccessed = [
            {
              patientId: patient.id,
              patientName: patient.name,
              scanDate: nowIso,
              accessTier: 'Tier 2',
              reason: 'OTP Verified Clinical Access',
            },
            ...(callerHospital.patientsAccessed || []),
          ];
          saveUser(callerHospital);
          auditLogged = true;
        }
      }

      return { status: 200 as const, canonicalId, auditLogged };
    });

    if (outcome.status !== 200) {
      res.status(outcome.status).json({ error: outcome.error });
      return;
    }

    otpVerifyRateMap.delete(rateKey);
    const vaultToken = signVaultToken(outcome.canonicalId);
    res.json({ verified: true, accessTier: '2', vaultToken, auditLogged: outcome.auditLogged });
  }
);

// --- AI Health Coach & Clinical Assistant Endpoint ---
app.post(
  '/api/ai/chat',
  authenticateToken,
  validateBody(aiChatBodySchema),
  (req: AuthenticatedRequest, res) => {
    const { message } = req.body as { message: string };

    const currentUser = req.user?.id ? getUserById(req.user.id) : undefined;
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
  }
);

const escapeHtml = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// --- Instant Mobile & Wi-Fi QR Scan Medical Report Page (Server-Enforced Tier Locking & XSS-Safe) ---
app.get('/scan-result', validateQuery(scanResultQuerySchema), (_req, res) => {
  res.status(400).json({ error: 'Tier parameter (/scan-result/:tier) and patient ID (?id=...) are required.' });
});

app.get(
  '/scan-result/:tier',
  validateParams(scanResultParamSchema),
  validateQuery(scanResultQuerySchema),
  (req, res) => {
    const patientId = typeof req.query.id === 'string' ? req.query.id.trim() : '';
    if (!patientId) {
      res.status(400).json({ error: 'Patient ID query parameter (?id=...) is required.' });
      return;
    }
    const foundUser = getUserById(patientId);
    const found = foundUser?.role === 'Patient' ? (foundUser as Patient) : undefined;

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
    <p>Could not find MedQR+ ID <strong>${escapeHtml(patientId)}</strong> in the database.</p>
  </div>
</body>
</html>`);
    return;
  }

  // Server-enforced Tier-2 check: Only unlock if a valid signed vaultToken for this patient is provided
  const queryVaultToken =
    typeof req.query.vaultToken === 'string' ? req.query.vaultToken : undefined;
  const headerVaultToken =
    typeof req.headers['x-vault-token'] === 'string' ? req.headers['x-vault-token'] : undefined;
  const isVaultUnlocked = verifyVaultToken(queryVaultToken || headerVaultToken, found.id);

  const safeId = escapeHtml(found.id);
  const safeName = escapeHtml(found.name);
  const safeDob = escapeHtml(found.dob || 'Not set');
  const safeGender = escapeHtml(found.gender || 'Not set');
  const safePhone = escapeHtml(found.phone || '--');
  const safeBloodGroup = escapeHtml(found.bloodGroup || 'N/A');
  const safeBloodGroupAlert = escapeHtml(found.bloodGroup || 'UNKNOWN');
  const safeAddress = found.address ? escapeHtml(found.address) : '';
  const allergies = found.allergies?.length
    ? escapeHtml(found.allergies.join(', '))
    : 'None reported';
  const meds = found.currentMedications?.length
    ? escapeHtml(found.currentMedications.join(', '))
    : 'None listed';
  const conditions = found.chronicConditions?.length
    ? escapeHtml(found.chronicConditions.join(', '))
    : 'None listed';
  const safeEmergencyName = found.emergencyContact?.name
    ? escapeHtml(found.emergencyContact.name)
    : '';
  const safeEmergencyPhone = found.emergencyContact?.phone
    ? escapeHtml(found.emergencyContact.phone)
    : '';

  // Only build and embed medical records HTML on the server when isVaultUnlocked === true
  const rightColumnHtml = isVaultUnlocked
    ? (() => {
        const records = found.medicalRecords || [];
        const recordsHtml =
          records.length > 0
            ? records
                .map(
                  (r) => `
        <div class="record-card">
          <div class="record-top">
            <div class="record-title">${escapeHtml(r.title)}</div>
            <span class="badge-blue">${escapeHtml((r.type || '').toUpperCase())}</span>
          </div>
          <div class="record-meta">${escapeHtml(r.date)} • ${escapeHtml(r.hospital)} • Dr. ${escapeHtml(r.doctor)}</div>
          <div class="record-summary">
            <div>${escapeHtml(r.summary)}</div>
            ${r.details ? `<div style="margin-top:6px;color:#475569;">${escapeHtml(r.details)}</div>` : ''}
          </div>
        </div>`
                )
                .join('')
            : `<div class="empty-box">No uploaded lab or prescription files yet. Patient vitals and allergies are shown above.</div>`;

        return `<div id="unlockedVault">
          <h3 style="margin:0 0 12px; font-size:17px;">📄 Medical Records Vault (${records.length})</h3>
          ${recordsHtml}
        </div>`;
      })()
    : `<div id="lockedVault" class="card" style="text-align:center; padding:28px;">
          <h3 style="margin:0 0 8px;">🔒 Medical Vault Locked (Tier 3)</h3>
          <p style="font-size:13px; color:#64748b; margin:0 0 16px;">Full medical records are withheld by the server. Enter the 6-digit OTP generated by the patient to unlock Tier 2 access.</p>
          <div id="otpError" style="display:none; color:#dc2626; font-size:12px; font-weight:700; margin-bottom:10px;"></div>
          <input id="otpInput" class="otp-input" maxlength="6" placeholder="••••••" />
          <div style="display:flex; gap:8px; justify-content:center;">
            <button class="btn btn-green" onclick="verifyOtp()">Verify &amp; Unlock Vault</button>
          </div>
          <div id="otpHint" style="margin-top:12px; font-size:12px; color:#059669; font-weight:700;"></div>
        </div>`;

  const bannerClass = isVaultUnlocked ? 'banner tier2' : 'banner tier3';
  const bannerTitle = isVaultUnlocked
    ? 'MedQR+ Verified Medical Report (Tier 2)'
    : 'Tier 3 Emergency Medical Summary';
  const bannerSub = isVaultUnlocked
    ? 'OTP Verified — Full patient vitals, allergies, medications &amp; medical records.'
    : 'Emergency vitals visible — Medical Records Vault is locked on the server.';

  const safeJsPatientId = JSON.stringify(found.id).replace(/</g, '\\u003c');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MedQR+ Medical Report — ${safeName}</title>
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
    </div>

    <div id="statusBanner" class="${bannerClass}">
      <div>
        <h1 id="bannerTitle">${bannerTitle}</h1>
        <p id="bannerSub">${bannerSub}</p>
      </div>
      <div class="id-pill">${safeId}</div>
    </div>

    <div class="grid">
      <div>
        <div class="card">
          <div class="section-label">Patient Profile</div>
          <div class="field">
            <div class="field-label">Full Name</div>
            <div class="field-val" style="font-size:18px;">${safeName}</div>
          </div>
          <div class="row2">
            <div class="field">
              <div class="field-label">Date of Birth</div>
              <div class="field-val">${safeDob}</div>
            </div>
            <div class="field">
              <div class="field-label">Gender</div>
              <div class="field-val">${safeGender}</div>
            </div>
          </div>
          ${
            isVaultUnlocked
              ? `<div class="row2">
            <div class="field">
              <div class="field-label">Phone</div>
              <div class="field-val">${safePhone}</div>
            </div>
            <div class="field">
              <div class="field-label">Blood Group</div>
              <div class="field-val" style="color:#dc2626;">${safeBloodGroup}</div>
            </div>
          </div>
          ${safeAddress ? `<div class="field"><div class="field-label">Address</div><div class="field-val" style="font-size:13px;">${safeAddress}</div></div>` : ''}`
              : ''
          }
        </div>

        <div class="card-red">
          <div class="section-label-red">⚠️ Critical Medical Information</div>
          <div class="field">
            <div class="field-label-red">Blood Group</div>
            <div class="field-val-red" style="font-size:22px;">${safeBloodGroupAlert}</div>
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
            safeEmergencyName
              ? `<div class="field"><div class="field-label-red">Emergency Contact</div><div class="field-val-red">${safeEmergencyName} (${safeEmergencyPhone})</div></div>`
              : ''
          }
        </div>
      </div>

      <div>
        ${rightColumnHtml}
      </div>
    </div>
  </div>

  <script>
    const patientId = ${safeJsPatientId};

    async function verifyOtp() {
      const otpInput = document.getElementById('otpInput');
      const errEl = document.getElementById('otpError');
      if (!otpInput || !errEl) return;
      const otp = otpInput.value;
      errEl.style.display = 'none';
      const token = localStorage.getItem('medqr_token');
      const headers = token
        ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
        : { 'Content-Type': 'application/json' };
      const res = await fetch('/api/scan/verify-otp', {
        method: 'POST',
        headers,
        body: JSON.stringify({ patientId, otp })
      });
      const data = await res.json();
      if (!res.ok || !data.vaultToken) {
        errEl.textContent = data.error || 'Invalid OTP or authentication required';
        errEl.style.display = 'block';
        return;
      }
      if (!data.auditLogged && token) {
        try {
          const meRes = await fetch('/api/auth/me', { headers });
          if (meRes.ok) {
            const meData = await meRes.json();
            if (meData.user && meData.user.role === 'Hospital') {
              await fetch('/api/users/' + encodeURIComponent(meData.user.id) + '/activity', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  type: 'tier_scan',
                  details: 'Unlocked Tier 2 full records for ' + patientId + ' via OTP',
                  extra: { accessTier: 'Tier 2', reason: 'OTP Verified Clinical Access' },
                  scannedPatientId: patientId
                })
              });
            }
          }
        } catch (e) {
          // Ignore fallback logging error before redirect
        }
      }
      window.location.href = '/scan-result/2?id=' + encodeURIComponent(patientId) + '&vaultToken=' + encodeURIComponent(data.vaultToken);
    }
  </script>
</body>
</html>`);
});

app.listen(PORT, '0.0.0.0', () => {
  if (isTunnelOptIn) {
    startPublicTunnel();
  }
  console.log(`✅ MedQR+ Backend Server running on http://0.0.0.0:${PORT} (SQLite: ${getUsersCount()} users)`);
});

export default app;
