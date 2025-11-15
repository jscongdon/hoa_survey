# HOA Survey

A secure, production-ready survey management system for HOA communities built with Next.js 15, TypeScript, Prisma, and SQLite.

## Documentation

- [Development Workflow](./WORKFLOW.md) - Branch strategy, deployment, and development practices
- [Docker Deployment Guide](./DOCKER-DEPLOYMENT.md) - Detailed deployment instructions

## Features

- **First-Time Setup Wizard**: Guided setup for HOA configuration, SMTP settings, and admin account creation
- **Email Verification**: Secure administrator account activation via email verification
- **Admin Dashboard**: Manage surveys, member lists, and view live results
- **Survey Builder**: Create surveys with multiple question types (multiple choice, rating, paragraph, yes/no)
- **Member List Management**: Import CSV files or create empty lists and add members manually
- **Email Distribution**: Send personalized survey links to homeowners via email
- **Response Tracking**: View real-time response rates and results with progress indicators
- **Minimum Response Threshold**: Set required response counts with automatic tracking
- **Role-Based Access**: Full Access and View-Only admin roles
- **Data Export**: CSV exports of survey responses and non-respondents
- **Dark Mode**: Full dark mode support throughout the UI

## Quick Start

### Docker Deployment (Recommended)

1. **Clone and configure:**
```bash
git clone https://github.com/YOUR_USERNAME/hoa_survey.git
cd hoa_survey
```

2. **Deploy with Docker:**
```bash
docker compose up -d --build
```

3. **Access the setup wizard:**
   - Navigate to `http://localhost:3000`
   - You'll be automatically redirected to `/setup`
   - Follow the guided setup wizard

### Setup Wizard Steps

The first time you access the application, you'll be guided through:

1. **HOA Configuration**
   - Enter your HOA name
   - Optionally add a logo URL

2. **Email Server Setup**
   - Configure SMTP settings
   - Test email delivery

3. **Administrator Account**
   - Create your admin account
   - Receive verification email
   - Click verification link to activate full access

4. **Start Using**
   - Log in with your credentials
   - Create member lists and surveys

## Tech Stack

- **Frontend**: Next.js 15 (App Router) + React 18 + Tailwind CSS
- **Backend**: Next.js API Routes (Node.js)
- **Database**: SQLite + Prisma ORM
- **Authentication**: JWT + bcryptjs
- **Validation**: Zod
- **Email**: Nodemailer (SMTP configurable)
- **Styling**: Tailwind CSS with dark mode support

## Prerequisites

- Node.js 18+ and npm/yarn
- SMTP email account (Gmail, SendGrid, etc.) - optional for local dev

## Local Development Setup

### 1. Clone and Install

```bash
git clone <repo-url>
cd hoa_survey
npm install
```

### 2. Environment Setup

```bash
# Copy example env
cp .env.example .env.local
```

Edit `.env.local` and update the values (especially `JWT_SECRET` and SMTP settings).

### 3. Prisma Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations (create database)
npx prisma migrate deploy || true

# Seed initial data (optional admin account)
npm run prisma:seed
```

### 4. Email Configuration

Edit `.env.local` with your SMTP settings:

```text
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourhoa.com
```

**Gmail Setup:**

- Enable 2FA on your Google account
- Generate an [App Password](https://support.google.com/accounts/answer/185833)
- Use the app password in `SMTP_PASS`

### 5. JWT Secret

Update `JWT_SECRET` in `.env.local`:

```text
JWT_SECRET="generate-a-secure-random-key-here"
```

Generate a secure key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 6. Start Development Server

```bash
npm run dev
```

Visit <http://localhost:3000>

## Project Structure

```text
hoa_survey/
├── app/
│   ├── api/                    # API routes
│   │   ├── auth/              # Authentication endpoints
│   │   ├── surveys/           # Survey CRUD
│   │   ├── member-lists/      # Member list management
│   │   ├── responses/         # Survey response handling
│   │   └── results/           # Results and analytics
│   ├── dashboard/             # Admin dashboard pages
│   ├── login/                 # Login page
│   ├── survey/[token]/        # Public survey page
│   ├── layout.tsx             # Root layout
│   └── globals.css            # Global styles
├── lib/
│   ├── auth/                  # Auth utilities (JWT, 2FA, password hashing)
│   ├── email/                 # Email service (Nodemailer)
│   ├── validation/            # Zod schemas
│   ├── prisma.ts              # Prisma client singleton
│   └── db/                    # Database utilities
├── prisma/
│   ├── schema.prisma          # Prisma data model
│   └── migrations/            # Database migrations
├── middleware.ts              # Next.js middleware (auth)
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript configuration
├── next.config.js             # Next.js configuration
└── tailwind.config.js         # Tailwind CSS configuration
```

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Create first admin or sign up with invite token
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/2fa/status` - Check 2FA status
- `POST /api/auth/2fa/setup` - Setup TOTP

### Surveys

- `GET /api/surveys` - List all surveys
- `POST /api/surveys` - Create survey
- `GET /api/surveys/{id}` - Get survey details
- `PUT /api/surveys/{id}` - Update survey
- `DELETE /api/surveys/{id}` - Delete survey
- `POST /api/surveys/{id}/publish` - Publish survey and create response tokens
- `POST /api/surveys/{id}/questions` - Add question
- `POST /api/surveys/{id}/send-reminder` - Send reminder emails

### Member Lists

