import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, Patient, Hospital, ActivityLog, MedicalRecord } from '../types';
import { apiFetch, getAuthHeaders, TOKEN_KEY } from '../utils/api';

export { apiFetch, getAuthHeaders };

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface AuthResult<T = User> {
  success: boolean;
  error?: string;
  user?: T;
}

interface AuthContextType {
  user: User | null;
  authLoading: boolean;
  login: (
    email: string,
    password: string,
    role: 'Patient' | 'Hospital' | 'Admin'
  ) => Promise<AuthResult<User>>;
  logout: () => void;
  registerPatient: (data: Partial<Patient> & { password: string }) => Promise<AuthResult<Patient>>;
  registerHospital: (data: Partial<Hospital> & { password: string }) => Promise<AuthResult<Hospital>>;
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
  const [usersCache, setUsersCache] = useState<User[]>([]);

  const refreshUsersList = async (currentRole?: string) => {
    if (currentRole !== 'Admin') {
      setUsersCache([]);
      return;
    }
    try {
      const res = await apiFetch(`${API_BASE}/users`);
      if (res.ok) {
        const data: { users: User[] } = await res.json();
        if (Array.isArray(data.users)) {
          setUsersCache(data.users);
        }
      }
    } catch {
      // Ignore network error when fetching directory list
    }
  };

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
        refreshUsersList(data.user.role);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        setAuthLoading(false);
      });
  }, []);

  const getAllUsers = (): User[] => {
    if (usersCache.length > 0) return usersCache;
    return user ? [user] : [];
  };

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
      await refreshUsersList(data.user.role);

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
    setUsersCache([]);
    localStorage.removeItem(TOKEN_KEY);
    clearLegacyLocalStorage();
  };

  const registerPatient = async (
    data: Partial<Patient> & { password: string }
  ): Promise<AuthResult<Patient>> => {
    try {
      const res = await apiFetch(`${API_BASE}/auth/register/patient`, {
        method: 'POST',
        body: JSON.stringify(data),
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
      await refreshUsersList(resp.user.role);

      return { success: true, user: resp.user };
    } catch {
      return {
        success: false,
        error: 'Unable to reach authentication server. Please verify the backend is running.',
      };
    }
  };

  const registerHospital = async (
    data: Partial<Hospital> & { password: string }
  ): Promise<AuthResult<Hospital>> => {
    try {
      const res = await apiFetch(`${API_BASE}/auth/register/hospital`, {
        method: 'POST',
        body: JSON.stringify(data),
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
      await refreshUsersList(resp.user.role);

      return { success: true, user: resp.user };
    } catch {
      return {
        success: false,
        error: 'Unable to reach authentication server. Please verify the backend is running.',
      };
    }
  };

  const updateUser = (updatedUser: User) => {
    apiFetch(`${API_BASE}/users/${encodeURIComponent(updatedUser.id)}`, {
      method: 'PUT',
      body: JSON.stringify(updatedUser),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { user: User }) => {
        if (user?.id === data.user.id) {
          setUser(data.user);
        }
        if (user?.role === 'Admin') {
          setUsersCache((prev) =>
            prev.map((u) => (u.id === data.user.id ? data.user : u))
          );
        }
      })
      .catch(() => {});
  };

  const logActivity = (
    userId: string,
    type: ActivityLog['type'],
    details: string,
    extra?: Partial<ActivityLog>,
    scannedPatientId?: string
  ) => {
    apiFetch(`${API_BASE}/users/${encodeURIComponent(userId)}/activity`, {
      method: 'POST',
      body: JSON.stringify({ type, details, extra, scannedPatientId }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { user?: User }) => {
        if (data.user && user?.id === data.user.id) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  };

  const addMedicalRecord = (userId: string, record: Omit<MedicalRecord, 'id'>) => {
    const newRecord: MedicalRecord = {
      ...record,
      id: crypto.randomUUID(),
    };

    apiFetch(`${API_BASE}/users/${encodeURIComponent(userId)}/records`, {
      method: 'POST',
      body: JSON.stringify(newRecord),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { user?: User }) => {
        if (data.user && user?.id === data.user.id) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  };

  const deleteMedicalRecord = (userId: string, recordId: string) => {
    apiFetch(`${API_BASE}/users/${encodeURIComponent(userId)}/records/${encodeURIComponent(recordId)}`, {
      method: 'DELETE',
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { user?: User }) => {
        if (data.user && user?.id === data.user.id) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authLoading,
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
