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
def get_config(_: str = Depends(get_current_user)):
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
