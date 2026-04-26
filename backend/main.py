from dotenv import load_dotenv
load_dotenv(override=True)

import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-5s | %(name)-12s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("main")

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import os

from database import engine, run_migrations
import models
from auth.models import User  # noqa: F401 — registers User table with Base.metadata
models.Base.metadata.create_all(bind=engine)
run_migrations()

import config
logger.info(f"Starting Vayu Research — provider={config.DEFAULT_PROVIDER} live_mode={config.LIVE_MODE}")
provider, model = config.resolve_model()
logger.info(f"Active model: {provider}/{model}")

from scheduler import start_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield

app = FastAPI(title="Vayu Research", lifespan=lifespan)

from routers import prompts, run, history, schedules, settings
from auth import router as auth_router
app.include_router(auth_router, prefix="/api/auth")
app.include_router(prompts.router, prefix="/api")
app.include_router(run.router, prefix="/api")
app.include_router(history.router, prefix="/api")
app.include_router(schedules.router, prefix="/api")
app.include_router(settings.router, prefix="/api")

STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.exists(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
