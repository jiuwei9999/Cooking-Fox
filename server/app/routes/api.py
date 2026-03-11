from __future__ import annotations

from fastapi import APIRouter

from ..sim.engine import create_default_session, step_session
from ..sim.models import SimAction
from ..storage.db import Storage


api_router = APIRouter()
storage = Storage.create("./data.sqlite")


@api_router.get("/health")
def health() -> dict:
    return {"ok": True}


@api_router.post("/sim/session")
def new_session() -> dict:
    session = create_default_session()
    storage.save_session(session)
    return {"session": session}


@api_router.post("/sim/step")
def sim_step(payload: dict) -> dict:
    session_id = payload.get("sessionId")
    action = payload.get("action")
    if not isinstance(session_id, str):
        return {"error": "sessionId must be a string"}
    sim_action = SimAction.model_validate(action)

    session = storage.get_session(session_id)
    if session is None:
        return {"error": "unknown sessionId"}

    updated = step_session(session, sim_action)
    storage.save_session(updated)
    return {"session": updated}


@api_router.get("/recipes/examples")
def example_recipes() -> dict:
    return {"recipes": storage.list_example_recipes()}

