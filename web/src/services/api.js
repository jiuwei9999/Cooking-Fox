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
    if (!r.ok) throw new Error("import failed");
    return await r.json();
  },
  async saveRecipe(recipe) {
    const r = await fetch("/api/recipes/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipe }),
    });
    if (!r.ok) throw new Error("save failed");
    return await r.json();
  },
};

