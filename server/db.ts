import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

export type StoredUser = User & {
  passwordHash?: string;
};

export interface DatabaseSchema {
  users: StoredUser[];
  otpCodes: Record<string, { code: string; expiresAt: number; attempts?: number }>;
}

interface DiskDatabaseSchema {
  encryptionVersion: 1;
  users: DiskUserRecord[];
  otpCodes: Record<string, { code: string; expiresAt: number; attempts?: number }>;
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

export const writeDb = (data: DatabaseSchema): void => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const diskPayload: DiskDatabaseSchema = {
      encryptionVersion: 1,
      users: data.users.map(encryptUserForDisk),
      otpCodes: data.otpCodes || {},
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(diskPayload, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing encrypted database file:', error);
  }
};

export const readDb = (): DatabaseSchema => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initialData: DatabaseSchema = {
        users: getInitialSeedUsers(),
        otpCodes: {},
      };
      writeDb(initialData);
      return initialData;
    }

    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsedDisk = JSON.parse(raw) as Partial<DiskDatabaseSchema> & { users?: DiskUserRecord[] };

    let needsWriteBack = parsedDisk.encryptionVersion !== 1;
    const decryptedUsers: StoredUser[] = [];

    for (const record of parsedDisk.users || []) {
      const { user: u, wasPlaintext } = decryptUserFromDisk(record);
      if (wasPlaintext) {
        needsWriteBack = true;
      }
      if (!u.passwordHash || bcrypt.compareSync('password123', u.passwordHash)) {
        const envKey =
          u.role === 'Admin'
            ? 'SEED_ADMIN_PASSWORD'
            : u.role === 'Hospital'
            ? 'SEED_HOSPITAL_PASSWORD'
            : 'SEED_PATIENT_PASSWORD';
        u.passwordHash = getSeedPasswordHash(envKey);
        needsWriteBack = true;
      }
      decryptedUsers.push(u);
    }

    const schema: DatabaseSchema = {
      users: decryptedUsers,
      otpCodes: parsedDisk.otpCodes || {},
    };

    if (needsWriteBack) {
      writeDb(schema);
    }

    return schema;
  } catch (error) {
    console.error('Error reading database file, falling back to seed data:', error);
    const fallback: DatabaseSchema = {
      users: getInitialSeedUsers(),
      otpCodes: {},
    };
    writeDb(fallback);
    return fallback;
  }
};

export const sanitizeUser = (user: StoredUser): User => {
  const { passwordHash, ...safeUser } = user;
  return safeUser as User;
};
