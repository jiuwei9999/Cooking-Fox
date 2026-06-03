import { fetchJson } from "./fetchJson.js";
import { getLang } from "./i18n.js";

export async function generateAiMealPlan(profile) {
  const payload = { ...profile, lang: profile.lang || getLang() };
  const { ok, data, error } = await fetchJson(
    "/api/ai/meal-plan",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: payload }),
    },
    payload.duration === "month" ? 600000 : 300000,
  );
  if (!ok) return { error: error || "请求失败" };
  if (data.error) return { error: data.error };
  if (!data.plan) return { error: "无 plan 字段" };
  return {
    plan: {
      ...data.plan,
      aiGenerated: !data.ai_fallback,
      model: data.model,
    },
    warning: data.warning || null,
    aiFallback: Boolean(data.ai_fallback),
  };
}
