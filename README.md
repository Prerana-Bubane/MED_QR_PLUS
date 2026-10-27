# MedQR+ — 3-Tier Encrypted Emergency Medical Pass & Clinical Vault

MedQR+ is a full-stack emergency medical identity and clinical record platform built with **React 19 + TypeScript + Vite + Tailwind CSS v4** on the frontend and **Express 5 + SQLite (`node:sqlite` WAL mode) + Zod + AES-256-GCM** on the backend.

## Architecture & Security Overview
┌────────────────────────────┐
│        React Frontend      │
│   React + TypeScript + Vite│
└──────────────┬─────────────┘
               │ /api requests
               ▼
┌────────────────────────────┐
│       Express API          │
│ Auth • Validation • OTP    │
│ Access Control • Audit Logs│
└──────────────┬─────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌───────────────┐  ┌────────────────┐
│ SQLite (WAL)  │  │ Crypto Services│
│ Persistent DB │  │ HKDF + AES-GCM │
└───────────────┘  └────────────────┘
- **Backend as Single Source of Truth**: All user profiles, medical records, OTP codes, and hospital audit logs are stored in SQLite (`server/data/medqr.sqlite` in WAL mode) using atomic `BEGIN IMMEDIATE` transactions (`server/db.ts`).
- **3-Tier Authenticated Encryption at Rest (`server/crypto.ts`)**:
  - Uses **HKDF-SHA256** (`DATA_ENCRYPTION_KEY`) to derive three distinct 256-bit keys (`tier1`, `tier2`, `tier3`) and encrypts patient/hospital records with **AES-256-GCM** (random 96-bit IV + 128-bit authentication tag):
    - **Tier 3 Ciphertext**: Emergency summary fields (`dob`, `gender`, `bloodGroup`, `allergies`, `chronicConditions`, `currentMedications`, `emergencyContact`, `issuingHospital`).
    - **Tier 2 Ciphertext**: Confidential clinical records (`medicalRecords` vault, `insurance`, `height`, `weight`, `address`).
    - **Tier 1 Ciphertext**: Account & hospital audit trails (`activityLog`, `patientsAccessed`, `scanLogs`).
- **Server-Enforced Tier Locking & OTP Verification**:
  - Scanning a patient's QR Pass defaults to **Tier 3** (emergency summary only; `medicalRecords` are withheld on the server).
  - Unlocking **Tier 2** requires verifying a 6-digit one-time passcode (`POST /api/scan/verify-otp`) using `crypto.timingSafeEqual`, which issues a short-lived (15-minute) signed `vaultToken` JWT (`x-vault-token`) and atomically logs the access in both the patient's `activityLog` and the hospital's `scanLogs` / `patientsAccessed`.
- **Input Validation & Rate Limiting**:
  - Every route validates `req.body`, `req.params`, and `req.query` using strict **Zod** schemas (`server/validation.ts`).
  - Authentication, registration, and OTP endpoints are protected by **`express-rate-limit`** (`server/middleware/rateLimit.ts`) plus per-OTP attempt limits (`MAX_OTP_ATTEMPTS = 5`).

---

## Local Setup & Development

### Prerequisites
- **Node.js** `>= 22.5.0` (tested on Node.js `v24.x`, which includes built-in `node:sqlite`)
- **npm** `>= 10.x`

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the project root and set strong secrets:
```bash
cp .env.example .env
```

> **Note:** Both `JWT_SECRET` and `DATA_ENCRYPTION_KEY` (minimum 16 characters, 32+ recommended) are strictly required at startup. The server will fail fast and exit if either is missing.

### 3. Start the Development Servers
```bash
npm run dev
```
This launches both processes concurrently:
- **Backend API Server**: `http://localhost:5000` (`tsx watch server/index.ts`)
- **Frontend Vite Dev Server**: `http://localhost:5173` (proxies `/api` and `/scan-result` to `http://localhost:5000`)

### Available Scripts
| Script | Command | Description |
| :--- | :--- | :--- |
| `npm run dev` | `concurrently "npm run server" "npm run dev:frontend"` | Starts backend (port `5000`) and Vite frontend (port `5173`) |
| `npm run server` | `tsx watch server/index.ts` | Runs the Express backend in watch mode |
| `npm run dev:frontend` | `vite` | Runs the Vite frontend dev server |
| `npm run build` | `tsc -b && vite build` | Type-checks TypeScript and builds the production SPA into `dist/` |
| `npm run start` | `tsx server/index.ts` | Starts the Express backend in production mode |
| `npm run lint` | `oxlint` | Lints the codebase with Oxlint |

---

## Environment Variables Reference

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | No | `5000` | Port on which the Express backend listens |
| `JWT_SECRET` | **Yes** | — | Secret key used to sign 7-day auth JWTs and 15-minute Tier 2 `vaultToken` JWTs |
| `DATA_ENCRYPTION_KEY` | **Yes** | — | Master secret (`>= 16` chars) used by HKDF-SHA256 to derive Tier 1/2/3 AES-256-GCM keys |
| `FRONTEND_ORIGIN` | No | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated list of allowed CORS origins (e.g. `https://your-app.vercel.app`) |
| `DATA_DIR` | No | `server/data` | Directory for persistent SQLite storage (e.g. `/var/data` on Render or `/data` on Railway) |
| `SQLITE_DB_PATH` | No | `<DATA_DIR>/medqr.sqlite` | Explicit file path override for the SQLite database file |
| `ENABLE_PUBLIC_TUNNEL` | No | `false` | Opt-in flag (`true`/`false`) to start an SSH tunnel (`localhost.run`) for mobile testing in non-production environments |
| `SEED_ADMIN_PASSWORD` | No | Random CSPRNG | Initial password (`>= 8` chars, not `password123`) for the seeded Admin account |
| `SEED_HOSPITAL_PASSWORD` | No | Random CSPRNG | Initial password (`>= 8` chars, not `password123`) for the seeded Hospital account |
| `SEED_PATIENT_PASSWORD` | No | Random CSPRNG | Initial password (`>= 8` chars, not `password123`) for the seeded Patient account |
| `VITE_API_URL` | No (Dev) / **Yes (Prod)** | `/api` | Base URL for backend API calls from the frontend (e.g. `https://medqr-backend.onrender.com/api`) |

