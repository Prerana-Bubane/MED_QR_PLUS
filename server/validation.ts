import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

const idFormatRegex = /^[A-Za-z0-9_-]+$/;

export const userIdParamSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'User ID is required')
    .max(64, 'User ID is too long')
    .regex(idFormatRegex, 'Invalid user ID format'),
});

export const patientIdParamSchema = z.object({
  patientId: z
    .string()
    .trim()
    .min(1, 'Patient ID is required')
    .max(64, 'Patient ID is too long')
    .regex(idFormatRegex, 'Invalid patient ID format'),
});

export const deleteRecordParamSchema = z.object({
  id: z.string().trim().min(1).max(64).regex(idFormatRegex, 'Invalid user ID format'),
  recordId: z.string().trim().min(1).max(64).regex(idFormatRegex, 'Invalid record ID format'),
});

export const scanResultParamSchema = z.object({
  tier: z.enum(['1', '2', '3']),
});

export const scanResultQuerySchema = z.object({
  id: z
    .string({ error: 'Patient ID query parameter (?id=...) is required' })
    .trim()
    .min(1, 'Patient ID is required')
    .max(64, 'Patient ID is too long')
    .regex(idFormatRegex, 'Invalid patient ID format'),
  vaultToken: z.string().max(2048).optional(),
});

export const loginBodySchema = z.object({
  email: z.string().trim().min(1, 'Email or MedQR+ ID is required').max(200),
  password: z.string().min(1, 'Password is required').max(200),
  role: z.enum(['Patient', 'Hospital', 'Admin']),
});

const strongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(200)
  .refine((val) => val.toLowerCase() !== 'password123', {
    message: 'Password must be at least 8 characters and not a common default.',
  });

export const registerPatientBodySchema = z.object({
  name: z.string().trim().min(1, 'Full name is required').max(120),
  email: z.string().trim().email('Valid email address is required').max(200),
  password: strongPasswordSchema,
  phone: z.string().trim().max(40).optional().default(''),
  dob: z.string().trim().max(30).optional().default(''),
  gender: z.string().trim().max(40).optional().default(''),
  bloodGroup: z.string().trim().max(10).optional().default(''),
  height: z.string().trim().max(30).optional().default(''),
  weight: z.string().trim().max(30).optional().default(''),
  address: z.string().trim().max(300).optional().default(''),
  allergies: z.array(z.string().trim().max(100)).max(50).optional().default([]),
  chronicConditions: z.array(z.string().trim().max(100)).max(50).optional().default([]),
  currentMedications: z.array(z.string().trim().max(100)).max(50).optional().default([]),
  issuingHospital: z.string().trim().max(150).optional().default('City General Hospital'),
  emergencyContact: z
    .object({
      name: z.string().trim().max(120).default(''),
      relation: z.string().trim().max(80).default(''),
      phone: z.string().trim().max(40).default(''),
    })
    .optional()
    .default({ name: '', relation: '', phone: '' }),
  insurance: z
    .object({
      provider: z.string().trim().max(150).default(''),
      policy: z.string().trim().max(100).default(''),
      validUntil: z.string().trim().max(30).default(''),
    })
    .optional()
    .default({ provider: '', policy: '', validUntil: '' }),
});

export const registerHospitalBodySchema = z.object({
  name: z.string().trim().min(1, 'Hospital name is required').max(150),
  email: z.string().trim().email('Valid email address is required').max(200),
  password: strongPasswordSchema,
  phone: z.string().trim().max(40).optional().default(''),
  licenseNumber: z.string().trim().max(80).optional().default(''),
  address: z.string().trim().max(300).optional().default(''),
  contactPerson: z.string().trim().max(120).optional().default(''),
  department: z.string().trim().max(100).optional().default('General'),
});

