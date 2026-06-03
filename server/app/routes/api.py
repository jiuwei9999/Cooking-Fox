from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from .ai_routes import ai_router
from ..sim.engine import create_default_session, step_session
from ..sim.equipment import COOKWARE_PROFILES
from ..sim.limits import limits_payload, validate_action
from ..sim.models import SimAction
from ..recipes.importer import parse_recipe_text
from ..recipes.enrich import enrich_recipe
from ..storage.db import Storage


api_router = APIRouter()
api_router.include_router(ai_router)

# Use absolute path relative to the server/ directory so the DB location is
# deterministic regardless of the working directory at startup.
_DB_PATH = (Path(__file__).resolve().parents[2] / "data.sqlite").as_posix()
storage = Storage.create(_DB_PATH)


@api_router.get("/health")
def health() -> dict:
    return {"ok": True}


@api_router.get("/sim/limits")
def sim_limits() -> dict:
    return limits_payload()


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
        return JSONResponse({"error": "sessionId must be a string"}, status_code=400)
    try:
        sim_action = SimAction.model_validate(action)
    except Exception as e:
        return JSONResponse({"error": f"invalid action: {e}"}, status_code=400)

    session = storage.get_session(session_id)
    if session is None:
        return JSONResponse({"error": "unknown sessionId"}, status_code=404)

    limit_err = validate_action(session, sim_action)
    if limit_err:
        return JSONResponse({"error": limit_err, "session": session.model_dump()}, status_code=422)

    updated = step_session(session, sim_action)
    storage.save_session(updated)
    return {"session": updated}


@api_router.post("/sim/equipment")
def set_equipment(payload: dict) -> dict:
    session_id = payload.get("sessionId")
    equipment_id = payload.get("equipmentId")
    if not isinstance(session_id, str):
        return JSONResponse({"error": "sessionId must be a string"}, status_code=400)
    if not isinstance(equipment_id, str) or equipment_id not in COOKWARE_PROFILES:
        return JSONResponse({"error": "unknown equipmentId"}, status_code=400)
    session = storage.get_session(session_id)
    if session is None:
        return JSONResponse({"error": "unknown sessionId"}, status_code=404)
    session.equipment_id = equipment_id
    storage.save_session(session)
    return {"session": session}


@api_router.get("/recipes/examples")
def example_recipes() -> dict:
    raw = storage.list_example_recipes()
    return {"recipes": [enrich_recipe(r) for r in raw]}


@api_router.get("/recipes/user")
def user_recipes() -> dict:
    return {"recipes": storage.list_user_recipes()}


@api_router.post("/recipes/import")
def import_recipe(payload: dict) -> dict:
    text = payload.get("text") if isinstance(payload, dict) else None
    if not isinstance(text, str):
        return JSONResponse({"error": "text must be a string"}, status_code=400)
    parsed = parse_recipe_text(text)
    recipe = enrich_recipe(parsed.to_dict())
    return {"recipe": recipe}


@api_router.post("/recipes/save")
def save_recipe(payload: dict) -> dict:
    recipe = payload.get("recipe") if isinstance(payload, dict) else None
    if not isinstance(recipe, dict):
        return JSONResponse({"error": "recipe must be an object"}, status_code=400)
    if not recipe.get("id"):
        return JSONResponse({"error": "recipe.id required"}, status_code=400)
    # Limit payload size to prevent abuse (max ~512KB serialized)
    import json as _json
    if len(_json.dumps(recipe, ensure_ascii=False)) > 512 * 1024:
        return JSONResponse({"error": "recipe payload too large"}, status_code=413)
    storage.save_user_recipe(recipe)
    return {"ok": True}

