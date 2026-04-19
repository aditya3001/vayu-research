from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import Setting
from typing import Optional

router = APIRouter()

class SettingsPayload(BaseModel):
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    notion_token: Optional[str] = None
    notion_page_id: Optional[str] = None

@router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    import os
    rows = {s.key: s.value for s in db.query(Setting).all()}
    return {
        "openai_api_key": "***" if rows.get("openai_api_key") else "",
        "anthropic_api_key": "***" if rows.get("anthropic_api_key") else "",
        "notion_token": "***" if rows.get("notion_token") else "",
        "notion_page_id": rows.get("notion_page_id", ""),
        "_email_configured": bool(os.environ.get("GMAIL_ADDRESS") and os.environ.get("GMAIL_APP_PASSWORD")),
        "_telegram_configured": bool(os.environ.get("TELEGRAM_BOT_TOKEN") and os.environ.get("TELEGRAM_CHAT_ID")),
    }

@router.get("/config")
def get_config():
    import os
    provider = os.environ.get("DEFAULT_PROVIDER", "anthropic")
    defaults = {"anthropic": "claude-opus-4-6", "openai": "gpt-4o"}
    model = os.environ.get("DEFAULT_MODEL") or defaults.get(provider, "claude-opus-4-6")
    return {"provider": provider, "model": model}

@router.put("/settings")
def update_settings(payload: SettingsPayload, db: Session = Depends(get_db)):
    data = payload.dict(exclude_none=True)
    for key, value in data.items():
        if value == "***":  # Don't overwrite masked values
            continue
        existing = db.query(Setting).filter(Setting.key == key).first()
        if existing:
            existing.value = value
        else:
            db.add(Setting(key=key, value=value))
    db.commit()
    return {"ok": True}

def get_setting(db: Session, key: str) -> Optional[str]:
    row = db.query(Setting).filter(Setting.key == key).first()
    return row.value if row else None
