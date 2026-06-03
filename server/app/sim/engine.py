from __future__ import annotations

import math
import time

from .ingredients import DEFAULT_INGREDIENTS
from .equipment import COOKWARE_PROFILES
from .cooking import (
    apply_elapsed_cooking,
    apply_heat_to_portions,
    apply_rest_cooking,
    cooks_as_food,
    doneness_at_add,
    doneness_label,
    portion_cook_warnings,
    sync_aggregate_cook_metrics,
)
from .limits import clamp_heat_target_c, clamp_temp_c, validate_add, validate_stash_to_reserve
from .models import (
    CutStyle,
    HeatMethod,
    IngredientPortion,
    PrepFlags,
    SimAction,
    SimEvent,
    SimMetrics,
    SimSession,
    TasteVector,
)


def _copy_prep_from_action(portion: IngredientPortion, action: SimAction) -> None:
    if action.prep_state:
        portion.prep_state = action.prep_state
    if action.prep_flags is not None:
        portion.prep_flags = action.prep_flags.model_copy(deep=True)


def _copy_prep_fields(src: IngredientPortion, dst: IngredientPortion) -> None:
    dst.prep_state = src.prep_state
    dst.prep_flags = src.prep_flags.model_copy(deep=True) if src.prep_flags else None
    dst.doneness = src.doneness
    dst.burn = src.burn
    dst.added_at_temp_c = src.added_at_temp_c


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
    m.total_weight_g = total
    # Composition-derived masses, adjusted by process losses.
    water = max(0.0, water - max(0.0, m.evaporation_loss_g))
    m.water_g = water
    m.oil_g = oil
    m.solids_g = solids

    # Taste mapping: concentration + absolute dosage bonus
    base_liquid = max(1.0, water + oil)
    m.taste.salty = _clamp01((salt / base_liquid) * 25.0 + min(0.5, salt / 20.0))
    m.taste.sour = _clamp01((acid / base_liquid) * 18.0 + min(0.4, acid / 15.0))
    m.taste.sweet = _clamp01((sugar / base_liquid) * 14.0 + min(0.4, sugar / 50.0))
    m.taste.spicy = _clamp01((spice / base_liquid) * 20.0 + min(0.5, spice / 40.0))
    m.taste.umami = _clamp01((umami / base_liquid) * 18.0 + (protein / max(1.0, total)) * 0.35 + min(0.5, umami / 15.0))

    # Bitter can increase with high browning + low water + burn risk.
    dryness = _clamp01(1.0 - (water / max(1.0, total)))
    burn = m.burn_risk
    m.taste.bitter = _clamp01(m.browning * 0.6 + dryness * 0.3 + burn * 0.8)

    # Aroma: boosted by spice and browning.
    m.taste.aroma = _clamp01((spice / max(1.0, total)) * 2.0 + m.browning * 0.8 + min(0.5, spice / 50.0))

    # Idle time decay: apply only the un-consumed delta, then reset so we don't
    # re-apply the same decay on every subsequent recompute.
    idle = max(0.0, m.idle_minutes)
    eq = COOKWARE_PROFILES.get(session.equipment_id, COOKWARE_PROFILES["wok"])
    heat_ret = eq.heat_retention if eq else 0.5
    if idle > 0.01 and session.pot:
        apply_elapsed_cooking(session, idle, m.temp_c, heat_ret)
    if idle > 0.5:
        m.temp_c = 25.0 + (m.temp_c - 25.0) * math.exp(-idle / 15.0)
        m.taste.aroma *= math.exp(-idle / 20.0)
        m.taste.sour = _clamp01(m.taste.sour * (1.0 + idle / 60.0))  # acidity becomes more noticeable cold
    m.idle_minutes = 0.0
    sync_aggregate_cook_metrics(session)
    m.temp_c = clamp_temp_c(session, m.temp_c)
    return m


def _add_notes_for_newbie(session: SimSession, action: SimAction, notes: list[str]) -> None:
    m = session.metrics
    if action.type == "heat":
        if m.oil_g <= 0.1 and action.heat_method in {HeatMethod.pan_fry, HeatMethod.stir_fry}:
            notes.append("提示：你在煎/炒但锅里几乎没有油，容易粘锅或糊底。")
        if action.target_temp_c is not None and action.target_temp_c >= 230 and m.oil_g > 1:
            notes.append("提示：温度较高，注意油烟与糊底风险。")
        if m.burn_risk > 0.7:
            notes.append("提示：已经有明显糊锅风险，继续高温会带来明显焦糊味，可以立刻降温或加少量水翻动。")
    if action.type == "add" and action.ingredient_id in {"salt", "soy_sauce"}:
        if m.water_g < 30:
            notes.append("提示：当前含水量不高，咸味会更集中；可以少量多次并随时“尝味”。")


