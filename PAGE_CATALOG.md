# HOA Survey Application - Page Catalog

## Overview

This document catalogs all pages/routes in the HOA Survey application, organized by functional areas and user roles.

## Application Structure

### Core Application Pages

#### **Public/Unauthenticated Pages**

1. **Landing/Home Page** (`/`)
   - Route: `app/page.tsx`
   - Purpose: Main landing page for the application
   - Access: Public

2. **Login Page** (`/login`)
   - Route: `app/login/page.tsx`
   - Purpose: User authentication
   - Access: Public

3. **Forgot Password** (`/forgot-password`)
   - Route: `app/forgot-password/page.tsx`
   - Purpose: Password reset request
   - Access: Public

4. **Reset Password** (`/reset-password`)
   - Route: `app/reset-password/page.tsx`
   - Purpose: Password reset form
   - Access: Public (with token)

#### **Setup/Onboarding Pages**

5. **Setup Page** (`/setup`)
   - Route: `app/setup/page.tsx`
   - Purpose: Initial application setup
   - Access: First-time setup

6. **JWT Secret Setup** (`/setup/jwt-secret`)
   - Route: `app/setup/jwt-secret/page.tsx`
   - Purpose: JWT secret configuration
   - Access: Setup process

#### **Survey Response Pages**

7. **Survey Response** (`/survey/[token]`)
   - Route: `app/survey/[token]/page.tsx`
   - Purpose: Public survey response form
   - Access: Public (with valid token)

8. **Survey Signature** (`/survey/[token]/sign/[signatureToken]`)
   - Route: `app/survey/[token]/sign/[signatureToken]/page.tsx`
   - Purpose: Digital signature for survey responses
   - Access: Public (with valid tokens)

#### **Invitation Pages**

9. **Accept Invitation** (`/invite/[token]`)
   - Route: `app/invite/[token]/page.tsx`
   - Purpose: Admin invitation acceptance
   - Access: Public (with valid token)

### Dashboard Pages (Authenticated Admin)

#### **Main Dashboard**

10. **Dashboard Home** (`/dashboard`)
    - Route: `app/dashboard/page.tsx`
    - Purpose: Main dashboard with survey overview
    - Access: Authenticated admins

#### **Admin Management**

11. **Admin List** (`/dashboard/admins`)
    - Route: `app/dashboard/admins/page.tsx`
    - Purpose: Manage admin users
    - Access: Full admin access

12. **Invite Admin** (`/dashboard/invite`)
    - Route: `app/dashboard/invite/page.tsx`
    - Purpose: Send admin invitations
    - Access: Full admin access

#### **Survey Management**

13. **Create Survey** (`/dashboard/surveys/create`)
    - Route: `app/dashboard/surveys/create/page.tsx`
    - Purpose: Create new surveys
    - Access: Authenticated admins

14. **Edit Survey** (`/dashboard/surveys/[id]/edit`)
    - Route: `app/dashboard/surveys/[id]/edit/page.tsx`
    - Purpose: Edit existing surveys
    - Access: Survey owner or full admin

15. **Survey Results** (`/dashboard/surveys/[id]/results`)
    - Route: `app/dashboard/surveys/[id]/results/page.tsx`
    - Purpose: View survey responses and analytics
    - Access: Survey owner or full admin

16. **Non-Respondents** (`/dashboard/surveys/[id]/nonrespondents`)
    - Route: `app/dashboard/surveys/[id]/nonrespondents/page.tsx`
    - Purpose: View and manage non-responding members
    - Access: Survey owner or full admin

#### **Member List Management**

17. **Member Lists Overview** (`/dashboard/member-lists`)
    - Route: `app/dashboard/member-lists/page.tsx`
    - Purpose: Manage member lists
    - Access: Authenticated admins

18. **Member List Details** (`/dashboard/member-lists/[id]`)
    - Route: `app/dashboard/member-lists/[id]/page.tsx`
    - Purpose: View/edit specific member list
    - Access: Authenticated admins

#### **Settings & Configuration**

19. **Settings** (`/dashboard/settings`)
    - Route: `app/dashboard/settings/page.tsx`
    - Purpose: Application settings
    - Access: Authenticated admins

#### **Testing & Development**

20. **Test Email** (`/dashboard/test-email`)
    - Route: `app/dashboard/test-email/page.tsx`
    - Purpose: Test email functionality
    - Access: Authenticated admins

## API Routes Structure

### Authentication APIs (`/api/auth/`)

- `login` - User login
- `logout` - User logout
- `me` - Get current user info
- `invite` - Send admin invitations
- `accept-invite` - Accept admin invitations
- `resend-invite` - Resend invitations
- `forgot-password` - Password reset request
- `reset-password` - Password reset
- `reset-admin-password` - Admin password reset
- `reset-my-password` - Self password reset
- `resend-verification` - Email verification
- `signup` - User registration

