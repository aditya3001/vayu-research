# Backend-Driven Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Firebase auth entirely with a self-contained backend-driven auth system using JWT access tokens (React memory, ~15min TTL) + refresh tokens (httpOnly cookie, 30 days), supporting email/password and OAuth (GitHub + Google redirect flow).

**Architecture:** FastAPI backend owns the complete auth flow — issues JWTs, handles OAuth redirect/callback, exposes `/api/auth` router. React frontend stores access token in state (lost on refresh, recovered via silent `/api/auth/refresh` call on mount), attaches it via Axios interceptor, handles 401 by silent refresh then retry. The auth module (`backend/auth/` + `frontend/src/auth/`) has zero coupling to vayu-research business logic — it can be dropped into any project.

**Tech Stack:** python-jose[cryptography] (JWT), passlib[bcrypt] (passwords), httpx (OAuth HTTP), SQLAlchemy (users table), React + Axios (frontend)

---

## File Map

### Backend

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/auth/models.py` | **Create** | `User` SQLAlchemy model |
| `backend/auth/jwt_utils.py` | **Create** | Create/decode access + refresh JWTs |
| `backend/auth/password.py` | **Create** | bcrypt hash + verify |
| `backend/auth/oauth.py` | **Create** | OAuth state dict, one-time code store, GitHub/Google token exchange |
| `backend/auth/router.py` | **Create** | All `/api/auth/*` routes |
| `backend/auth/dependencies.py` | **Rewrite** | `get_current_user` reads Bearer JWT (returns str user_id) |
| `backend/auth/__init__.py` | **Rewrite** | Export `get_current_user`, `router` |
| `backend/auth/config.py` | **Delete** | Firebase-specific, no longer needed |
| `backend/auth/firebase.py` | **Delete** | Firebase Admin SDK, no longer needed |
| `backend/database.py` | **Modify** | Add `users` table migration |
| `backend/main.py` | **Modify** | Import `auth.models`, include `auth.router` |
| `backend/requirements.txt` | **Modify** | Remove `firebase-admin`, add `python-jose[cryptography]`, `passlib[bcrypt]` |
| `backend/.env.example` | **Modify** | Remove Firebase vars, add JWT + OAuth + BACKEND_URL vars |
| `backend/tests/auth/test_user_model.py` | **Create** | User model unit tests |
| `backend/tests/auth/test_jwt.py` | **Create** | JWT utils unit tests |
| `backend/tests/auth/test_password.py` | **Create** | Password utils unit tests |
| `backend/tests/auth/test_oauth.py` | **Create** | OAuth helpers unit tests |
| `backend/tests/auth/test_auth_router.py` | **Create** | Auth router integration tests |
| `backend/tests/auth/test_dependencies.py` | **Rewrite** | New JWT-based dependency tests |

### Frontend

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/auth/firebase.js` | **Delete** | Firebase SDK config, no longer needed |
| `frontend/src/auth/AuthContext.jsx` | **Rewrite** | Access token in state, silent refresh on mount + 401 |
| `frontend/src/auth/ProtectedRoute.jsx` | **No change** | Already correct — uses `user` from AuthContext |
| `frontend/src/auth/LoginPage.jsx` | **Rewrite** | Email/password form + GitHub/Google redirect links |
| `frontend/src/auth/SignupPage.jsx` | **Rewrite** | Email/password form → POST `/api/auth/signup` |
| `frontend/src/auth/OAuthCallbackPage.jsx` | **Create** | Exchanges one-time code for access token after OAuth |
| `frontend/src/auth/index.js` | **Modify** | Remove firebase export |
| `frontend/src/api.js` | **Modify** | Add auth endpoints, update Axios interceptor for silent refresh |
| `frontend/src/App.jsx` | **Modify** | Add `/auth/callback` route |
| `frontend/package.json` | **Modify** | Remove `firebase` dependency |

---

## Task 1: Install Python deps + update requirements and .env.example

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/.env.example`

- [ ] **Step 1: Update `backend/requirements.txt`**

Replace the entire file contents:
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
psycopg2-binary>=2.9.0
apscheduler==3.10.4
anthropic>=0.40.0
python-multipart==0.0.9
requests==2.32.3
openai>=1.30.0
python-dotenv>=1.0.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
httpx>=0.27.0
pytest>=8.0.0
pytest-asyncio>=0.23.0
```

(Removed: `firebase-admin>=6.0.0`. Added: `python-jose[cryptography]>=3.3.0`, `passlib[bcrypt]>=1.7.4`. `httpx` was already installed but now explicit.)

- [ ] **Step 2: Install the new packages**

```bash
cd /Users/adityajain/Documents/Work/Projects/vayu-research/backend
source venv/bin/activate
pip install "python-jose[cryptography]>=3.3.0" "passlib[bcrypt]>=1.7.4"
```

Expected: Both install successfully. No errors.

- [ ] **Step 3: Update `backend/.env.example`**

Remove this block (near the bottom of the file):
```
# ── Firebase Auth ─────────────────────────────────────────────────────────────
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

Add at the end of the file:
```
# ── Auth (JWT + OAuth) ────────────────────────────────────────────────────────
# Generate with: python3 -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET_KEY=replace-me-with-a-secure-random-string

# Backend base URL used to build OAuth callback URLs
# Dev: http://localhost:8000  |  Prod: https://yourdomain.com
BACKEND_URL=http://localhost:8000

# Frontend URL for OAuth post-callback redirect
# Dev: http://localhost:5173  |  Prod: https://yourdomain.com
FRONTEND_URL=http://localhost:5173

# OAuth providers (optional — only needed if GitHub/Google login is used)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Set to "true" in production (requires HTTPS). "false" for local HTTP dev.
COOKIE_SECURE=false
```

- [ ] **Step 4: Commit**

```bash
cd /Users/adityajain/Documents/Work/Projects/vayu-research
git add backend/requirements.txt backend/.env.example
git commit -m "chore: replace firebase-admin with python-jose + passlib for backend-driven auth"
```

---

## Task 2: User model + DB migration

**Files:**
- Create: `backend/auth/models.py`
- Modify: `backend/database.py`
- Modify: `backend/main.py`
- Create: `backend/tests/auth/test_user_model.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/auth/test_user_model.py`:
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base


def test_user_table_created():
    from auth.models import User
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    u = User(email="test@example.com", provider="email", hashed_password="hashed")
    db.add(u)
    db.commit()
    found = db.query(User).filter_by(email="test@example.com").first()
    assert found is not None
    assert found.id is not None
    assert found.provider == "email"
    assert found.hashed_password == "hashed"
    assert found.created_at is not None
    db.close()


def test_user_email_is_unique():
    from auth.models import User
    import pytest
    from sqlalchemy.exc import IntegrityError
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    db.add(User(email="dup@example.com", provider="email"))
    db.commit()
    db.add(User(email="dup@example.com", provider="github"))
    with pytest.raises(IntegrityError):
        db.commit()
    db.close()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/adityajain/Documents/Work/Projects/vayu-research/backend
source venv/bin/activate
python -m pytest tests/auth/test_user_model.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'auth.models'`

- [ ] **Step 3: Create `backend/auth/models.py`**

```python
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    provider = Column(String, nullable=False)          # "email" | "github" | "google"
    hashed_password = Column(String, nullable=True)    # null for OAuth-only users
    created_at = Column(DateTime, server_default=func.now())
```

- [ ] **Step 4: Add `users` table migration to `backend/database.py`**

Inside `run_migrations()`, at the very end of the function (before the closing of the function body), add:

```python
        # ── users table ───────────────────────────────────────────────────────
        try:
            conn.execute(text(
                "CREATE TABLE IF NOT EXISTS users ("
                "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                "email VARCHAR NOT NULL UNIQUE, "
                "provider VARCHAR NOT NULL, "
                "hashed_password VARCHAR, "
                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
                ")"
            ))
            conn.commit()
        except Exception:
            pass  # already exists
```

- [ ] **Step 5: Import `auth.models` in `backend/main.py` so the table is registered**

In `backend/main.py`, immediately after `import models`, add:
```python
from auth import models as auth_models  # noqa: F401 — registers User table with Base.metadata
```

- [ ] **Step 6: Run test to verify it passes**

```bash
python -m pytest tests/auth/test_user_model.py -v
```

Expected: Both tests PASS

- [ ] **Step 7: Commit**

```bash
git add backend/auth/models.py backend/database.py backend/main.py backend/tests/auth/test_user_model.py
git commit -m "feat(auth): add User model and users table migration"
```

---

## Task 3: JWT utilities

**Files:**
- Create: `backend/auth/jwt_utils.py`
- Create: `backend/tests/auth/test_jwt.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/auth/test_jwt.py`:
```python
import os
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-testing-only")

import pytest
from auth.jwt_utils import (
    create_access_token,
    create_refresh_token,
    decode_token,
    TokenExpiredError,
    TokenInvalidError,
)


def test_access_token_round_trip():
    token = create_access_token(user_id=42)
    payload = decode_token(token)
    assert payload["sub"] == 42
    assert payload["type"] == "access"


def test_refresh_token_round_trip():
    token = create_refresh_token(user_id=7)
    payload = decode_token(token)
    assert payload["sub"] == 7
    assert payload["type"] == "refresh"


def test_expired_token_raises_token_expired_error():
    token = create_access_token(user_id=1, expires_minutes=-1)
    with pytest.raises(TokenExpiredError):
        decode_token(token)


def test_tampered_token_raises_token_invalid_error():
    token = create_access_token(user_id=1)
    tampered = token[:-5] + "XXXXX"
    with pytest.raises(TokenInvalidError):
        decode_token(tampered)


def test_garbage_string_raises_token_invalid_error():
    with pytest.raises(TokenInvalidError):
        decode_token("not.a.valid.token")


def test_access_and_refresh_tokens_are_different():
    access = create_access_token(user_id=1)
    refresh = create_refresh_token(user_id=1)
    assert access != refresh
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/auth/test_jwt.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'auth.jwt_utils'`

- [ ] **Step 3: Create `backend/auth/jwt_utils.py`**

```python
import os
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError, ExpiredSignatureError

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 30


class TokenExpiredError(Exception):
    pass


class TokenInvalidError(Exception):
    pass


def create_access_token(user_id: int, expires_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "type": "refresh",
        "iat": now,
        "exp": now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises TokenExpiredError or TokenInvalidError."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except ExpiredSignatureError:
        raise TokenExpiredError("Token has expired")
    except JWTError:
        raise TokenInvalidError("Token is invalid")
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest tests/auth/test_jwt.py -v
```

Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/auth/jwt_utils.py backend/tests/auth/test_jwt.py
git commit -m "feat(auth): add JWT utilities with access and refresh token support"
```

---

## Task 4: Password utilities

**Files:**
- Create: `backend/auth/password.py`
- Create: `backend/tests/auth/test_password.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/auth/test_password.py`:
```python
from auth.password import hash_password, verify_password


def test_hash_is_not_plaintext():
    hashed = hash_password("mysecret")
    assert hashed != "mysecret"
    # bcrypt hashes always start with $2b$ or $2a$
    assert hashed.startswith("$2")


def test_verify_correct_password_returns_true():
    hashed = hash_password("correct-horse-battery")
    assert verify_password("correct-horse-battery", hashed) is True


def test_verify_wrong_password_returns_false():
    hashed = hash_password("rightpassword")
    assert verify_password("wrongpassword", hashed) is False


def test_same_password_hashes_differently():
    # bcrypt uses random salts
    h1 = hash_password("same")
    h2 = hash_password("same")
    assert h1 != h2
    assert verify_password("same", h1) is True
    assert verify_password("same", h2) is True
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/auth/test_password.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'auth.password'`

- [ ] **Step 3: Create `backend/auth/password.py`**

```python
from passlib.context import CryptContext

_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return _ctx.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return _ctx.verify(plain, hashed)
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest tests/auth/test_password.py -v
```

Expected: All 4 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/auth/password.py backend/tests/auth/test_password.py
git commit -m "feat(auth): add bcrypt password hashing utilities"
```

---

## Task 5: OAuth helpers

**Files:**
- Create: `backend/auth/oauth.py`
- Create: `backend/tests/auth/test_oauth.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/auth/test_oauth.py`:
```python
import os
os.environ.setdefault("GITHUB_CLIENT_ID", "test-github-id")
os.environ.setdefault("GITHUB_CLIENT_SECRET", "test-github-secret")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-google-id")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-google-secret")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")

from auth.oauth import (
    create_exchange_code,
    redeem_exchange_code,
    build_github_auth_url,
    build_google_auth_url,
    store_oauth_state,
    verify_oauth_state,
)


def test_exchange_code_round_trip():
    code = create_exchange_code(user_id=99)
    assert isinstance(code, str) and len(code) > 10
    assert redeem_exchange_code(code) == 99


def test_exchange_code_single_use():
    code = create_exchange_code(user_id=5)
    assert redeem_exchange_code(code) == 5
    assert redeem_exchange_code(code) is None  # already redeemed


def test_exchange_code_expired_returns_none():
    code = create_exchange_code(user_id=3, ttl_seconds=-1)
    assert redeem_exchange_code(code) is None


def test_oauth_state_round_trip():
    state = store_oauth_state()
    assert verify_oauth_state(state) is True


def test_invalid_state_rejected():
    assert verify_oauth_state("not-a-real-state") is False


def test_state_single_use():
    state = store_oauth_state()
    assert verify_oauth_state(state) is True
    assert verify_oauth_state(state) is False  # consumed


def test_github_auth_url_contains_expected_parts():
    url, state = build_github_auth_url(callback_url="http://localhost:8000/api/auth/callback/github")
    assert "github.com/login/oauth/authorize" in url
    assert state in url
    assert "client_id=test-github-id" in url


def test_google_auth_url_contains_expected_parts():
    url, state = build_google_auth_url(callback_url="http://localhost:8000/api/auth/callback/google")
    assert "accounts.google.com/o/oauth2/v2/auth" in url
    assert state in url
    assert "client_id=test-google-id" in url
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/auth/test_oauth.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'auth.oauth'`

- [ ] **Step 3: Create `backend/auth/oauth.py`**

```python
import os
import secrets
import time
from urllib.parse import urlencode

GITHUB_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET", "")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

# In-memory stores — single-process. Fine for SQLite/single-instance deployments.
_pending_codes: dict[str, dict] = {}
_pending_states: set[str] = set()


# ── One-time exchange codes (post-OAuth → frontend token exchange) ─────────────

def create_exchange_code(user_id: int, ttl_seconds: int = 60) -> str:
    """Issue a single-use code the frontend exchanges for tokens."""
    code = secrets.token_urlsafe(32)
    _pending_codes[code] = {"user_id": user_id, "expires": time.time() + ttl_seconds}
    return code


def redeem_exchange_code(code: str) -> int | None:
    """Consume code and return user_id, or None if missing/expired."""
    entry = _pending_codes.pop(code, None)
    if entry and entry["expires"] > time.time():
        return entry["user_id"]
    return None


# ── CSRF state tokens ─────────────────────────────────────────────────────────

def store_oauth_state() -> str:
    """Generate and store a single-use CSRF state token."""
    state = secrets.token_urlsafe(24)
    _pending_states.add(state)
    return state


def verify_oauth_state(state: str) -> bool:
    """Return True and consume the state if it exists, else False."""
    if state in _pending_states:
        _pending_states.discard(state)
        return True
    return False


# ── OAuth URL builders ────────────────────────────────────────────────────────

def build_github_auth_url(callback_url: str) -> tuple[str, str]:
    state = store_oauth_state()
    params = urlencode({
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": callback_url,
        "scope": "user:email",
        "state": state,
    })
    return f"https://github.com/login/oauth/authorize?{params}", state


def build_google_auth_url(callback_url: str) -> tuple[str, str]:
    state = store_oauth_state()
    params = urlencode({
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": callback_url,
        "response_type": "code",
        "scope": "openid email",
        "state": state,
        "access_type": "online",
    })
    return f"https://accounts.google.com/o/oauth2/v2/auth?{params}", state


# ── OAuth token exchange (server-side HTTP calls) ─────────────────────────────

def exchange_github_code(code: str, callback_url: str) -> dict:
    """Exchange GitHub auth code for user info. Returns {'email': str}."""
    import httpx

    token_resp = httpx.post(
        "https://github.com/login/oauth/access_token",
        json={
            "client_id": GITHUB_CLIENT_ID,
            "client_secret": GITHUB_CLIENT_SECRET,
            "code": code,
            "redirect_uri": callback_url,
        },
        headers={"Accept": "application/json"},
        timeout=10,
    )
    token_resp.raise_for_status()
    access_token = token_resp.json().get("access_token")
    if not access_token:
        raise ValueError("GitHub did not return an access token")

    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
    user_resp = httpx.get("https://api.github.com/user", headers=headers, timeout=10)
    user_resp.raise_for_status()
    user_data = user_resp.json()

    email = user_data.get("email")
    if not email:
        # Private email — fetch from /user/emails
        emails_resp = httpx.get("https://api.github.com/user/emails", headers=headers, timeout=10)
        emails_resp.raise_for_status()
        primary = next(
            (e for e in emails_resp.json() if e.get("primary") and e.get("verified")),
            None,
        )
        if not primary:
            raise ValueError("No verified primary email found in GitHub account")
        email = primary["email"]

    return {"email": email.lower()}


def exchange_google_code(code: str, callback_url: str) -> dict:
    """Exchange Google auth code for user info. Returns {'email': str}."""
    import httpx
    import base64
    import json as _json

    token_resp = httpx.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": callback_url,
            "grant_type": "authorization_code",
        },
        timeout=10,
    )
    token_resp.raise_for_status()
    id_token = token_resp.json().get("id_token")
    if not id_token:
        raise ValueError("Google did not return an id_token")

    # Decode JWT payload (no signature verification — we just got it from Google)
    parts = id_token.split(".")
    padded = parts[1] + "=" * (4 - len(parts[1]) % 4)
    claims = _json.loads(base64.urlsafe_b64decode(padded))
    return {"email": claims["email"].lower()}
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest tests/auth/test_oauth.py -v
```

Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/auth/oauth.py backend/tests/auth/test_oauth.py
git commit -m "feat(auth): add OAuth helpers — state, one-time codes, GitHub/Google URL builders"
```

---

## Task 6: Auth router

**Files:**
- Create: `backend/auth/router.py`
- Create: `backend/tests/auth/test_auth_router.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/auth/test_auth_router.py`:
```python
import os
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-testing-only")
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")
os.environ.setdefault("BACKEND_URL", "http://localhost:8000")

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db
from auth.router import router
import auth.models  # noqa: F401 — registers User table


@pytest.fixture
def client():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)

    def override_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.include_router(router, prefix="/auth")
    app.dependency_overrides[get_db] = override_db
    return TestClient(app)


def test_signup_returns_access_token(client):
    resp = client.post("/auth/signup", json={"email": "a@b.com", "password": "secret123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_signup_sets_refresh_cookie(client):
    resp = client.post("/auth/signup", json={"email": "cookie@b.com", "password": "secret123"})
    assert "refresh_token" in resp.cookies


def test_signup_duplicate_email_returns_400(client):
    client.post("/auth/signup", json={"email": "dup@b.com", "password": "pass1234"})
    resp = client.post("/auth/signup", json={"email": "dup@b.com", "password": "pass5678"})
    assert resp.status_code == 400


def test_signup_short_password_returns_400(client):
    resp = client.post("/auth/signup", json={"email": "short@b.com", "password": "abc"})
    assert resp.status_code == 400


def test_login_returns_access_token(client):
    client.post("/auth/signup", json={"email": "login@b.com", "password": "pass1234"})
    resp = client.post("/auth/login", json={"email": "login@b.com", "password": "pass1234"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_login_wrong_password_returns_401(client):
    client.post("/auth/signup", json={"email": "wp@b.com", "password": "rightpass"})
    resp = client.post("/auth/login", json={"email": "wp@b.com", "password": "wrongpass"})
    assert resp.status_code == 401


def test_login_unknown_email_returns_401(client):
    resp = client.post("/auth/login", json={"email": "nobody@b.com", "password": "pass1234"})
    assert resp.status_code == 401


def test_logout_clears_refresh_cookie(client):
    client.post("/auth/signup", json={"email": "logout@b.com", "password": "pass1234"})
    resp = client.post("/auth/logout")
    assert resp.status_code == 200
    # Cookie should be cleared (set with max_age=0 / empty value)
    set_cookie = resp.headers.get("set-cookie", "")
    assert "refresh_token" in set_cookie


def test_refresh_with_valid_cookie_returns_new_access_token(client):
    client.post("/auth/signup", json={"email": "ref@b.com", "password": "pass1234"})
    resp = client.post("/auth/refresh")
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_refresh_with_no_cookie_returns_401():
    # Fresh client — no cookies
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)

    def override_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.include_router(router, prefix="/auth")
    app.dependency_overrides[get_db] = override_db
    fresh = TestClient(app)
    resp = fresh.post("/auth/refresh")
    assert resp.status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/auth/test_auth_router.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'auth.router'`

- [ ] **Step 3: Create `backend/auth/router.py`**

```python
import os
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from auth.models import User
from auth.jwt_utils import (
    create_access_token,
    create_refresh_token,
    decode_token,
    TokenExpiredError,
    TokenInvalidError,
)
from auth.password import hash_password, verify_password
from auth.oauth import (
    build_github_auth_url,
    build_google_auth_url,
    verify_oauth_state,
    exchange_github_code,
    exchange_google_code,
    create_exchange_code,
    redeem_exchange_code,
    FRONTEND_URL,
)

logger = logging.getLogger(__name__)
router = APIRouter()

COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")


# ── Cookie helpers ────────────────────────────────────────────────────────────

def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=30 * 24 * 3600,
        path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key="refresh_token", path="/")


def _get_or_create_oauth_user(db: Session, email: str, provider: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email, provider=provider)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


# ── Schemas ───────────────────────────────────────────────────────────────────

class EmailAuthRequest(BaseModel):
    email: str
    password: str


class ExchangeRequest(BaseModel):
    code: str


# ── Email / Password ──────────────────────────────────────────────────────────

@router.post("/signup")
def signup(body: EmailAuthRequest, response: Response, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email.lower()).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    user = User(
        email=body.email.lower(),
        provider="email",
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _set_refresh_cookie(response, create_refresh_token(user.id))
    return {"access_token": create_access_token(user.id), "token_type": "bearer"}


@router.post("/login")
def login(body: EmailAuthRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if not user or not user.hashed_password or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    _set_refresh_cookie(response, create_refresh_token(user.id))
    return {"access_token": create_access_token(user.id), "token_type": "bearer"}


# ── Token management ──────────────────────────────────────────────────────────

@router.post("/refresh")
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = decode_token(token)
    except (TokenExpiredError, TokenInvalidError):
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="User not found")
    # Rotate: issue new refresh token
    _set_refresh_cookie(response, create_refresh_token(user.id))
    return {"access_token": create_access_token(user.id), "token_type": "bearer"}


@router.post("/logout")
def logout(response: Response):
    _clear_refresh_cookie(response)
    return {"ok": True}


# ── OAuth — GitHub ────────────────────────────────────────────────────────────

@router.get("/github")
def github_login():
    callback_url = f"{BACKEND_URL}/api/auth/callback/github"
    url, _ = build_github_auth_url(callback_url)
    return RedirectResponse(url=url)


@router.get("/callback/github")
def github_callback(code: str, state: str, db: Session = Depends(get_db)):
    if not verify_oauth_state(state):
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    callback_url = f"{BACKEND_URL}/api/auth/callback/github"
    try:
        user_info = exchange_github_code(code, callback_url)
    except Exception as e:
        logger.error("GitHub OAuth exchange failed: %s", e)
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=oauth_failed")
    user = _get_or_create_oauth_user(db, email=user_info["email"], provider="github")
    exchange_code = create_exchange_code(user.id)
    return RedirectResponse(url=f"{FRONTEND_URL}/auth/callback?code={exchange_code}")


# ── OAuth — Google ────────────────────────────────────────────────────────────

@router.get("/google")
def google_login():
    callback_url = f"{BACKEND_URL}/api/auth/callback/google"
    url, _ = build_google_auth_url(callback_url)
    return RedirectResponse(url=url)


@router.get("/callback/google")
def google_callback(code: str, state: str, db: Session = Depends(get_db)):
    if not verify_oauth_state(state):
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    callback_url = f"{BACKEND_URL}/api/auth/callback/google"
    try:
        user_info = exchange_google_code(code, callback_url)
    except Exception as e:
        logger.error("Google OAuth exchange failed: %s", e)
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=oauth_failed")
    user = _get_or_create_oauth_user(db, email=user_info["email"], provider="google")
    exchange_code = create_exchange_code(user.id)
    return RedirectResponse(url=f"{FRONTEND_URL}/auth/callback?code={exchange_code}")


# ── One-time code exchange (frontend calls this after OAuth redirect) ──────────

@router.post("/exchange")
def exchange_code(body: ExchangeRequest, response: Response, db: Session = Depends(get_db)):
    user_id = redeem_exchange_code(body.code)
    if user_id is None:
        raise HTTPException(status_code=400, detail="Invalid or expired exchange code")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    _set_refresh_cookie(response, create_refresh_token(user.id))
    return {"access_token": create_access_token(user.id), "token_type": "bearer"}
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest tests/auth/test_auth_router.py -v
```

Expected: All 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/auth/router.py backend/tests/auth/test_auth_router.py
git commit -m "feat(auth): add auth router — email/password, OAuth GitHub/Google, refresh, logout"
```

---

## Task 7: Auth dependencies + wire into main.py

**Files:**
- Rewrite: `backend/auth/dependencies.py`
- Rewrite: `backend/auth/__init__.py`
- Delete: `backend/auth/config.py`
- Delete: `backend/auth/firebase.py`
- Modify: `backend/main.py`
- Rewrite: `backend/tests/auth/test_dependencies.py`

- [ ] **Step 1: Write the failing test**

Replace `backend/tests/auth/test_dependencies.py` with:
```python
import os
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-testing-only")

import pytest
from fastapi import HTTPException
from auth.jwt_utils import create_access_token
from auth.dependencies import get_current_user


@pytest.mark.asyncio
async def test_valid_token_returns_user_id():
    token = create_access_token(user_id=42)
    result = await get_current_user(authorization=f"Bearer {token}")
    assert result == "42"


@pytest.mark.asyncio
async def test_expired_token_raises_401():
    from auth.jwt_utils import create_access_token
    token = create_access_token(user_id=1, expires_minutes=-1)
    with pytest.raises(HTTPException) as exc:
        await get_current_user(authorization=f"Bearer {token}")
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_tampered_token_raises_401():
    token = create_access_token(user_id=1)
    tampered = token[:-5] + "XXXXX"
    with pytest.raises(HTTPException) as exc:
        await get_current_user(authorization=f"Bearer {tampered}")
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_missing_bearer_prefix_raises_401():
    with pytest.raises(HTTPException) as exc:
        await get_current_user(authorization="Token somevalue")
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_empty_token_raises_401():
    with pytest.raises(HTTPException) as exc:
        await get_current_user(authorization="Bearer ")
    assert exc.value.status_code == 401
    assert "Missing token" in exc.value.detail


@pytest.mark.asyncio
async def test_401_includes_www_authenticate_header():
    with pytest.raises(HTTPException) as exc:
        await get_current_user(authorization="Bearer garbage")
    assert exc.value.headers.get("WWW-Authenticate") == "Bearer"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/auth/test_dependencies.py -v
```

Expected: FAIL — tests import old Firebase-based code and fail

- [ ] **Step 3: Rewrite `backend/auth/dependencies.py`**

```python
import logging
from fastapi import Header, HTTPException
from auth.jwt_utils import decode_token, TokenExpiredError, TokenInvalidError

logger = logging.getLogger(__name__)


async def get_current_user(authorization: str = Header(...)) -> str:
    """Extract and validate Bearer JWT. Returns user_id as a string."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header format",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Missing token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(token)
    except TokenExpiredError:
        raise HTTPException(
            status_code=401,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except TokenInvalidError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return str(payload["sub"])
```

- [ ] **Step 4: Rewrite `backend/auth/__init__.py`**

```python
from .dependencies import get_current_user
from .router import router

__all__ = ["get_current_user", "router"]
```

- [ ] **Step 5: Delete Firebase files**

```bash
rm backend/auth/config.py backend/auth/firebase.py
```

- [ ] **Step 6: Wire auth router into `backend/main.py`**

In `backend/main.py`, find:
```python
from routers import prompts, run, history, schedules, settings
app.include_router(prompts.router, prefix="/api")
```

Change to (add the auth router include before the existing ones):
```python
from routers import prompts, run, history, schedules, settings
from auth import router as auth_router
app.include_router(auth_router, prefix="/api/auth")
app.include_router(prompts.router, prefix="/api")
app.include_router(run.router, prefix="/api")
app.include_router(history.router, prefix="/api")
app.include_router(schedules.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
```

(The existing router includes are already there — only add `auth_router` and its include line.)

- [ ] **Step 7: Run all auth tests**

```bash
python -m pytest tests/auth/ -v
```

Expected: All tests PASS (the old Firebase-mocking tests are replaced, new JWT tests pass)

- [ ] **Step 8: Commit**

```bash
git add backend/auth/dependencies.py backend/auth/__init__.py backend/main.py backend/tests/auth/test_dependencies.py
git rm backend/auth/config.py backend/auth/firebase.py
git commit -m "feat(auth): wire JWT dependencies + auth router into FastAPI app, remove Firebase"
```

---

## Task 8: Frontend — auth API functions in api.js

**Files:**
- Modify: `frontend/src/api.js`

The interceptor currently attaches a Firebase token. Replace it with one that:
1. Reads the access token from a module-level ref (set by AuthContext)
2. On 401, attempts a silent refresh, then retries once

- [ ] **Step 1: Replace `frontend/src/api.js` entirely**

```javascript
import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Module-level token store — AuthContext calls setAccessToken() after login/refresh
let _accessToken = null

export function setAccessToken(token) {
  _accessToken = token
}

export function getAccessToken() {
  return _accessToken
}

// ── Auth API ──────────────────────────────────────────────────────────────────

export const authSignup = (email, password) =>
  api.post('/auth/signup', { email, password }).then(r => r.data)

export const authLogin = (email, password) =>
  api.post('/auth/login', { email, password }).then(r => r.data)

export const authRefresh = () =>
  api.post('/auth/refresh').then(r => r.data)

export const authLogout = () =>
  api.post('/auth/logout').then(r => r.data)

export const authExchange = (code) =>
  api.post('/auth/exchange', { code }).then(r => r.data)

// ── Request interceptor — attach Bearer token ─────────────────────────────────

api.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`
  }
  return config
})

// ── Response interceptor — silent refresh on 401 ─────────────────────────────

let _refreshing = null  // single in-flight refresh promise

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    // Only attempt refresh once per request, only on 401, skip auth endpoints
    if (
      error.response?.status === 401 &&
      !original._retried &&
      !original.url?.startsWith('/auth/')
    ) {
      original._retried = true
      if (!_refreshing) {
        _refreshing = authRefresh()
          .then(data => {
            setAccessToken(data.access_token)
          })
          .catch(() => {
            setAccessToken(null)
          })
          .finally(() => {
            _refreshing = null
          })
      }
      await _refreshing
      if (_accessToken) {
        original.headers.Authorization = `Bearer ${_accessToken}`
        return api(original)
      }
    }
    return Promise.reject(error)
  }
)

// ── App API ───────────────────────────────────────────────────────────────────

export const getPrompts = () => api.get('/prompts').then(r => r.data)
export const getPrompt = (id) => api.get(`/prompts/${id}`).then(r => r.data)
export const runPrompt = (prompt_id, inputs) =>
  api.post('/run', { prompt_id, inputs }).then(r => r.data)
export const saveToNotion = (id) => api.post(`/history/${id}/notion`).then(r => r.data)
export const getHistory = () => api.get('/history').then(r => r.data)
export const deleteHistory = (id) => api.delete(`/history/${id}`)
export const downloadHistory = async (id) => {
  const response = await api.get(`/history/${id}/download`, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `research-${id}.md`
  a.click()
  URL.revokeObjectURL(url)
}
export const getSchedules = () => api.get('/schedules').then(r => r.data)
export const createSchedule = (data) => api.post('/schedules', data).then(r => r.data)
export const updateSchedule = (id, data) => api.put(`/schedules/${id}`, data).then(r => r.data)
export const deleteSchedule = (id) => api.delete(`/schedules/${id}`)
export const toggleSchedule = (id) => api.patch(`/schedules/${id}/toggle`).then(r => r.data)
export const getSettings = () => api.get('/settings').then(r => r.data)
export const updateSettings = (data) => api.put('/settings', data).then(r => r.data)
export const getConfig = () => api.get('/config').then(r => r.data)
export const testNotion = () => api.get('/notion/test').then(r => r.data)
export const testNotionDbs = () => api.get('/notion/test-dbs').then(r => r.data)
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api.js
git commit -m "feat(auth): replace Firebase Axios interceptor with JWT token store + silent refresh"
```

---

## Task 9: Frontend AuthContext

**Files:**
- Rewrite: `frontend/src/auth/AuthContext.jsx`

AuthContext holds the access token in state. On mount: calls `/api/auth/refresh` to recover session. Exposes `login`, `signup`, `signOut`, `user` (non-null = authenticated).

- [ ] **Step 1: Rewrite `frontend/src/auth/AuthContext.jsx`**

```jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { setAccessToken, authRefresh, authLogin, authSignup, authLogout } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // undefined = loading, null = unauthenticated, object = authenticated user info
  const [user, setUser] = useState(undefined)

  const _applyToken = useCallback((accessToken) => {
    setAccessToken(accessToken)
    // Decode payload to get user id (no verification needed — already trusted from backend)
    const parts = accessToken.split('.')
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    setUser({ id: String(payload.sub) })
  }, [])

  // Silent refresh on app load — recover session from httpOnly refresh cookie
  useEffect(() => {
    authRefresh()
      .then(data => _applyToken(data.access_token))
      .catch(() => {
        setAccessToken(null)
        setUser(null)
      })
  }, [_applyToken])

  const login = async (email, password) => {
    const data = await authLogin(email, password)
    _applyToken(data.access_token)
  }

  const signup = async (email, password) => {
    const data = await authSignup(email, password)
    _applyToken(data.access_token)
  }

  const signOut = async () => {
    try { await authLogout() } catch (_) {}
    setAccessToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/auth/AuthContext.jsx
git commit -m "feat(auth): rewrite AuthContext — JWT in state, silent refresh on mount"
```

---

## Task 10: Frontend LoginPage + SignupPage

**Files:**
- Rewrite: `frontend/src/auth/LoginPage.jsx`
- Rewrite: `frontend/src/auth/SignupPage.jsx`

- [ ] **Step 1: Rewrite `frontend/src/auth/LoginPage.jsx`**

```jsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from './AuthContext'

const IconGitHub = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
  </svg>
)

const IconGoogle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Check for OAuth error param on mount
  const params = new URLSearchParams(window.location.search)
  const oauthError = params.get('error')

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">VAYU</div>
        <p className="auth-tagline">Research, automated.</p>

        {oauthError && (
          <p className="auth-error">OAuth sign-in failed. Please try again.</p>
        )}

        {/* OAuth — redirect to backend, which handles the full flow */}
        <a href="/api/auth/github" className="auth-btn auth-btn-github">
          <IconGitHub /> Continue with GitHub
        </a>

        <a href="/api/auth/google" className="auth-btn auth-btn-google">
          <IconGoogle /> Continue with Google
        </a>

        <div className="auth-divider"><span>or</span></div>

        <form onSubmit={handleEmailLogin}>
          <input
            className="auth-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-btn auth-btn-primary" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `frontend/src/auth/SignupPage.jsx`**

```jsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function SignupPage() {
  const navigate = useNavigate()
  const { signup } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setError('')
    setLoading(true)
    try {
      await signup(email, password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">VAYU</div>
        <p className="auth-tagline">Create your account.</p>

        <form onSubmit={submit}>
          <input
            className="auth-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-btn auth-btn-primary" type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/auth/LoginPage.jsx frontend/src/auth/SignupPage.jsx
git commit -m "feat(auth): rewrite LoginPage and SignupPage — remove Firebase, use backend auth"
```

---

## Task 11: Frontend OAuthCallbackPage + App.jsx + cleanup

**Files:**
- Create: `frontend/src/auth/OAuthCallbackPage.jsx`
- Modify: `frontend/src/auth/index.js`
- Modify: `frontend/src/App.jsx`
- Delete: `frontend/src/auth/firebase.js`
- Modify: `frontend/package.json`

- [ ] **Step 1: Create `frontend/src/auth/OAuthCallbackPage.jsx`**

This page lives at `/auth/callback`. The backend redirects here after OAuth with `?code=<one_time_code>`. It exchanges the code for tokens, then does a hard navigation to `/` so AuthContext re-initializes with the fresh httpOnly cookie.

```jsx
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { authExchange, setAccessToken } from '../api'

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const [error, setError] = useState(null)

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      setError('Missing exchange code')
      return
    }
    authExchange(code)
      .then(data => {
        // Store access token in module-level ref so the next request is authenticated
        setAccessToken(data.access_token)
        // Hard navigation: triggers full page load, AuthContext runs silent refresh
        // with the httpOnly refresh cookie the backend just set
        window.location.replace('/')
      })
      .catch(() => {
        setError('Authentication failed. Please try again.')
        setTimeout(() => { window.location.replace('/login') }, 2000)
      })
  }, [])

  if (error) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="auth-error">{error}</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Redirecting to login…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="spinner" />
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>Completing sign-in…</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `frontend/src/auth/index.js`**

Replace entire file:
```javascript
export { AuthProvider, useAuth } from './AuthContext'
export { default as ProtectedRoute } from './ProtectedRoute'
export { default as LoginPage } from './LoginPage'
export { default as SignupPage } from './SignupPage'
export { default as OAuthCallbackPage } from './OAuthCallbackPage'
```

- [ ] **Step 3: Update `frontend/src/App.jsx`**

Replace entire file:
```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, ProtectedRoute, LoginPage, SignupPage, OAuthCallbackPage } from './auth'
import Sidebar from './components/Sidebar'
import PromptsPage from './components/PromptsPage'
import PromptRunner from './components/PromptRunner'
import HistoryPage from './components/HistoryPage'
import SchedulesPage from './components/SchedulesPage'
import SettingsPage from './components/SettingsPage'

