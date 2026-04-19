from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import Setting
from typing import Optional

router = APIRouter()

class SettingsPayload(BaseModel):
    gmail_address: Optional[str] = None
    gmail_app_password: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    default_provider: Optional[str] = None
    default_model: Optional[str] = None
    notion_token: Optional[str] = None
    notion_page_id: Optional[str] = None

@router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    rows = {s.key: s.value for s in db.query(Setting).all()}
    return {
        "gmail_address": rows.get("gmail_address", ""),
        "gmail_app_password": "***" if rows.get("gmail_app_password") else "",
        "telegram_bot_token": "***" if rows.get("telegram_bot_token") else "",
        "telegram_chat_id": rows.get("telegram_chat_id", ""),
        "openai_api_key": "***" if rows.get("openai_api_key") else "",
        "anthropic_api_key": "***" if rows.get("anthropic_api_key") else "",
        "default_provider": rows.get("default_provider", "anthropic"),
        "default_model": rows.get("default_model", ""),
        "notion_token": "***" if rows.get("notion_token") else "",
        "notion_page_id": rows.get("notion_page_id", ""),
    }

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
