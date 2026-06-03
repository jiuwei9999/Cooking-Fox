// 菜品图：优先走后端代理（gpt-image-2），Pollinations 作备用

import { ING_EN, SEASONING_IDS } from "./ingredientMeta.js";
import { fetchJson } from "./fetchJson.js";
import { slimSessionForAi } from "./sessionForAi.js";

const POLLINATIONS_BASE = "https://image.pollinations.ai/prompt/";

export async function generateAiImage(session, apiConfig = {}, onProgress) {
  const useBackend = apiConfig.provider !== "pollinations";
  if (useBackend) {
    const backend = await generateWithBackend(session, onProgress);
    if (backend.url) return backend;
    if (apiConfig.noFallback) return backend;
  }
  const prompt = buildPrompt(session);
  const url = await generateWithPollinations(prompt, onProgress);
  return { url, error: url ? undefined : "Pollinations 备用通道失败" };
}

function b64ToObjectUrl(b64, mime = "image/png") {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

async function generateWithBackend(session, onProgress) {
  if (onProgress) onProgress({ attempt: 1, total: 1, model: "gpt-image-2" });
  try {
    const { ok, data, error } = await fetchJson(
      "/api/ai/dish-image",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: slimSessionForAi(session) }),
      },
      180000,
    );
    if (!ok) {
      console.warn("[aiImage] backend:", error);
      return { url: null, error: error || "请求失败" };
    }
    if (data.error) {
      console.warn("[aiImage] backend:", data.error);
      return { url: null, error: data.error };
    }
    if (data.url) return { url: data.url };
    if (data.b64) {
      return { url: b64ToObjectUrl(data.b64, data.mime || "image/png") };
    }
    return { url: null, error: "响应缺少 url / b64" };
  } catch (e) {
    console.warn("[aiImage] backend failed:", e.message || e);
    return { url: null, error: e.message || String(e) };
  }
}

async function generateWithPollinations(prompt, onProgress) {
  const encoded = encodeURIComponent(prompt);
  const attempts = [
    { model: "turbo", seed: randSeed(), timeoutMs: 60000 },
    { model: "flux", seed: randSeed(), timeoutMs: 120000 },
    { model: "", seed: randSeed(), timeoutMs: 90000 },
  ];

  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i];
    const params = new URLSearchParams({
      width: "768",
      height: "768",
      nologo: "true",
      seed: String(a.seed),
    });
    if (a.model) params.set("model", a.model);

    const url = `${POLLINATIONS_BASE}${encoded}?${params.toString()}`;
    if (onProgress) onProgress({ attempt: i + 1, total: attempts.length, model: a.model || "default" });

    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), a.timeoutMs);
      const resp = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(timeout);
      if (!resp.ok) continue;
      const ct = resp.headers.get("content-type") || "";
      if (!ct.startsWith("image/")) continue;
      const blob = await resp.blob();
      if (blob.size < 1024) continue;
      return URL.createObjectURL(blob);
    } catch (e) {
      console.warn("[aiImage] pollinations:", e.message || e);
    }
  }
  return null;
}

function randSeed() {
  return Math.floor(Math.random() * 1e8);
}

function buildPrompt(session) {
  const pot = session.pot || [];
  const metrics = session.metrics || {};
  const taste = metrics.taste || {};

  const counts = new Map();
  for (const p of pot) {
    counts.set(p.ingredient_id, (counts.get(p.ingredient_id) || 0) + (p.amount_g || 0));
  }

  const seasonings = new Set(SEASONING_IDS);
  const mains = [];
  const aromatics = [];
  for (const [id, amt] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    const en = ING_EN[id] || id.replace(/_/g, " ");
    if (seasonings.has(id)) continue;
    if (["garlic", "ginger", "chili", "scallion"].includes(id)) aromatics.push(en);
    else mains.push(en);
    if (mains.length >= 5) break;
  }

  const sauceHints = [];
  if (counts.has("soy_sauce") || counts.has("dark_soy_sauce")) sauceHints.push("glossy soy-based sauce");
  if (counts.has("vinegar")) sauceHints.push("tangy vinegar glaze");
  if ((metrics.oil_g || 0) > 30) sauceHints.push("rich oil sheen");

  const tasteDesc = [];
  if (taste.salty > 0.25) tasteDesc.push("savory");
  if (taste.sweet > 0.2) tasteDesc.push("slightly sweet");
  if (taste.sour > 0.2) tasteDesc.push("tangy");
  if (taste.spicy > 0.25) tasteDesc.push("spicy");
  if (taste.umami > 0.35) tasteDesc.push("umami-rich");

  const doneness = Math.round((metrics.doneness || 0) * 100);
  const browning = Math.round((metrics.browning || 0) * 100);
  const burn = metrics.burn_risk || 0;

  const parts = [
    "Top-down food photography of a homemade Chinese dish",
    mains.length ? `featuring ${mains.join(", ")}` : "",
    aromatics.length ? `garnished with ${aromatics.join(" and ")}` : "",
    sauceHints.length ? `coated in ${sauceHints.join(", ")}` : "",
    tasteDesc.length ? `${tasteDesc.join(", ")} flavor profile` : "",
    doneness > 40 ? "cooked thoroughly" : "",
    browning > 25 ? (browning > 60 ? "deeply caramelized golden-brown sear" : "light golden browning") : "",
    burn > 0.5 ? "with slightly charred edges" : "",
    "served on a rustic ceramic plate, warm natural lighting, shallow depth of field, soft steam rising, appetizing, sharp focus, high resolution, photorealistic",
  ].filter(Boolean);

  return parts.join(", ");
}
