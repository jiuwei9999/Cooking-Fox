import { t } from "./i18n.js";

/** 与 server/app/sim/limits.py 对齐 */
export const LIMITS = {
  maxPotPortions: 8,
  maxReservePortions: 8,
  maxPotTotalG: 2000,
  maxReserveTotalG: 1500,
  maxSingleAddG: 200,
  minAddG: 1,
  minTempC: 25,
  globalMaxTempC: 280,
  equipment: {
    wok: { maxSafeTempC: 280, volumeL: 3, potCapacityG: 2000 },
    flat_pan: { maxSafeTempC: 260, volumeL: 2, potCapacityG: 1900 },
    deep_pot: { maxSafeTempC: 220, volumeL: 5, potCapacityG: 2000 },
    casserole: { maxSafeTempC: 240, volumeL: 3.5, potCapacityG: 2000 },
  },
};

export function potTotals(session) {
  const pot = session?.pot || [];
  let totalG = 0;
  for (let i = 0; i < pot.length; i++) totalG += Number(pot[i].amount_g || 0);
  return { count: pot.length, totalG };
}

export function potCapacityG(session) {
  const eqId = session?.equipment_id || "wok";
  const eq = LIMITS.equipment[eqId] || LIMITS.equipment.wok;
  return Math.min(LIMITS.maxPotTotalG, eq.potCapacityG);
}

export function maxHeatTempC(session) {
  const eqId = session?.equipment_id || "wok";
  const eq = LIMITS.equipment[eqId] || LIMITS.equipment.wok;
  return Math.min(LIMITS.globalMaxTempC, eq.maxSafeTempC);
}

export function clampHeatTargetC(session, target) {
  const hi = maxHeatTempC(session);
  const lo = LIMITS.minTempC;
  const v = Number(target);
  if (!Number.isFinite(v)) return 160;
  return Math.max(lo, Math.min(hi, v));
}

export function getAddLimits(session) {
  const { count, totalG } = potTotals(session);
  const capG = potCapacityG(session);
  const remainG = Math.max(0, capG - totalG);
  const maxSingle = Math.min(LIMITS.maxSingleAddG, remainG);
  return {
    count,
    totalG,
    capG,
    remainG,
    maxSingleAddG: maxSingle > 0 ? maxSingle : 0,
    portionsLeft: Math.max(0, LIMITS.maxPotPortions - count),
    canAdd: count < LIMITS.maxPotPortions && remainG >= LIMITS.minAddG,
    maxHeatTempC: maxHeatTempC(session),
    maxPortions: LIMITS.maxPotPortions,
    minAddG: LIMITS.minAddG,
  };
}

/** @returns {string|null} */
export function validateAddToPot(session, amountG) {
  if (!session) return t("kitchen.limit.noSession");
  const amt = Number(amountG);
  if (!Number.isFinite(amt) || amt < LIMITS.minAddG) {
    return t("kitchen.limit.minAdd", { min: LIMITS.minAddG });
  }
  if (amt > LIMITS.maxSingleAddG) {
    return t("kitchen.limit.maxSingle", { max: LIMITS.maxSingleAddG });
  }
  const { count, totalG } = potTotals(session);
  const cap = potCapacityG(session);
  if (count >= LIMITS.maxPotPortions) {
    return t("kitchen.limit.portions", { n: count, max: LIMITS.maxPotPortions });
  }
  if (totalG + amt > cap + 1e-6) {
    const remain = Math.max(0, cap - totalG);
    return t("kitchen.limit.capacity", {
      total: Math.round(totalG),
      remain: Math.round(remain),
      cap: Math.round(cap),
    });
  }
  return null;
}
