import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User, Patient, Hospital, ActivityLog, MedicalRecord } from '../types';
import { API_BASE, apiFetch, getAuthHeaders, TOKEN_KEY } from '../utils/api';

export { API_BASE, apiFetch, getAuthHeaders };

export interface AuthResult<T = User> {
  success: boolean;
  error?: string;
  user?: T;
}

interface AuthContextType {
  user: User | null;
  authLoading: boolean;
  refreshUser: () => Promise<User | null>;
  login: (
    email: string,
    password: string,
    role: 'Patient' | 'Hospital' | 'Admin'
  ) => Promise<AuthResult<User>>;
  logout: () => void;
  registerPatient: (
    data: Omit<Partial<Patient>, 'id' | 'role'> & { password: string }
  ) => Promise<AuthResult<Patient>>;
  registerHospital: (
    data: Omit<Partial<Hospital>, 'id' | 'role'> & { password: string }
  ) => Promise<AuthResult<Hospital>>;
  updateUser: (updates: Partial<User> & { id: string }) => Promise<User | null>;
  logActivity: (
    userId: string,
    type: ActivityLog['type'],
    details: string,
    extra?: Partial<ActivityLog>,
    scannedPatientId?: string
  ) => Promise<void>;
  addMedicalRecord: (userId: string, record: Omit<MedicalRecord, 'id'>) => Promise<void>;
  deleteMedicalRecord: (userId: string, recordId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LEGACY_KEYS = [
  'medqr_users',
  'medqr_current_user',
  'aegiscare_current_user',
  'aegiscare_users',
  'aegiscare_seeded',
];

const clearLegacyLocalStorage = () => {
  for (const key of LEGACY_KEYS) {
    localStorage.removeItem(key);
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      return null;
    }

    try {
      const res = await apiFetch(`${API_BASE}/auth/me`);
      if (!res.ok) {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        return null;
      }
      const data: { user: User } = await res.json();
      setUser(data.user);
      return data.user;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    clearLegacyLocalStorage();

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      setAuthLoading(false);
      return;
    }

    // Verify existing JWT token with backend /api/auth/me before granting session access
    apiFetch(`${API_BASE}/auth/me`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Session expired or invalid token');
        }
        return res.json() as Promise<{ user: User }>;
      })
      .then((data) => {
        setUser(data.user);
        setAuthLoading(false);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        setAuthLoading(false);
      });
  }, []);

  const login = async (
    email: string,
    password: string,
    role: 'Patient' | 'Hospital' | 'Admin'
  ): Promise<AuthResult<User>> => {
    try {
      const res = await apiFetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password, role }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token || !data.user) {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        return {
          success: false,
          error: data.error || 'Invalid email, password, or role.',
        };
      }

      clearLegacyLocalStorage();
      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);

      return { success: true, user: data.user };
    } catch {
      return {
        success: false,
        error: 'Unable to reach authentication server. Please verify the backend is running.',
      };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    clearLegacyLocalStorage();
  };

  const registerPatient = async (
    data: Omit<Partial<Patient>, 'id' | 'role'> & { password: string }
  ): Promise<AuthResult<Patient>> => {
    try {
      const { id: _id, role: _role, ...payload } = data as Partial<Patient> & { password: string };
      const res = await apiFetch(`${API_BASE}/auth/register/patient`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const resp = await res.json().catch(() => ({}));
      if (!res.ok || !resp.token || !resp.user) {
        return {
          success: false,
          error: resp.error || 'Patient registration failed.',
        };
      }

      clearLegacyLocalStorage();
      localStorage.setItem(TOKEN_KEY, resp.token);
      setUser(resp.user);

      return { success: true, user: resp.user };
    } catch {
      return {
        success: false,
        error: 'Unable to reach authentication server. Please verify the backend is running.',
      };
    }
  };

  const registerHospital = async (
    data: Omit<Partial<Hospital>, 'id' | 'role'> & { password: string }
  ): Promise<AuthResult<Hospital>> => {
    try {
      const { id: _id, role: _role, ...payload } = data as Partial<Hospital> & { password: string };
      const res = await apiFetch(`${API_BASE}/auth/register/hospital`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const resp = await res.json().catch(() => ({}));
      if (!res.ok || !resp.token || !resp.user) {
        return {
          success: false,
          error: resp.error || 'Hospital registration failed.',
        };
      }

      clearLegacyLocalStorage();
      localStorage.setItem(TOKEN_KEY, resp.token);
      setUser(resp.user);

      return { success: true, user: resp.user };
    } catch {
      return {
        success: false,
        error: 'Unable to reach authentication server. Please verify the backend is running.',
      };
    }
  };

  const updateUser = async (updates: Partial<User> & { id: string }): Promise<User | null> => {
    try {
      const res = await apiFetch(`${API_BASE}/users/${encodeURIComponent(updates.id)}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      if (!res.ok) return null;
      const data: { user: User } = await res.json();
      setUser((prev) => (prev?.id === data.user.id ? data.user : prev));
      return data.user;
    } catch {
      return null;
    }
  };

  const logActivity = async (
    userId: string,
    type: ActivityLog['type'],
    details: string,
    extra?: Partial<ActivityLog>,
    scannedPatientId?: string
  ): Promise<void> => {
    try {
      const res = await apiFetch(`${API_BASE}/users/${encodeURIComponent(userId)}/activity`, {
        method: 'POST',
        body: JSON.stringify({ type, details, extra, scannedPatientId }),
      });
      if (res.ok) {
        const data: { user?: User } = await res.json();
        if (data.user) {
          setUser((prev) => (prev?.id === data.user!.id ? data.user! : prev));
        }
      }
    } catch {
      // Ignore activity log failure
    }
  };

  const addMedicalRecord = async (
    userId: string,
    record: Omit<MedicalRecord, 'id'>
  ): Promise<void> => {
    try {
      const res = await apiFetch(`${API_BASE}/users/${encodeURIComponent(userId)}/records`, {
        method: 'POST',
        body: JSON.stringify(record),
      });
      if (res.ok) {
        const data: { user?: User } = await res.json();
        if (data.user) {
          setUser((prev) => (prev?.id === data.user!.id ? data.user! : prev));
        }
      }
    } catch {
      // Ignore network error
    }
  };

  const deleteMedicalRecord = async (userId: string, recordId: string): Promise<void> => {
    try {
      const res = await apiFetch(
        `${API_BASE}/users/${encodeURIComponent(userId)}/records/${encodeURIComponent(recordId)}`,
        {
          method: 'DELETE',
        }
      );
      if (res.ok) {
        const data: { user?: User } = await res.json();
        if (data.user) {
          setUser((prev) => (prev?.id === data.user!.id ? data.user! : prev));
        }
      }
    } catch {
      // Ignore network error
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authLoading,
        refreshUser,
        login,
        logout,
        registerPatient,
        registerHospital,
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
