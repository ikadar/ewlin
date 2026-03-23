# Authentication Plan

High-level outline of what's needed to add authentication to the Flux Scheduler application.

## Decision: JWT Authentication

**Chosen method:** JWT (JSON Web Token) with asymmetric signing (RS256 or ES256).

**Why JWT:**
- Natural fit for the existing SPA (React) + REST API architecture
- Stateless — no server-side session storage needed
- Mature Symfony ecosystem support (`lexik/jwt-authentication-bundle`)

**Why asymmetric signing (RS256/ES256), not HMAC (HS256):**
- The private key stays only on the token-issuing service
- Any service can validate tokens with just the public key
- Critical for backend portability (see below)

**Backend portability:** JWT is technology-independent. The token is a self-contained, signed JSON structure. If the backend is later ported from Symfony to Kotlin (Spring Boot) or Node.js, the new backend validates tokens with the same public key — zero frontend changes required.

| Future backend | JWT validation |
|----------------|---------------|
| Kotlin / Spring Boot | `spring-boot-starter-oauth2-resource-server` — built-in JWT support |
| Node.js | `jose` npm package — a few lines of validation code |
| Migration period | Both backends can validate simultaneously with the same public key |

## Decision: User Groups & Permissions

**Model:** Dynamic, group-based access control (GBAC). Users can belong to multiple groups simultaneously. Groups are created and managed by admins via the UI.

### Initial Groups

| Group | Permissions |
|-------|------------|
| **admin** | Full access to everything — scheduling, jobs, settings, user/group management |
| **scheduler** | Scheduling view, create/edit jobs and tasks, create/manage assignments |
| **reporter** | Modify completion/progress data only (feature TBD — group defined upfront) |

### Authorization Model

- **Feature-level** access control (not data-level): groups determine which actions a user can perform, not which records they can see.
- A user's **effective permissions** are the **union** of all their groups' permissions (most permissive wins).
- Groups are **dynamic** — admins can create, rename, and delete groups and assign permissions to them via the admin UI.

### Data Model

```
┌──────────┐       ┌──────────────────┐       ┌───────────┐
│  users   │──M:N──│  user_groups     │──M:N──│  groups   │
│          │       │ (join table)     │       │           │
│ id       │       │ user_id          │       │ id        │
│ email    │       │ group_id         │       │ name      │
│ password │       └──────────────────┘       │ permissions (JSON) │
│ ...      │                                  │ createdAt │
└──────────┘                                  └───────────┘
```

### Permissions Granularity

Permissions are stored as a JSON array on the group. Proposed permission keys:

| Permission | Description |
|------------|------------|
| `scheduling.view` | View the scheduling grid |
| `scheduling.assign` | Create and manage assignments |
| `jobs.create` | Create jobs and tasks |
| `jobs.edit` | Edit existing jobs and tasks |
| `reporting.edit` | Modify completion/progress data |
| `settings.view` | View settings pages |
| `settings.edit` | Modify settings (stations, providers, etc.) |
| `admin.users` | Manage users and groups |

### JWT Integration

The user's effective permissions (union of all group permissions) are included in the JWT payload:

```json
{
  "sub": "user-uuid",
  "email": "operator@example.com",
  "permissions": ["scheduling.view", "scheduling.assign", "jobs.create", "jobs.edit"],
  "iat": 1710000000,
  "exp": 1710003600
}
```

This allows the frontend to check permissions without an API call, and the backend to enforce them from the token.

**Trade-off:** If group permissions change, the user must re-login (or wait for token refresh) to get updated permissions. Acceptable for an internal tool with infrequent permission changes.

## Other Decisions

| Question | Decision |
|----------|----------|
| User management | Admin-created accounts (internal tool) |
| Password policy | Minimum 12 chars, optional MFA in v2 |

---

## Backend (PHP/Symfony)

### Components

1. **Symfony Security Bundle** configuration
   - `security.yaml`: firewall, access control, provider, authenticator
   - Stateless JWT authenticator (e.g., `lexik/jwt-authentication-bundle`)

2. **User Entity**
   - Fields: `id`, `email`, `password` (hashed), `roles`, `createdAt`, `lastLoginAt`
   - Implements `UserInterface`, `PasswordAuthenticatedUserInterface`
   - Doctrine migration for `users` table

3. **API Endpoints**
   - `POST /api/login` — returns JWT token pair (access + refresh)
   - `POST /api/token/refresh` — refresh expired access token
   - `GET /api/me` — current user info
   - `POST /api/logout` — invalidate refresh token (optional with JWT)

4. **Middleware / Guard**
   - JWT authenticator on all `/api/*` routes except `/api/login`
   - Extract and validate JWT from `Authorization: Bearer <token>` header
   - Set authenticated user in Symfony security context

5. **Migration**
   - Create `users` table
   - Seed initial admin user (via command or migration)

### Key Packages

- `lexik/jwt-authentication-bundle` — JWT generation and validation
- `gesdinet/jwt-refresh-token-bundle` — refresh token support (optional)

---

## Frontend (React)

### Components

1. **Login Page**
   - Route: `/login`
   - Email + password form
   - Error handling (invalid credentials, server error)
   - Redirect to `/flux` on success

2. **Auth State Management**
   - Store JWT in memory (not localStorage — XSS risk)
   - Refresh token in httpOnly cookie (if using refresh tokens)
   - Auth context/provider with `user`, `isAuthenticated`, `login()`, `logout()`

3. **Protected Routes**
   - Route guard component wrapping all routes except `/login`
   - Redirect to `/login` if not authenticated
   - Redirect to `/flux` if already authenticated and navigating to `/login`

4. **API Interceptor**
   - Attach `Authorization: Bearer <token>` header to all API requests
   - On 401 response: attempt token refresh, if fails → redirect to login
   - Queue failed requests during refresh, replay after

5. **Logout**
   - Clear auth state
   - Redirect to `/login`
   - Optional: call backend logout endpoint

---

## Validation Service (Node.js)

The validation service is **internal-only** — called by the PHP backend via HTTP, never directly by the browser. No public authentication needed.

Options:
- **Network-level isolation** (recommended): service only accessible from backend's network
- **Shared secret**: simple API key in `Authorization` header (if network isolation is not possible)

---

## Implementation Order

1. **Backend first**: User entity, migration, JWT setup, login endpoint, guard
2. **Frontend login**: Login page, auth context, route guard
3. **API interceptor**: Token attachment, 401 handling, refresh flow
4. **Testing**: Auth-aware test setup, fixture user seeding
5. **Hardening**: Rate limiting on login, account lockout, audit logging

---

## Out of Scope (v1)

- Multi-factor authentication (MFA)
- Password reset / forgot password flow
- OAuth2 / SSO integration
- Session management UI (active sessions list)
- Data-level access control (row-level filtering by user/group)

These can be added incrementally after the base authentication is working.
