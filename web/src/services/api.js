export const api = {
  async health() {
    const r = await fetch("/api/health");
    if (!r.ok) throw new Error("health failed");
    return await r.json();
  },
  async aiStatus(probe = false) {
    const r = await fetch(`/api/ai/status${probe ? "?probe=1" : ""}`);
    if (!r.ok) throw new Error("ai status failed");
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
    const data = await r.json();
    if (!r.ok || data.error) throw new Error(data.error || "step failed");
    return data;
  },
  async setEquipment(sessionId, equipmentId) {
    const r = await fetch("/api/sim/equipment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, equipmentId }),
    });
    const data = await r.json();
    if (!r.ok || data.error) throw new Error(data.error || "set equipment failed");
    return data;
  },
  async exampleRecipes() {
    const r = await fetch("/api/recipes/examples");
    if (!r.ok) throw new Error("examples failed");
    return await r.json();
  },
  async userRecipes() {
    const r = await fetch("/api/recipes/user");
    if (!r.ok) throw new Error("user recipes failed");
    return await r.json();
  },
  async importRecipe(text) {
    const r = await fetch("/api/recipes/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await r.json();
    if (!r.ok || data.error) throw new Error(data.error || "import failed");
    return data;
  },
  async saveRecipe(recipe) {
    const r = await fetch("/api/recipes/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipe }),
    });
    const data = await r.json();
    if (!r.ok || data.error) throw new Error(data.error || "save failed");
    return data;
  },
};

