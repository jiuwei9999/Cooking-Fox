/**
 * 出锅报告文案（经后端 /api/ai/serve-report，默认快速模式）
 */
import { genTasteNarrative } from "./flavorProfile.js";
import { fetchJson } from "./fetchJson.js";
import { slimSessionForAi } from "./sessionForAi.js";

export async function generateAiServeReport(session) {
  const base = genTasteNarrative(session);
  try {
    const { ok, data, error } = await fetchJson(
      "/api/ai/serve-report",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: slimSessionForAi(session) }),
      },
      90000,
    );
    if (!ok) {
      console.warn("[aiReport]", error);
      return { error: error || "请求失败", ...base };
    }
    if (data.error) {
      console.warn("[aiReport]", data.error);
      return { error: data.error, ...base };
    }
    if (!data.narrative) return { error: "无 narrative 字段", ...base };

    const n = data.narrative;
    return {
      intro: n.intro || base.intro,
      body: n.body || base.body,
      suggestText: n.suggestText || base.suggestText,
      pairing: n.pairing || base.pairing,
      scene: n.scene || base.scene,
      touch: n.touch || base.touch,
      score: base.score,
      emoji: base.emoji,
      judge: base.judge,
      aiGenerated: true,
    };
  } catch (e) {
    console.warn("[aiReport] failed:", e.message || e);
    return { error: e.message || String(e), ...base };
  }
}
