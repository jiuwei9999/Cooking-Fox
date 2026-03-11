from __future__ import annotations

import math

from .ingredients import DEFAULT_INGREDIENTS
from .models import (
    CutStyle,
    HeatMethod,
    IngredientPortion,
    SimAction,
    SimEvent,
    SimMetrics,
    SimSession,
    TasteVector,
)


def create_default_session() -> SimSession:
    s = SimSession()
    s.ingredients = {i.id: i for i in DEFAULT_INGREDIENTS}
    return s


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _recompute_metrics(session: SimSession) -> SimMetrics:
    water = 0.0
    oil = 0.0
    solids = 0.0
    sugar = 0.0
    protein = 0.0
    starch = 0.0
    salt = 0.0
    acid = 0.0
    spice = 0.0
    umami = 0.0

    total = 0.0
    for p in session.pot:
        ing = session.ingredients.get(p.ingredient_id)
        if ing is None:
            continue
        amt = max(0.0, p.amount_g)
        total += amt
        water += amt * ing.water_frac
        oil += amt * ing.oil_frac
        solids += amt * max(0.0, 1.0 - ing.water_frac - ing.oil_frac)
        sugar += amt * ing.sugar_frac
        protein += amt * ing.protein_frac
        starch += amt * ing.starch_frac
        salt += amt * ing.salt_frac
        acid += amt * ing.acid_frac
        spice += amt * ing.spice_frac
        umami += amt * ing.umami_frac

    m = session.metrics.model_copy(deep=True)
    # Composition-derived masses, adjusted by process losses.
    water = max(0.0, water - max(0.0, m.evaporation_loss_g))
    m.water_g = water
    m.oil_g = oil
    m.solids_g = solids

    # Taste mapping: very rough but monotonic and explainable.
    base_liquid = max(1.0, water + oil)
    m.taste.salty = _clamp01((salt / base_liquid) * 25.0)
    m.taste.sour = _clamp01((acid / base_liquid) * 18.0)
    m.taste.sweet = _clamp01((sugar / base_liquid) * 14.0)
    m.taste.spicy = _clamp01((spice / base_liquid) * 20.0)
    m.taste.umami = _clamp01((umami / base_liquid) * 18.0 + (protein / max(1.0, total)) * 0.35)

    # Bitter can increase with high browning + low water.
    dryness = _clamp01(1.0 - (water / max(1.0, total)))
    m.taste.bitter = _clamp01(m.browning * 0.7 + dryness * 0.4)

    # Aroma: boosted by spice and browning.
    m.taste.aroma = _clamp01((spice / max(1.0, total)) * 2.0 + m.browning * 0.8)
    return m


def _add_notes_for_newbie(session: SimSession, action: SimAction, notes: list[str]) -> None:
    m = session.metrics
    if action.type == "heat":
        if m.oil_g <= 0.1 and action.heat_method in {HeatMethod.pan_fry, HeatMethod.stir_fry}:
            notes.append("提示：你在煎/炒但锅里几乎没有油，容易粘锅或糊底。")
        if action.target_temp_c is not None and action.target_temp_c >= 230 and m.oil_g > 1:
            notes.append("提示：温度较高，注意油烟与糊底风险。")
    if action.type == "add" and action.ingredient_id in {"salt", "soy_sauce"}:
        if m.water_g < 30:
            notes.append("提示：当前含水量不高，咸味会更集中；可以少量多次并随时“尝味”。")


