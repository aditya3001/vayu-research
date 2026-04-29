# Firebase Auth — Design Spec
**Date:** 2026-04-24
**Status:** Approved

---

## Overview

Add authentication to Vayu Research using Firebase Auth. Users can sign in with GitHub, Google, or email/password. All app data (history, schedules, settings) is scoped per user. Auth is implemented as a self-contained, reusable module on both the backend and frontend — drop-in portable to any FastAPI + React project.

No backward compatibility with existing unauthed data.

---

## Providers

| Provider | Method |
|---|---|
| GitHub | OAuth popup |
| Google | OAuth popup |
| Email | Email + password (signup + login) |

---

## Architecture

```
React Frontend
├── Firebase JS SDK (auth only — no Firestore, no hosting)
│   ├── GitHub OAuth  →  popup
│   ├── Google OAuth  →  popup
│   └── Email/Password  →  form
├── auth/AuthContext.jsx  →  wraps entire app, exposes user + getIdToken()
├── auth/ProtectedRoute.jsx  →  redirects to /login if no session
└── api.js  →  Axios interceptor attaches Authorization: Bearer <idToken>

FastAPI Backend
├── auth/ module  →  firebase-admin SDK, verify_id_token()
├── get_current_user dependency  →  extracts uid from JWT
└── all /api/* routes  →  Depends(get_current_user), scoped to user_id

Supabase PostgreSQL
├── history    +  user_id VARCHAR NOT NULL
├── schedules  +  user_id VARCHAR NOT NULL
└── settings   →  composite PK (user_id, key)
```

Firebase owns auth. Supabase owns data. Backend never trusts the client for identity.

---

## Backend Module

### Structure

```
backend/
└── auth/
    ├── __init__.py          ← exports get_current_user
    ├── config.py            ← reads FIREBASE_SERVICE_ACCOUNT_PATH from env
    ├── firebase.py          ← Firebase app init, verify_id_token()
    └── dependencies.py      ← FastAPI get_current_user Depends
```

### `auth/config.py`
Reads `FIREBASE_SERVICE_ACCOUNT_PATH` from environment. Raises a clear error at startup if missing.

### `auth/firebase.py`
- Initialises `firebase_admin` app once using `credentials.Certificate(path)`
- Exposes `verify_id_token(token: str) -> dict` — wraps `firebase_admin.auth.verify_id_token`
- Guards against double-initialisation (safe to import multiple times)

### `auth/dependencies.py`
```python
async def get_current_user(authorization: str = Header(...)) -> str:
    token = authorization.removeprefix("Bearer ")
    decoded = verify_id_token(token)
    return decoded["uid"]
```
Returns `user_id` (Firebase UID string). Raises `HTTP 401` on invalid/expired token.

### `auth/__init__.py`
```python
from .dependencies import get_current_user
```

### Route integration
Every router endpoint adds:
```python
user_id: str = Depends(get_current_user)
```
All DB queries filter by `user_id`. No other changes to router logic.

### Portability
Copy `backend/auth/` to any FastAPI project. Set `FIREBASE_SERVICE_ACCOUNT_PATH` in `.env`. Import `get_current_user`. Done.

---

## Frontend Module

### Structure

```
frontend/src/
└── auth/
    ├── firebase.js          ← init Firebase app, export auth instance + providers
    ├── AuthContext.jsx      ← AuthProvider + useAuth() hook
    ├── ProtectedRoute.jsx   ← route guard
    ├── LoginPage.jsx        ← GitHub + Google + email/password
    └── SignupPage.jsx       ← email + password + confirm
```

### `auth/firebase.js`
Initialises Firebase app from env vars (`VITE_FIREBASE_*`). Exports:
- `auth` — Firebase Auth instance
- `githubProvider` — `GithubAuthProvider`
- `googleProvider` — `GoogleAuthProvider`

### `auth/AuthContext.jsx`
- `AuthProvider` wraps the app
- `onAuthStateChanged` tracks session
- Exposes `{ user, loading, signOut }` via `useAuth()`
- `user.getIdToken()` used by `api.js` to get fresh token on each request

### `auth/ProtectedRoute.jsx`
- If `loading` → show spinner
- If no `user` → redirect to `/login`
- Otherwise → render children

### `auth/LoginPage.jsx`
Matches existing dark theme. Contains:
- Vayu logo + tagline
- "Continue with GitHub" button (dark, GitHub icon)
- "Continue with Google" button (light/outlined, Google icon)
- Horizontal divider with "or"
- Email + password fields + "Sign in" button
- "Don't have an account? Sign up" link → `/signup`
- Error state for failed auth attempts

### `auth/SignupPage.jsx`
- Email, password, confirm password fields
- "Create account" button
- On success → redirect to `/`
- "Already have an account? Sign in" link → `/login`

### `App.jsx` changes
```jsx
<AuthProvider>
  <Routes>
    <Route path="/login"  element={<LoginPage />} />
    <Route path="/signup" element={<SignupPage />} />
    <Route path="/*"      element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
  </Routes>
</AuthProvider>
```
`AppShell` = existing Sidebar + app-body layout.

### `api.js` change
Add Axios request interceptor:
```js
axios.interceptors.request.use(async (config) => {
  const token = await auth.currentUser?.getIdToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
```
Single change covers all existing API calls.

---

## Database Migrations

Handled in `run_migrations()` (existing pattern in `database.py`):

```sql
-- history
ALTER TABLE history ADD COLUMN user_id VARCHAR NOT NULL;

-- schedules
ALTER TABLE schedules ADD COLUMN user_id VARCHAR NOT NULL;

-- settings
ALTER TABLE settings ADD COLUMN user_id VARCHAR NOT NULL;
ALTER TABLE settings DROP CONSTRAINT settings_pkey;
ALTER TABLE settings ADD PRIMARY KEY (user_id, key);
```

No backward compatibility. Existing rows without `user_id` are dropped before migration.

---

## Environment Variables

### Backend (`.env`)
```
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

### Frontend (`.env`)
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

### Firebase Console Setup
1. Create Firebase project
2. Authentication → Sign-in method → enable GitHub, Google, Email/Password
3. GitHub: requires GitHub OAuth App (client ID + secret)
4. Download service account JSON → `backend/firebase-service-account.json` (gitignored)

---

## Security

- Firebase service account JSON is gitignored — never committed
- Backend validates every request independently — no client-side trust
- `getIdToken()` auto-refreshes expired tokens (Firebase SDK handles this)
- 401 on missing/invalid/expired token — no silent failures

---

## New Dependencies

### Backend
```
firebase-admin>=6.0.0
```

### Frontend
```
firebase (^10.x)
```
