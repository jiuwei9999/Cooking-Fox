import { api } from "./services/api.js";
import { disposePot3D } from "./3d/potScene.js";
import { initI18n, t } from "./shared/i18n.js";
import { renderKitchen } from "./pages/kitchen.js";
import { renderRecipeLab } from "./pages/recipeLab.js";
import { renderWelcome } from "./pages/welcome.js";
import { renderMealPlan } from "./pages/mealPlan.js";

initI18n();

const appEl = document.getElementById("app");

function route() {
  const hash = location.hash || "#/";
  const path = hash.replace(/^#/, "") || "/";
  if (!appEl) return;

  try {
    appEl.className = "";
    // 切换页面时销毁锅 3D，否则返回厨房时 initPot3D 会因 renderer 已存在而跳过
    disposePot3D();
    if (path === "/" || path === "/welcome" || path === "/home") {
      renderWelcome(appEl);
    } else if (path === "/meal-plan" || path.startsWith("/meal-plan")) {
      renderMealPlan(appEl);
    } else if (path.startsWith("/recipes")) {
      var p = renderRecipeLab(appEl);
      if (p && p.catch) p.catch(function(e) { showError("RecipeLab", e); });
    } else {
      var p2 = renderKitchen(appEl);
      if (p2 && p2.catch) p2.catch(function(e) { showError("Kitchen", e); });
    }
  } catch(e) {
    showError("Route", e);
  }
}

function showError(source, e) {
  appEl.textContent = "";
  var container = document.createElement("div");
  container.style.cssText = "padding:40px;color:#ff6b6b;font-family:monospace";
  var h2 = document.createElement("h2");
  h2.textContent = source + " Error";
  container.appendChild(h2);
  var pre1 = document.createElement("pre");
  pre1.style.cssText = "white-space:pre-wrap;word-break:break-all";
  pre1.textContent = e.message || String(e);
  container.appendChild(pre1);
  if (e.stack) {
    var pre2 = document.createElement("pre");
    pre2.style.cssText = "white-space:pre-wrap;word-break:break-all;font-size:11px;color:#8899bb";
    pre2.textContent = e.stack;
    container.appendChild(pre2);
  }
  appEl.appendChild(container);
}

window.addEventListener("hashchange", route);
window.addEventListener("cookingsim:langchange", route);
try {
  appEl.textContent = t("nav.loading");
  route();
} catch(e) {
  showError("Init", e);
}

api.health().catch(function(){});
