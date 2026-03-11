export const api = {
  async health() {
    const r = await fetch("/api/health");
    if (!r.ok) throw new Error("health failed");
    return await r.json();
  },
  async newSession() {
    const r = await fetch("/api/sim/session", { method: "POST" });
    if (!r.ok) throw new Error("new session failed");
    return await r.json();
  },
  async step(sessionId, action) {
    const r = await fetch("/api/sim/step", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, action }),
    });
    if (!r.ok) throw new Error("step failed");
    return await r.json();
  },
  async exampleRecipes() {
    const r = await fetch("/api/recipes/examples");
    if (!r.ok) throw new Error("examples failed");
    return await r.json();
  },
};

