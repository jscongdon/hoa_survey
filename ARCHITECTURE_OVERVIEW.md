# HOA Survey Application - Architecture Overview

## Application Flow Diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│                    PUBLIC/UNAUTHENTICATED                        │
├─────────────────────────────────────────────────────────────────┤
│  Landing Page (/) ────→ Login (/login)                          │
│     │                        │                                  │
│     │                        ├───→ Forgot Password             │
│     │                        │                                  │
│     │                        └───→ Reset Password              │
│     │                                                           │
│     └───→ Survey Response (/survey/[token])                    │
│              │                                                  │
│              └───→ Digital Signature                           │
│                                                                 │
│  Invitation Acceptance (/invite/[token])                       │
│                                                                 │
│  Setup Process (/setup) ────→ JWT Config                       │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AUTHENTICATED DASHBOARD                        │
├─────────────────────────────────────────────────────────────────┤
│  Dashboard Home (/)                                             │
│  │                                                              │
│  ├───→ Admin Management (/admins)                              │
│  │     ├───→ Invite Admin (/invite)                            │
│  │     └───→ Admin Details                                     │
│  │                                                              │
│  ├───→ Survey Management                                       │
│  │     ├───→ Create Survey (/surveys/create)                   │
│  │     ├───→ Edit Survey (/surveys/[id]/edit)                  │
│  │     ├───→ Survey Results (/surveys/[id]/results)            │
│  │     └───→ Non-Respondents (/surveys/[id]/nonrespondents)    │
│  │                                                              │
│  ├───→ Member Lists (/member-lists)                            │
│  │     └───→ List Details (/member-lists/[id])                 │
│  │                                                              │
│  ├───→ Settings (/settings)                                    │
│  │                                                              │
│  └───→ Test Email (/test-email)                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```text
App Layout (app/layout.tsx)
├── Header (components/Header.tsx)
├── Main Content
│   ├── Public Pages
│   │   ├── Landing (app/page.tsx)
│   │   ├── Login (app/login/page.tsx)
│   │   ├── Password Reset (app/forgot-password/page.tsx + app/reset-password/page.tsx)
│   │   ├── Survey Response (app/survey/[token]/page.tsx)
│   │   ├── Digital Signature (app/survey/[token]/sign/[signatureToken]/page.tsx)
│   │   ├── Invitation (app/invite/[token]/page.tsx)
│   │   └── Setup (app/setup/page.tsx + app/setup/jwt-secret/page.tsx)
│   │
│   └── Dashboard Pages (app/dashboard/)
│       ├── Home (page.tsx)
│       ├── Admin Management
│       │   ├── List (admins/page.tsx)
│       │   └── Invite (invite/page.tsx)
│       ├── Survey Management
│       │   ├── Create (surveys/create/page.tsx)
│       │   ├── Edit (surveys/[id]/edit/page.tsx)
│       │   ├── Results (surveys/[id]/results/page.tsx)
│       │   └── Non-Respondents (surveys/[id]/nonrespondents/page.tsx)
│       ├── Member Lists
│       │   ├── Overview (member-lists/page.tsx)
│       │   └── Details (member-lists/[id]/page.tsx)
│       ├── Settings (settings/page.tsx)
│       └── Test Email (test-email/page.tsx)
└── Footer (components/Footer.tsx)
```

## API Architecture

```text
API Routes (app/api/)
├── Authentication (/auth/*)
│   ├── Login/Logout
│   ├── Password Management
│   ├── Invitations
│   └── User Management
│
├── Surveys (/surveys/*)
│   ├── CRUD Operations
│   ├── Response Management
│   ├── Results & Analytics
│   └── Notifications
│
├── Member Lists (/member-lists/*)
│   ├── List Management
│   └── Member CRUD
│
├── Settings (/settings/*)
│   ├── Configuration
│   └── System Management
│
├── Setup (/setup/*)
│   ├── Initial Configuration
│   └── System Verification
│
├── Public (/public/*)
│   └── Public Information
│
├── Responses (/responses/*)
│   ├── Survey Submissions
│   └── Digital Signatures
│
├── Testing (/test-email/)
│   └── Email Testing
│
└── Debug (/_debug/)
    └── Development Tools
```

## Data Flow Patterns

### Authentication Flow

```text
User Request → Middleware → API Route → Database → Response → UI Update
```

### Survey Management Flow

```text
Admin Action → API Route → Database → Email Service → UI Update
```

### Response Submission Flow

```text
User Form → Validation → API Route → Database → Email Notification → Confirmation
```

## Current Issues Identified

### 1. **Component Size & Complexity**

- Large page components handling multiple responsibilities
- Mixed UI logic, business logic, and API calls
- Difficult to test and maintain

### 2. **Code Duplication**

- Similar responsive patterns across pages
- Repeated form handling logic

### 3. **Tight Coupling**

- Pages directly coupled to API endpoints
- UI components mixed with business logic
- Hard to reuse components across different contexts

### 4. **State Management**

- Local state scattered across components
- No centralized state management
- Complex prop drilling

## Modularization Strategy

### ✅ Phase 1: Extract Shared Components (COMPLETED)

- ✅ Create reusable layout components (`DashboardLayout`, `FormLayout`, `ListLayout`, `PageLayout`)
- ✅ Extract common form patterns (`FormField`, `Input`, `Textarea`, `Select`, `FileInput`)
- ✅ Build shared data display components (tables, cards, grids)
- ✅ Migrate admin and nonrespondents tables to use `DataTable` component

### ✅ Phase 2: Separate Business Logic (COMPLETED)

- ✅ Create custom hooks for API calls (`useSurveys`, `useMemberLists`)
- ✅ Extract business logic into service functions
- ✅ Implement consistent error handling (COMPLETED)

### Phase 3: State Management

- Implement context providers for global state
- Create typed state management
- Add proper loading and error states

### Phase 4: Testing & Documentation

- Add comprehensive tests
- Create component documentation
- Establish coding standards

## Benefits of Modularization

1. **Maintainability**: Smaller, focused components are easier to understand and modify
2. **Reusability**: Common patterns can be reused across different parts of the application
3. **Testability**: Isolated components and logic are easier to test
4. **Developer Experience**: Clear separation of concerns makes development faster
5. **Scalability**: Modular architecture supports future growth and feature additions

## Implementation Priority

### High Priority (Immediate)

- ✅ Extract common layout patterns (COMPLETED)
- ✅ Create shared form components (COMPLETED)
- ✅ Implement consistent error handling (COMPLETED)

### Medium Priority (Next Sprint)

- Separate API logic into hooks
- Create reusable data display components
- Add proper TypeScript types
- Implement global state management</content>
  `<parameter name="filePath">/Users/jasoncongdon/projects/hoa_survey/ARCHITECTURE_OVERVIEW.md`