def step_session(session: SimSession, action: SimAction) -> SimSession:
    s = session.model_copy(deep=True)
    notes: list[str] = []

    # Load equipment profile
    eq = COOKWARE_PROFILES.get(s.equipment_id, COOKWARE_PROFILES.get("wok"))
    if eq is None:
        eq = COOKWARE_PROFILES["wok"]

    # Track timestamps for idle time (delta only — _recompute_metrics resets idle_minutes
    # after applying decay so the time-decay is not re-applied on every step).
    now = time.time()
    if s.started_at == 0.0:
        s.started_at = now
    elapsed_s = 0.0
    if s.last_action_at > 0:
        elapsed_s = now - s.last_action_at
        s.metrics.idle_minutes += elapsed_s / 60.0
    s.last_action_at = now

    # 操作间隔内：食材在上一时刻锅温下继续变熟（再执行本次加热/静置）
    if elapsed_s > 0.05 and s.pot and s.metrics.temp_c >= 48.0:
        apply_elapsed_cooking(s, elapsed_s / 60.0, s.metrics.temp_c, eq.heat_retention)

    if action.type == "add":
        if not action.ingredient_id or action.amount_g is None:
            notes.append("缺少 ingredient_id 或 amount_g。")
        else:
            limit_err = validate_add(s, action.ingredient_id, action.amount_g)
            if limit_err:
                notes.append(limit_err)
            ing = s.ingredients.get(action.ingredient_id)
            if ing is None:
                notes.append(f"未知食材：{action.ingredient_id}")
            elif limit_err:
                pass
            else:
                pot_temp = s.metrics.temp_c
                p = IngredientPortion(
                    ingredient_id=ing.id,
                    amount_g=max(0.0, float(action.amount_g)),
                    cut=action.cut_style or CutStyle.none,
                    particle_mm=action.particle_mm or 20.0,
                    added_at_temp_c=pot_temp,
                )
                _copy_prep_from_action(p, action)
                if cooks_as_food(ing):
                    p.doneness = doneness_at_add(pot_temp, ing, p)
                    notes.append(
                        f"{ing.name} 以生鲜入锅（当前锅温 {round(pot_temp)}°C），加热后逐渐变熟"
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
        target = clamp_heat_target_c(s, action.target_temp_c)
        duration = float(action.duration_s or 30.0)

        # Temperature relax toward target; longer durations approach target more.
        alpha = 1.0 - math.exp(-max(0.0, duration) / 18.0)
        s.metrics.temp_c = s.metrics.temp_c + (target - s.metrics.temp_c) * _clamp01(alpha * eq.heat_transfer)

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
        evap = s.metrics.water_g * _clamp01(evap_base) * (duration / 120.0) * method_factor * (1.0 + eq.splash_risk * 0.3)
        evap = min(evap, s.metrics.water_g)
        s.metrics.water_g -= evap
        s.metrics.evaporation_loss_g += evap

        # Browning increases above ~140C, penalized by water.
        browning_drive = _clamp01((temp - 140.0) / 80.0) * _clamp01(duration / 90.0)
        wetness = _clamp01(s.metrics.water_g / max(1.0, (s.metrics.water_g + s.metrics.solids_g)))
        s.metrics.browning = _clamp01(s.metrics.browning + browning_drive * (1.0 - wetness) * 0.8 * (0.5 + eq.pot_air_bonus * 0.5))

        apply_heat_to_portions(s, temp, duration, method, eq.heat_evenness)

        # 锅级焦香仍与整体含水相关；单份焦糊见 portion.burn
        burn_drive = _clamp01((temp - 160.0) / 50.0) * _clamp01(duration / 40.0)
        s.metrics.burn_risk = _clamp01(s.metrics.burn_risk + burn_drive * (1.0 - wetness) * 0.5 * (1.0 + eq.stick_risk * 0.5))

    elif action.type == "rest":
        duration = float(action.duration_s or 60.0)
        apply_rest_cooking(s, duration, eq.heat_retention)
        # Cool down: slower with higher heat_retention
        cool_factor = 0.85 + eq.heat_retention * 0.08
        s.metrics.temp_c = (s.metrics.temp_c * min(0.95, cool_factor)) + (25.0 * 0.15)
        s.metrics.emulsion = _clamp01(s.metrics.emulsion - _clamp01(duration / 300.0) * 0.2)

    elif action.type == "stash_to_reserve":
        if not action.ingredient_id or action.amount_g is None:
            notes.append("缺少 ingredient_id 或 amount_g。")
        else:
            limit_err = validate_stash_to_reserve(s, action.ingredient_id, action.amount_g)
            if limit_err:
                notes.append(limit_err)
            ing = s.ingredients.get(action.ingredient_id)
            if ing is None:
                notes.append(f"未知食材：{action.ingredient_id}")
            elif limit_err:
                pass
            else:
                p = IngredientPortion(
                    ingredient_id=ing.id,
                    amount_g=max(0.0, float(action.amount_g)),
                    cut=action.cut_style or CutStyle.none,
                    particle_mm=action.particle_mm or 20.0,
                )
                _copy_prep_from_action(p, action)
                if action.prep_flags and action.prep_flags.set_aside:
                    pf = p.prep_flags.model_copy(deep=True) if p.prep_flags else PrepFlags()
                    pf.set_aside = True
                    p.prep_flags = pf
                s.reserve.append(p)
                notes.append(f"已放入备用区：{ing.name} {round(p.amount_g, 1)}g")

    elif action.type == "clear_pot":
        n = len(s.pot)
        total_g = sum(max(0.0, p.amount_g) for p in s.pot)
        if n == 0:
            notes.append("锅里已经是空的。")
        else:
            s.pot.clear()
            notes.append(f"已清空锅内 {n} 份食材（约 {round(total_g, 1)}g）。备用区未动。")

    elif action.type == "scoop_out":
        scooped_n = 0
        scooped_g = 0.0

        if action.portion_index is not None:
            idx = action.portion_index
            if 0 <= idx < len(s.pot):
                p = s.pot.pop(idx)
                s.reserve.append(p)
                scooped_n = 1
                scooped_g = p.amount_g
            else:
                notes.append("锅内没有该份食材。")
        elif action.portion_indices:
            for idx in sorted({int(i) for i in action.portion_indices}, reverse=True):
                if 0 <= idx < len(s.pot):
                    p = s.pot.pop(idx)
                    s.reserve.append(p)
                    scooped_n += 1
                    scooped_g += p.amount_g
        elif action.ingredient_id:
            ing_id = action.ingredient_id
            want = action.amount_g
            i = len(s.pot) - 1
            while i >= 0:
                if want is not None and want <= 0.01:
                    break
                p = s.pot[i]
                if p.ingredient_id != ing_id:
                    i -= 1
                    continue
                if want is None or p.amount_g <= want + 1e-6:
                    removed = s.pot.pop(i)
                    s.reserve.append(removed)
                    scooped_n += 1
                    scooped_g += removed.amount_g
                    if want is not None:
                        want -= removed.amount_g
                else:
                    taken = IngredientPortion(
                        ingredient_id=p.ingredient_id,
                        amount_g=want,
                        cut=p.cut,
                        particle_mm=p.particle_mm,
                    )
                    _copy_prep_fields(p, taken)
                    s.reserve.append(taken)
                    s.pot[i].amount_g -= want
                    scooped_n += 1
                    scooped_g += want
                    want = 0
                if want is not None and want <= 0.01:
                    break
                i -= 1
            if scooped_n == 0:
                notes.append(f"锅里没有可捞出的：{action.ingredient_id}")
        else:
            notes.append("捞出备用需要 portion_index、portion_indices 或 ingredient_id。")

        if scooped_n > 0:
            notes.append(f"捞出备用 {scooped_n} 份（约 {round(scooped_g, 1)}g），已从锅中移除。")

    elif action.type == "return_to_pot":
        if action.reserve_index is not None:
            idx = action.reserve_index
            if 0 <= idx < len(s.reserve):
                p = s.reserve.pop(idx)
                if p.prep_flags:
                    pf = p.prep_flags.model_copy(deep=True)
                    pf.set_aside = False
                    p.prep_flags = pf
                s.pot.append(p)
                ing = s.ingredients.get(p.ingredient_id)
                name = ing.name if ing else p.ingredient_id
                notes.append(f"已将 {name} 约 {round(p.amount_g, 1)}g 放回锅里（保留备菜状态）。")
            else:
                notes.append("备用区没有该份食材。")
        elif action.ingredient_id:
            ing_id = action.ingredient_id
            want = action.amount_g
            i = len(s.reserve) - 1
            returned = 0
            while i >= 0:
                if want is not None and want <= 0.01:
                    break
                p = s.reserve[i]
                if p.ingredient_id != ing_id:
                    i -= 1
                    continue
                if want is None or p.amount_g <= want + 1e-6:
                    moved = s.reserve.pop(i)
                    s.pot.append(moved)
                    returned += 1
                    if want is not None:
                        want -= moved.amount_g
                else:
                    moved = IngredientPortion(
                        ingredient_id=p.ingredient_id,
                        amount_g=want,
                        cut=p.cut,
                        particle_mm=p.particle_mm,
                    )
                    _copy_prep_fields(p, moved)
                    s.pot.append(moved)
                    s.reserve[i].amount_g -= want
                    returned += 1
                    want = 0
                if want is not None and want <= 0.01:
                    break
                i -= 1
            if returned == 0:
                notes.append(f"备用区没有：{ing_id}")
        else:
            notes.append("放回锅里需要 reserve_index 或 ingredient_id。")

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
    for w in portion_cook_warnings(s):
        if w not in notes:
            notes.append(w)

    s.timeline.append(
        _event(action=action, metrics=s.metrics, notes=notes),
    )
    return s


def _event(*, action: SimAction, metrics: SimMetrics, notes: list[str]) -> SimEvent:
    return SimEvent(action=action, metrics_after=metrics, notes=notes)


def _pct(x: float) -> str:
    return f"{int(_clamp01(x) * 100)}%"

