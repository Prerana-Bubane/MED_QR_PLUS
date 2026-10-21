export type Role = 'Patient' | 'Hospital' | 'Admin';

export interface BaseUser {
  id: string;
  role: Role;
  name: string; // Patient name or Hospital name
  email: string;
  phone: string;
}

export interface ActivityLog {
  id: string;
  type: 'account_created' | 'profile_updated' | 'record_added' | 'ai_session' | 'tier_scan';
  date: string;
  details: string;
  // For tier_scan specifically
  hospitalName?: string;
  department?: string;
  accessTier?: 'Tier 1' | 'Tier 2' | 'Tier 3';
  reason?: string;
}

export interface MedicalRecord {
  id: string;
  type: 'prescription' | 'lab' | 'imaging' | 'consultation' | 'vaccine';
  title: string;
  doctor: string;
  hospital: string;
  date: string;
  summary: string;
  details: string;
  tags: string[];
  fileName?: string;
  fileSize?: string;
}

export interface Patient extends BaseUser {
  role: 'Patient';
  dob: string;
  gender: string;
  bloodGroup: string;
  height: string;
  weight: string;
  address: string;
  allergies: string[];
  chronicConditions: string[];
  currentMedications: string[];
  issuingHospital: string;
  emergencyContact: {
    name: string;
    relation: string;
    phone: string;
  };
  insurance: {
    provider: string;
    policy: string;
    validUntil: string;
  };
  avatar?: string;
  medicalRecords: MedicalRecord[];
  activityLog: ActivityLog[];
}

export interface PatientAccessedLog {
  patientId: string;
  patientName: string;
  scanDate: string;
  accessTier: 'Tier 1' | 'Tier 2' | 'Tier 3';
  reason: string;
}

export interface Hospital extends BaseUser {
  role: 'Hospital';
  licenseNumber: string;
  address: string;
  contactPerson: string;
  department: string;
  verified: boolean;
  status: 'pending' | 'verified' | 'rejected';
  patientsAccessed: PatientAccessedLog[];
  scanLogs: ActivityLog[]; // Similar to activity log but hospital-centric
}

export interface Admin extends BaseUser {
  role: 'Admin';
}

export type User = Patient | Hospital | Admin;
