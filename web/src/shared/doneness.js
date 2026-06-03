/** 熟度展示与锅内提醒（与后端 cooking.py 标签对齐） */

import { t } from "./i18n.js";

const LEVEL_KEYS = [
  { max: 0.08, key: "raw", emoji: "🥶", cls: "donenessRaw", warn: true },
  { max: 0.22, key: "under", emoji: "🟢", cls: "donenessUnder", warn: true },
  { max: 0.38, key: "rare", emoji: "🟡", cls: "donenessRare", warn: false },
  { max: 0.52, key: "medium", emoji: "🟠", cls: "donenessMedium", warn: false },
  { max: 0.68, key: "mediumWell", emoji: "🟤", cls: "donenessMediumWell", warn: false },
  { max: 0.82, key: "done", emoji: "✅", cls: "donenessDone", warn: false },
  { max: 0.92, key: "well", emoji: "🍳", cls: "donenessWell", warn: false },
  { max: 1.01, key: "over", emoji: "⚠️", cls: "donenessOver", warn: true },
];

const SKIP_IDS = new Set([
  "salt", "sugar", "pepper", "five_spice", "chicken_powder", "starch", "sesame",
]);

export function cooksAsFood(id, ingredients) {
  if (!id || SKIP_IDS.has(id)) return false;
  const ing = ingredients?.[id];
  if (!ing) return true;
  if ((ing.salt_frac || 0) > 0.5 || (ing.spice_frac || 0) > 0.5) return false;
  return true;
}

export function getDonenessLevel(d) {
  const v = Math.max(0, Math.min(1, Number(d) || 0));
  for (let i = 0; i < LEVEL_KEYS.length; i++) {
    if (v <= LEVEL_KEYS[i].max) {
      const lk = LEVEL_KEYS[i];
      return { ...lk, label: t("doneness." + lk.key), value: v };
    }
  }
  const last = LEVEL_KEYS[LEVEL_KEYS.length - 1];
  return { ...last, label: t("doneness." + last.key), value: v };
}

export function formatDoneness(d) {
  const lv = getDonenessLevel(d);
  return `${lv.emoji} ${lv.label} ${Math.round(lv.value * 100)}%`;
}

export function donenessBarColor(d) {
  const v = Math.max(0, Math.min(1, Number(d) || 0));
  if (v < 0.22) return "var(--coral)";
  if (v < 0.52) return "var(--gold)";
  if (v < 0.82) return "var(--mint)";
  if (v < 0.92) return "var(--sky)";
  return "var(--purple)";
}

/**
 * @param {Array} pot
 * @param {Record<string, object>} ingredients
 * @returns {{ summary: string, alerts: string[], worst: object | null, items: object[] }}
 */
export function analyzePotDoneness(pot, ingredients) {
  const items = [];
  const alerts = [];
  const raw = [];
  const over = [];
  const burned = [];

  (pot || []).forEach((p, idx) => {
    if (!cooksAsFood(p.ingredient_id, ingredients)) return;
    const name = ingredients[p.ingredient_id]?.name || p.ingredient_id;
    const d = Number(p.doneness ?? 0);
    const burn = Number(p.burn ?? 0);
    const lv = getDonenessLevel(d);
    const addedT = p.added_at_temp_c != null ? Math.round(p.added_at_temp_c) : null;
    items.push({ idx, id: p.ingredient_id, name, doneness: d, burn, level: lv, addedAtTempC: addedT });
    if (d < 0.22) raw.push(`${name}·${lv.label}`);
    else if (d > 0.92) over.push(`${name}·${lv.label}`);
    if (burn > 0.55) burned.push(name);
  });

  if (raw.length) alerts.push(t("doneness.alertRaw", { list: raw.slice(0, 4).join("、") + (raw.length > 4 ? "…" : "") }));
  if (burned.length) alerts.push(t("doneness.alertBurn", { list: burned.slice(0, 3).join("、") }));
  if (over.length) alerts.push(t("doneness.alertOver", { list: over.slice(0, 3).join("、") }));

  let worst = null;
  items.forEach((it) => {
    if (!worst || it.doneness < worst.doneness) worst = it;
  });

  const summary = alerts.length
    ? t("doneness.summaryIssues", { n: alerts.length })
    : t("doneness.summaryOk");

  return { summary, alerts, worst, items };
}