- `GET /api/member-lists` - List all member lists
- `POST /api/member-lists` - Create member list (with CSV upload)
- `GET /api/member-lists/{id}` - Get list details
- `DELETE /api/member-lists/{id}` - Delete list

### Responses

- `GET /api/responses/{token}` - Get survey for respondent
- `PUT /api/responses/{token}` - Submit survey response

### Results

- `GET /api/results/{surveyId}` - Get survey results and analytics

## Deployment

### Docker (Recommended)

Build and run with Docker Compose:

```bash
docker compose up --build
```

This will:

- Start a Node.js container with the app
- Create a SQLite database in a named volume
- Expose the app on port 3000

Docker configuration:

```yaml
# docker-compose.yml example
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: file:/data/hoasurvey.db
      JWT_SECRET: ${JWT_SECRET}
      SMTP_HOST: ${SMTP_HOST}
      # ... other env vars
    volumes:
      - hoasurvey-data:/data
volumes:
  hoasurvey-data:
```

### Traditional Node.js Hosting

#### 1. Build for Production

```bash
npm run build
```

#### 2. Environment Variables

Set these in your hosting dashboard:

```text
DATABASE_URL=file:/data/hoasurvey.db
JWT_SECRET=<secure-key>
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=noreply@yourhoa.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production
```

#### 3. Database Setup

```bash
# SSH into server
ssh user@server

# Navigate to app directory
cd hoa_survey

# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
```

#### 4. Start Application

```bash
npm start
```

The app will listen on port 3000. Configure your reverse proxy (Nginx, Apache) to forward requests to <http://localhost:3000>

## Database Schema

The app uses Prisma ORM with SQLite and the following models:

- **Admin**: Users with admin access (FULL role, role-based)
- **MemberList**: Named lists of members/homeowners (for reuse)
- **Member**: Individual homeowner records with lot number, name, email
- **Survey**: Survey documents with title, description, open/close dates
- **Question**: Survey questions with type, text, and options (stored as JSON)
- **Response**: Submitted survey responses linked to members and surveys
- **Reminder**: Tracking for sent reminder emails

See `prisma/schema.prisma` for the complete data model.

## Email Templates

Email templates are generated dynamically in `lib/email/send.ts`. Customize the `generateSurveyEmail()` function to match your branding.

To add a logo:

```typescript
// In generateSurveyEmail(), add:
<img src="https://yourdomain.com/logo.png" alt="HOA Logo" style="max-width: 200px; margin-bottom: 20px;" />
```

## Security

- **TypeScript Strict Mode**: Full type safety
- **Password Hashing**: bcryptjs with 12 salt rounds
- **JWT Tokens**: Secure, httpOnly cookies
- **HTTPS Only in Production**: Secure headers configured
- **CORS & CSP**: Configured in `next.config.js`
- **Input Validation**: Zod schemas on all inputs
- **SQL Injection Prevention**: Prisma parameterized queries

## Development Commands

```bash
npm run dev           # Start dev server
npm run build         # Build for production
npm start             # Start production server
npm run lint          # Run ESLint
npm run type-check    # TypeScript type checking
npm run prisma:generate    # Generate Prisma client
npm run prisma:migrate     # Run migrations (dev)
npm run prisma:push        # Push schema to DB
npm run prisma:studio      # Open Prisma Studio
```

## Troubleshooting

### Prisma Client Not Found

```bash
npm install
npm run prisma:generate
```

### Database File Issues

SQLite stores data in `/data/hoasurvey.db`. If you get connection errors:

```bash
# Ensure /data directory exists
mkdir -p /data

# Regenerate database
npx prisma migrate deploy
```

### Email Not Sending

- Verify SMTP credentials in `.env.local`
- Check spam folder
- For Gmail: Use App Password, not regular password
- Test connection with: `telnet smtp.example.com 587`

### Build Fails

```bash
rm -rf .next node_modules
npm install
npm run build
```

### TypeScript Errors in VSCode

If VSCode shows stale errors:

1. Press `Cmd+Shift+P` (or `Ctrl+Shift+P`)
2. Type: `TypeScript: Reload Projects`
3. Press Enter

Or restart VSCode entirely.

## Contributing

1. Keep TypeScript strict
2. Follow Prettier formatting (`npm run prettier`)
3. Write tests for new features
4. Document API changes in this README

## License

Proprietary - HOA Survey

## Support

For issues or questions, contact your development team.

---

**Deployment Checklist:**

- [ ] SQLite database directory created (`/data`)
- [ ] Environment variables set (JWT_SECRET, SMTP, etc.)
- [ ] SMTP credentials verified and tested
- [ ] JWT_SECRET is cryptographically secure
- [ ] NEXT_PUBLIC_APP_URL points to production domain
- [ ] Database migrations run: `npx prisma migrate deploy`
- [ ] Initial admin account seeded: `npm run prisma:seed`
- [ ] Test survey created and sent to test recipient
- [ ] Email delivery verified in inbox
- [ ] Backup strategy in place for `/data` directory
- [ ] SSL/HTTPS enabled (via reverse proxy)
- [ ] Docker build tested locally: `docker compose up --build`

**Post-Deployment:**

1. Test login flow end-to-end
2. Create test survey with test member list (CSV)
3. Verify email delivery to actual inbox
4. Check response submission works
5. Verify data appears in results page
6. Test dark mode toggle
7. Monitor application logs in first 24 hours