---

## Seed / Demo Accounts

On first startup, if `medqr.sqlite` is empty, the server seeds three initial accounts. Their passwords are set from `SEED_ADMIN_PASSWORD`, `SEED_HOSPITAL_PASSWORD`, and `SEED_PATIENT_PASSWORD` in `.env` (or generated randomly via CSPRNG if those variables are omitted):

| Role | MedQR+ ID | Email | Verification Status | Password Source |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `ADMIN-001` | `admin@medqr.com` | Verified | `SEED_ADMIN_PASSWORD` in `.env` |
| **Hospital** | `HOSP-001` | `contact@citygeneral.com` | Verified (`verified: true`) | `SEED_HOSPITAL_PASSWORD` in `.env` |
| **Patient** | `MQR-2026-12345` | `john.doe@example.com` | Active | `SEED_PATIENT_PASSWORD` in `.env` |

You can also register new **Patient** (`MQR-YYYY-XXXXX`) and **Hospital** (`HOSP-XXXX`) accounts via `/register` with any password of at least 8 characters. Newly registered hospitals start in `pending` status until approved by an Admin in `/admin`.

---

## API Routes Reference

All protected routes require an `Authorization: Bearer <jwt>` header.

### System & Health
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Returns service status, timestamp, `usersCount`, LAN IP, and active tunnel info |
| `GET` | `/api/network-info` | Public | Returns `{ lanIp, lanUrl, publicUrl }` for local QR code scanning |

### Authentication & Registration
| Method | Endpoint | Auth | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | 10 / 15m | Authenticates by `{ email, password, role }` (`email` accepts email or MedQR+ ID) and returns `{ token, user }` |
| `POST` | `/api/auth/register/patient` | Public | 5 / 15m | Registers a new Patient with a server-generated `MQR-YYYY-XXXXX` ID and returns `{ token, user }` |
| `POST` | `/api/auth/register/hospital` | Public | 5 / 15m | Registers a new Hospital (`verified: false`, `status: 'pending'`) with a server-generated `HOSP-XXXX` ID and returns `{ token, user }` |
| `GET` | `/api/auth/me` | Bearer JWT | — | Returns `{ user }` for the currently authenticated token |

### Users, Medical Records & Activity Logs
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users` | Admin Only | Returns directory list of all users (confidential patient medical data is redacted) |
| `GET` | `/api/users/:id` | Bearer JWT | Returns user profile. When a verified Hospital requests a Patient without a valid `x-vault-token`, returns Tier 3 emergency summary (`medicalRecords: []`, `tierLocked: true`) |
| `PUT` | `/api/users/:id` | Owner or Admin | Updates allowed profile fields (`id`, `role`, and `passwordHash` are immutable; only Admins can update hospital `verified`/`status`) |
| `POST` | `/api/users/:id/records` | Patient Owner | Appends a new `MedicalRecord` with a server-generated UUID to the patient's encrypted vault |
| `DELETE` | `/api/users/:id/records/:recordId` | Patient Owner | Deletes a specific medical record from the patient's vault |
| `POST` | `/api/users/:id/activity` | Account Owner | Appends an `ActivityLog` entry; when logged by a Hospital with `scannedPatientId`, atomically updates both the hospital's `scanLogs`/`patientsAccessed` and the patient's `activityLog` |

### QR Scan & Tier 2 OTP Verification
| Method | Endpoint | Auth | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/scan/request-otp` | Patient Self or Hospital | 5 / 5m | Generates a 6-digit OTP (5-minute expiry) for `patientId` without exposing the OTP in the response |
| `GET` | `/api/scan/otp/:patientId` | Patient Owner Only | 30 / 1m | Returns `{ active, otp, expiresAt }` so the authenticated patient can view their active code on `/dashboard/qr` |
| `POST` | `/api/scan/verify-otp` | Bearer JWT | 5 / 15m | Verifies `{ patientId, otp }` (max 5 attempts before invalidation), atomically logs Tier 2 access to both patient and hospital audit logs, and returns `{ verified: true, accessTier: '2', vaultToken, auditLogged }` |
| `GET` | `/scan-result/:tier?id=<patientId>` | Public / `vaultToken` | — | Server-rendered emergency medical summary page (`tier` in `1..3`, requires `?id=`). Medical records are only rendered if a valid `vaultToken` is supplied |

### AI Clinical & Health Assistant
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/ai/chat` | Bearer JWT | Accepts `{ message }` and returns context-aware guidance based on the authenticated Patient's or Hospital's profile |

---

## Production Deployment

1. **Backend (Render or Railway)**:
   - Deploy using the included [`render.yaml`](./render.yaml) (mounts a persistent disk at `/var/data` with `DATA_DIR=/var/data`) or [`railway.json`](./railway.json) (`npm run start`).
   - Set `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, and `FRONTEND_ORIGIN=https://your-frontend-domain.vercel.app`.
2. **Frontend (Vercel)**:
   - Deploy the repository to Vercel (uses [`vercel.json`](./vercel.json) to build `dist/` with Vite).
   - Set `VITE_API_URL=https://your-backend-domain.onrender.com/api` in Vercel Project Settings.
