from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session
from typing import Optional
import json, re
from database import get_db
from models import Schedule
from scheduler import register_schedule, unregister_schedule
from auth import get_current_user

router = APIRouter()

VALID_FREQUENCIES = {"daily", "weekdays", "weekly"}
VALID_DAYS        = {"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"}
VALID_PROVIDERS   = {"anthropic", "openai", "openrouter"}
_TIME_RE          = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


class ScheduleCreate(BaseModel):
    prompt_id: str
    prompt_name: str
    inputs: dict
    frequency: str
    day_of_week: Optional[str] = None
    run_time: str
    provider: Optional[str] = None
    model_name: Optional[str] = None
    notify_email: bool = False
    notify_telegram: bool = False

    @field_validator("prompt_id", "prompt_name")
    @classmethod
    def nonempty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be empty")
        return v.strip()

    @field_validator("frequency")
    @classmethod
    def frequency_valid(cls, v: str) -> str:
        if v not in VALID_FREQUENCIES:
            raise ValueError(f"must be one of {sorted(VALID_FREQUENCIES)}")
        return v

    @field_validator("run_time")
    @classmethod
    def run_time_valid(cls, v: str) -> str:
        if not _TIME_RE.match(v):
            raise ValueError("must be HH:MM in 24-hour format (e.g. 08:30)")
        return v

    @field_validator("day_of_week")
    @classmethod
    def day_of_week_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.lower() not in VALID_DAYS:
            raise ValueError(f"must be one of {sorted(VALID_DAYS)}")
        return v.lower() if v else v

    @field_validator("provider")
    @classmethod
    def provider_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_PROVIDERS:
            raise ValueError(f"must be one of {sorted(VALID_PROVIDERS)}")
        return v

    @field_validator("inputs")
    @classmethod
    def inputs_valid(cls, v: dict) -> dict:
        for key, val in v.items():
            if not isinstance(val, str):
                raise ValueError(f"input value for '{key}' must be a string")
        return v

    def model_post_init(self, __context) -> None:
        if self.frequency == "weekly" and not self.day_of_week:
            raise ValueError("day_of_week is required when frequency is 'weekly'")


class ScheduleUpdate(BaseModel):
    inputs: Optional[dict] = None
    frequency: Optional[str] = None
    day_of_week: Optional[str] = None
    run_time: Optional[str] = None
    provider: Optional[str] = None
    model_name: Optional[str] = None
    notify_email: Optional[bool] = None
    notify_telegram: Optional[bool] = None

    @field_validator("frequency")
    @classmethod
    def frequency_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_FREQUENCIES:
            raise ValueError(f"must be one of {sorted(VALID_FREQUENCIES)}")
        return v

    @field_validator("run_time")
    @classmethod
    def run_time_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not _TIME_RE.match(v):
            raise ValueError("must be HH:MM in 24-hour format (e.g. 08:30)")
        return v

    @field_validator("day_of_week")
    @classmethod
    def day_of_week_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.lower() not in VALID_DAYS:
            raise ValueError(f"must be one of {sorted(VALID_DAYS)}")
        return v.lower() if v else v

    @field_validator("provider")
    @classmethod
    def provider_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_PROVIDERS:
            raise ValueError(f"must be one of {sorted(VALID_PROVIDERS)}")
        return v


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
def list_schedules(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    return [_serialize(s) for s in db.query(Schedule).filter(Schedule.user_id == user_id).order_by(Schedule.created_at.desc()).all()]


@router.post("/schedules")
def create_schedule(payload: ScheduleCreate, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
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
        is_active=True,
        user_id=user_id
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
