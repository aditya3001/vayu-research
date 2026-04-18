from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.sql import func
from database import Base

class History(Base):
    __tablename__ = "history"
    id = Column(Integer, primary_key=True, index=True)
    prompt_id = Column(String, nullable=False)
    prompt_name = Column(String, nullable=False)
    inputs = Column(Text, nullable=False)   # JSON string
    result = Column(Text, nullable=False)
    source = Column(String, default="manual")  # "manual" | "scheduled"
    created_at = Column(DateTime, server_default=func.now())

class Schedule(Base):
    __tablename__ = "schedules"
    id = Column(Integer, primary_key=True, index=True)
    prompt_id = Column(String, nullable=False)
    prompt_name = Column(String, nullable=False)
    inputs = Column(Text, nullable=False)   # JSON string
    frequency = Column(String, nullable=False)  # "daily" | "weekdays" | "weekly"
    day_of_week = Column(String, nullable=True)  # "monday" etc, only for weekly
    run_time = Column(String, nullable=False)    # "08:00"
    provider = Column(String, default="anthropic")   # "anthropic" | "openai"
    model_name = Column(String, nullable=True)         # None = use provider default
    notify_email = Column(Boolean, default=False)
    notify_telegram = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    last_run_at = Column(DateTime, nullable=True)
    next_run_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class Setting(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True)
    value = Column(Text, nullable=True)
