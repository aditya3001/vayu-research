from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def run_migrations():
    """Add columns that may be missing from an existing schema."""
    from sqlalchemy import text
    with engine.connect() as conn:
        for table, col, definition in [
            ("schedules", "provider", "VARCHAR DEFAULT 'anthropic'"),
            ("schedules", "model_name", "VARCHAR"),
            ("history", "model_used", "VARCHAR"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {definition}"))
                conn.commit()
            except Exception:
                pass  # column already exists