export const updateUserBodySchema = z
  .object({
    id: z.string().trim().max(64).optional(),
    role: z.enum(['Patient', 'Hospital', 'Admin']).optional(),
    name: z.string().trim().min(1).max(150).optional(),
    email: z.string().trim().email().max(200).optional(),
    phone: z.string().trim().max(40).optional(),
    dob: z.string().trim().max(30).optional(),
    gender: z.string().trim().max(40).optional(),
    bloodGroup: z.string().trim().max(10).optional(),
    height: z.string().trim().max(30).optional(),
    weight: z.string().trim().max(30).optional(),
    address: z.string().trim().max(300).optional(),
    allergies: z.array(z.string().trim().max(100)).max(50).optional(),
    chronicConditions: z.array(z.string().trim().max(100)).max(50).optional(),
    currentMedications: z.array(z.string().trim().max(100)).max(50).optional(),
    issuingHospital: z.string().trim().max(150).optional(),
    emergencyContact: z
      .object({
        name: z.string().trim().max(120),
        relation: z.string().trim().max(80),
        phone: z.string().trim().max(40),
      })
      .optional(),
    insurance: z
      .object({
        provider: z.string().trim().max(150),
        policy: z.string().trim().max(100),
        validUntil: z.string().trim().max(30),
      })
      .optional(),
    licenseNumber: z.string().trim().max(80).optional(),
    contactPerson: z.string().trim().max(120).optional(),
    department: z.string().trim().max(100).optional(),
    verified: z.boolean().optional(),
    status: z.enum(['pending', 'verified', 'rejected']).optional(),
  })
  .passthrough();

export const addMedicalRecordBodySchema = z.object({
  type: z.enum(['prescription', 'lab', 'imaging', 'consultation', 'vaccine']),
  title: z.string().trim().min(1, 'Record title is required').max(200),
  doctor: z.string().trim().min(1, 'Doctor name is required').max(150),
  hospital: z.string().trim().min(1, 'Hospital/Clinic name is required').max(150),
  date: z.string().trim().min(1, 'Record date is required').max(30),
  summary: z.string().trim().min(1, 'Summary is required').max(1000),
  details: z.string().max(5000).optional().default(''),
  tags: z.array(z.string().trim().max(50)).max(20).optional().default([]),
  fileName: z.string().trim().max(255).optional(),
  fileSize: z.string().trim().max(50).optional(),
});

export const logActivityBodySchema = z.object({
  type: z.enum(['record_added', 'tier_scan', 'profile_updated', 'account_created']),
  details: z.string().trim().min(1, 'Activity details are required').max(500),
  extra: z
    .object({
      hospitalName: z.string().trim().max(150).optional(),
      department: z.string().trim().max(100).optional(),
      accessTier: z.enum(['Tier 1', 'Tier 2', 'Tier 3']).optional(),
      reason: z.string().trim().max(250).optional(),
    })
    .optional(),
  scannedPatientId: z.string().trim().max(64).regex(idFormatRegex).optional(),
});

export const requestOtpBodySchema = z.object({
  patientId: z
    .string()
    .trim()
    .min(1, 'patientId is required')
    .max(64)
    .regex(idFormatRegex, 'Invalid patientId format'),
  requestedBy: z.string().trim().max(150).optional(),
});

export const verifyOtpBodySchema = z.object({
  patientId: z
    .string()
    .trim()
    .min(1, 'patientId is required')
    .max(64)
    .regex(idFormatRegex, 'Invalid patientId format'),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'OTP must be a 6-digit numeric code'),
});

export const aiChatBodySchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(2000),
});

const formatZodError = (err: z.ZodError): string => {
  return err.issues.map((issue) => issue.message).join('; ');
};

export const validateBody =
  <T extends z.ZodTypeAny>(schema: T) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      res.status(400).json({ error: formatZodError(result.error) });
      return;
    }
    req.body = result.data;
    next();
  };

export const validateParams =
  <T extends z.ZodTypeAny>(schema: T) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params ?? {});
    if (!result.success) {
      res.status(400).json({ error: formatZodError(result.error) });
      return;
    }
    req.params = result.data as Record<string, string>;
    next();
  };

export const validateQuery =
  <T extends z.ZodTypeAny>(schema: T) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query ?? {});
    if (!result.success) {
      res.status(400).json({ error: formatZodError(result.error) });
      return;
    }
    next();
  };
