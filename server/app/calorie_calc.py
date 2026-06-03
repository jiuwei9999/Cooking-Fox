"""每日推荐热量（Mifflin-St Jeor + PAL + 体重目标）。与 web/src/shared/calorieCalc.js 保持同步。"""
from __future__ import annotations

import math
from typing import Any

# 轻量活动=久坐+偶尔走路；中等=每周运动3-5次；高=体力劳动或每天运动
ACTIVITY_MULT = {"low": 1.375, "mid": 1.55, "high": 1.725}

KCAL_PER_KG_LOSS = 7700  # 脂肪组织约 7700 kcal/kg
KCAL_PER_KG_GAIN = 5500  # 增重时肌肉/糖原等，约 5500 kcal/kg 更贴近实测


def _auto_weeks_for_goal(
    abs_delta: float,
    *,
    is_loss: bool,
    is_gain: bool,
    meal_plan_duration: str,
) -> int:
    """未手填周数时：食谱「一月」用更缓和的减重节奏，「一周」用稍快节奏。"""
    if is_loss:
        pace = 0.35 if meal_plan_duration == "month" else 0.5
        w = max(4, math.ceil(abs_delta / pace) if abs_delta > 0 else 4)
        if meal_plan_duration == "month":
            return max(8, min(52, w))
        return max(4, min(12, w))
    if is_gain:
        pace = 0.2 if meal_plan_duration == "month" else 0.25
        return max(4, min(52, math.ceil(abs_delta / pace) if abs_delta > 0 else 4))
    return 4


def calc_daily_calories(profile: dict) -> dict[str, Any]:
    try:
        w0 = float(profile.get("weight_current_kg") or 0)
        w1 = float(profile.get("weight_target_kg") or 0)
    except (TypeError, ValueError):
        return {"error": "invalid_weight"}

    if w0 < 30 or w0 > 250 or w1 < 30 or w1 > 250:
        return {"error": "invalid_weight"}

    weight_loss_only = bool(profile.get("weight_loss_only"))
    if weight_loss_only and w1 >= w0:
        return {"error": "target_not_lower"}

    sex = (profile.get("sex") or "").strip().upper()
    if sex not in ("M", "F"):
        return {"error": "sex_required"}

    age_raw = profile.get("age")
    try:
        age_n = int(age_raw) if age_raw not in (None, "") else 0
    except (TypeError, ValueError):
        age_n = 0
    if age_n < 14 or age_n > 90:
        return {"error": "invalid_age"}

    h = max(120, min(230, float(profile.get("height_cm") or 170)))

    # 减脂用当前体重算 BMR；减重≥3kg 时用平均体重更接近全程代谢
    bmr_weight = (w0 + w1) / 2 if weight_loss_only and w0 - w1 >= 3 else w0

    if sex == "M":
        bmr = 10 * bmr_weight + 6.25 * h - 5 * age_n + 5
    else:
        bmr = 10 * bmr_weight + 6.25 * h - 5 * age_n - 161

    act_mult = ACTIVITY_MULT.get(profile.get("activity") or "mid", ACTIVITY_MULT["mid"])
    tdee = round(bmr * act_mult)

    delta_kg = w1 - w0
    is_loss = delta_kg < -0.05
    is_gain = delta_kg > 0.05
    abs_delta = abs(delta_kg)

    meal_plan_duration = "month" if profile.get("meal_plan_duration") == "month" else "week"
    weeks_manual = False
    weeks_raw = profile.get("weeks_for_goal")
    try:
        weeks = int(weeks_raw) if weeks_raw not in (None, "") else 0
    except (TypeError, ValueError):
        weeks = 0
    if weeks >= 1:
        weeks_manual = True
    else:
        weeks = _auto_weeks_for_goal(
            abs_delta, is_loss=is_loss, is_gain=is_gain, meal_plan_duration=meal_plan_duration,
        )
    weeks = max(2, min(104, weeks))

    kcal_per_kg = KCAL_PER_KG_LOSS if is_loss else (KCAL_PER_KG_GAIN if is_gain else KCAL_PER_KG_LOSS)
    weekly_kg = delta_kg / weeks
    daily_adj = round((weekly_kg * kcal_per_kg) / 7)
    daily_kcal = tdee + daily_adj
    deficit_capped = False

    min_cal = max(1500 if sex == "M" else 1200, round(bmr * 1.1))
    max_cal = 4000

    if is_loss:
        max_deficit = 1000
        uncapped = daily_kcal
        if tdee - daily_kcal > max_deficit:
            daily_kcal = tdee - max_deficit
            deficit_capped = uncapped < daily_kcal - 1
        daily_kcal = max(min_cal, daily_kcal)
        if daily_kcal <= min_cal and tdee - min_cal >= max_deficit - 50:
            deficit_capped = True
        max_weekly_loss = 1.0
        actual_weekly = (daily_kcal - tdee) * 7 / KCAL_PER_KG_LOSS
        if actual_weekly < -max_weekly_loss:
            daily_kcal = max(min_cal, round(tdee - (max_weekly_loss * KCAL_PER_KG_LOSS) / 7))
            deficit_capped = True
    elif is_gain:
        max_surplus = 500
        if daily_kcal - tdee > max_surplus:
            daily_kcal = tdee + max_surplus
        daily_kcal = min(max_cal, daily_kcal)
        daily_kcal = max(min_cal, daily_kcal)
    else:
        daily_kcal = tdee
        daily_adj = 0

    daily_kcal = round(daily_kcal)
    daily_adj = daily_kcal - tdee
    weekly_kg_change = round((daily_adj * 7) / (KCAL_PER_KG_LOSS if is_loss else KCAL_PER_KG_GAIN), 2)
    if not is_loss and not is_gain:
        weekly_kg_change = 0.0

    return {
        "bmr": round(bmr),
        "tdee": tdee,
        "daily_kcal": daily_kcal,
        "delta_kg": round(delta_kg, 1),
        "weeks_for_goal": weeks,
        "weekly_kg_change": weekly_kg_change,
        "daily_adjustment": daily_adj,
        "goal": "lose" if is_loss else ("gain" if is_gain else "maintain"),
        "weight_current_kg": w0,
        "weight_target_kg": w1,
        "height_cm": h,
        "age": age_n,
        "sex": sex,
        "activity_factor": act_mult,
        "bmr_weight_kg": round(bmr_weight, 1),
        "meal_plan_duration": meal_plan_duration,
        "weeks_manual": weeks_manual,
        "deficit_capped": deficit_capped,
    }
