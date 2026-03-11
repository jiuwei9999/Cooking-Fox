import { api } from "./services/api.js";
import { renderKitchen } from "./pages/kitchen.js";
import { renderRecipeLab } from "./pages/recipeLab.js";

const appEl = document.getElementById("app");

function route() {
  const hash = location.hash || "#/kitchen";
  const path = hash.replace(/^#/, "");
  if (!appEl) return;

  if (path.startsWith("/recipes")) {
    renderRecipeLab(appEl);
  } else {
    renderKitchen(appEl);
  }
}

window.addEventListener("hashchange", route);
route();

// Warm up API (ignore failures)
api.health().catch(() => {});

