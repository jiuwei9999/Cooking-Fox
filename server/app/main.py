from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .routes.api import api_router


app = FastAPI(title="CookingSim MVP", version="0.1.0")

app.include_router(api_router, prefix="/api")

# Serve the frontend (static files)
WEB_DIR = (Path(__file__).resolve().parents[2] / "web").as_posix()
app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")