function AppShell() {
  return (
    <div className="app">
      <Sidebar />
      <div className="app-body">
        <main className="app-main">
          <Routes>
            <Route path="/"                element={<PromptsPage />} />
            <Route path="/prompt/:promptId" element={<PromptRunner />} />
            <Route path="/history"          element={<HistoryPage />} />
            <Route path="/schedules"        element={<SchedulesPage />} />
            <Route path="/settings"         element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login"          element={<LoginPage />} />
          <Route path="/signup"         element={<SignupPage />} />
          <Route path="/auth/callback"  element={<OAuthCallbackPage />} />
          <Route path="/*"              element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
```

- [ ] **Step 4: Delete `frontend/src/auth/firebase.js`**

```bash
rm frontend/src/auth/firebase.js
```

- [ ] **Step 5: Remove firebase from package.json**

In `frontend/package.json`, remove the `"firebase": "^12.12.1"` line from the `dependencies` section.

Then run:
```bash
cd frontend
npm uninstall firebase
```

Expected: firebase removed from node_modules and package.json

- [ ] **Step 6: Build frontend to verify no import errors**

```bash
cd /Users/adityajain/Documents/Work/Projects/vayu-research/frontend
npm run build
```

Expected: Build succeeds with no errors. (Warnings about unused imports are OK, errors are not.)

- [ ] **Step 7: Commit**

```bash
cd /Users/adityajain/Documents/Work/Projects/vayu-research
git add frontend/src/auth/OAuthCallbackPage.jsx frontend/src/auth/index.js frontend/src/App.jsx frontend/package.json frontend/package-lock.json
git rm frontend/src/auth/firebase.js
git commit -m "feat(auth): add OAuthCallbackPage, wire into App.jsx, remove Firebase package"
```

---

## Task 12: Add JWT_SECRET_KEY to backend .env and smoke test

**Files:**
- Modify: `backend/.env` (the actual env file, not .env.example)

- [ ] **Step 1: Generate a JWT secret and add it to `.env`**

```bash
cd /Users/adityajain/Documents/Work/Projects/vayu-research/backend
python3 -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_hex(32))"
```

Copy the output and add the line to `backend/.env`. Also add:
```
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
COOKIE_SECURE=false
```

- [ ] **Step 2: Run all backend tests**

```bash
cd /Users/adityajain/Documents/Work/Projects/vayu-research/backend
source venv/bin/activate
python -m pytest tests/ -v
```

Expected: All tests PASS. No Firebase-related import errors.

- [ ] **Step 3: Start the backend and verify the auth endpoints are live**

```bash
cd /Users/adityajain/Documents/Work/Projects/vayu-research/backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

In a separate terminal, test signup:
```bash
curl -s -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}' | python3 -m json.tool
```

Expected output:
```json
{
    "access_token": "eyJ...",
    "token_type": "bearer"
}
```

Test login:
```bash
curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}' | python3 -m json.tool
```

Expected: `{"access_token": "eyJ...", "token_type": "bearer"}`

- [ ] **Step 4: Start frontend and do an end-to-end sign-up test**

In a separate terminal:
```bash
cd /Users/adityajain/Documents/Work/Projects/vayu-research/frontend
npm run dev
```

Open `http://localhost:5173/signup` in the browser. Sign up with a new email. Should redirect to `/` (PromptsPage). Refresh the page — should stay logged in (silent refresh via httpOnly cookie).

Open DevTools → Application → Cookies → confirm `refresh_token` cookie is `HttpOnly`.

Open DevTools → Network — confirm API calls include `Authorization: Bearer ...` header.

- [ ] **Step 5: Final commit**

```bash
cd /Users/adityajain/Documents/Work/Projects/vayu-research
git add backend/.env
git commit -m "chore: add JWT_SECRET_KEY and auth env vars to backend .env"
```

---

## Deployment Checklist

When deploying to production (Railway, Render, etc.):

1. Set `JWT_SECRET_KEY` to a secure random value (never commit to git)
2. Set `COOKIE_SECURE=true` (requires HTTPS)
3. Set `BACKEND_URL=https://yourdomain.com`
4. Set `FRONTEND_URL=https://yourdomain.com`
5. Register OAuth callback URLs:
   - GitHub App: `https://yourdomain.com/api/auth/callback/github`
   - Google Cloud Console: `https://yourdomain.com/api/auth/callback/google`
6. Set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

---

## What Was Removed

| Removed | Replaced With |
|---------|---------------|
| `firebase-admin` Python package | `python-jose[cryptography]`, `passlib[bcrypt]` |
| `firebase` npm package | Nothing — auth is now API calls |
| `FIREBASE_SERVICE_ACCOUNT_PATH` env var | `JWT_SECRET_KEY` env var |
| Firebase UID as user identifier | Integer database ID (stored as string in `user_id` columns) |
| `signInWithPopup()` (frontend OAuth) | Redirect to `/api/auth/github` or `/api/auth/google` |
| `onAuthStateChanged` listener | Silent `POST /api/auth/refresh` on mount |
| Firebase token auto-refresh | Axios interceptor retries on 401 with refresh |
