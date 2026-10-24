import 'dotenv/config';
import crypto from 'crypto';
import type { Patient, Hospital } from '../src/types/index.js';
import type { StoredUser } from './db.js';

const RAW_ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY?.trim();
if (!RAW_ENCRYPTION_KEY || RAW_ENCRYPTION_KEY.length < 32) {
  console.error(
    'FATAL: DATA_ENCRYPTION_KEY environment variable (min 32 chars) is required for AES-256-GCM medical data encryption.'
  );
  process.exit(1);
}

const deriveTierKey = (tierInfo: string): Buffer => {
  return Buffer.from(
    crypto.hkdfSync(
      'sha256',
      Buffer.from(RAW_ENCRYPTION_KEY, 'utf-8'),
      Buffer.from('medqr-plus-hkdf-salt-v1', 'utf-8'),
      Buffer.from(tierInfo, 'utf-8'),
      32
    )
  );
};

// Separate 256-bit keys derived per access tier via HKDF-SHA256
const TIER_KEYS = {
  tier1: deriveTierKey('medqr:tier1:identity-pii'),
  tier2: deriveTierKey('medqr:tier2:clinical-vault'),
  tier3: deriveTierKey('medqr:tier3:emergency-vitals'),
} as const;

export interface EncryptedEnvelope {
  alg: 'aes-256-gcm';
  iv: string;
  tag: string;
  ciphertext: string;
}

export const encryptTierPayload = (
  tier: keyof typeof TIER_KEYS,
  aadContext: string,
  payload: unknown
): EncryptedEnvelope => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', TIER_KEYS[tier], iv);
  cipher.setAAD(Buffer.from(`${aadContext}:${tier}`, 'utf-8'));

  const plaintext = Buffer.from(JSON.stringify(payload), 'utf-8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  };
};

export const decryptTierPayload = <T>(
  tier: keyof typeof TIER_KEYS,
  aadContext: string,
  envelope: EncryptedEnvelope
): T => {
  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', TIER_KEYS[tier], iv);
  decipher.setAAD(Buffer.from(`${aadContext}:${tier}`, 'utf-8'));
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf-8')) as T;
};

export interface EncryptedDiskPatient {
  id: string;
  role: 'Patient';
  name: string;
  email: string;
  issuingHospital: string;
  passwordHash?: string;
  encryptedTiers: {
    tier1: EncryptedEnvelope;
    tier2: EncryptedEnvelope;
    tier3: EncryptedEnvelope;
  };
}

export interface EncryptedDiskHospital {
  id: string;
  role: 'Hospital';
  name: string;
  email: string;
  phone: string;
  licenseNumber: string;
  address: string;
  contactPerson: string;
  department?: string;
  verified: boolean;
  status: 'pending' | 'verified' | 'rejected';
  passwordHash?: string;
  encryptedAudit: EncryptedEnvelope;
}

export type DiskUserRecord = EncryptedDiskPatient | EncryptedDiskHospital | StoredUser;

interface Tier1IdentityData {
  phone: string;
  dob: string;
  gender: string;
  height: string;
  weight: string;
  address: string;
  insurance: Patient['insurance'];
}

interface Tier2ClinicalVaultData {
  medicalRecords: Patient['medicalRecords'];
  activityLog: Patient['activityLog'];
}

interface Tier3EmergencyData {
  bloodGroup: string;
  allergies: string[];
  chronicConditions: string[];
  currentMedications: string[];
  emergencyContact: Patient['emergencyContact'];
}

interface HospitalAuditData {
  patientsAccessed: Hospital['patientsAccessed'];
  scanLogs: Hospital['scanLogs'];
}

export const encryptUserForDisk = (user: StoredUser): DiskUserRecord => {
  if (user.role === 'Patient') {
    const p = user as Patient & { passwordHash?: string };
    const tier1Data: Tier1IdentityData = {
      phone: p.phone || '',
      dob: p.dob || '',
      gender: p.gender || '',
      height: p.height || '',
      weight: p.weight || '',
      address: p.address || '',
      insurance: p.insurance || { provider: '', policy: '', validUntil: '' },
    };
    const tier2Data: Tier2ClinicalVaultData = {
      medicalRecords: p.medicalRecords || [],
      activityLog: p.activityLog || [],
    };
    const tier3Data: Tier3EmergencyData = {
      bloodGroup: p.bloodGroup || '',
      allergies: p.allergies || [],
      chronicConditions: p.chronicConditions || [],
      currentMedications: p.currentMedications || [],
      emergencyContact: p.emergencyContact || { name: '', relation: '', phone: '' },
    };

    return {
      id: p.id,
      role: 'Patient',
      name: p.name,
      email: p.email,
      issuingHospital: p.issuingHospital || 'City General Hospital',
      passwordHash: p.passwordHash,
      encryptedTiers: {
        tier1: encryptTierPayload('tier1', p.id, tier1Data),
        tier2: encryptTierPayload('tier2', p.id, tier2Data),
        tier3: encryptTierPayload('tier3', p.id, tier3Data),
      },
    };
  }

  if (user.role === 'Hospital') {
    const h = user as Hospital & { passwordHash?: string };
    const auditData: HospitalAuditData = {
      patientsAccessed: h.patientsAccessed || [],
      scanLogs: h.scanLogs || [],
    };

    return {
      id: h.id,
      role: 'Hospital',
      name: h.name,
      email: h.email,
      phone: h.phone || '',
      licenseNumber: h.licenseNumber || '',
      address: h.address || '',
      contactPerson: h.contactPerson || '',
      department: h.department || 'General',
      verified: Boolean(h.verified),
      status: h.status || 'pending',
      passwordHash: h.passwordHash,
      encryptedAudit: encryptTierPayload('tier2', h.id, auditData),
    };
  }

  return user;
};

export const decryptUserFromDisk = (record: DiskUserRecord): { user: StoredUser; wasPlaintext: boolean } => {
  if (record.role === 'Patient') {
    if ('encryptedTiers' in record && record.encryptedTiers) {
      const tier1 = decryptTierPayload<Tier1IdentityData>('tier1', record.id, record.encryptedTiers.tier1);
      const tier2 = decryptTierPayload<Tier2ClinicalVaultData>('tier2', record.id, record.encryptedTiers.tier2);
      const tier3 = decryptTierPayload<Tier3EmergencyData>('tier3', record.id, record.encryptedTiers.tier3);

      const patient: StoredUser = {
        id: record.id,
        role: 'Patient',
        name: record.name,
        email: record.email,
        issuingHospital: record.issuingHospital,
        passwordHash: record.passwordHash,
        ...tier1,
        ...tier2,
        ...tier3,
      };
      return { user: patient, wasPlaintext: false };
    }
    return { user: record as StoredUser, wasPlaintext: true };
  }

  if (record.role === 'Hospital') {
    if ('encryptedAudit' in record && record.encryptedAudit) {
      const audit = decryptTierPayload<HospitalAuditData>('tier2', record.id, record.encryptedAudit);
      const hospital: StoredUser = {
        id: record.id,
        role: 'Hospital',
        name: record.name,
        email: record.email,
        phone: record.phone,
        licenseNumber: record.licenseNumber,
        address: record.address,
        contactPerson: record.contactPerson,
        department: record.department,
        verified: record.verified,
        status: record.status,
        passwordHash: record.passwordHash,
        patientsAccessed: audit.patientsAccessed || [],
        scanLogs: audit.scanLogs || [],
      };
      return { user: hospital, wasPlaintext: false };
    }
    return { user: record as StoredUser, wasPlaintext: true };
  }

  return { user: record as StoredUser, wasPlaintext: false };
};
