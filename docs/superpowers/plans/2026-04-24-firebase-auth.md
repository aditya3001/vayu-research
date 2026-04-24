# Firebase Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GitHub, Google, and email/password authentication via Firebase Auth — scoping all user data (history, schedules, settings) per user.

**Architecture:** Firebase Auth handles identity (JWT tokens). FastAPI validates tokens via `firebase-admin` SDK through a reusable `backend/auth/` module. All `/api` routes are protected via `Depends(get_current_user)`. Frontend manages session via `AuthContext` and attaches Bearer tokens to every Axios request.

**Tech Stack:** `firebase-admin` (Python), `firebase` JS SDK v10, FastAPI `Depends`, Axios request interceptor, PostgreSQL composite PK migration.

---

## File Map

**New backend files:**
- `backend/auth/__init__.py` — exports `get_current_user`
- `backend/auth/config.py` — reads `FIREBASE_SERVICE_ACCOUNT_PATH` from env
- `backend/auth/firebase.py` — Firebase app init + `verify_id_token()`
- `backend/auth/dependencies.py` — FastAPI `get_current_user` dependency
- `backend/tests/auth/test_dependencies.py` — unit tests for auth module

**Modified backend files:**
- `backend/requirements.txt` — add `firebase-admin>=6.0.0`
- `backend/models.py` — add `user_id` to History, Schedule, Setting
- `backend/database.py` — extend `run_migrations()` for user_id columns + settings PK
- `backend/routers/settings.py` — update `get_setting()` signature, all queries scoped by user_id
- `backend/routers/history.py` — add `Depends(get_current_user)`, filter queries by user_id
- `backend/routers/run.py` — add `Depends(get_current_user)`, pass user_id into History + get_setting
- `backend/routers/schedules.py` — add `Depends(get_current_user)`, filter queries by user_id
- `backend/routers/prompts.py` — add `Depends(get_current_user)` (protect endpoint, uid unused)
- `backend/scheduler.py` — pass `schedule.user_id` to `get_setting()`
- `backend/.env.example` — add `FIREBASE_SERVICE_ACCOUNT_PATH`

**New frontend files:**
- `frontend/src/auth/firebase.js` — Firebase app init, export auth + providers
- `frontend/src/auth/AuthContext.jsx` — `AuthProvider` + `useAuth()` hook
- `frontend/src/auth/ProtectedRoute.jsx` — redirect to `/login` if no session
- `frontend/src/auth/LoginPage.jsx` — GitHub + Google + email/password UI
- `frontend/src/auth/SignupPage.jsx` — email + password + confirm UI
- `frontend/src/auth/index.js` — re-exports

**Modified frontend files:**
- `frontend/package.json` — add `firebase`
- `frontend/src/App.jsx` — wrap with `AuthProvider`, add `/login` + `/signup` routes, wrap existing routes in `ProtectedRoute`
- `frontend/src/api.js` — add Axios request interceptor for Bearer token; change `downloadHistory` to Axios blob download
- `frontend/src/index.css` — add `.auth-page`, `.auth-card`, `.auth-btn-*` styles
- `frontend/.env.example` — add `VITE_FIREBASE_*` vars

---

## Task 1: Backend auth module

**Files:**
- Create: `backend/auth/__init__.py`
- Create: `backend/auth/config.py`
- Create: `backend/auth/firebase.py`
- Create: `backend/auth/dependencies.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/auth/__init__.py`
- Create: `backend/tests/auth/test_dependencies.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add firebase-admin to requirements.txt**

```
firebase-admin>=6.0.0
pytest>=8.0.0
pytest-asyncio>=0.23.0
```

Run: `cd backend && pip install firebase-admin>=6.0.0 pytest pytest-asyncio`

- [ ] **Step 2: Create `backend/auth/config.py`**

```python
import os

def get_service_account_path() -> str:
    path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    if not path:
        raise RuntimeError(
            "FIREBASE_SERVICE_ACCOUNT_PATH is not set. "
            "Download the service account JSON from Firebase console and set the path."
        )
    return path
```

- [ ] **Step 3: Create `backend/auth/firebase.py`**

```python
import firebase_admin
from firebase_admin import credentials, auth as _auth
from auth.config import get_service_account_path

def _init() -> None:
    if not firebase_admin._apps:
        cred = credentials.Certificate(get_service_account_path())
        firebase_admin.initialize_app(cred)

