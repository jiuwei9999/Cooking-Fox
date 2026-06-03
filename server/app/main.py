from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.types import Scope

from .routes.api import api_router


class NoCacheStaticFiles(StaticFiles):
    async def __call__(self, scope: Scope, receive, send):
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                path = scope.get("path", "")
                if path.endswith(".js") or path.endswith(".css"):
                    headers = dict(message.get("headers", []))
                    headers[b"cache-control"] = b"no-store, must-revalidate"
                    headers[b"pragma"] = b"no-cache"
                    headers[b"expires"] = b"0"
                    message["headers"] = list(headers.items())
            await send(message)
        await super().__call__(scope, receive, send_wrapper)


app = FastAPI(title="狐闹厨房 · Cooking-Fox", version="0.1.0")

app.include_router(api_router, prefix="/api")

# Serve the frontend with no-cache headers for JS/CSS
WEB_DIR = (Path(__file__).resolve().parents[2] / "web").as_posix()
app.mount("/", NoCacheStaticFiles(directory=WEB_DIR, html=True), name="web")
