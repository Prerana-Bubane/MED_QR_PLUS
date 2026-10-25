import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for authentication login endpoint:
 * Max 10 attempts per 15 minutes per IP to mitigate credential stuffing and brute-force attacks.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too many login attempts from this IP. Please try again after 15 minutes.',
  },
});

/**
 * Rate limiter for account registration endpoints (Patient & Hospital):
 * Max 5 registrations per 15 minutes per IP to prevent automated account spam.
 */
export const registerRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too many registration attempts from this IP. Please try again after 15 minutes.',
  },
});

/**
 * Rate limiter for OTP generation requests (`POST /api/scan/request-otp`):
 * Max 5 OTP requests per 5 minutes per IP.
 */
export const otpRequestRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too many OTP generation requests. Please wait 5 minutes before requesting another code.',
  },
});

/**
 * Rate limiter for OTP verification (`POST /api/scan/verify-otp`):
 * Max 5 verification attempts per 15 minutes per IP.
 */
export const otpVerifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too many OTP verification attempts from this IP. Please wait 15 minutes before trying again.',
  },
});

/**
 * Rate limiter for OTP status polling (`GET /api/scan/otp/:patientId`):
 * Max 30 requests per minute per IP.
 */
export const otpStatusRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too many OTP status requests. Please slow down.',
  },
});
