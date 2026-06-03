import { fetchJson } from "./fetchJson.js";

/** @returns {Promise<{ ok: boolean, data?: object, error?: string }>} */
export async function fetchAiStatus(probe = false) {
  const q = probe ? "?probe=1" : "";
  return fetchJson(`/api/ai/status${q}`, {}, probe ? 60000 : 15000);
}
