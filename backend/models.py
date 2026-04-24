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