def step_session(session: SimSession, action: SimAction) -> SimSession:
    s = session.model_copy(deep=True)
    notes: list[str] = []

    if action.type == "add":
        if not action.ingredient_id or action.amount_g is None:
            notes.append("缺少 ingredient_id 或 amount_g。")
        else:
            ing = s.ingredients.get(action.ingredient_id)
            if ing is None:
                notes.append(f"未知食材：{action.ingredient_id}")
            else:
                p = IngredientPortion(
                    ingredient_id=ing.id,
                    amount_g=max(0.0, float(action.amount_g)),
                )
                s.pot.append(p)

    elif action.type == "cut":
        style = action.cut_style or CutStyle.chop
        particle = action.particle_mm if action.particle_mm is not None else 8.0
        for p in s.pot:
            p.cut = style
            p.particle_mm = max(1.0, float(particle))

    elif action.type == "mix":
        intensity = float(action.mix_intensity or 0.5)
        duration = float(action.duration_s or 10.0)
        mix_score = _clamp01(intensity) * _clamp01(duration / 30.0)
        s.metrics.emulsion = _clamp01(s.metrics.emulsion + mix_score * 0.6)

    elif action.type == "heat":
        method = action.heat_method or HeatMethod.stir_fry
        target = float(action.target_temp_c or 160.0)
        duration = float(action.duration_s or 30.0)

        # Temperature relax toward target; longer durations approach target more.
        alpha = 1.0 - math.exp(-max(0.0, duration) / 45.0)
        s.metrics.temp_c = s.metrics.temp_c + (target - s.metrics.temp_c) * _clamp01(alpha)

        # Evaporation grows with temp and duration (boil/steam higher).
        temp = s.metrics.temp_c
        evap_base = max(0.0, (temp - 80.0) / 120.0)
        method_factor = {
            HeatMethod.boil: 1.3,
            HeatMethod.steam: 1.1,
            HeatMethod.bake: 0.9,
            HeatMethod.pan_fry: 0.8,
            HeatMethod.stir_fry: 1.0,
        }[method]
        evap = s.metrics.water_g * _clamp01(evap_base) * (duration / 120.0) * method_factor
        evap = min(evap, s.metrics.water_g)
        s.metrics.water_g -= evap
        s.metrics.evaporation_loss_g += evap

        # Browning increases above ~140C, penalized by water.
        browning_drive = _clamp01((temp - 140.0) / 80.0) * _clamp01(duration / 90.0)
        wetness = _clamp01(s.metrics.water_g / max(1.0, (s.metrics.water_g + s.metrics.solids_g)))
        s.metrics.browning = _clamp01(s.metrics.browning + browning_drive * (1.0 - wetness) * 0.8)

        # Doneness progresses with time and temp.
        cook_drive = _clamp01((temp - 60.0) / 120.0) * _clamp01(duration / 120.0)
        s.metrics.doneness = _clamp01(s.metrics.doneness + cook_drive * 0.6)

        # Burn risk.
        burn_drive = _clamp01((temp - 190.0) / 70.0) * _clamp01(duration / 60.0)
        s.metrics.burn_risk = _clamp01(s.metrics.burn_risk + burn_drive * (1.0 - wetness) * 0.9)

    elif action.type == "rest":
        duration = float(action.duration_s or 60.0)
        # Cool down slowly and let emulsion settle.
        s.metrics.temp_c = (s.metrics.temp_c * 0.85) + (25.0 * 0.15)
        s.metrics.emulsion = _clamp01(s.metrics.emulsion - _clamp01(duration / 300.0) * 0.2)

    elif action.type == "taste":
        s.metrics = _recompute_metrics(s)
        s.last_tasted = s.metrics.taste.model_copy(deep=True)
        notes.append(
            f"尝味结果：咸{_pct(s.last_tasted.salty)} 甜{_pct(s.last_tasted.sweet)} 酸{_pct(s.last_tasted.sour)} "
            f"辣{_pct(s.last_tasted.spicy)} 鲜{_pct(s.last_tasted.umami)} 香{_pct(s.last_tasted.aroma)}"
        )

    elif action.type == "serve":
        # No-op: UI will show report using current metrics.
        pass

    # Always recompute derived metrics after any change.
    s.metrics = _recompute_metrics(s)
    _add_notes_for_newbie(s, action, notes)

    s.timeline.append(
        _event(action=action, metrics=s.metrics, notes=notes),
    )
    return s


def _event(*, action: SimAction, metrics: SimMetrics, notes: list[str]) -> SimEvent:
    return SimEvent(action=action, metrics_after=metrics, notes=notes)


def _pct(x: float) -> str:
    return f"{int(_clamp01(x) * 100)}%"

