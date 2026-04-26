from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import DATABASE_URL

_is_postgres = DATABASE_URL.startswith("postgresql") or DATABASE_URL.startswith("postgres")

if _is_postgres:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,      # drop stale connections (important for Supabase)
        pool_size=5,
        max_overflow=10,
    )
else:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},  # SQLite only
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def run_migrations():
    """
    Idempotent migrations — safe to run on every startup.
    No backward compatibility: existing rows without user_id are dropped.
    """
    from sqlalchemy import text
    with engine.connect() as conn:
        # ── Legacy schema migrations (kept for safety) ──────────────────
        for table, col, definition in [
            ("schedules", "provider",   "VARCHAR DEFAULT 'anthropic'"),
            ("schedules", "model_name", "VARCHAR"),
            ("history",   "model_used", "VARCHAR"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {definition}"))
                conn.commit()
            except Exception:
                pass  # column already exists

        # ── user_id migration ────────────────────────────────────────────
        # Drop all existing rows — no backward compat
        for table in ("history", "schedules", "settings"):
            try:
                conn.execute(text(f"DELETE FROM {table}"))
                conn.commit()
            except Exception:
                pass

        # Add user_id to history
        try:
            conn.execute(text("ALTER TABLE history ADD COLUMN user_id VARCHAR NOT NULL DEFAULT ''"))
            conn.execute(text("ALTER TABLE history ALTER COLUMN user_id DROP DEFAULT"))
            conn.commit()
        except Exception:
            pass  # column already exists

        # Add user_id to schedules
        try:
            conn.execute(text("ALTER TABLE schedules ADD COLUMN user_id VARCHAR NOT NULL DEFAULT ''"))
            conn.execute(text("ALTER TABLE schedules ALTER COLUMN user_id DROP DEFAULT"))
            conn.commit()
        except Exception:
            pass  # column already exists

        # settings: add user_id + change PK to (user_id, key)
        try:
            conn.execute(text("ALTER TABLE settings ADD COLUMN user_id VARCHAR NOT NULL DEFAULT ''"))
            conn.execute(text("ALTER TABLE settings ALTER COLUMN user_id DROP DEFAULT"))
            conn.commit()
        except Exception:
            pass  # column already exists

        # Drop old single-column PK and add composite PK (PostgreSQL only)
        try:
            conn.execute(text("ALTER TABLE settings DROP CONSTRAINT settings_pkey"))
            conn.execute(text("ALTER TABLE settings ADD PRIMARY KEY (user_id, key)"))
            conn.commit()
        except Exception:
            pass  # constraint already updated or not supported
