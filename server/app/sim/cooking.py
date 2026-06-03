"""Per-portion doneness: 首次入锅为生鲜，仅加热/余温随时间变熟；捞出/回锅保留熟度。"""

from __future__ import annotations

import math

from .models import HeatMethod, IngredientBase, IngredientPortion, SimSession

SEASONING_IDS = frozenset({
    "salt", "sugar", "pepper", "five_spice", "chicken_powder", "starch", "sesame",
})
PURE_LIQUID_IDS = frozenset({
    "water", "oil", "soy_sauce", "dark_soy_sauce", "vinegar", "sesame_oil",
    "cooking_wine", "oyster_sauce", "chili_oil", "bean_paste",
})


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def cooks_as_food(ing: IngredientBase) -> bool:
    if ing.id in SEASONING_IDS:
        return False
    if ing.id in PURE_LIQUID_IDS and ing.water_frac + ing.oil_frac > 0.85:
        return True  # 酱汁仍会受热但熟度展示弱化
    if ing.salt_frac > 0.5 or ing.spice_frac > 0.5:
        return False
    return True


def cook_profile(ing: IngredientBase) -> dict[str, float]:
    """返回食材受热曲线参数。"""
    if ing.id in SEASONING_IDS:
        return {"heat_gain": 0.05, "burn_gain": 0.0, "target_bias": 0.0}
    if ing.id == "egg":
        return {"heat_gain": 1.25, "burn_gain": 0.9, "target_bias": 0.08}
    if ing.protein_frac >= 0.15:
        return {"heat_gain": 1.0, "burn_gain": 1.0, "target_bias": 0.0}
    if ing.starch_frac >= 0.45:
        return {"heat_gain": 0.95, "burn_gain": 0.5, "target_bias": 0.12}
    if ing.water_frac >= 0.9:
        return {"heat_gain": 0.35, "burn_gain": 0.15, "target_bias": 0.0}
    return {"heat_gain": 0.88, "burn_gain": 0.65, "target_bias": 0.05}


def temp_cook_speed(temp_c: float) -> float:
    """锅温越高，向目标熟度靠拢越快（相对 160°C 约为 1.0）。"""
    if temp_c < 50.0:
        return 0.06
    t = min(280.0, temp_c)
    # 50°C 极慢 → 160°C 基准 → 240°C+ 明显加速
    norm = _clamp01((t - 50.0) / 190.0)
    return max(0.08, min(2.4, 0.1 + math.pow(norm, 1.35) * 2.1))


def equilibrium_doneness(
    temp_c: float,
    ing: IngredientBase,
    particle_mm: float,
) -> float:
    """给定环境温度（锅温），该食材理论上可达的熟度均衡值。"""
    if not cooks_as_food(ing):
        return 0.0
    prof = cook_profile(ing)
    # 40°C 以下几乎无生熟变化，160°C 以上接近全熟区
    core = _clamp01((temp_c - 42.0) / 118.0)
    size_factor = _clamp01(1.35 - particle_mm / 28.0)
    d = core * prof["heat_gain"] * size_factor + prof["target_bias"]
    if ing.id in PURE_LIQUID_IDS:
        d *= 0.35
    return _clamp01(d)


def doneness_at_add(
    pot_temp_c: float,
    ing: IngredientBase,
    portion: IngredientPortion,
) -> float:
    """首次入锅：未经历加热的食材一律生鲜，不因锅热立刻变熟。"""
    if not cooks_as_food(ing):
        return 0.0
    return 0.0


def apply_heat_to_portions(
    session: SimSession,
    temp_c: float,
    duration_s: float,
    method: HeatMethod,
    heat_evenness: float,
) -> None:
    """加热：每份食材向当前锅温对应的熟度靠拢，并单独累计焦糊风险。"""
    method_factor = {
        HeatMethod.boil: 1.15,
        HeatMethod.steam: 1.05,
        HeatMethod.bake: 0.95,
        HeatMethod.pan_fry: 1.1,
        HeatMethod.stir_fry: 1.0,
    }[method]
    even = max(0.35, _clamp01(heat_evenness))
    speed = temp_cook_speed(temp_c) * method_factor
    # 锅越热 tau 越小 → 同样加热秒数熟得更快
    tau_s = max(6.0, 32.0 / speed)

    for p in session.pot:
        ing = session.ingredients.get(p.ingredient_id)
        if ing is None or not cooks_as_food(ing):
            continue
        prof = cook_profile(ing)
        target = equilibrium_doneness(temp_c, ing, p.particle_mm)
        factor = (1.0 - math.exp(-max(0.0, duration_s) / tau_s)) * even
        p.doneness = _clamp01(p.doneness + (target - p.doneness) * factor)

        if temp_c > 130.0:
            burn_drive = (
                _clamp01((temp_c - 130.0) / 70.0)
                * _clamp01(duration_s / 40.0)
                * speed
                * 0.4
            )
            p.burn = _clamp01(p.burn + burn_drive * prof["burn_gain"])


