import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { User, Patient, Hospital, Admin } from '../src/types/index.js';

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

const getInitialSeedUsers = (): StoredUser[] => {
  const defaultPasswordHash = bcrypt.hashSync('password123', 10);

  const admin: Admin & { passwordHash: string } = {
    id: 'ADMIN-001',
    role: 'Admin',
    name: 'System Admin',
    email: 'admin@medqr.com',
    phone: '123-456-7890',
    passwordHash: defaultPasswordHash,
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
    passwordHash: defaultPasswordHash,
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
    passwordHash: defaultPasswordHash,
  };

  return [admin, dummyHospital, dummyPatient];
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
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
      return initialData;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw) as DatabaseSchema;
  } catch (error) {
    console.error('Error reading database file, falling back to seed data:', error);
    return {
      users: getInitialSeedUsers(),
      otpCodes: {},
    };
  }
};

export const writeDb = (data: DatabaseSchema): void => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing database file:', error);
  }
};

export const sanitizeUser = (user: StoredUser): User => {
  const { passwordHash, ...safeUser } = user;
  return safeUser as User;
};