### Admin Management APIs (`/api/admins/`)

- `GET /api/admins` - List all admins
- `GET /api/admins/[id]` - Get specific admin
- `PUT /api/admins/[id]` - Update admin
- `DELETE /api/admins/[id]` - Delete admin

### Survey APIs (`/api/surveys/`)

- `GET /api/surveys` - List surveys
- `POST /api/surveys` - Create survey
- `GET /api/surveys/[id]` - Get survey details
- `PUT /api/surveys/[id]` - Update survey
- `DELETE /api/surveys/[id]` - Delete survey
- `POST /api/surveys/[id]/close` - Close survey
- `POST /api/surveys/[id]/send-initial` - Send initial survey emails
- `GET /api/surveys/[id]/results` - Get survey results
- `GET /api/surveys/[id]/export` - Export survey data
- `GET /api/surveys/[id]/nonrespondents` - Get non-respondents
- `GET /api/surveys/[id]/non-respondents` - Alternative non-respondents endpoint
- `POST /api/surveys/[id]/remind` - Send reminders
- `POST /api/surveys/[id]/remind/[responseId]` - Send individual reminders

### Response APIs (`/api/responses/`)

- `GET /api/responses/[token]` - Get survey response form
- `POST /api/responses/[token]` - Submit survey response
- `POST /api/responses/[token]/request-signature` - Request digital signature
- `GET /api/responses/[token]/sign/[signatureToken]` - Get signature page

### Member List APIs (`/api/member-lists/`)

- `GET /api/member-lists` - List member lists
- `POST /api/member-lists` - Create member list
- `GET /api/member-lists/[id]` - Get member list details
- `PUT /api/member-lists/[id]` - Update member list
- `DELETE /api/member-lists/[id]` - Delete member list
- `GET /api/member-lists/[id]/members` - Get list members
- `POST /api/member-lists/[id]/members` - Add member
- `GET /api/member-lists/[id]/members/[memberId]` - Get specific member
- `PUT /api/member-lists/[id]/members/[memberId]` - Update member
- `DELETE /api/member-lists/[id]/members/[memberId]` - Delete member

### Settings APIs (`/api/settings/`)

- `GET /api/settings/env` - Get environment settings
- `POST /api/settings/restart` - Restart application
- `GET /api/settings/development-mode` - Get dev mode status

### Setup APIs (`/api/setup/`)

- `GET /api/setup/status` - Get setup status
- `POST /api/setup/complete` - Complete setup
- `POST /api/setup/jwt-secret` - Set JWT secret
- `POST /api/setup/test-email` - Test email configuration
- `POST /api/setup/verify` - Verify setup

### Public APIs (`/api/public/`)

- `GET /api/public/hoa-name` - Get HOA name and logo

### Testing APIs (`/api/test-email/`)

- `POST /api/test-email` - Send test email

### Debug APIs (`/api/_debug/`)

- Various debugging endpoints

## Component Structure

### Shared Components (`/components/`)

- `Footer.tsx` - Application footer
- `Header.tsx` - Application header
- `SurveyBuilder.tsx` - Survey creation/editing interface
- `ThemeToggle.tsx` - Dark/light theme toggle

### Form Components (`/components/forms/`)

- `FormField.tsx` - Form field wrapper with label, error, and help text
- `Input.tsx` - Styled input component
- `Textarea.tsx` - Styled textarea component
- `Select.tsx` - Styled select dropdown component
- `FileInput.tsx` - Styled file input component

## Page Organization Analysis

### Current Issues

1. **Mixed Concerns**: Some pages handle both UI and business logic
2. **Large Components**: Dashboard pages are quite large and handle multiple responsibilities
3. **Repeated Patterns**: Similar responsive layouts across different pages
4. **API Coupling**: Pages are tightly coupled to specific API endpoints

### Modularization Opportunities

1. **Layout Components**: Extract common page layouts (forms, lists, details)
2. **Business Logic Hooks**: Separate data fetching and state management
3. **Shared UI Components**: Create reusable form fields, tables, cards
4. **Route Guards**: Extract authentication and permission logic
5. **API Abstraction**: Create service layers for API calls

### Recommended Structure

```
components/
├── layouts/          # Page layout components
├── forms/           # Form components
├── data/            # Data display components (tables, cards, etc.)
├── common/          # Shared UI components
└── providers/       # Context providers

hooks/
├── api/            # API-related hooks
├── auth/           # Authentication hooks
└── ui/             # UI state hooks

services/
├── api/            # API service functions
└── utils/          # Utility functions

types/
└── api.ts          # Shared type definitions
```

This catalog provides a foundation for understanding the current application structure and planning modularization improvements.</content>
<parameter name="filePath">/Users/jasoncongdon/projects/hoa_survey/PAGE_CATALOG.md
