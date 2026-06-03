from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..ai_service import generate_dish_image, generate_meal_plan, generate_serve_report, get_ai_status
from ..calorie_calc import calc_daily_calories

ai_router = APIRouter()


@ai_router.get("/ai/status")
def ai_status(probe: int = 0) -> dict:
    return get_ai_status(probe=bool(probe))


@ai_router.post("/ai/calc-calories")
def ai_calc_calories(payload: dict) -> dict:
    profile = payload.get("profile") if isinstance(payload, dict) else payload
    if not isinstance(profile, dict):
        return JSONResponse({"error": "profile must be an object"}, status_code=400)
    result = calc_daily_calories(profile)
    if result.get("error"):
        return JSONResponse(result, status_code=422)
    return {"calorie_plan": result, "calorie_target": result.get("daily_kcal")}


@ai_router.post("/ai/dish-image")
def ai_dish_image(payload: dict) -> dict:
    session = payload.get("session") if isinstance(payload, dict) else None
    if not isinstance(session, dict):
        return JSONResponse({"error": "session must be an object"}, status_code=400)
    try:
        return generate_dish_image(session)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@ai_router.post("/ai/meal-plan")
def ai_meal_plan(payload: dict) -> dict:
    profile = payload.get("profile") if isinstance(payload, dict) else None
    if not isinstance(profile, dict):
        return JSONResponse({"error": "profile must be an object"}, status_code=400)
    try:
        return generate_meal_plan(profile)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@ai_router.post("/ai/serve-report")
def ai_serve_report(payload: dict) -> dict:
    session = payload.get("session") if isinstance(payload, dict) else None
    if not isinstance(session, dict):
        return JSONResponse({"error": "session must be an object"}, status_code=400)
    try:
        return generate_serve_report(session)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)
