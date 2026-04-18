from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
import json
from database import get_db
from models import Schedule
from scheduler import register_schedule, unregister_schedule

router = APIRouter()

class ScheduleCreate(BaseModel):
    prompt_id: str
    prompt_name: str
    inputs: dict
    frequency: str  # daily | weekdays | weekly
    day_of_week: Optional[str] = None
    run_time: str   # "08:00"
    provider: str = "anthropic"
    model_name: Optional[str] = None
    notify_email: bool = False
    notify_telegram: bool = False

class ScheduleUpdate(BaseModel):
    inputs: Optional[dict] = None
    frequency: Optional[str] = None
    day_of_week: Optional[str] = None
    run_time: Optional[str] = None
    provider: Optional[str] = None
    model_name: Optional[str] = None
    notify_email: Optional[bool] = None
    notify_telegram: Optional[bool] = None

def _serialize(s: Schedule) -> dict:
    return {
        "id": s.id,
        "prompt_id": s.prompt_id,
        "prompt_name": s.prompt_name,
        "inputs": json.loads(s.inputs),
        "frequency": s.frequency,
        "day_of_week": s.day_of_week,
        "run_time": s.run_time,
        "provider": s.provider or "anthropic",
        "model_name": s.model_name,
        "notify_email": s.notify_email,
        "notify_telegram": s.notify_telegram,
        "is_active": s.is_active,
        "last_run_at": s.last_run_at.isoformat() if s.last_run_at else None,
        "next_run_at": s.next_run_at.isoformat() if s.next_run_at else None,
        "created_at": s.created_at.isoformat() if s.created_at else None
    }

@router.get("/schedules")
def list_schedules(db: Session = Depends(get_db)):
    return [_serialize(s) for s in db.query(Schedule).order_by(Schedule.created_at.desc()).all()]

@router.post("/schedules")
def create_schedule(payload: ScheduleCreate, db: Session = Depends(get_db)):
    s = Schedule(
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
def update_schedule(schedule_id: int, payload: ScheduleUpdate, db: Session = Depends(get_db)):
    s = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    for field, value in payload.dict(exclude_none=True).items():
        if field == "inputs":
            setattr(s, field, json.dumps(value))
        else:
            setattr(s, field, value)
    db.commit()
    db.refresh(s)
    register_schedule(s)
    return _serialize(s)

@router.delete("/schedules/{schedule_id}")
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    s = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    unregister_schedule(schedule_id)
    db.delete(s)
    db.commit()
    return {"ok": True}

@router.patch("/schedules/{schedule_id}/toggle")
def toggle_schedule(schedule_id: int, db: Session = Depends(get_db)):
    s = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    s.is_active = not s.is_active
    db.commit()
    db.refresh(s)
    register_schedule(s)
    return _serialize(s)
