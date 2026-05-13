# HOA Survey — Claude Code Guide

## Project Overview

Full-stack web application for managing HOA surveys. Admins create surveys, send them to member lists, track responses, and view results.

- Next.js 16 App Router + TypeScript (strict) + React 19
- SQLite database via Prisma 6 ORM
- JWT authentication (httpOnly cookie), role-based access, admin invite hierarchy
- AES-256-CBC encryption on all member/admin PII
- Nodemailer SMTP for bulk survey sends and reminders
- Vitest test suite (22 files, serial execution)

## Commands

```bash
npm run dev            # Start dev server (localhost:3000)
npm run build          # prisma generate + next build
npm run test           # Run full test suite with temp test.db (alias for test:db)
npm run lint           # ESLint — zero warnings allowed
npm run type-check     # tsc --noEmit

npx prisma migrate dev # Apply schema changes (creates migration file)
npx prisma db push     # Sync schema without migration (dev/test only)
npx prisma studio      # Browse database in browser
```

## Architecture

```
app/
  api/          # All API route handlers
    auth/       # Login, logout, 2FA, password reset, invite
    surveys/    # Survey CRUD, send, remind, results, export
    responses/  # Public token-based response submission + signing
    member-lists/ # Member list + member CRUD
    admins/     # Admin management
    settings/   # Env config, dev mode toggle
    setup/      # First-run wizard endpoints
  (pages)/      # Next.js App Router page components
components/     # Shared React components (survey builder, forms, UI)
lib/
  auth/         # jwt.ts, jwt-edge.ts, password.ts, totp.ts, permissions.ts, AuthContext.tsx
  email/        # send.ts (Nodemailer wrapper, bulk send, HTML templates)
  encryption.ts # AES-256-CBC encrypt/decrypt for PII
  prisma.ts     # Prisma client singleton
  validation/
    schemas.ts  # All Zod schemas (login, survey, member, response, invite, etc.)
prisma/
  schema.prisma # Models: SystemConfig, Admin, MemberList, Member, Survey, Question, Response, Answer, Reminder
  migrations/   # Migration history
test/           # All 22 Vitest test files (flat directory)
  vitest.setup.ts # Global auth mock
proxy.ts        # Edge middleware — JWT verification, route protection, header injection
```

## Key Patterns

**API validation** — Every route handler validates with Zod schemas from `lib/validation/schemas.ts` before touching the database.

**Encryption** — Member and admin PII is always encrypted at rest. Use `decryptMemberData()` before use, `encryptMemberData()` before storage. Never store raw emails/names/addresses. Key: `ENCRYPTION_KEY` env var (falls back to `JWT_SECRET`).

**Prisma** — Always import from `lib/prisma.ts` singleton. Never call `new PrismaClient()` directly.

**JWT** — Use `lib/auth/jwt.ts` in API routes (Node.js runtime); use `lib/auth/jwt-edge.ts` in middleware/edge functions. The middleware (`proxy.ts`) injects `x-admin-id` and `x-admin-role` headers so route handlers don't re-verify tokens.

**Email** — Use `sendBulkEmails()` from `lib/email/send.ts` for any batch sending. It handles batching (25/batch), delays (1s between batches), and retries.

**Error responses** — `NextResponse.json({ error: "..." }, { status: NNN })`. ZodError details go in a `details` field.

**Transactions** — Survey creation is atomic: survey + questions + one Response record per member all created in `prisma.$transaction()`.

**Public vs admin access** — Public survey responses use a unique `response.token` in the URL (no login required). Admin access requires the `auth-token` JWT cookie.

## Database

SQLite, file at `/data/hoa-survey.db` in production. Core models:

| Model | Purpose |
|-------|---------|
| SystemConfig | Single config row: setup status, SMTP, HOA name/logo, app URL |
| Admin | Admins with roles (FULL, VIEW_ONLY, LIMITED), 2FA, invite relationships |
| MemberList | Named groups of Members |
| Member | HOA resident — lot, name (enc), email (enc), address (enc) |
| Survey | Survey with open/close dates, linked MemberList, thresholds |
| Question | MULTI_SINGLE, MULTI_MULTI, YES_NO, APPROVE_DISAPPROVE, RATING_5, PARAGRAPH |
| Response | One per member per survey; unique token for public URL |
| Answer | One per question per Response |
| Reminder | Tracks reminder emails sent per member per survey |

## Authentication & Authorization

- JWT in `auth-token` httpOnly cookie, 24h expiry, HS256
- Roles: `FULL` (all features), `VIEW_ONLY` (read-only), `LIMITED` (unverified email, cannot log in)
- Admin invite tree: admins can only manage admins they directly/transitively invited — enforced in `lib/auth/permissions.ts` via `canManageAdmin()` and `getManagedAdmins()`
- Optional TOTP 2FA per admin (`lib/auth/totp.ts`)

## Environment Variables

See `.env.example` for the full list. Critical vars:

```bash
DATABASE_URL          # file path to SQLite DB
JWT_SECRET            # must be set in production
ENCRYPTION_KEY        # AES key for PII (defaults to JWT_SECRET if unset)
SMTP_HOST/PORT/USER/PASS/FROM
HOA_NAME
APP_URL               # used in all email links
NODE_ENV
LOG_LEVEL=debug       # enables verbose server logging
```

SMTP settings and HOA config can also be updated at runtime via the `/api/settings/env` endpoint (stored in SystemConfig).

## Testing

Vitest, serial execution (`threads: false`) to prevent DB race conditions.

```bash
npm run test:db
# Sets DATABASE_URL=file:./test.db, runs prisma db push, runs all tests, deletes test.db
```

**Global mock** — `test/vitest.setup.ts` mocks `verifyToken` to return `{ adminId: "test-admin", role: "FULL" }` by default. Override per-test with `vi.mocked(verifyToken).mockResolvedValue(...)`.

**Test types:**
- API/integration tests with mocked Prisma (most common)
- Integration tests hitting a real test DB (use `prisma.*.deleteMany()` in `beforeEach`)
- React component tests with Testing Library — add `/* @vitest-environment jsdom */` at top of file

No dedicated factory helpers; test data is created inline with Prisma calls.

## Docker / Deployment

```bash
docker compose -f docker-compose.dev.yml up   # local dev
docker compose -f docker-compose.prod.yml up  # production
```

`startup.sh` runs on container start: generates Prisma client, runs migrations (`migrate deploy`, falls back to `db push`), optionally seeds if `PRISMA_SEED=true` and no admin exists.

GitHub Actions (`.github/workflows/docker-build.yml`) builds and pushes to `ghcr.io` on push to `main` (tagged `latest`) or `develop`.
