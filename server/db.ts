import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { User, Patient, Hospital, Admin } from '../src/types/index.js';
import {
  encryptUserForDisk,
  decryptUserFromDisk,
  type DiskUserRecord,
} from './crypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data');

export const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.join(DATA_DIR, 'medqr.sqlite');

const LEGACY_JSON_FILE = process.env.DB_FILE_PATH
  ? path.resolve(process.env.DB_FILE_PATH)
  : path.join(DATA_DIR, 'database.json');

export type StoredUser = User & {
  passwordHash?: string;
};

export interface OtpRecord {
  code: string;
  expiresAt: number;
  attempts: number;
}

interface LegacyDiskDatabaseSchema {
  encryptionVersion?: number;
  users?: DiskUserRecord[];
  otpCodes?: Record<string, { code: string; expiresAt: number; attempts?: number }>;
}

const getSeedPasswordHash = (envKey: string): string => {
  const fromEnv = process.env[envKey]?.trim();
  const rawPassword =
    fromEnv && fromEnv.length >= 8 && fromEnv !== 'password123'
      ? fromEnv
      : crypto.randomBytes(16).toString('base64url');
  return bcrypt.hashSync(rawPassword, 10);
};

const getInitialSeedUsers = (): StoredUser[] => {
  const adminPasswordHash = getSeedPasswordHash('SEED_ADMIN_PASSWORD');
  const hospitalPasswordHash = getSeedPasswordHash('SEED_HOSPITAL_PASSWORD');
  const patientPasswordHash = getSeedPasswordHash('SEED_PATIENT_PASSWORD');

  const admin: Admin & { passwordHash: string } = {
    id: 'ADMIN-001',
    role: 'Admin',
    name: 'System Admin',
    email: 'admin@medqr.com',
    phone: '123-456-7890',
    passwordHash: adminPasswordHash,
  };

  const dummyHospital: Hospital & { passwordHash: string } = {
    id: 'HOSP-001',
    role: 'Hospital',
    name: 'City General Hospital',
    email: 'contact@citygeneral.com',
    phone: '555-0100',
    licenseNumber: 'LIC-998877',
    address: '123 Health Ave, Metro City',
    contactPerson: 'Dr. Sarah Jenkins',
    department: 'Emergency',
    verified: true,
    status: 'verified',
    patientsAccessed: [
      {
        patientId: 'MQR-2026-12345',
        patientName: 'John Doe',
        scanDate: new Date(Date.now() - 86400000).toISOString(),
        accessTier: 'Tier 2',
        reason: 'Routine Emergency Checkup',
      },
    ],
    scanLogs: [
      {
        id: crypto.randomUUID(),
        type: 'tier_scan',
        date: new Date(Date.now() - 86400000).toISOString(),
        details: 'Scanned patient John Doe (MQR-2026-12345)',
        hospitalName: 'City General Hospital',
        department: 'Emergency',
        accessTier: 'Tier 2',
        reason: 'Routine Emergency Checkup',
      },
    ],
    passwordHash: hospitalPasswordHash,
  };

  const dummyPatient: Patient & { passwordHash: string } = {
    id: 'MQR-2026-12345',
    role: 'Patient',
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '555-0200',
    dob: '1985-04-12',
    gender: 'Male',
    bloodGroup: 'O+',
    height: '180 cm',
    weight: '75 kg',
    address: '456 Residential St, Metro City',
    allergies: ['Penicillin', 'Peanuts'],
    chronicConditions: ['Asthma'],
    currentMedications: ['Albuterol Inhaler'],
    issuingHospital: 'City General Hospital',
    emergencyContact: {
      name: 'Jane Doe',
      relation: 'Spouse',
      phone: '555-0201',
    },
    insurance: {
      provider: 'HealthGuard Plus',
      policy: 'HG-88776655',
      validUntil: '2027-12-31',
    },
    medicalRecords: [
      {
        id: crypto.randomUUID(),
        type: 'lab',
        title: 'Comprehensive Metabolic Panel',
        doctor: 'Sarah Jenkins',
        hospital: 'City General Hospital',
        date: '2026-08-15',
        summary: 'All electrolytes, kidney, and liver function markers within normal range.',
        details: 'Fasting glucose: 92 mg/dL, Creatinine: 0.9 mg/dL, eGFR: >90.',
        tags: ['lab', 'routine'],
      },
      {
        id: crypto.randomUUID(),
        type: 'prescription',
        title: 'Albuterol Sulfate HFA Inhaler',
        doctor: 'Sarah Jenkins',
        hospital: 'City General Hospital',
        date: '2026-07-02',
        summary: '90 mcg/actuation — 2 puffs every 4-6 hours as needed for bronchospasm.',
        details: 'Refills: 3 remaining.',
        tags: ['asthma', 'inhaler'],
      },
    ],
    activityLog: [
      {
        id: crypto.randomUUID(),
        type: 'account_created',
        date: new Date(Date.now() - 7 * 86400000).toISOString(),
        details: 'Account initialized and verified under 3-tier encryption.',
      },
      {
        id: crypto.randomUUID(),
        type: 'record_added',
        date: new Date(Date.now() - 2 * 86400000).toISOString(),
        details: 'Added new lab record: Comprehensive Metabolic Panel',
      },
    ],
    passwordHash: patientPasswordHash,
  };

  return [admin, dummyHospital, dummyPatient];
};