def apply_elapsed_cooking(
    session: SimSession,
    elapsed_minutes: float,
    temp_c: float,
    heat_retention: float = 0.5,
) -> None:
    """食材留在热锅中随时间继续变熟（操作间隔与静置均适用）。"""
    if elapsed_minutes <= 0 or temp_c < 48.0 or not session.pot:
        return
    speed = temp_cook_speed(temp_c)
    tau = max(0.8, 6.0 / (speed * (0.35 + heat_retention * 0.55)))
    factor = 1.0 - math.exp(-elapsed_minutes / tau)
    for p in session.pot:
        ing = session.ingredients.get(p.ingredient_id)
        if ing is None or not cooks_as_food(ing):
            continue
        prof = cook_profile(ing)
        target = equilibrium_doneness(temp_c, ing, p.particle_mm)
        p.doneness = _clamp01(p.doneness + (target - p.doneness) * factor)
        if temp_c > 130.0:
            burn_add = (
                _clamp01((temp_c - 130.0) / 70.0)
                * factor
                * speed
                * prof["burn_gain"]
                * 0.1
            )
            p.burn = _clamp01(p.burn + burn_add)


def apply_rest_cooking(session: SimSession, duration_s: float, heat_retention: float) -> None:
    """静置时若锅仍烫，余温继续作用于各食材。"""
    temp = session.metrics.temp_c
    if temp < 48.0:
        return
    apply_elapsed_cooking(session, duration_s / 60.0, temp, heat_retention)


def sync_aggregate_cook_metrics(session: SimSession) -> None:
    """锅级熟度/糊风险 = 固体食材按克数加权。"""
    pot = session.pot
    if not pot:
        session.metrics.doneness = 0.0
        session.metrics.burn_risk = 0.0
        return

    d_sum = 0.0
    b_sum = 0.0
    w_sum = 0.0
    for p in pot:
        ing = session.ingredients.get(p.ingredient_id)
        if ing is None or not cooks_as_food(ing):
            continue
        w = max(0.0, p.amount_g)
        if w <= 0:
            continue
        w_sum += w
        d_sum += p.doneness * w
        b_sum += p.burn * w

    if w_sum > 0:
        session.metrics.doneness = _clamp01(d_sum / w_sum)
        session.metrics.burn_risk = _clamp01(b_sum / w_sum)
    else:
        session.metrics.doneness = 0.0
        session.metrics.burn_risk = 0.0


def doneness_label(d: float) -> str:
    d = _clamp01(d)
    if d < 0.08:
        return "生鲜"
    if d < 0.22:
        return "偏生"
    if d < 0.38:
        return "三分熟"
    if d < 0.52:
        return "五分熟"
    if d < 0.68:
        return "七分熟"
    if d < 0.82:
        return "全熟"
    if d < 0.92:
        return "熟透"
    return "过熟"


def portion_cook_warnings(session: SimSession) -> list[str]:
    """生成面向用户的熟度提醒。"""
    msgs: list[str] = []
    raw: list[str] = []
    over: list[str] = []
    burned: list[str] = []

    for p in session.pot:
        ing = session.ingredients.get(p.ingredient_id)
        if ing is None or not cooks_as_food(ing):
            continue
        name = ing.name
        d = p.doneness
        if d < 0.22:
            raw.append(f"{name}({doneness_label(d)})")
        elif d > 0.92:
            over.append(f"{name}({doneness_label(d)})")
        if p.burn > 0.55:
            burned.append(name)

    if raw:
        msgs.append("⚠️ 偏生需继续加热：" + "、".join(raw[:4]) + ("…" if len(raw) > 4 else ""))
    if burned:
        msgs.append("🔥 局部焦糊风险：" + "、".join(burned[:3]))
    if over:
        msgs.append("⏱ 已过熟：" + "、".join(over[:3]))

    return msgs
