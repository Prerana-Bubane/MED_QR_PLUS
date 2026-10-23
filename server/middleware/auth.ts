import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '../../src/types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'medqr-plus-dev-secret-key-2026';

export interface JwtPayload {
  id: string;
  email: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export const signToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

export interface VaultTokenPayload {
  type: 'tier2_vault';
  patientId: string;
}

export const signVaultToken = (patientId: string): string => {
  const payload: VaultTokenPayload = { type: 'tier2_vault', patientId };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
};

export const verifyVaultToken = (token: string | undefined, patientId: string): boolean => {
  if (!token || typeof token !== 'string') return false;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as VaultTokenPayload;
    return (
      decoded.type === 'tier2_vault' &&
      typeof decoded.patientId === 'string' &&
      decoded.patientId.toLowerCase() === patientId.toLowerCase()
    );
  } catch {
    return false;
  }
};

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Authentication token required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};
