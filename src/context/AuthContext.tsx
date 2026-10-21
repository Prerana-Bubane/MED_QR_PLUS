import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, Patient, Hospital, Admin, ActivityLog, MedicalRecord } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface AuthContextType {
  user: User | null;
  login: (email: string, role: 'Patient' | 'Hospital' | 'Admin', password?: string) => boolean;
  logout: () => void;
  registerPatient: (data: Partial<Patient> & { password?: string }) => void;
  registerHospital: (data: Partial<Hospital> & { password?: string }) => void;
  getAllUsers: () => User[];
  updateUser: (user: User) => void;
  logActivity: (
    userId: string,
    type: ActivityLog['type'],
    details: string,
    extra?: Partial<ActivityLog>,
    scannedPatientId?: string
  ) => void;
  addMedicalRecord: (userId: string, record: Omit<MedicalRecord, 'id'>) => void;
  deleteMedicalRecord: (userId: string, recordId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SEED_DATA_KEY = 'medqr_seeded';
const USERS_KEY = 'medqr_users';
const CURRENT_USER_KEY = 'medqr_current_user';
const TOKEN_KEY = 'medqr_token';

const seedData = () => {
  if (localStorage.getItem(SEED_DATA_KEY)) return;

  const admin: Admin = {
    id: 'ADMIN-001',
    role: 'Admin',
    name: 'System Admin',
    email: 'admin@medqr.com',
    phone: '123-456-7890',
  };

  const dummyHospital: Hospital = {
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
  };

  const dummyPatient: Patient = {
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
    ],
  };

  localStorage.setItem(USERS_KEY, JSON.stringify([admin, dummyHospital, dummyPatient]));
  localStorage.setItem(SEED_DATA_KEY, 'true');
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [usersCache, setUsersCache] = useState<User[]>([]);

  useEffect(() => {
    seedData();
    const initialUsers: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    setUsersCache(initialUsers);

    const storedUser = localStorage.getItem(CURRENT_USER_KEY);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    // Sync users from backend API
    fetch(`${API_BASE}/users`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { users: User[] }) => {
        if (Array.isArray(data.users) && data.users.length > 0) {
          localStorage.setItem(USERS_KEY, JSON.stringify(data.users));
          setUsersCache(data.users);
          if (storedUser) {
            const parsed = JSON.parse(storedUser) as User;
            const refreshed = data.users.find((u) => u.id === parsed.id);
            if (refreshed) {
              setUser(refreshed);
              localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(refreshed));
            }
          }
        }
      })
      .catch(() => {
        // Fallback to localStorage cache if backend server is offline
      });
  }, []);

  const getAllUsers = (): User[] => {
    const stored = localStorage.getItem(USERS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return usersCache;
  };

  const setAllUsers = (users: User[]) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    setUsersCache(users);
  };

  const login = (email: string, role: 'Patient' | 'Hospital' | 'Admin', password?: string) => {
    const users = getAllUsers();
    const foundUser = users.find(
      (u) =>
        (u.email.toLowerCase() === email.toLowerCase() || u.id.toLowerCase() === email.toLowerCase()) &&
        u.role === role
    );

    if (foundUser) {
      setUser(foundUser);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(foundUser));

      // Authenticate against backend asynchronously to obtain JWT token & fresh profile
      fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      })
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data: { token: string; user: User }) => {
          localStorage.setItem(TOKEN_KEY, data.token);
          localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(data.user));
          setUser(data.user);
        })
        .catch(() => {});

      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  };

  const registerPatient = (data: Partial<Patient> & { password?: string }) => {
    const users = getAllUsers();
    const newId = `MQR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const newPatient: Patient = {
      ...data,
      id: newId,
      role: 'Patient',
      allergies: data.allergies || [],
      chronicConditions: data.chronicConditions || [],
      currentMedications: data.currentMedications || [],
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
    } as Patient;

    setAllUsers([...users, newPatient]);

    fetch(`${API_BASE}/auth/register/patient`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newPatient, password: data.password }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((resp: { token: string; user: Patient }) => {
        localStorage.setItem(TOKEN_KEY, resp.token);
      })
      .catch(() => {});
  };

  const registerHospital = (data: Partial<Hospital> & { password?: string }) => {
    const users = getAllUsers();
    const newId = `HOSP-${Math.floor(1000 + Math.random() * 9000)}`;
    const newHospital: Hospital = {
      ...data,
      id: newId,
      role: 'Hospital',
      verified: false,
      status: 'pending',
      patientsAccessed: [],
      scanLogs: [],
    } as Hospital;

    setAllUsers([...users, newHospital]);

    fetch(`${API_BASE}/auth/register/hospital`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newHospital, password: data.password }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((resp: { token: string; user: Hospital }) => {
        localStorage.setItem(TOKEN_KEY, resp.token);
      })
      .catch(() => {});
  };

  const updateUser = (updatedUser: User) => {
    const users = getAllUsers();
    const index = users.findIndex((u) => u.id === updatedUser.id);
    if (index !== -1) {
      users[index] = updatedUser;
      setAllUsers(users);
      if (user?.id === updatedUser.id) {
        setUser(updatedUser);
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
      }
    }

    fetch(`${API_BASE}/users/${encodeURIComponent(updatedUser.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedUser),
    }).catch(() => {});
  };

  const logActivity = (
    userId: string,
    type: ActivityLog['type'],
    details: string,
    extra?: Partial<ActivityLog>,
    scannedPatientId?: string
  ) => {
    const users = getAllUsers();
    const targetUser = users.find((u) => u.id === userId);
    if (targetUser && (targetUser.role === 'Patient' || targetUser.role === 'Hospital')) {
      const newLog: ActivityLog = {
        id: crypto.randomUUID(),
        type,
        date: new Date().toISOString(),
        details,
        ...extra,
      };

      let updatedUser: User;
      if (targetUser.role === 'Patient') {
        updatedUser = {
          ...targetUser,
          activityLog: [newLog, ...(targetUser.activityLog || [])],
        };
      } else {
        const scannedPatient = scannedPatientId
          ? (users.find((u) => u.id === scannedPatientId && u.role === 'Patient') as Patient | undefined)
          : undefined;

        updatedUser = {
          ...targetUser,
          scanLogs: [newLog, ...(targetUser.scanLogs || [])],
          patientsAccessed: scannedPatient
            ? [
                {
                  patientId: scannedPatient.id,
                  patientName: scannedPatient.name,
                  scanDate: newLog.date,
                  accessTier: extra?.accessTier || 'Tier 3',
                  reason: extra?.reason || 'Emergency Admission',
                },
                ...(targetUser.patientsAccessed || []),
              ]
            : targetUser.patientsAccessed || [],
        };
      }

      const idx = users.findIndex((u) => u.id === userId);
      if (idx !== -1) {
        users[idx] = updatedUser;
        setAllUsers(users);
        if (user?.id === updatedUser.id) {
          setUser(updatedUser);
          localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
        }
      }

      fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, details, extra, scannedPatientId }),
      }).catch(() => {});
    }
  };

  const addMedicalRecord = (userId: string, record: Omit<MedicalRecord, 'id'>) => {
    const users = getAllUsers();
    const targetUser = users.find((u) => u.id === userId);
    if (targetUser && targetUser.role === 'Patient') {
      const newRecord: MedicalRecord = {
        ...record,
        id: crypto.randomUUID(),
      };
      const newLog: ActivityLog = {
        id: crypto.randomUUID(),
        type: 'record_added',
        date: new Date().toISOString(),
        details: `Added new ${record.type} record: ${record.title}`,
      };
      const updatedUser: Patient = {
        ...targetUser,
        medicalRecords: [newRecord, ...(targetUser.medicalRecords || [])],
        activityLog: [newLog, ...(targetUser.activityLog || [])],
      };

      const idx = users.findIndex((u) => u.id === userId);
      if (idx !== -1) {
        users[idx] = updatedUser;
        setAllUsers(users);
        if (user?.id === updatedUser.id) {
          setUser(updatedUser);
          localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
        }
      }

      fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord),
      }).catch(() => {});
    }
  };

  const deleteMedicalRecord = (userId: string, recordId: string) => {
    const users = getAllUsers();
    const targetUser = users.find((u) => u.id === userId);
    if (targetUser && targetUser.role === 'Patient') {
      const updatedUser: Patient = {
        ...targetUser,
        medicalRecords: (targetUser.medicalRecords || []).filter((r) => r.id !== recordId),
      };

      const idx = users.findIndex((u) => u.id === userId);
      if (idx !== -1) {
        users[idx] = updatedUser;
        setAllUsers(users);
        if (user?.id === updatedUser.id) {
          setUser(updatedUser);
          localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
        }
      }

      fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/records/${encodeURIComponent(recordId)}`, {
        method: 'DELETE',
      }).catch(() => {});
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        registerPatient,
        registerHospital,
        getAllUsers,
        updateUser,
        logActivity,
        addMedicalRecord,
        deleteMedicalRecord,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