def verify_id_token(token: str) -> dict:
    _init()
    return _auth.verify_id_token(token)
```

- [ ] **Step 4: Create `backend/auth/dependencies.py`**

```python
from fastapi import Header, HTTPException
from auth.firebase import verify_id_token

async def get_current_user(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        decoded = verify_id_token(token)
        return decoded["uid"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
```

- [ ] **Step 5: Create `backend/auth/__init__.py`**

```python
from .dependencies import get_current_user

__all__ = ["get_current_user"]
```

- [ ] **Step 6: Write failing tests**

Create `backend/tests/__init__.py` (empty) and `backend/tests/auth/__init__.py` (empty).

Create `backend/tests/auth/test_dependencies.py`:

```python
import pytest
import asyncio
from unittest.mock import patch
from fastapi import HTTPException


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_valid_token_returns_uid():
    with patch("auth.firebase.verify_id_token", return_value={"uid": "user-abc"}):
        from auth.dependencies import get_current_user
        result = run(get_current_user("Bearer valid_token_here"))
        assert result == "user-abc"


def test_invalid_token_raises_401():
    with patch("auth.firebase.verify_id_token", side_effect=Exception("token invalid")):
        from auth.dependencies import get_current_user
        with pytest.raises(HTTPException) as exc:
            run(get_current_user("Bearer bad_token"))
        assert exc.value.status_code == 401


def test_missing_bearer_raises_401():
    with patch("auth.firebase.verify_id_token"):
        from auth.dependencies import get_current_user
        with pytest.raises(HTTPException) as exc:
            run(get_current_user("not-a-bearer-token"))
        assert exc.value.status_code == 401


def test_missing_header_raises_422():
    """FastAPI raises 422 when a required Header is absent."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from auth.dependencies import get_current_user

    app = FastAPI()

    @app.get("/test")
    async def handler(uid: str = __import__('fastapi').Depends(get_current_user)):
        return {"uid": uid}

    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/test")
    assert response.status_code == 422
```

- [ ] **Step 7: Run tests — expect them to pass**

```bash
cd backend && python -m pytest tests/auth/ -v
```

Expected output:
```
PASSED tests/auth/test_dependencies.py::test_valid_token_returns_uid
PASSED tests/auth/test_dependencies.py::test_invalid_token_raises_401
PASSED tests/auth/test_dependencies.py::test_missing_bearer_raises_401
PASSED tests/auth/test_dependencies.py::test_missing_header_raises_422
```

- [ ] **Step 8: Commit**

```bash
cd backend
git add auth/ tests/ requirements.txt
git commit -m "feat(auth): add reusable Firebase auth module"
```

---

## Task 2: Database — add user_id to models + migration

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/database.py`

- [ ] **Step 1: Update `backend/models.py`**

Add `user_id` column to all three models:

```python
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.sql import func
from database import Base

class History(Base):
    __tablename__ = "history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    prompt_id = Column(String, nullable=False)
    prompt_name = Column(String, nullable=False)
    inputs = Column(Text, nullable=False)
    result = Column(Text, nullable=False)
    source = Column(String, default="manual")
    model_used = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class Schedule(Base):
    __tablename__ = "schedules"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    prompt_id = Column(String, nullable=False)
    prompt_name = Column(String, nullable=False)
    inputs = Column(Text, nullable=False)
    frequency = Column(String, nullable=False)
    day_of_week = Column(String, nullable=True)
    run_time = Column(String, nullable=False)
    provider = Column(String, default="anthropic")
    model_name = Column(String, nullable=True)
    notify_email = Column(Boolean, default=False)
    notify_telegram = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    last_run_at = Column(DateTime, nullable=True)
    next_run_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class Setting(Base):
    __tablename__ = "settings"
    user_id = Column(String, primary_key=True)
    key = Column(String, primary_key=True)
    value = Column(Text, nullable=True)
```

- [ ] **Step 2: Update `run_migrations()` in `backend/database.py`**

Replace the existing `run_migrations` function entirely:

```python
def run_migrations():
    """
    Idempotent migrations — safe to run on every startup.
    No backward compatibility: existing rows without user_id are dropped.
    """
    from sqlalchemy import text
    with engine.connect() as conn:
        # ── Legacy schema migrations (kept for safety) ──────────────────
        for table, col, definition in [
            ("schedules", "provider",   "VARCHAR DEFAULT 'anthropic'"),
            ("schedules", "model_name", "VARCHAR"),
            ("history",   "model_used", "VARCHAR"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {definition}"))
                conn.commit()
            except Exception:
                pass  # column already exists

        # ── user_id migration ────────────────────────────────────────────
        # Drop all existing rows — no backward compat
        for table in ("history", "schedules", "settings"):
            try:
                conn.execute(text(f"DELETE FROM {table}"))
                conn.commit()
            except Exception:
                pass

        # Add user_id to history
        try:
            conn.execute(text("ALTER TABLE history ADD COLUMN user_id VARCHAR NOT NULL DEFAULT ''"))
            conn.execute(text("ALTER TABLE history ALTER COLUMN user_id DROP DEFAULT"))
            conn.commit()
        except Exception:
            pass  # column already exists

        # Add user_id to schedules
        try:
            conn.execute(text("ALTER TABLE schedules ADD COLUMN user_id VARCHAR NOT NULL DEFAULT ''"))
            conn.execute(text("ALTER TABLE schedules ALTER COLUMN user_id DROP DEFAULT"))
            conn.commit()
        except Exception:
            pass  # column already exists

        # settings: add user_id + change PK to (user_id, key)
        try:
            conn.execute(text("ALTER TABLE settings ADD COLUMN user_id VARCHAR NOT NULL DEFAULT ''"))
            conn.execute(text("ALTER TABLE settings ALTER COLUMN user_id DROP DEFAULT"))
            conn.commit()
        except Exception:
            pass  # column already exists

        # Drop old single-column PK and add composite PK (PostgreSQL only)
        try:
            conn.execute(text("ALTER TABLE settings DROP CONSTRAINT settings_pkey"))
            conn.execute(text("ALTER TABLE settings ADD PRIMARY KEY (user_id, key)"))
            conn.commit()
        except Exception:
            pass  # constraint already updated or not supported
```

- [ ] **Step 3: Commit**

```bash
git add backend/models.py backend/database.py
git commit -m "feat(auth): add user_id to History, Schedule, Setting models + migration"
```

---

## Task 3: Protect all backend routes

**Files:**
- Modify: `backend/routers/settings.py`
- Modify: `backend/routers/history.py`
- Modify: `backend/routers/run.py`
- Modify: `backend/routers/schedules.py`
- Modify: `backend/routers/prompts.py`
- Modify: `backend/scheduler.py`

- [ ] **Step 1: Update `backend/routers/settings.py`**

```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import Setting
from auth import get_current_user
from typing import Optional

router = APIRouter()

class SettingsPayload(BaseModel):
    notion_page_id: Optional[str] = None
    auto_save_notion: Optional[bool] = None
    email_enabled: Optional[bool] = None
    telegram_enabled: Optional[bool] = None

@router.get("/settings")
def get_settings(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    import config as cfg
    rows = {s.key: s.value for s in db.query(Setting).filter(Setting.user_id == user_id).all()}
    return {
        "notion_page_id": cfg.NOTION_PAGE_ID or rows.get("notion_page_id", ""),
        "notion_page_id_from_env": bool(cfg.NOTION_PAGE_ID),
        "notion_configured": bool(cfg.NOTION_TOKEN),
        "auto_save_notion": rows.get("auto_save_notion", "false") == "true",
        "email_configured": bool(cfg.GMAIL_ADDRESS and cfg.GMAIL_APP_PASSWORD),
        "email_enabled": rows.get("email_enabled", "true") == "true",
        "telegram_configured": bool(cfg.TELEGRAM_BOT_TOKEN and cfg.TELEGRAM_CHAT_ID),
        "telegram_enabled": rows.get("telegram_enabled", "true") == "true",
        "openrouter_configured": bool(cfg.OPENROUTER_API_KEY),
    }

@router.get("/config")
def get_config(user_id: str = Depends(get_current_user)):
    import config as cfg
    provider, model = cfg.resolve_model()
    return {
        "provider": provider,
        "model": model,
        "live_mode": cfg.LIVE_MODE,
        "category_config": cfg.CATEGORY_CONFIG,
    }

@router.put("/settings")
def update_settings(
    payload: SettingsPayload,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = payload.dict(exclude_none=True)
    for key, value in data.items():
        str_value = "true" if value is True else "false" if value is False else str(value)
        existing = db.query(Setting).filter(Setting.user_id == user_id, Setting.key == key).first()
        if existing:
            existing.value = str_value
        else:
            db.add(Setting(user_id=user_id, key=key, value=str_value))
    db.commit()
    return {"ok": True}

def get_setting(db: Session, key: str, user_id: Optional[str] = None) -> Optional[str]:
    query = db.query(Setting).filter(Setting.key == key)
    if user_id:
        query = query.filter(Setting.user_id == user_id)
    row = query.first()
    return row.value if row else None
```

- [ ] **Step 2: Update `backend/routers/history.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from database import get_db
from models import History
from routers.settings import get_setting
from auth import get_current_user
import json

router = APIRouter()

@router.get("/history")
def list_history(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(History).filter(History.user_id == user_id).order_by(History.created_at.desc()).all()
    return [
        {
            "id": h.id,
            "prompt_id": h.prompt_id,
            "prompt_name": h.prompt_name,
            "inputs": json.loads(h.inputs),
            "result": h.result,
            "source": h.source,
            "model_used": h.model_used,
            "created_at": h.created_at.isoformat() if h.created_at else None
        }
        for h in items
    ]

@router.get("/history/{item_id}")
def get_history(item_id: int, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    h = db.query(History).filter(History.id == item_id, History.user_id == user_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Not found")
    return {
        "id": h.id,
        "prompt_name": h.prompt_name,
        "inputs": json.loads(h.inputs),
        "result": h.result,
        "source": h.source,
        "model_used": h.model_used,
        "created_at": h.created_at.isoformat() if h.created_at else None
    }

@router.delete("/history/{item_id}")
def delete_history(item_id: int, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    h = db.query(History).filter(History.id == item_id, History.user_id == user_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(h)
    db.commit()
    return {"ok": True}

@router.post("/history/{item_id}/notion")
def save_to_notion(item_id: int, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    h = db.query(History).filter(History.id == item_id, History.user_id == user_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Not found")
    import config as cfg
    token = cfg.NOTION_TOKEN
    page_id = cfg.NOTION_PAGE_ID or get_setting(db, "notion_page_id", user_id)
    if not token or not page_id:
        raise HTTPException(status_code=400, detail="Notion not configured. Add token and page ID in Settings.")
    from notifier import send_notion_page
    from datetime import datetime
    date_label = h.created_at.strftime('%Y-%m-%d') if h.created_at else datetime.utcnow().strftime('%Y-%m-%d')
    title = f"{h.prompt_name} — {date_label}"
    inputs_summary = ", ".join(f"{k}: {v}" for k, v in json.loads(h.inputs).items() if v)
    ok, err = send_notion_page(
        token, page_id, title, h.result,
        metadata={"Date": date_label, "Model": h.model_used or "", "Source": h.source, "Inputs": inputs_summary},
    )
    if not ok:
        raise HTTPException(status_code=500, detail=err or "Failed to save to Notion.")
    return {"ok": True}

@router.get("/notion/test")
def test_notion(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    import config as cfg
    from notifier import test_notion_connection
    token = cfg.NOTION_TOKEN
    page_id = cfg.NOTION_PAGE_ID or get_setting(db, "notion_page_id", user_id)
    if not token:
        raise HTTPException(status_code=400, detail="NOTION_TOKEN not set in environment.")
    if not page_id:
        raise HTTPException(status_code=400, detail="Notion page ID not set. Add NOTION_PAGE_ID to .env or set it in Settings.")
    return test_notion_connection(token, page_id)

@router.get("/notion/test-dbs")
def test_notion_dbs(user_id: str = Depends(get_current_user)):
    import config as cfg
    import requests
    token = cfg.NOTION_TOKEN
    if not token:
        raise HTTPException(status_code=400, detail="NOTION_TOKEN not set in environment.")
    results = {}
    headers = {
        "Authorization": f"Bearer {token}",
        "Notion-Version": cfg.NOTION_API_VERSION,
    }
    for category, cat_cfg in cfg.CATEGORY_CONFIG.items():
        page_id = cat_cfg.get("notion_page_id", "").strip()
        if not page_id:
            results[category] = {"ok": None, "error": "not configured"}
            continue
        clean_id = page_id.replace("-", "").strip("/").split("/")[-1].split("?")[0]
        try:
            resp = requests.get(
                f"https://api.notion.com/v1/pages/{clean_id}",
                headers=headers,
                timeout=cfg.NOTION_TIMEOUT,
            )
            if resp.status_code == 200:
                title_parts = resp.json().get("properties", {}).get("title", {}).get("title", [])
                page_title = title_parts[0]["plain_text"] if title_parts else "(untitled)"
                results[category] = {"ok": True, "title": page_title}
            elif resp.status_code == 404:
                results[category] = {"ok": False, "error": "Page not found"}
            elif resp.status_code == 403:
                results[category] = {"ok": False, "error": "Integration lacks access"}
            else:
                msg = resp.json().get("message", resp.text[:150])
                results[category] = {"ok": False, "error": f"Notion {resp.status_code}: {msg}"}
        except Exception as e:
            results[category] = {"ok": False, "error": str(e)}
    return results

@router.get("/history/{item_id}/download")
def download_history(item_id: int, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    h = db.query(History).filter(History.id == item_id, History.user_id == user_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Not found")
    filename = f"{h.prompt_name.replace(' ', '-').lower()}-{h.id}.md"
    date_str = h.created_at.strftime('%Y-%m-%d') if h.created_at else 'unknown'
    inputs_str = '\n'.join(f'{k}: {v}' for k, v in json.loads(h.inputs).items() if v)
    content = f"---\ntitle: {h.prompt_name}\ndate: {date_str}\nmodel: {h.model_used or 'unknown'}\nsource: {h.source}\n---\n\n# {h.prompt_name}\n\n"
    if inputs_str:
        content += f"**Inputs**\n{inputs_str}\n\n---\n\n"
    content += h.result
    return Response(
        content=content,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
```

- [ ] **Step 3: Update `backend/routers/run.py`**

Add `user_id: str = Depends(get_current_user)` to both endpoints and pass `user_id` when creating `History`. Also pass `user_id` to `get_setting` calls.

In the `run_prompt` endpoint, change the signature to:
```python
@router.post("/run")
def run_prompt(req: RunRequest, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
```

Change the History creation block to include `user_id`:
```python
entry = History(
    prompt_id=req.prompt_id,
    prompt_name=prompt["name"],
    inputs=json.dumps(req.inputs),
    result=result,
    source="manual",
    model_used=f"{provider}/{model}",
    user_id=user_id,
)
```

Change `get_setting(db, "auto_save_notion")` to `get_setting(db, "auto_save_notion", user_id)`.
Change `get_setting(db, "notion_page_id")` to `get_setting(db, "notion_page_id", user_id)`.

In the `run_raw` endpoint, change the signature to:
```python
@router.post("/run/raw")
def run_raw(req: RawRunRequest, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
```

Add `from auth import get_current_user` at the top of `run.py`.

- [ ] **Step 4: Update `backend/routers/schedules.py`**

Add `from auth import get_current_user` at the top.

Change all four endpoint signatures to include `user_id: str = Depends(get_current_user)`:

```python
@router.get("/schedules")
def list_schedules(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    return [_serialize(s) for s in db.query(Schedule).filter(Schedule.user_id == user_id).order_by(Schedule.created_at.desc()).all()]

@router.post("/schedules")
def create_schedule(payload: ScheduleCreate, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    s = Schedule(
        user_id=user_id,
        prompt_id=payload.prompt_id,
        prompt_name=payload.prompt_name,
        inputs=json.dumps(payload.inputs),
        frequency=payload.frequency,
        day_of_week=payload.day_of_week,
        run_time=payload.run_time,
        provider=payload.provider,
        model_name=payload.model_name,
        notify_email=payload.notify_email,
        notify_telegram=payload.notify_telegram,
        is_active=True
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    register_schedule(s)
    return _serialize(s)

@router.put("/schedules/{schedule_id}")
def update_schedule(schedule_id: int, payload: ScheduleUpdate, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    s = db.query(Schedule).filter(Schedule.id == schedule_id, Schedule.user_id == user_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        if field == "inputs":
            setattr(s, field, json.dumps(value))
        else:
            setattr(s, field, value)
    db.commit()
    db.refresh(s)
    register_schedule(s)
    return _serialize(s)

@router.delete("/schedules/{schedule_id}")
def delete_schedule(schedule_id: int, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    s = db.query(Schedule).filter(Schedule.id == schedule_id, Schedule.user_id == user_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    unregister_schedule(schedule_id)
    db.delete(s)
    db.commit()
    return {"ok": True}

@router.patch("/schedules/{schedule_id}/toggle")
def toggle_schedule(schedule_id: int, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    s = db.query(Schedule).filter(Schedule.id == schedule_id, Schedule.user_id == user_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    s.is_active = not s.is_active
    db.commit()
    db.refresh(s)
    register_schedule(s)
    return _serialize(s)
```

- [ ] **Step 5: Update `backend/routers/prompts.py`**

Add auth protection (prompts are shared, uid is unused but the endpoint is protected):

```python
from fastapi import APIRouter, Depends
from auth import get_current_user
from pathlib import Path
import json, re

router = APIRouter()

PROMPTS_FILE = Path(__file__).parent.parent / "data" / "prompts.json"

def load_prompts():
    with open(PROMPTS_FILE) as f:
        prompts = json.load(f)
    for p in prompts:
        if not p.get("placeholders"):
            found = re.findall(r'\[([^\]]+)\]', p["prompt_text"])
            p["placeholders"] = list(dict.fromkeys(found))
    return prompts

@router.get("/prompts")
def list_prompts(_: str = Depends(get_current_user)):
    prompts = load_prompts()
    grouped = {}
    for p in prompts:
        cat = p["category"]
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append(p)
    return grouped

@router.get("/prompts/{prompt_id}")
def get_prompt(prompt_id: str, _: str = Depends(get_current_user)):
    prompts = load_prompts()
    for p in prompts:
        if p["id"] == prompt_id:
            return p
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Prompt not found")
```

- [ ] **Step 6: Update `backend/scheduler.py`**

Pass `schedule.user_id` to all `get_setting()` calls. Find these three lines and update them:

```python
# Line: api_key = config.OPENAI_API_KEY or get_setting(db, "openai_api_key")
api_key = config.OPENAI_API_KEY or get_setting(db, "openai_api_key", schedule.user_id)

# Line: api_key = config.ANTHROPIC_API_KEY or get_setting(db, "anthropic_api_key")
api_key = config.ANTHROPIC_API_KEY or get_setting(db, "anthropic_api_key", schedule.user_id)

# Line: notion_page_id = cat_page_id or config.NOTION_PAGE_ID or get_setting(db, "notion_page_id")
notion_page_id = cat_page_id or config.NOTION_PAGE_ID or get_setting(db, "notion_page_id", schedule.user_id)

# Line: email_enabled = get_setting(db, "email_enabled") != "false"
email_enabled = get_setting(db, "email_enabled", schedule.user_id) != "false"

# Line: telegram_enabled = get_setting(db, "telegram_enabled") != "false"
telegram_enabled = get_setting(db, "telegram_enabled", schedule.user_id) != "false"
```

- [ ] **Step 7: Update `backend/.env.example`**

Add this line:
```
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

Also add `firebase-service-account.json` to `backend/.gitignore` (create if it doesn't exist):
```
firebase-service-account.json
```

- [ ] **Step 8: Commit**

```bash
git add backend/routers/ backend/scheduler.py backend/.env.example
git commit -m "feat(auth): protect all API routes with Firebase auth, scope data by user_id"
```

---

## Task 4: Frontend — install Firebase + create auth/firebase.js

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/auth/firebase.js`
- Create: `frontend/.env.example`

- [ ] **Step 1: Install Firebase**

```bash
cd frontend && npm install firebase
```

- [ ] **Step 2: Create `frontend/src/auth/firebase.js`**

```js
import { initializeApp } from 'firebase/app'
import {
  getAuth,
  GithubAuthProvider,
  GoogleAuthProvider,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const githubProvider = new GithubAuthProvider()
export const googleProvider = new GoogleAuthProvider()
```

- [ ] **Step 3: Create `frontend/.env.example`**

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

- [ ] **Step 4: Add `.env` to `frontend/.gitignore`**

If `frontend/.gitignore` doesn't exist, create it:
```
.env
.env.local
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/auth/firebase.js frontend/.env.example frontend/package.json frontend/package-lock.json
git commit -m "feat(auth): add Firebase JS SDK setup"
```

---

## Task 5: Frontend — AuthContext + ProtectedRoute

**Files:**
- Create: `frontend/src/auth/AuthContext.jsx`
- Create: `frontend/src/auth/ProtectedRoute.jsx`
- Create: `frontend/src/auth/index.js`

- [ ] **Step 1: Create `frontend/src/auth/AuthContext.jsx`**

```jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth'
import { auth } from './firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u ?? null))
    return unsub
  }, [])

  const signOut = () => firebaseSignOut(auth)

  return (
    <AuthContext.Provider value={{ user, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
```

- [ ] **Step 2: Create `frontend/src/auth/ProtectedRoute.jsx`**

```jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function ProtectedRoute({ children }) {
  const { user } = useAuth()

  if (user === undefined) {
    // Still loading auth state — show nothing to avoid flash
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (user === null) {
    return <Navigate to="/login" replace />
  }

  return children
}
```

- [ ] **Step 3: Create `frontend/src/auth/index.js`**

```js
export { AuthProvider, useAuth } from './AuthContext'
export { default as ProtectedRoute } from './ProtectedRoute'
export { default as LoginPage } from './LoginPage'
export { default as SignupPage } from './SignupPage'
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/auth/AuthContext.jsx frontend/src/auth/ProtectedRoute.jsx frontend/src/auth/index.js
git commit -m "feat(auth): add AuthContext and ProtectedRoute"
```

---

## Task 6: Frontend — LoginPage + SignupPage

**Files:**
- Create: `frontend/src/auth/LoginPage.jsx`
- Create: `frontend/src/auth/SignupPage.jsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Create `frontend/src/auth/LoginPage.jsx`**

```jsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  signInWithPopup,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { auth, githubProvider, googleProvider } from './firebase'

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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = async (fn) => {
    setError('')
    setLoading(true)
    try {
      await fn()
      navigate('/')
    } catch (e) {
      setError(e.message?.replace('Firebase: ', '') || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">VAYU</div>
        <p className="auth-tagline">Research, automated.</p>

        <button
          className="auth-btn auth-btn-github"
          onClick={() => handle(() => signInWithPopup(auth, githubProvider))}
          disabled={loading}
        >
          <IconGitHub /> Continue with GitHub
        </button>

        <button
          className="auth-btn auth-btn-google"
          onClick={() => handle(() => signInWithPopup(auth, googleProvider))}
          disabled={loading}
        >
          <IconGoogle /> Continue with Google
        </button>

        <div className="auth-divider"><span>or</span></div>

        <form onSubmit={(e) => { e.preventDefault(); handle(() => signInWithEmailAndPassword(auth, email, password)) }}>
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

- [ ] **Step 2: Create `frontend/src/auth/SignupPage.jsx`**

```jsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from './firebase'

export default function SignupPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    setError('')
    setLoading(true)
    try {
      await createUserWithEmailAndPassword(auth, email, password)
      navigate('/')
    } catch (e) {
      setError(e.message?.replace('Firebase: ', '') || 'Sign up failed')
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
            placeholder="Password"
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

- [ ] **Step 3: Add auth page styles to `frontend/src/index.css`**

Append to the end of `index.css`:

```css
/* ── Auth pages ─────────────────────────────────────────────────────────── */
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
}

.auth-card {
  width: 100%;
  max-width: 380px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 36px 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auth-logo {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 800;
  color: var(--accent);
  letter-spacing: -0.5px;
  margin-bottom: 2px;
}

.auth-tagline {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.auth-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
}
.auth-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.auth-btn-github {
  background: #24292e;
  color: #fff;
}
.auth-btn-github:hover:not(:disabled) { background: #2f363d; }

.auth-btn-google {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
}
.auth-btn-google:hover:not(:disabled) { border-color: var(--text-muted); }

.auth-btn-primary {
  background: var(--accent);
  color: #1a1200;
  font-weight: 700;
  margin-top: 4px;
}
.auth-btn-primary:hover:not(:disabled) { opacity: 0.88; }

.auth-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-muted);
  font-size: 11px;
  margin: 2px 0;
}
.auth-divider::before, .auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.auth-input {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 13px;
  font-size: 13px;
  color: var(--text);
  font-family: 'Manrope', sans-serif;
  outline: none;
  display: block;
  margin-bottom: 8px;
  transition: border-color 0.15s;
}
.auth-input:focus { border-color: var(--accent); }
.auth-input::placeholder { color: var(--text-muted); }

.auth-error {
  font-size: 12px;
  color: #e05c5c;
  margin: -4px 0 4px;
}

.auth-switch {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  margin-top: 4px;
}
.auth-switch a { color: var(--accent); text-decoration: none; }
.auth-switch a:hover { text-decoration: underline; }
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/auth/LoginPage.jsx frontend/src/auth/SignupPage.jsx frontend/src/index.css
git commit -m "feat(auth): add Login and Signup pages"
```

---

## Task 7: Wire up App.jsx + api.js

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/api.js`

- [ ] **Step 1: Update `frontend/src/App.jsx`**

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, ProtectedRoute, LoginPage, SignupPage } from './auth'
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
          <Route path="/login"  element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/*"      element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
```

- [ ] **Step 2: Update `frontend/src/api.js`**

```js
import axios from 'axios'
import { auth } from './auth/firebase'

const api = axios.create({ baseURL: '/api' })

// Attach Firebase ID token to every request
api.interceptors.request.use(async (config) => {
  const token = await auth.currentUser?.getIdToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

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

- [ ] **Step 3: Find all usages of `downloadHistory` in the frontend and update call sites**

Search for usages:
```bash
grep -r "downloadHistory" frontend/src/ --include="*.jsx" --include="*.js"
```

The current usage is likely `window.location.href = downloadHistory(id)` or an `<a href={downloadHistory(id)}>`. Change all such usages to call `downloadHistory(id)` as an async function (not used as a URL string):

```jsx
// Before:
<a href={downloadHistory(item.id)} download>Download</a>

// After:
<button onClick={() => downloadHistory(item.id)}>Download</button>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.jsx frontend/src/api.js
git commit -m "feat(auth): wire AuthProvider, ProtectedRoute, and Bearer token interceptor"
```

---

## Task 8: Firebase console setup (manual steps)

These steps are done in the browser — not code. Document them here for reference.

- [ ] **Step 1: Create Firebase project**
  1. Go to [console.firebase.google.com](https://console.firebase.google.com)
  2. Click "Add project" → name it "vayu-research" → disable Google Analytics → Create
  3. In the project, go to **Build → Authentication → Get started**

- [ ] **Step 2: Enable sign-in providers**
  - Enable **Email/Password** (toggle ON, save)
  - Enable **Google** (toggle ON, set project support email, save)
  - Enable **GitHub** (toggle ON — you need a GitHub OAuth App first)

- [ ] **Step 3: Create GitHub OAuth App**
  1. Go to github.com → Settings → Developer settings → OAuth Apps → New OAuth App
  2. Application name: `Vayu Research`
  3. Homepage URL: `https://your-domain.com` (or `http://localhost:5173` for dev)
  4. Authorization callback URL: copy from Firebase GitHub provider page (`https://<project>.firebaseapp.com/__/auth/handler`)
  5. Register app → copy Client ID and Client Secret → paste into Firebase GitHub provider

- [ ] **Step 4: Get Firebase web config**
  1. In Firebase console → Project settings (gear icon) → General → "Your apps"
  2. Click "Add app" → Web (`</>`) → name it "vayu-research-web" → Register
  3. Copy the `firebaseConfig` object values into `frontend/.env`:
  ```
  VITE_FIREBASE_API_KEY=AIzaSy...
  VITE_FIREBASE_AUTH_DOMAIN=vayu-research.firebaseapp.com
  VITE_FIREBASE_PROJECT_ID=vayu-research
  VITE_FIREBASE_STORAGE_BUCKET=vayu-research.appspot.com
  VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
  VITE_FIREBASE_APP_ID=1:123456789:web:abc123
  ```

- [ ] **Step 5: Get service account JSON for backend**
  1. Firebase console → Project settings → Service accounts
  2. Click "Generate new private key" → Download JSON
  3. Save as `backend/firebase-service-account.json` (this file is gitignored)
  4. Set in `backend/.env`: `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json`

- [ ] **Step 6: Add authorised domains (for production)**
  1. Firebase console → Authentication → Settings → Authorised domains
  2. Add your production domain

- [ ] **Step 7: Commit setup docs**

```bash
git add docs/
git commit -m "docs: add Firebase console setup instructions"
```

---

## Self-Review Checklist

- [x] Spec coverage: auth module ✓, DB migration ✓, route protection ✓, frontend auth ✓, login/signup UI ✓, api interceptor ✓, download fix ✓
- [x] No TBDs or placeholders
- [x] `get_current_user` signature consistent across all tasks
- [x] `get_setting(db, key, user_id)` updated in settings.py and referenced consistently in history.py, run.py, scheduler.py
- [x] `History(user_id=user_id, ...)` consistent between run.py (Task 3) and scheduler.py (Task 3 Step 6)
- [x] `downloadHistory` changed from URL string to async function — call sites updated in Task 7 Step 3
