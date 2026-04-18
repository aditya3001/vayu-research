from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from database import get_db
from models import History
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

@router.get("/history/{item_id}/download")
def download_history(item_id: int, db: Session = Depends(get_db)):
    h = db.query(History).filter(History.id == item_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Not found")
    filename = f"{h.prompt_id}-{h.id}.md"
    content = f"# {h.prompt_name}\n\n**Date:** {h.created_at}\n**Source:** {h.source}\n\n---\n\n{h.result}"
    return Response(
        content=content,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
