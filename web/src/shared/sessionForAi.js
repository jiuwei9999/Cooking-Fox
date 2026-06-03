/** 出锅报告 AI 请求体：只传必要字段，避免整份食材库 + 时间线撑爆请求 */
export function slimSessionForAi(session) {
  const ingredients = session.ingredients || {};
  const pot = (session.pot || []).map((p) => ({
    ingredient_id: p.ingredient_id,
    amount_g: p.amount_g,
    cut: p.cut,
  }));

  const names = {};
  for (const p of pot) {
    const meta = ingredients[p.ingredient_id];
    if (meta && meta.name) names[p.ingredient_id] = { name: meta.name };
  }

  return {
    equipment_id: session.equipment_id,
    pot,
    ingredients: names,
    metrics: session.metrics,
    timeline: session.timeline || [],
  };
}
