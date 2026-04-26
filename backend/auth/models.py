from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    provider = Column(String, nullable=False)          # "email" | "github" | "google"
    hashed_password = Column(String, nullable=True)    # null for OAuth-only users
    created_at = Column(DateTime, server_default=func.now())
