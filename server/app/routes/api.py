from __future__ import annotations

from fastapi import APIRouter

from ..sim.engine import create_default_session, step_session
from ..sim.models import SimAction
from ..recipes.importer import parse_recipe_text
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


@api_router.get("/recipes/user")
def user_recipes() -> dict:
    return {"recipes": storage.list_user_recipes()}


@api_router.post("/recipes/import")
def import_recipe(payload: dict) -> dict:
    text = payload.get("text") if isinstance(payload, dict) else None
    if not isinstance(text, str):
        return {"error": "text must be a string"}
    parsed = parse_recipe_text(text)
    return {"recipe": parsed.to_dict()}


@api_router.post("/recipes/save")
def save_recipe(payload: dict) -> dict:
    recipe = payload.get("recipe") if isinstance(payload, dict) else None
    if not isinstance(recipe, dict):
        return {"error": "recipe must be an object"}
    if not recipe.get("id"):
        return {"error": "recipe.id required"}
    storage.save_user_recipe(recipe)
    return {"ok": True}

