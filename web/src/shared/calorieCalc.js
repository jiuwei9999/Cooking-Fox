/**
 * 每日推荐热量（Mifflin-St Jeor + PAL + 体重目标）
 * 与 server/app/calorie_calc.py 保持同步
 */

const ACTIVITY_MULT = { low: 1.375, mid: 1.55, high: 1.725 };
const KCAL_PER_KG_LOSS = 7700;
const KCAL_PER_KG_GAIN = 5500;

function autoWeeksForGoal(absDelta, { isLoss, isGain, mealPlanDuration }) {
  if (isLoss) {
    const pace = mealPlanDuration === "month" ? 0.35 : 0.5;
    let w = Math.max(4, Math.ceil(absDelta / pace) || 4);
    if (mealPlanDuration === "month") return Math.max(8, Math.min(52, w));
    return Math.max(4, Math.min(12, w));
  }
  if (isGain) {
    const pace = mealPlanDuration === "month" ? 0.2 : 0.25;
    return Math.max(4, Math.min(52, Math.ceil(absDelta / pace) || 4));
  }
  return 4;
}

/**
 * @param {{
 *   age?: number|string,
 *   sex?: string,
 *   height_cm?: number|string,
 *   weight_current_kg?: number|string,
 *   weight_target_kg?: number|string,
 *   weeks_for_goal?: number|string,
 *   activity?: string,
 *   meal_plan_duration?: string,
 * }} input
 * @param {{ weightLossOnly?: boolean }} [options]
 */
export function calcDailyCalories(input, options = {}) {
  const weightLossOnly = Boolean(options.weightLossOnly);
  const w0 = Number(input.weight_current_kg);
  const w1 = Number(input.weight_target_kg);
  if (!w0 || w0 < 30 || w0 > 250) return { error: "invalid_current_weight" };
  if (!w1 || w1 < 30 || w1 > 250) return { error: "invalid_target_weight" };
  if (weightLossOnly && w1 >= w0) return { error: "target_not_lower" };

  const sex = String(input.sex || "").toUpperCase();
  if (sex !== "M" && sex !== "F") return { error: "sex_required" };

  const ageN = Number(input.age);
  if (!ageN || ageN < 14 || ageN > 90) return { error: "invalid_age" };

  const h = Math.max(120, Math.min(230, Number(input.height_cm) || 170));
  const mealPlanDuration = input.meal_plan_duration === "month" ? "month" : "week";

  const bmrWeight = weightLossOnly && w0 - w1 >= 3 ? (w0 + w1) / 2 : w0;
  let bmr;
  if (sex === "M") bmr = 10 * bmrWeight + 6.25 * h - 5 * ageN + 5;
  else bmr = 10 * bmrWeight + 6.25 * h - 5 * ageN - 161;

  const actMult = ACTIVITY_MULT[input.activity] || ACTIVITY_MULT.mid;
  const tdee = Math.round(bmr * actMult);

  const deltaKg = w1 - w0;
  const isLoss = deltaKg < -0.05;
  const isGain = deltaKg > 0.05;
  const absDelta = Math.abs(deltaKg);

  let weeksManual = false;
  let weeks = Number(input.weeks_for_goal);
  if (weeks >= 1) {
    weeksManual = true;
  } else {
    weeks = autoWeeksForGoal(absDelta, { isLoss, isGain, mealPlanDuration });
  }
  weeks = Math.max(2, Math.min(104, Math.round(weeks)));

  const kcalPerKg = isLoss ? KCAL_PER_KG_LOSS : (isGain ? KCAL_PER_KG_GAIN : KCAL_PER_KG_LOSS);
  let dailyKcal = tdee + Math.round((deltaKg / weeks * kcalPerKg) / 7);
  let deficitCapped = false;

  const minCal = Math.max(sex === "M" ? 1500 : 1200, Math.round(bmr * 1.1));
  const maxCal = 4000;

  if (isLoss) {
    const uncapped = dailyKcal;
    if (tdee - dailyKcal > 1000) {
      dailyKcal = tdee - 1000;
      deficitCapped = uncapped < dailyKcal - 1;
    }
    dailyKcal = Math.max(minCal, dailyKcal);
    if (dailyKcal <= minCal && tdee - minCal >= 950) deficitCapped = true;
    const actualWeekly = ((dailyKcal - tdee) * 7) / KCAL_PER_KG_LOSS;
    if (actualWeekly < -1.0) {
      dailyKcal = Math.max(minCal, Math.round(tdee - (1.0 * KCAL_PER_KG_LOSS) / 7));
      deficitCapped = true;
    }
  } else if (isGain) {
    if (dailyKcal - tdee > 500) dailyKcal = tdee + 500;
    dailyKcal = Math.min(maxCal, Math.max(minCal, dailyKcal));
  } else {
    dailyKcal = tdee;
  }

  dailyKcal = Math.round(dailyKcal);
  const dailyAdj = dailyKcal - tdee;
  const weeklyKgChange = isLoss || isGain
    ? Math.round((dailyAdj * 7) / (isLoss ? KCAL_PER_KG_LOSS : KCAL_PER_KG_GAIN) * 100) / 100
    : 0;

  return {
    bmr: Math.round(bmr),
    tdee,
    daily_kcal: dailyKcal,
    delta_kg: Math.round(deltaKg * 10) / 10,
    weeks_for_goal: weeks,
    weekly_kg_change: weeklyKgChange,
    daily_adjustment: dailyAdj,
    goal: isLoss ? "lose" : isGain ? "gain" : "maintain",
    weight_current_kg: w0,
    weight_target_kg: w1,
    height_cm: h,
    age: ageN,
    sex,
    activity_factor: actMult,
    bmr_weight_kg: Math.round(bmrWeight * 10) / 10,
    meal_plan_duration: mealPlanDuration,
    weeks_manual: weeksManual,
    deficit_capped: deficitCapped,
  };
}
