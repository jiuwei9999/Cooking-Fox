"""锅内容量与温度安全上限（前后端应对齐常量）。"""

from __future__ import annotations

from .equipment import COOKWARE_PROFILES
from .models import SimAction, SimSession

# 份数过多会加重 3D 物理与列表渲染
MAX_POT_PORTIONS = 8
MAX_RESERVE_PORTIONS = 8

MAX_POT_TOTAL_G = 2000.0
MAX_RESERVE_TOTAL_G = 1500.0
MAX_SINGLE_ADD_G = 200.0
MIN_ADD_G = 1.0

MIN_TEMP_C = 25.0
GLOBAL_MAX_TEMP_C = 280.0


def pot_capacity_g(session: SimSession) -> float:
    eq = COOKWARE_PROFILES.get(session.equipment_id or "wok")
    vol_l = eq.volume_l if eq else 3.0
    return min(MAX_POT_TOTAL_G, vol_l * 1000.0 * 0.95)


def reserve_capacity_g() -> float:
    return MAX_RESERVE_TOTAL_G


def pot_stats(session: SimSession) -> tuple[int, float]:
    pot = session.pot or []
    total = sum(max(0.0, float(p.amount_g)) for p in pot)
    return len(pot), total


def reserve_stats(session: SimSession) -> tuple[int, float]:
    reserve = session.reserve or []
    total = sum(max(0.0, float(p.amount_g)) for p in reserve)
    return len(reserve), total


def max_heat_target_c(session: SimSession) -> float:
    eq = COOKWARE_PROFILES.get(session.equipment_id or "wok")
    cap = eq.max_safe_temp_c if eq else GLOBAL_MAX_TEMP_C
    return min(GLOBAL_MAX_TEMP_C, cap)


def clamp_temp_c(session: SimSession, temp_c: float) -> float:
    hi = max_heat_target_c(session)
    return max(MIN_TEMP_C, min(hi, float(temp_c)))


def clamp_heat_target_c(session: SimSession, target_temp_c: float | None) -> float:
    t = float(target_temp_c if target_temp_c is not None else 160.0)
    return clamp_temp_c(session, t)


def validate_add(session: SimSession, ingredient_id: str | None, amount_g: float | None) -> str | None:
    if not ingredient_id:
        return "缺少食材。"
    if amount_g is None:
        return "缺少加入克数。"
    amt = float(amount_g)
    if amt < MIN_ADD_G:
        return f"加入量至少 {MIN_ADD_G:g}g。"
    if amt > MAX_SINGLE_ADD_G:
        return f"单次加入不能超过 {MAX_SINGLE_ADD_G:g}g。"
    n, total = pot_stats(session)
    cap = pot_capacity_g(session)
    if n >= MAX_POT_PORTIONS:
        return (
            f"锅内已有 {n} 份食材（上限 {MAX_POT_PORTIONS} 份），"
            "请先捞出部分或清空锅内。"
        )
    if total + amt > cap + 1e-6:
        remain = max(0.0, cap - total)
        return (
            f"锅内约 {round(total)}g，最多再放 {round(remain)}g"
            f"（本锅容量约 {round(cap)}g）。"
        )
    return None


def validate_stash_to_reserve(
    session: SimSession, ingredient_id: str | None, amount_g: float | None
) -> str | None:
    if not ingredient_id or amount_g is None:
        return "缺少食材或克数。"
    amt = float(amount_g)
    if amt < MIN_ADD_G:
        return f"加入量至少 {MIN_ADD_G:g}g。"
    if amt > MAX_SINGLE_ADD_G:
        return f"单次不能超过 {MAX_SINGLE_ADD_G:g}g。"
    n, total = reserve_stats(session)
    cap = reserve_capacity_g()
    if n >= MAX_RESERVE_PORTIONS:
        return f"备用区已满（{MAX_RESERVE_PORTIONS} 份），请先入锅或移除。"
    if total + amt > cap + 1e-6:
        remain = max(0.0, cap - total)
        return f"备用区约 {round(total)}g，最多再放 {round(remain)}g。"
    return None


def validate_action(session: SimSession, action: SimAction) -> str | None:
    if action.type == "add":
        return validate_add(session, action.ingredient_id, action.amount_g)
    if action.type == "stash_to_reserve":
        return validate_stash_to_reserve(session, action.ingredient_id, action.amount_g)
    if action.type == "heat" and action.target_temp_c is not None:
        hi = max_heat_target_c(session)
        if float(action.target_temp_c) > hi + 1e-6:
            return f"目标温度不能超过 {int(hi)}°C（当前锅具安全上限）。"
    return None


def limits_payload() -> dict:
    equipment = {}
    for eid, eq in COOKWARE_PROFILES.items():
        equipment[eid] = {
            "maxSafeTempC": eq.max_safe_temp_c,
            "volumeL": eq.volume_l,
            "potCapacityG": min(MAX_POT_TOTAL_G, eq.volume_l * 1000.0 * 0.95),
        }
    return {
        "maxPotPortions": MAX_POT_PORTIONS,
        "maxReservePortions": MAX_RESERVE_PORTIONS,
        "maxPotTotalG": MAX_POT_TOTAL_G,
        "maxReserveTotalG": MAX_RESERVE_TOTAL_G,
        "maxSingleAddG": MAX_SINGLE_ADD_G,
        "minAddG": MIN_ADD_G,
        "minTempC": MIN_TEMP_C,
        "globalMaxTempC": GLOBAL_MAX_TEMP_C,
        "equipment": equipment,
    }
