/** fetch + JSON，带超时；兼容不支持 AbortSignal.timeout 的浏览器 */
export async function fetchJson(url, options = {}, timeoutMs = 120000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: ctrl.signal });
    let data = null;
    try {
      data = await resp.json();
    } catch {
      if (!resp.ok) {
        return { ok: false, status: resp.status, error: `HTTP ${resp.status}` };
      }
      return { ok: false, status: resp.status, error: "响应不是 JSON" };
    }
    if (!resp.ok) {
      const err = (data && data.error) || `HTTP ${resp.status}`;
      return { ok: false, status: resp.status, data, error: String(err) };
    }
    return { ok: true, status: resp.status, data };
  } catch (e) {
    const msg = e.name === "AbortError"
      ? "请求超时（AI 生成较慢，请选「一周」或关闭 AI 使用本地模板）"
      : (e.message || String(e));
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
