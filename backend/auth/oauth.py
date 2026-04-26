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
