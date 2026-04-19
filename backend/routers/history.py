from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from database import get_db
from models import History
from routers.settings import get_setting
import json

router = APIRouter()

@router.get("/history")
def list_history(db: Session = Depends(get_db)):
    items = db.query(History).order_by(History.created_at.desc()).all()
    return [
        {
            "id": h.id,
            "prompt_id": h.prompt_id,
            "prompt_name": h.prompt_name,
            "inputs": json.loads(h.inputs),
            "result": h.result,
            "source": h.source,
            "created_at": h.created_at.isoformat() if h.created_at else None
        }
        for h in items
    ]

@router.get("/history/{item_id}")
def get_history(item_id: int, db: Session = Depends(get_db)):
    h = db.query(History).filter(History.id == item_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Not found")
    return {
        "id": h.id,
        "prompt_name": h.prompt_name,
        "inputs": json.loads(h.inputs),
        "result": h.result,
        "source": h.source,
        "created_at": h.created_at.isoformat() if h.created_at else None
    }

@router.delete("/history/{item_id}")
def delete_history(item_id: int, db: Session = Depends(get_db)):
    h = db.query(History).filter(History.id == item_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(h)
    db.commit()
    return {"ok": True}

@router.post("/history/{item_id}/notion")
def save_to_notion(item_id: int, db: Session = Depends(get_db)):
    h = db.query(History).filter(History.id == item_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Not found")
    import os
    token = os.environ.get("NOTION_TOKEN")
    page_id = os.environ.get("NOTION_PAGE_ID") or get_setting(db, "notion_page_id")
    if not token or not page_id:
        raise HTTPException(status_code=400, detail="Notion not configured. Add token and page ID in Settings.")
    from notifier import send_notion
    from datetime import datetime
    title = f"{h.prompt_name} — {h.created_at.strftime('%Y-%m-%d') if h.created_at else datetime.utcnow().strftime('%Y-%m-%d')}"
    ok, err = send_notion(token, page_id, title, h.result)
    if not ok:
        raise HTTPException(status_code=500, detail=err or "Failed to save to Notion.")
    return {"ok": True}

@router.get("/notion/test")
def test_notion(db: Session = Depends(get_db)):
    import os
    from notifier import test_notion_connection
    token = os.environ.get("NOTION_TOKEN")
    page_id = os.environ.get("NOTION_PAGE_ID") or get_setting(db, "notion_page_id")
    if not token:
        raise HTTPException(status_code=400, detail="NOTION_TOKEN not set in environment.")
    if not page_id:
        raise HTTPException(status_code=400, detail="Notion page ID not set. Add NOTION_PAGE_ID to .env or set it in Settings.")
    return test_notion_connection(token, page_id)

@router.get("/history/{item_id}/download")
def download_history(item_id: int, db: Session = Depends(get_db)):
    h = db.query(History).filter(History.id == item_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Not found")
    filename = f"{h.prompt_name.replace(' ', '-').lower()}-{h.id}.md"
    date_str = h.created_at.strftime('%Y-%m-%d') if h.created_at else 'unknown'
    inputs_str = '\n'.join(f'{k}: {v}' for k, v in json.loads(h.inputs).items() if v)
    content = f"---\ntitle: {h.prompt_name}\ndate: {date_str}\nsource: {h.source}\n---\n\n# {h.prompt_name}\n\n"
    if inputs_str:
        content += f"**Inputs**\n{inputs_str}\n\n---\n\n"
    content += h.result
    return Response(
        content=content,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