// --- Initialize SQLite Connection & Schema ---
const ensureDbDir = () => {
  const dir = path.dirname(SQLITE_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDbDir();
const sqlite = new DatabaseSync(SQLITE_DB_PATH);

sqlite.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY COLLATE NOCASE,
    role TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    encrypted_payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email COLLATE NOCASE);
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

  CREATE TABLE IF NOT EXISTS otp_codes (
    patient_id TEXT PRIMARY KEY COLLATE NOCASE,
    code TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
  );
`);

let transactionDepth = 0;

/**
 * Executes a callback inside an atomic SQLite transaction (`BEGIN IMMEDIATE ... COMMIT`),
 * supporting nested calls safely and preventing concurrent read-modify-write race conditions.
 */
export const runInTransaction = <T>(fn: () => T): T => {
  const isOuter = transactionDepth === 0;
  if (isOuter) {
    sqlite.exec('BEGIN IMMEDIATE');
  }
  transactionDepth += 1;
  try {
    const result = fn();
    transactionDepth -= 1;
    if (isOuter) {
      sqlite.exec('COMMIT');
    }
    return result;
  } catch (err) {
    transactionDepth -= 1;
    if (isOuter) {
      try {
        sqlite.exec('ROLLBACK');
      } catch {
        // Ignore rollback error if transaction already rolled back
      }
    }
    throw err;
  }
};

const rowToUser = (row: { encrypted_payload: string; password_hash: string }): StoredUser => {
  const diskRecord = JSON.parse(row.encrypted_payload) as DiskUserRecord;
  const { user } = decryptUserFromDisk(diskRecord);
  if (row.password_hash) {
    user.passwordHash = row.password_hash;
  }
  return user;
};

/**
 * Upserts a single user record into SQLite with 3-tier AES-256-GCM encryption at rest.
 */
export const saveUser = (user: StoredUser): void => {
  const diskRecord = encryptUserForDisk(user);
  const stmt = sqlite.prepare(`
    INSERT INTO users (id, role, email, name, password_hash, encrypted_payload, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      role = excluded.role,
      email = excluded.email,
      name = excluded.name,
      password_hash = excluded.password_hash,
      encrypted_payload = excluded.encrypted_payload,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    user.id,
    user.role,
    user.email.trim(),
    user.name.trim(),
    user.passwordHash || '',
    JSON.stringify(diskRecord),
    new Date().toISOString()
  );
};

/**
 * Inserts a new user row, throwing if `id` or `email` already exists.
 */
export const insertUser = (user: StoredUser): void => {
  const diskRecord = encryptUserForDisk(user);
  const stmt = sqlite.prepare(`
    INSERT INTO users (id, role, email, name, password_hash, encrypted_payload, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    user.id,
    user.role,
    user.email.trim(),
    user.name.trim(),
    user.passwordHash || '',
    JSON.stringify(diskRecord),
    new Date().toISOString()
  );
};

export const getUserById = (id: string): StoredUser | undefined => {
  const stmt = sqlite.prepare(
    'SELECT encrypted_payload, password_hash FROM users WHERE id = ? COLLATE NOCASE LIMIT 1'
  );
  const row = stmt.get(id.trim()) as { encrypted_payload: string; password_hash: string } | undefined;
  return row ? rowToUser(row) : undefined;
};

export const getUserByLogin = (
  identifier: string,
  role: 'Patient' | 'Hospital' | 'Admin'
): StoredUser | undefined => {
  const clean = identifier.trim();
  const stmt = sqlite.prepare(`
    SELECT encrypted_payload, password_hash
    FROM users
    WHERE (email = ? COLLATE NOCASE OR id = ? COLLATE NOCASE)
      AND role = ?
    LIMIT 1
  `);
  const row = stmt.get(clean, clean, role) as
    | { encrypted_payload: string; password_hash: string }
    | undefined;
  return row ? rowToUser(row) : undefined;
};

export const userEmailExists = (email: string): boolean => {
  const stmt = sqlite.prepare('SELECT 1 FROM users WHERE email = ? COLLATE NOCASE LIMIT 1');
  return Boolean(stmt.get(email.trim()));
};

export const userIdExists = (id: string): boolean => {
  const stmt = sqlite.prepare('SELECT 1 FROM users WHERE id = ? COLLATE NOCASE LIMIT 1');
  return Boolean(stmt.get(id.trim()));
};

export const getAllUsers = (): StoredUser[] => {
  const stmt = sqlite.prepare('SELECT encrypted_payload, password_hash FROM users ORDER BY updated_at DESC');
  const rows = stmt.all() as Array<{ encrypted_payload: string; password_hash: string }>;
  return rows.map(rowToUser);
};

export const getUsersCount = (): number => {
  const stmt = sqlite.prepare('SELECT COUNT(*) as count FROM users');
  const row = stmt.get() as { count: number } | undefined;
  return Number(row?.count ?? 0);
};

/**
 * Atomically reads, mutates, and persists a single user inside a `BEGIN IMMEDIATE` SQLite transaction.
 */
export const updateUserAtomic = (
  id: string,
  mutator: (existing: StoredUser) => StoredUser | null
): StoredUser | null => {
  return runInTransaction(() => {
    const existing = getUserById(id);
    if (!existing) return null;
    const updated = mutator(existing);
    if (!updated) return null;
    saveUser(updated);
    return updated;
  });
};

// --- Atomic OTP Operations ---
export const getOtpCode = (patientId: string): OtpRecord | undefined => {
  const stmt = sqlite.prepare(
    'SELECT code, expires_at, attempts FROM otp_codes WHERE patient_id = ? COLLATE NOCASE LIMIT 1'
  );
  const row = stmt.get(patientId.trim()) as
    | { code: string; expires_at: number; attempts: number }
    | undefined;
  if (!row) return undefined;
  return {
    code: row.code,
    expiresAt: Number(row.expires_at),
    attempts: Number(row.attempts ?? 0),
  };
};

export const upsertOtpCode = (patientId: string, record: OtpRecord): void => {
  const stmt = sqlite.prepare(`
    INSERT INTO otp_codes (patient_id, code, expires_at, attempts)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(patient_id) DO UPDATE SET
      code = excluded.code,
      expires_at = excluded.expires_at,
      attempts = excluded.attempts
  `);
  stmt.run(patientId.trim(), record.code, record.expiresAt, record.attempts);
};

export const incrementOtpAttempts = (patientId: string, attempts: number): void => {
  const stmt = sqlite.prepare(
    'UPDATE otp_codes SET attempts = ? WHERE patient_id = ? COLLATE NOCASE'
  );
  stmt.run(attempts, patientId.trim());
};

export const deleteOtpCode = (patientId: string): void => {
  const stmt = sqlite.prepare('DELETE FROM otp_codes WHERE patient_id = ? COLLATE NOCASE');
  stmt.run(patientId.trim());
};

export const sanitizeUser = (user: StoredUser): User => {
  const { passwordHash, ...safeUser } = user;
  return safeUser as User;
};

// --- Automatic Migration from Legacy database.json or Initial Seed on Startup ---
const initializeDatabase = (): void => {
  if (getUsersCount() > 0) {
    return;
  }

  runInTransaction(() => {
    if (fs.existsSync(LEGACY_JSON_FILE)) {
      try {
        const raw = fs.readFileSync(LEGACY_JSON_FILE, 'utf-8');
        const parsedDisk = JSON.parse(raw) as LegacyDiskDatabaseSchema;
        const legacyRecords = parsedDisk.users || [];

        if (legacyRecords.length > 0) {
          for (const record of legacyRecords) {
            const { user: u } = decryptUserFromDisk(record);
            if (!u.passwordHash || bcrypt.compareSync('password123', u.passwordHash)) {
              const envKey =
                u.role === 'Admin'
                  ? 'SEED_ADMIN_PASSWORD'
                  : u.role === 'Hospital'
                  ? 'SEED_HOSPITAL_PASSWORD'
                  : 'SEED_PATIENT_PASSWORD';
              u.passwordHash = getSeedPasswordHash(envKey);
            }
            saveUser(u);
          }

          const legacyOtps = parsedDisk.otpCodes || {};
          for (const [patientId, otp] of Object.entries(legacyOtps)) {
            if (otp && otp.expiresAt > Date.now()) {
              upsertOtpCode(patientId, {
                code: otp.code,
                expiresAt: otp.expiresAt,
                attempts: otp.attempts ?? 0,
              });
            }
          }
          console.log(
            `📦 Migrated ${legacyRecords.length} user(s) from legacy database.json to SQLite (${SQLITE_DB_PATH}).`
          );
          return;
        }
      } catch (err) {
        console.warn('Could not migrate legacy database.json, initializing fresh seed:', err);
      }
    }

    const seedUsers = getInitialSeedUsers();
    for (const u of seedUsers) {
      saveUser(u);
    }
  });
};

initializeDatabase();
