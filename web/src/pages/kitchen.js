import { api } from "../services/api.js";
import { fmtAction, pct, round1 } from "../shared/format.js";
import { el, mount } from "../shared/dom.js";
import { t, createLangToggle } from "../shared/i18n.js";
import { initPot3D, updatePot3D, setPotAction, updatePotTheme, disposePot3D, switchEquipment, setPotHeatingActive } from "../3d/potScene.js";
import { drawDishOnCanvas } from "../shared/dishCanvas.js";
import { drawRadarChart } from "../shared/radarChart.js";
import { generateAiImage } from "../shared/aiImage.js";
import { generateAiServeReport } from "../shared/aiReport.js";
import { showPrepKitchen } from "./prepKitchen.js";
import { calcFlavorTags, calcMouthfeel, calcFlavorLayers, genTasteNarrative, getDishName } from "../shared/flavorProfile.js";
import { judgeDish, generateRadarData } from "../shared/judgeProfile.js";
import { EMOJI, getDefaultAmountG, buildIngredientSections, formatPrepStateLabel } from "../shared/ingredientMeta.js";
import { mountIngredientPicker, clearRecentIngredients } from "../shared/ingredientPicker.js";
import { mountTargetRecipeGuide } from "../shared/targetRecipeGuide.js";
import {
  clampHeatTargetC,
  getAddLimits,
  maxHeatTempC,
  validateAddToPot,
} from "../shared/cookingLimits.js";
import { analyzePotDoneness, cooksAsFood, formatDoneness, getDonenessLevel, donenessBarColor } from "../shared/doneness.js";
import {
  adoptSession,
  applyPortionMeta,
  extractPortionMeta,
  hydrateSession,
  prepExtrasFromItem,
  restorePrepStateOnly,
} from "../shared/portionMeta.js";

var state = { session: null, busy: false, selectedIngredient: "egg", amountG: 50, heatMethod: "stir_fry", targetTempC: 160, durationS: 30, mixIntensity: 0.6, cutStyle: "chop", particleMm: 8 };
var ingredientPickerApi = null;
var targetGuideApi = null;

// --- 按钮冷却机制：防止用户频繁点击导致请求过载 ---
var _lastActionTime = 0;
var COOLDOWN_MS = 1000; // 1秒冷却

function isCoolingDown() {
  var now = Date.now();
  if (now - _lastActionTime < COOLDOWN_MS) {
    return true;
  }
  _lastActionTime = now;
  return false;
}

export async function renderKitchen(root) {
  root.innerHTML = "";
  var topBar = el("div", { class: "topBar" }, [
    el("a", { href: "#/", class: "topBarLogo", style: "text-decoration:none;color:inherit" }, [el("span",{class:"logoIcon"},["🦊"]), "狐闹厨房"]),
    el("div", { class: "topBarNav" }, [
      el("a", { href: "#/", class: "btn", style: "text-decoration:none" }, [t("nav.home")]),
      el("select", { class: "input", style: "width:auto;min-width:90px;padding:8px 10px", onchange: function(e){ doSwitchEquipment(e.target.value); } }, [
        el("option", { value: "wok" }, [t("equipment.wok")]),
        el("option", { value: "flat_pan" }, [t("equipment.flat_pan")]),
        el("option", { value: "deep_pot" }, [t("equipment.deep_pot")]),
        el("option", { value: "casserole" }, [t("equipment.casserole")]),
      ]),
      el("button", { class: "btn btnSuccess", onclick: function(){ openPrepKitchen(); } }, [t("nav.prepKitchen")]),
      el("a", { href: "#/recipes", class: "btn", style: "text-decoration:none" }, [t("nav.recipeLab")]),
      el("button", { class: "btn btnPrimary", onclick: function(){ newSession(); } }, [t("nav.newSession")]),
      createLangToggle({ style: "padding:9px 11px;font-weight:600;min-width:44px" }),
      el("button", { id: "themeBtn", class: "btn", style: "padding:9px 11px;font-size:16px", onclick: toggleTheme }, [getThemeIcon()]),
    ]),
  ]);
  var left = el("div", { class: "panel" }, [
    el("div", { class: "panelHeader" }, [el("h2",{},[t("kitchen.ingredientLib")]), el("span",{class:"tag",id:"ingredientCountTag"},["—"])]),
    el("div", { class: "panelBody" }, [
      el("div", { id: "ingredientPickerHost" }, []),
      el("div", { class: "hr" }),
      el("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:8px" }, [
        el("div", { class: "muted" }, [t("kitchen.potList")]),
        el("button", {
          class: "btn btnDanger",
          id: "clearPotBtn",
          style: "padding:4px 10px;font-size:10px",
          onclick: function() { doClearPot(); },
        }, [t("kitchen.clearPot")]),
      ]),
      el("div", { id: "potList", style: "display:grid;gap:6px" }, []),
      el("div", { class: "hr" }),
      el("div", { class: "muted potReserveTitle" }, [t("kitchen.reserveTitle")]),
      el("div", { id: "potReserveList", class: "potReserve" }, []),
    ]),
  ]);
  var center = el("div", { class: "panel kitchenCenter" }, [
    el("div", { class: "potView" }, [
      el("div", { class: "pot" }, [
        el("div", { class: "stoveFlameLayer", "aria-hidden": "true" }, []),
        el("div", { id: "pot3dHost", style: "width:100%;height:100%;position:relative;z-index:1" }, []),
        el("div", { class: "potTop" }, [
          el("span", { class: "pill", id: "potSummary" }, [t("kitchen.potEmpty")]),
          el("span", { class: "pill", id: "tempPill" }, ["25°C"]),
        ]),
      ]),
    ]),
      el("div", { class: "panelBody" }, [
      el("div", { id: "donenessAlert", class: "donenessAlert donenessAlertHidden" }, []),
      el("div", { class: "metricBars", id: "metrics" }, []),
      el("div", { class: "hr" }),
      el("div", { id: "suggestion", class: "muted" }, ["..."]),
    ]),
  ]);
  var right = el("div", { class: "panel" }, [
    el("div", { class: "panelHeader" }, [el("h2",{},[t("kitchen.controlPanel")]), el("span",{id:"busy",class:"tag"},[t("kitchen.ready")])]),
    el("div", { class: "panelBody" }, [
      el("div", { class: "col" }, [
        el("div", { id: "targetRecipe" }, []),
        buildForm(),
        el("div", { class: "hr" }),
        el("div", { class: "row" }, [
          el("button", { class: "btn btnSuccess", onclick: function(){ doTaste(); } }, [t("kitchen.taste")]),
          el("button", { class: "btn btnWarn", onclick: function(){ doServe(); } }, [t("kitchen.serveReport")]),
        ]),
        el("div", { id: "tasteFace", class: "pill" }, [t("kitchen.notTasted")]),
        el("div", { class: "hr" }),
        el("div", { class: "timeline", id: "timeline" }, []),
      ]),
    ]),
  ]);
  root.appendChild(topBar);
  mount(root, el("div", { class: "app" }, [left, center, right]));
  await ensureSession();
  var potHost = document.getElementById("pot3dHost");
  if (potHost) { initPot3D(potHost); updatePotTheme((document.documentElement.dataset.theme || localStorage.getItem("cookingsim.theme")) === "light"); }
  rerenderAll();
  // Time passage: periodic rest calls to apply idle-time effects. Only runs while
  // the pot is warm (>30°C) so an idle, cold kitchen doesn't keep ticking server load
  // and the timeline doesn't get spammed with empty events.
  if (window._timePassTimer) clearInterval(window._timePassTimer);
  window._timePassTimer = setInterval(function() {
    if (!state.session || !state.session.id) return;
    if (state.busy || heatingActive) return;
    var temp = (state.session.metrics && state.session.metrics.temp_c) || 25;
    if (temp <= 30) return;
    api.step(state.session.id, { type: "rest", duration_s: 30 }).then(function(d) {
      if (d && d.session) {
        var prev = state.session;
        state.session = adoptSession(prev, d.session);
        updateTempPill();
        updateDonenessAlert();
        populatePotList();
        updatePot3D(state.session);
        updateMetrics();
        var sg = document.getElementById("suggestion");
        if (sg) sg.textContent = buildSuggestion(state.session);
      }
    }).catch(function(){});
  }, 30000);
}

function buildForm() {
  var lim = getAddLimits(state.session);
  var maxAmt = Math.max(lim.maxSingleAddG, lim.minAddG);
  if (state.amountG > maxAmt) state.amountG = maxAmt;
  state.targetTempC = clampHeatTargetC(state.session, state.targetTempC);
  var maxT = lim.maxHeatTempC;
  var sel = el("select", { id: "ingredientSelect", class: "input", onchange: function(e){ state.selectedIngredient = e.target.value; rerenderAll(); } });
  var amt = el("input", {
    class: "input",
    type: "number",
    min: String(lim.minAddG),
    max: String(maxAmt),
    step: "0.1",
    value: String(state.amountG),
    oninput: function(e) {
      var v = Number(e.target.value || 0);
      var cap = getAddLimits(state.session).maxSingleAddG;
      state.amountG = Math.min(cap, Math.max(lim.minAddG, v));
      e.target.value = String(state.amountG);
    },
  });
  var heat = el("select", { id: "heatMethodSelect", class: "input", onchange: function(e){ state.heatMethod = e.target.value; } }, [
    el("option", { value: "stir_fry" }, [t("kitchen.heatMethods.stir_fry")]),
    el("option", { value: "pan_fry" }, [t("kitchen.heatMethods.pan_fry")]),
    el("option", { value: "boil" }, [t("kitchen.heatMethods.boil")]),
    el("option", { value: "steam" }, [t("kitchen.heatMethods.steam")]),
    el("option", { value: "bake" }, [t("kitchen.heatMethods.bake")]),
  ]);
  heat.value = state.heatMethod;
  var tmp = el("input", {
    class: "input",
    type: "number",
    min: "25",
    max: String(maxT),
    step: "5",
    value: String(state.targetTempC),
    oninput: function(e) {
      state.targetTempC = clampHeatTargetC(state.session, Number(e.target.value || 160));
      e.target.value = String(state.targetTempC);
    },
  });
  var dur = el("input", { class: "input", type: "number", min: "1", step: "1", value: String(state.durationS), oninput: function(e){ state.durationS = Number(e.target.value || 30); } });
  var mix = el("input", { class: "input", type: "number", min: "0", max: "1", step: "0.1", value: String(state.mixIntensity), oninput: function(e){ state.mixIntensity = Number(e.target.value || 0); } });
  return el("div", { class: "col" }, [
    el("div", { class: "pill", style: "font-size:11px;padding:8px 10px" }, [t("kitchen.formHint")]),
    el("div", { class: "grid2" }, [
      el("div", { class: "col" }, [el("div",{class:"muted"},[t("kitchen.selectIng")]), sel]),
      el("div", { class: "col" }, [el("div",{class:"muted"},[t("kitchen.amountG")]), amt]),
    ]),
    el("button", {
      class: "btn btnPrimary",
      disabled: !lim.canAdd,
      onclick: function() { doAdd(); },
    }, [t("kitchen.addToPot")]),
    el("div", {
      id: "potCapacityHint",
      class: "muted",
      style: "font-size:10px;line-height:1.4",
    }, [
      t("kitchen.potCapacityHint", {
        total: Math.round(lim.totalG),
        cap: Math.round(lim.capG),
        remain: Math.round(lim.remainG),
        maxPortions: lim.maxPortions,
      }),
    ]),
    el("div", { class: "hr" }),
    el("div", { class: "grid2" }, [
      el("div", { class: "col" }, [el("div",{class:"muted"},[t("kitchen.method")]), heat]),
      el("div", { class: "col" }, [el("div",{class:"muted"},[t("kitchen.targetTemp")]), tmp]),
    ]),
    el("button", { class: "btn", id: "heatBtn", onclick: function(){ toggleHeat(); } }, [t("kitchen.heatStart")]),
    el("div", { class: "hr" }),
    el("div", { class: "col" }, [el("div",{class:"muted"},[t("kitchen.mixStrength")]), mix]),
    el("div", { class: "row" }, [
      el("button", { class: "btn", onclick: function(){ doMix(); } }, [t("kitchen.mix")]),
      el("button", { class: "btn", onclick: function(){ doToss(); } }, [t("kitchen.toss")]),
    ]),
  ]);
}

async function ensureSession() {
  if (state.session) return;
  var d = await api.newSession();
  state.session = d.session;
  hydrateSession(state.session);
}
async function newSession() {
  if (isCoolingDown()) return;
  heatingActive = false;
  setPotHeatingActive(false);
  updatePotHeatGlow(false);
  if (heatTimer) clearTimeout(heatTimer);
  var btn = document.getElementById("heatBtn");
  if (btn) { btn.textContent = t("kitchen.heatStart"); btn.className = "btn"; }
  clearRecentIngredients();
  setBusy(true);
  try {
    var d = await api.newSession();
    state.session = d.session;
    hydrateSession(state.session);
    rerenderAll();
    if (ingredientPickerApi && ingredientPickerApi.clearRecent) ingredientPickerApi.clearRecent();
  } finally { setBusy(false); }
}
function setBusy(v) { state.busy = v; var b = document.getElementById("busy"); if (b) b.textContent = v ? t("kitchen.working") : t("kitchen.ready"); }

function attachMetaToNewReserve(oldLen, metas) {
  var reserve = state.session.reserve || [];
  for (var i = 0; i < metas.length && oldLen + i < reserve.length; i++) {
    if (metas[i]) applyPortionMeta(reserve[oldLen + i], metas[i], { toReserve: true });
  }
}

async function doStep(action) {
  if (!state.session) return;
  setBusy(true);
  try {
    var oldPreps = [];
    if (state.session.pot) for (var i = 0; i < state.session.pot.length; i++) {
      var op = state.session.pot[i];
      oldPreps[i] = {
        prepState: op._prepState, cut: op.cut, prepFlags: op._prepFlags,
      };
    }
    var oldLen = oldPreps.length;
    var oldReserveLen = (state.session.reserve || []).length;
    var scoopMetas = null;
    var returnMeta = null;
    if (action.type === "scoop_out") {
      if (action.portion_index != null) {
        scoopMetas = [extractPortionMeta(state.session.pot[action.portion_index])];
      } else if (action.portion_indices && action.portion_indices.length) {
        scoopMetas = action.portion_indices.slice().sort(function(a, b) { return b - a; }).map(function(idx) {
          return extractPortionMeta(state.session.pot[idx]);
        });
      } else if (action.ingredient_id) {
        scoopMetas = [];
        var want = action.amount_g;
        var acc = 0;
        for (var si = state.session.pot.length - 1; si >= 0; si--) {
          var sp = state.session.pot[si];
          if (sp.ingredient_id !== action.ingredient_id) continue;
          scoopMetas.unshift(extractPortionMeta(sp));
          acc += sp.amount_g;
          if (!want || acc >= want) break;
        }
      }
    }
    if (action.type === "return_to_pot" && action.reserve_index != null) {
      returnMeta = extractPortionMeta(state.session.reserve[action.reserve_index]);
    }
    var data = await api.step(state.session.id, action);
    if (data.error) { alert(data.error); return; }
    var prevSession = state.session;
    state.session = adoptSession(prevSession, data.session);
    if (!state.session.reserve) state.session.reserve = [];
    if (state.session.pot) for (var i = 0; i < oldLen && i < state.session.pot.length; i++) {
      restorePrepStateOnly(state.session.pot[i], oldPreps[i]);
    }
    if (scoopMetas && scoopMetas.length) attachMetaToNewReserve(oldReserveLen, scoopMetas);
    if (returnMeta && state.session.pot && state.session.pot.length > 0) {
      applyPortionMeta(state.session.pot[state.session.pot.length - 1], returnMeta, { toPot: true });
    }
    rerenderAll();
  } catch (e) {
    alert(e.message || String(e));
  } finally { setBusy(false); }
}

async function doScoopOutPortion(portionIndex) {
  if (isCoolingDown()) return;
  if (!state.session || !state.session.pot[portionIndex]) return;
  return doStep({ type: "scoop_out", portion_index: portionIndex });
}

async function doScoopOutIngredient(ingredientId) {
  if (isCoolingDown()) return;
  if (!state.session) return;
  return doStep({ type: "scoop_out", ingredient_id: ingredientId });
}

async function doReturnToPot(reserveIndex) {
  if (isCoolingDown()) return;
  if (!state.session || !state.session.reserve || !state.session.reserve[reserveIndex]) return;
  return doStep({ type: "return_to_pot", reserve_index: reserveIndex });
}

async function doClearPot() {
  if (isCoolingDown()) return;
  if (!state.session) return;
  var pot = state.session.pot || [];
  if (pot.length === 0) {
    alert(t("kitchen.potEmptyMsg"));
    return;
  }
  var totalG = 0;
  for (var i = 0; i < pot.length; i++) totalG += Number(pot[i].amount_g || 0);
  if (!confirm(t("kitchen.clearConfirm", { count: pot.length, g: Math.round(totalG) }))) return;
  return doStep({ type: "clear_pot" });
}

async function doAdd() {
  if (isCoolingDown()) return;
  var err = validateAddToPot(state.session, Number(state.amountG));
  if (err) { alert(err); return; }
  return doStep({ type: "add", ingredient_id: state.selectedIngredient, amount_g: Number(state.amountG) });
}

var heatingActive = false;
var heatTimer = null, coolTimer = null;

function updatePotHeatGlow(on) {
  var pot = document.querySelector(".potView .pot");
  if (pot) pot.classList.toggle("pot-heating", !!on);
}

function toggleHeat() {
  if (isCoolingDown()) return;
  heatingActive = !heatingActive;
  setPotHeatingActive(heatingActive);
  updatePotHeatGlow(heatingActive);
  var btn = document.getElementById("heatBtn");
  if (!btn) return;
  if (heatingActive) {
    btn.textContent = t("kitchen.heatStop");
    btn.className = "btn btnDanger";
    if (coolTimer) clearTimeout(coolTimer);
    doHeatStep();
  } else {
    btn.textContent = t("kitchen.heatStart");
    btn.className = "btn";
    doCoolStep();
  }
}

function doHeatStep() {
  if (!heatingActive || !state.session) return;
  var st = clampHeatTargetC(state.session, state.targetTempC);
  state.targetTempC = st;
  doStep({ type: "heat", heat_method: state.heatMethod, target_temp_c: st, duration_s: 3 }).finally(function() {
    if (heatingActive) heatTimer = setTimeout(doHeatStep, 3000);
  });
}

function doCoolStep() {
  if (heatingActive || !state.session) return;
  var temp = state.session.metrics.temp_c || 25;
  if (temp <= 30) return;
  doStep({ type: "rest", duration_s: 10 }).finally(function() {
    if (!heatingActive) coolTimer = setTimeout(doCoolStep, 10000);
  });
}
async function doMix() { if (isCoolingDown()) return; var i = Math.max(0,Math.min(1,Number(state.mixIntensity))); if (coolTimer) { clearTimeout(coolTimer); coolTimer = null; } setPotAction("mix", i); doStep({ type:"mix", mix_intensity:i, duration_s:3 }); setTimeout(function(){ if (state.session) { setPotAction("mix", i * 0.6); doStep({ type:"mix", mix_intensity:i * 0.6, duration_s:2 }); } }, 600); setTimeout(function(){ if (state.session) { setPotAction("mix", i * 0.3); doStep({ type:"mix", mix_intensity:i * 0.3, duration_s:2 }); } }, 1200); setTimeout(function(){ if (!heatingActive) doCoolStep(); }, 3000); }

async function doToss() { if (isCoolingDown()) return; var i = Math.max(0,Math.min(1,Number(state.mixIntensity))); if (coolTimer) { clearTimeout(coolTimer); coolTimer = null; } setPotAction("toss", i); doStep({ type:"mix", mix_intensity:i, duration_s:2 }); setTimeout(function(){ if (!heatingActive) doCoolStep(); }, 3000); }
async function doTaste() { if (isCoolingDown()) return; return doStep({ type:"taste" }); }

async function doSwitchEquipment(id) {
  if (isCoolingDown()) return;
  if (!state.session) return;
  setBusy(true);
  try {
    var data = await api.setEquipment(state.session.id, id);
    if (data && data.error) { alert(data.error); return; }
    if (data && data.session) state.session = adoptSession(state.session, data.session);
    state.targetTempC = clampHeatTargetC(state.session, state.targetTempC);
    switchEquipment(id);
    rerenderAll();
  } catch (e) {
    state.session.equipment_id = id;
    switchEquipment(id);
    rerenderAll();
  } finally {
    setBusy(false);
  }
}

function doServe() { if (isCoolingDown()) return; if (!state.session) return; showServeModal(state.session); }

async function doQuickAdd(id) {
  if (isCoolingDown()) return;
  state.selectedIngredient = id;
  var def = getDefaultAmountG(id) || 10;
  var cap = getAddLimits(state.session).maxSingleAddG;
  state.amountG = Math.min(def, cap);
  rerenderAll();
  // 直接执行添加逻辑，不再调用 doAdd（避免重复冷却检查）
  var err = validateAddToPot(state.session, Number(state.amountG));
  if (err) { alert(err); return; }
  return doStep({ type: "add", ingredient_id: state.selectedIngredient, amount_g: Number(state.amountG) });
}

function openPrepKitchen() { if (!state.session) return; showPrepKitchen(state.session.ingredients || {}, null, commitStaged); }
function openPrepKitchenFor(id) { if (!state.session) return; showPrepKitchen(state.session.ingredients || {}, id, commitStaged); }

async function commitStaged(items) {
  setBusy(true);
  try {
    var oldPreps = [];
    if (state.session.pot) for (var i = 0; i < state.session.pot.length; i++) {
      var op = state.session.pot[i];
      oldPreps[i] = {
        prepState: op._prepState, cut: op.cut, prepFlags: op._prepFlags,
      };
    }
    var oldLen = oldPreps.length;
    var potAdds = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.prepFlags && it.prepFlags.setAside) {
        var oldReserveLen = (state.session.reserve || []).length;
        var dr = await api.step(state.session.id, Object.assign({
          type: "stash_to_reserve",
          ingredient_id: it.id,
          amount_g: it.amountG || 50,
          cut_style: it.cut || "none",
        }, prepExtrasFromItem(it)));
        if (dr.session) {
          state.session = adoptSession(state.session, dr.session);
          attachMetaToNewReserve(oldReserveLen, [{
            prepState: it.prepState || "whole",
            cut: it.cut,
            prepFlags: it.prepFlags,
          }]);
        }
      } else {
        potAdds.push(it);
      }
    }
    for (var k = 0; k < potAdds.length; k++) {
      var it2 = potAdds[k];
      var addErr = validateAddToPot(state.session, it2.amountG || 50);
      if (addErr) {
        alert(addErr);
        break;
      }
      var d = await api.step(state.session.id, Object.assign({
        type: "add",
        ingredient_id: it2.id,
        amount_g: it2.amountG || 50,
        cut_style: it2.cut || "none",
      }, prepExtrasFromItem(it2)));
      if (d.session) {
        state.session = adoptSession(state.session, d.session);
        if (state.session.pot) for (var j = 0; j < oldLen && j < state.session.pot.length; j++) {
          restorePrepStateOnly(state.session.pot[j], oldPreps[j]);
        }
      }
    }
    if (state.session && state.session.pot && potAdds.length) {
      var off = state.session.pot.length - potAdds.length;
      for (var pi = 0; pi < potAdds.length; pi++) {
        var idx = off + pi;
        if (idx >= 0 && idx < state.session.pot.length) {
          applyPortionMeta(state.session.pot[idx], {
            prepState: potAdds[pi].prepState || "whole",
            cut: potAdds[pi].cut,
            prepFlags: potAdds[pi].prepFlags,
          }, { toPot: true });
        }
      }
    }
    rerenderAll();
  } finally { setBusy(false); }
}

function rerenderAll() {
  if (!state.session) return;
  renderTargetGuide();
  populateIngredients();
  populatePotList();
  populateReserveList();
  updateDonenessAlert();
  updateClearPotBtn();
  var ps = document.getElementById("potSummary");
  if (ps) {
    var c = (state.session.pot || []).length;
    var r = (state.session.reserve || []).length;
    if (!c && !r) ps.textContent = t("kitchen.potSummaryEmpty");
    else ps.textContent = t("kitchen.potSummary", { count: c }) + (r ? t("kitchen.potSummaryReserve", { reserve: r }) : "");
  }
  updatePot3D(state.session);
  updateTempPill();
  updateMetrics();
  var sg = document.getElementById("suggestion"); if (sg) sg.textContent = buildSuggestion(state.session);
  var tf = document.getElementById("tasteFace"); if (tf) tf.textContent = buildTasteFace(state.session);
  updateTimeline();
}

function syncIngredientSelectDropdown() {
  var ingredientsMap = state.session?.ingredients || {};
  var sections = buildIngredientSections(ingredientsMap);
  var ingSel = document.getElementById("ingredientSelect");
  if (!ingSel || ingSel.tagName !== "SELECT") return;
  ingSel.innerHTML = "";
  for (var s = 0; s < sections.length; s++) {
    var sec = sections[s];
    var og = document.createElement("optgroup");
    og.label = (sec.emoji || "") + " " + sec.label;
    for (var j = 0; j < sec.items.length; j++) {
      var o = document.createElement("option");
      o.value = sec.items[j].id;
      o.textContent = sec.items[j].name;
      og.appendChild(o);
    }
    ingSel.appendChild(og);
  }
  ingSel.value = state.selectedIngredient;
}

function populateIngredients() {
  var host = document.getElementById("ingredientPickerHost");
  if (!host || !state.session) return;
  var ingredientsMap = state.session.ingredients || {};
  syncIngredientSelectDropdown();
  var countTag = document.getElementById("ingredientCountTag");
  if (countTag) countTag.textContent = t("kitchen.ingCountSearch", { n: Object.keys(ingredientsMap).length });

  if (ingredientPickerApi && ingredientPickerApi.isMounted && host.querySelector(".ingredientPickerSearch")) {
    ingredientPickerApi.setSelectedId(state.selectedIngredient);
    return;
  }

  ingredientPickerApi = mountIngredientPicker(host, {
    ingredients: ingredientsMap,
    selectedId: state.selectedIngredient,
    onSelect: function(ing) {
      state.selectedIngredient = ing.id;
      state.amountG = getDefaultAmountG(ing.id);
      syncIngredientSelectDropdown();
      ingredientPickerApi?.setSelectedId(ing.id);
    },
    onQuickAdd: function(id) { doQuickAdd(id); },
    showQuickAdd: true,
    showPrepBtn: true,
    onPrep: function(id) { openPrepKitchenFor(id); },
    listMaxHeight: "38vh",
  });
}

function updateClearPotBtn() {
  var btn = document.getElementById("clearPotBtn");
  if (!btn || !state.session) return;
  var n = (state.session.pot || []).length;
  btn.disabled = n === 0;
  btn.style.opacity = n === 0 ? "0.45" : "1";
}

function populatePotList() {
  var list = document.getElementById("potList");
  if (!list) return;
  list.innerHTML = "";
  updateClearPotBtn();
  var pot = state.session.pot || [];
  if (pot.length === 0) {
    list.appendChild(el("div", { class: "muted", style: "padding:6px;font-size:11px" }, [t("kitchen.potListEmpty")]));
    return;
  }
  var grouped = {};
  for (var i = 0; i < pot.length; i++) {
    var id = pot[i].ingredient_id;
    if (!grouped[id]) grouped[id] = { indices: [], totalG: 0 };
    grouped[id].indices.push(i);
    grouped[id].totalG += Number(pot[i].amount_g || 0);
  }
  for (var gi = 0; gi < pot.length; gi++) {
    var p = pot[gi];
    var id = p.ingredient_id;
    var name = (state.session.ingredients || {})[id] ? state.session.ingredients[id].name : id;
    var stateLabel = formatPrepStateLabel(p._prepState, p.cut, p._prepFlags);
    var cookKids = [];
    if (cooksAsFood(id, state.session.ingredients)) {
      var lv = getDonenessLevel(p.doneness);
      var barW = Math.round(Math.max(0, Math.min(1, p.doneness || 0)) * 100);
      cookKids.push(
        el("div", { class: "potDonenessRow" }, [
          el("span", { class: "donenessBadge " + lv.cls }, [lv.emoji + " " + lv.label]),
          el("div", { class: "donenessMiniBar" }, [
            el("div", {
              class: "donenessMiniBarFill",
              style: "width:" + barW + "%;background:" + donenessBarColor(p.doneness),
            }, []),
          ]),
          p.added_at_temp_c != null
            ? el("span", { class: "muted", style: "font-size:9px" }, [t("kitchen.addedAtTemp", { temp: round1(p.added_at_temp_c) })])
            : null,
        ].filter(Boolean))
      );
      if ((p.burn || 0) > 0.35) {
        cookKids.push(el("span", { class: "donenessBurnTag" }, [t("kitchen.burnPct", { pct: Math.round((p.burn || 0) * 100) })]));
      }
    }
    list.appendChild(el("div", { class: "potListItem" + (cookKids.length && (p.doneness || 0) < 0.22 ? " potListItemRaw" : "") }, [
      el("div", { style: "display:flex;flex-direction:column;gap:4px;min-width:0;flex:1" }, [
        el("span", { style: "font-size:12px" }, [(EMOJI[id] || "") + " " + name + " · " + round1(p.amount_g) + "g"]),
        el("span", { class: "muted", style: "font-size:10px" }, [stateLabel]),
      ].concat(cookKids)),
      el("button", {
        class: "btn btnWarn",
        style: "padding:3px 8px;font-size:10px;flex-shrink:0",
        onclick: (function(idx) { return function() { doScoopOutPortion(idx); }; })(gi),
      }, [t("kitchen.scoopOut")]),
    ]));
  }
  var gids = Object.keys(grouped);
  if (gids.length > 1 || (grouped[gids[0]] && grouped[gids[0]].indices.length > 1)) {
    list.appendChild(el("div", { class: "hr", style: "margin:4px 0" }, []));
    for (var g = 0; g < gids.length; g++) {
      var gid = gids[g];
      var gname = (state.session.ingredients || {})[gid] ? state.session.ingredients[gid].name : gid;
      if (grouped[gid].indices.length <= 1) continue;
      list.appendChild(el("button", {
        class: "btn",
        style: "width:100%;padding:4px 8px;font-size:10px;margin-bottom:4px",
        onclick: (function(ingId) { return function() { doScoopOutIngredient(ingId); }; })(gid),
      }, [t("kitchen.scoopAll", { name: gname, g: round1(grouped[gid].totalG) })]));
    }
  }
}

function populateReserveList() {
  var list = document.getElementById("potReserveList");
  if (!list) return;
  list.innerHTML = "";
  var reserve = state.session.reserve || [];
  if (reserve.length === 0) {
    list.appendChild(el("div", { class: "muted", style: "padding:6px;font-size:11px" }, [
      t("kitchen.reserveEmpty"),
    ]));
    return;
  }
  for (var ri = 0; ri < reserve.length; ri++) {
    var p = reserve[ri];
    var id = p.ingredient_id;
    var name = (state.session.ingredients || {})[id] ? state.session.ingredients[id].name : id;
    var stateLabel = formatPrepStateLabel(p._prepState, p.cut, p._prepFlags);
    list.appendChild(el("div", { class: "prepStagedItem prepReserveItem" }, [
      el("div", { style: "display:flex;flex-direction:column;gap:2px;min-width:0;flex:1" }, [
        el("span", { style: "font-size:12px" }, [(EMOJI[id] || "") + " " + name + " · " + round1(p.amount_g) + "g"]),
        el("span", { class: "muted", style: "font-size:10px" }, [stateLabel]),
      ]),
      el("button", {
        class: "btn btnPrimary",
        style: "padding:3px 8px;font-size:10px;flex-shrink:0",
        onclick: (function(idx) { return function() { doReturnToPot(idx); }; })(ri),
      }, [t("kitchen.returnPot")]),
    ]));
  }
}

function updateDonenessAlert() {
  var host = document.getElementById("donenessAlert");
  if (!host || !state.session) return;
  host.innerHTML = "";
  var pot = state.session.pot || [];
  if (pot.length === 0) {
    host.className = "donenessAlert donenessAlertHidden";
    return;
  }
  var analysis = analyzePotDoneness(pot, state.session.ingredients || {});
  if (!analysis.items.length) {
    host.className = "donenessAlert donenessAlertHidden";
    return;
  }
  host.className = "donenessAlert" + (analysis.alerts.length ? " donenessAlertWarn" : "");
  host.appendChild(el("div", { class: "donenessAlertTitle" }, [t("kitchen.donenessTitle")]));
  host.appendChild(el("div", { class: "donenessAlertSummary" }, [analysis.summary]));
  if (analysis.alerts.length) {
    analysis.alerts.forEach(function(msg) {
      host.appendChild(el("div", { class: "donenessAlertLine" }, [msg]));
    });
  } else {
    host.appendChild(el("div", { class: "donenessAlertOk" }, [t("kitchen.donenessOk")]));
  }
}

function updateTempPill() {
  var tp = document.getElementById("tempPill");
  if (!tp) return;
  var temp = state.session.metrics.temp_c || 25;
  tp.textContent = round1(temp) + "°C";
  tp.classList.remove("tempPillCool","tempPillWarm","tempPillHot");
  if (temp < 60) tp.classList.add("tempPillCool"); else if (temp < 120) tp.classList.add("tempPillWarm"); else tp.classList.add("tempPillHot");
}

function updateMetrics() {
  var el2 = document.getElementById("metrics");
  if (!el2) return;
  el2.innerHTML = "";
  // Empty pot: show placeholder
  if ((state.session.pot || []).length === 0 && (state.session.timeline || []).length === 0) {
    el2.appendChild(el("div",{class:"col",style:"align-items:center;gap:10px;padding:20px 0"},[
      el("div",{style:"font-size:36px"},["👨‍🍳"]),
      el("div",{class:"muted",style:"text-align:center"},[t("kitchen.clickToStart")]),
    ]));
    return;
  }
  try {
    var judge = judgeDish(state.session);
    var jt = judge.total;
    // Build halo directly from judge data (unified with serve modal)
    var halo = {
      score: jt / 20,
      emoji: jt >= 70 ? "🙂" : jt >= 50 ? "😐" : jt >= 30 ? "😟" : "😵",
      label: jt >= 70 ? t("kitchen.judgeOk") : jt >= 50 ? t("kitchen.judgeMid") : jt >= 30 ? t("kitchen.judgeLow") : t("kitchen.judgeFail"),
      color: jt >= 70 ? "#6bcb77" : jt >= 50 ? "#ffd93d" : "#ff6b6b",
    };
    var tags = calcFlavorTags(state.session.metrics.taste || {}, state.session.metrics);
    var mf = calcMouthfeel(state.session.metrics, state.session.pot || []);
    var layers = calcFlavorLayers(state.session.metrics.taste || {});
    el2.appendChild(buildHalo(halo, tags, mf, layers));
  } catch(e) {
    el2.appendChild(el("div",{class:"muted"},[t("kitchen.flavorLoading")]));
  }
}

function simpleBars(m) {
  var wrap = el("div", { class: "metricBars" }, []);
  var items = [
    [t("kitchen.metricDoneness"), m.doneness, ""], [t("kitchen.metricBrowning"), m.browning, ""], [t("kitchen.metricBurn"), m.burn_risk, "danger"], [t("kitchen.metricEmulsion"), m.emulsion, ""],
  ];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var v = Math.round(Math.max(0,Math.min(1,it[1]))*100);
    var cls = it[2] === "danger" ? "barFillDanger" : "barFill";
    wrap.appendChild(el("div",{class:"col"},[
      el("div",{class:"barLabel"},[el("span",{},[it[0]]),el("span",{},[v+"%"])]),
      el("div",{class:"barTrack"},[el("div",{class:cls,style:"width:"+v+"%"},[])]),
    ]));
  }
  return wrap;
}

function buildHalo(halo, tags, mf, layers) {
  var stars = "⭐".repeat(Math.max(0,Math.round(halo.score))) + "☆".repeat(Math.max(0,5-Math.round(halo.score)));
  var hd = el("div",{class:"flavorHalo",style:"border-color:"+halo.color+";box-shadow:0 0 20px "+halo.color+"33"},[
    el("div",{class:"flavorHaloEmoji"},[halo.emoji]),
    el("div",{class:"flavorHaloLabel",style:"color:"+halo.color},[halo.label]),
    el("div",{class:"flavorHaloStars"},[stars]),
  ]);
  var allT = [];
  if (layers) allT = (layers.front||[]).concat(layers.middle||[],layers.after||[]);
  var icons = [];
  var checkIcons = [
    ["🫙", t("flavor.tasteShort.salty")], ["🍬", t("flavor.tasteShort.sweet")], ["🍋", t("flavor.tasteShort.sour")],
    ["🌶️", t("flavor.tasteShort.spicy")], ["🍄", t("flavor.tasteShort.umami")], ["🌸", t("flavor.tasteShort.aroma")], ["☕", t("flavor.tasteShort.bitter")],
  ];
  for (var i = 0; i < checkIcons.length; i++) {
    var iconPair = checkIcons[i];
    for (var j = 0; j < allT.length; j++) {
      if (iconPair[1] === allT[j].taste) { icons.push(el("span",{class:"tasteIconPill"},[allT[j].emoji+" "+allT[j].taste])); break; }
    }
  }
  var mfBars = null;
  if (mf) {
    mfBars = el("div",{class:"col",style:"gap:3px;margin-top:6px"},[
      mfBar(t("kitchen.mfSmooth"),mf.smooth), mfBar(t("kitchen.mfRich"),mf.rich), mfBar(t("kitchen.mfFresh"),mf.fresh), mfBar(t("kitchen.mfLayered"),mf.layered),
    ]);
  }
  return el("div",{class:"col",style:"align-items:center;gap:8px"},[
    hd,
    icons.length>0 ? el("div",{class:"row",style:"gap:4px;flex-wrap:wrap;justify-content:center"},icons) : null,
    tags&&tags.length>0 ? el("div",{class:"row",style:"flex-wrap:wrap;gap:4px;justify-content:center"},tags.map(function(tag){return el("span",{class:"flavorTag"},[tag]);})) : null,
    el("div",{class:"hr",style:"width:100%"}),
    el("div",{class:"muted",style:"text-align:center"},[t("kitchen.mouthfeel")]),
    mfBars,
  ].filter(Boolean));
}

function mfBar(label, val) {
  var pctV = Math.round(Math.max(0, Math.min(100, val||0)));
  return el("div",{class:"col",style:"gap:2px"},[
    el("div",{style:"display:flex;justify-content:space-between;font-size:10px;color:var(--text-dim)"},[el("span",{},[label]),el("span",{},[pctV+"%"])]),
    el("div",{class:"barTrack",style:"height:5px"},[el("div",{class:"barFill",style:"width:"+pctV+"%"},[])]),
  ]);
}

function tasteBar(emoji, label, val) {
  var pctV = Math.round(Math.max(0, Math.min(1, val||0)) * 100);
  return el("div",{class:"col",style:"gap:2px"},[
    el("div",{style:"display:flex;justify-content:space-between;font-size:11px;color:var(--text-dim)"},[el("span",{},[emoji+" "+label]),el("span",{},[pctV+"%"])]),
    el("div",{class:"barTrack",style:"height:6px"},[el("div",{class:"barFill",style:"width:"+pctV+"%"},[])]),
  ]);
}

function flavorLayerArrow(layers) {
  if (!layers) return null;
  var all = [];
  var front = layers.front || [], middle = layers.middle || [], after = layers.after || [];
  for (var i = 0; i < front.length; i++) all.push(front[i]);
  for (var i = 0; i < middle.length; i++) all.push(middle[i]);
  for (var i = 0; i < after.length; i++) all.push(after[i]);
  if (all.length === 0) return null;
  var parts = [];
  for (var i = 0; i < all.length; i++) {
    parts.push(all[i].emoji + " " + all[i].taste);
  }
  return el("div",{class:"pill",style:"font-size:12px;gap:4px"},[parts.join("  →  ")]);
}

function buildTasteBars(tasteObj) {
  return el("div",{class:"col",style:"gap:3px"},[
    tasteBar("🫙",t("kitchen.tasteSalty"),tasteObj.salty), tasteBar("🍬",t("kitchen.tasteSweet"),tasteObj.sweet), tasteBar("🍋",t("kitchen.tasteSour"),tasteObj.sour),
    tasteBar("🌶️",t("kitchen.tasteSpicy"),tasteObj.spicy), tasteBar("🍄",t("kitchen.tasteUmami"),tasteObj.umami), tasteBar("🌸",t("kitchen.tasteAroma"),tasteObj.aroma), tasteBar("☕",t("kitchen.tasteBitter"),tasteObj.bitter),
  ]);
}

function buildMouthfeelBars(mf) {
  if (!mf) return null;
  return el("div",{class:"col",style:"gap:3px"},[
    mfBar(t("kitchen.mfSmooth"),mf.smooth), mfBar(t("kitchen.mfRich"),mf.rich), mfBar(t("kitchen.mfFresh"),mf.fresh), mfBar(t("kitchen.mfLayered"),mf.layered),
  ]);
}

function updateTimeline() {
  var tl = document.getElementById("timeline");
  if (!tl) return;
  tl.innerHTML = "";
  var events = state.session.timeline || [];
  // Filter out silent rest events (auto-ticks and cool-downs) — they have no notes
  // and would otherwise spam the UI. User-visible actions and rest events that
  // produced notes are preserved.
  var visible = [];
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    var isRest = ev.action && ev.action.type === "rest";
    var hasNotes = (ev.notes || []).length > 0;
    if (isRest && !hasNotes) continue;
    visible.push({ ev: ev, idx: i + 1 });
  }
  var rev = visible.slice(-40).reverse();
  for (var j = 0; j < rev.length; j++) {
    var item = rev[j];
    tl.appendChild(el("div",{class:"event"},[
      el("div",{class:"eventTitle"},[el("strong",{},[fmtAction(item.ev.action)]),el("span",{},["#"+item.idx])]),
      el("div",{class:"eventNotes"},[(item.ev.notes||[]).join("\n")||"—"]),
    ]));
  }
}

function renderTargetGuide() {
  var host = document.getElementById("targetRecipe");
  if (!host) return;
  if (!targetGuideApi) {
    targetGuideApi = mountTargetRecipeGuide(host, {
      context: "kitchen",
      onClear: function() { rerenderAll(); },
      onAddIngredient: function(item) {
        if (!item.ingredient_id) {
          alert(t("kitchen.noIngMatch"));
          return;
        }
        state.selectedIngredient = item.ingredient_id;
        var cap = getAddLimits(state.session).maxSingleAddG;
        state.amountG = Math.min(Number(item.amount_g || 30), cap);
        syncIngredientSelectDropdown();
        ingredientPickerApi?.setSelectedId(item.ingredient_id);
        doAdd();
      },
    });
  } else {
    targetGuideApi.refresh();
  }
}

function showServeModal(session) {
  var m = session.metrics || {};
  var ex = document.querySelector(".serveOverlay"); if (ex) ex.remove();
  var close = function(){ var o = document.querySelector(".serveOverlay"); if (o) o.remove(); };
  var nm = getDishName(session);
  var na;
  try { na = genTasteNarrative(session); } catch(e) { na = { emoji:"😐", score:2.5, intro:t("kitchen.fallbackIntro"), body:"", suggestText:"", pairing:"", scene:"", touch:"", judge:{total:50,dimensions:[],analysis:"",suggestions:[],playerComment:t("kitchen.fallbackJudge")} }; }
  var judge = na.judge || { total: 0, dimensions: [], analysis: "", suggestions: [], playerComment: "" };

  function renderServeEval(narr) {
    var box = document.getElementById("serveEvalBox");
    if (!box) return;
    box.innerHTML = "";
    box.appendChild(el("div", { style: "font-size:16px;margin-bottom:8px" }, [
      narr.emoji + " " + "⭐".repeat(Math.round(narr.score)) + "☆".repeat(Math.max(0, 5 - Math.round(narr.score))),
    ]));
    if (narr.aiGenerated) {
      box.appendChild(el("div", { class: "pill", style: "margin-bottom:8px;font-size:11px" }, [t("kitchen.aiBadge")]));
    }
    box.appendChild(el("div", { style: "margin-bottom:6px" }, [narr.intro]));
    box.appendChild(el("div", { style: "margin-bottom:8px;color:var(--text-dim)" }, [narr.body]));
    box.appendChild(el("div", { style: "margin-bottom:8px;white-space:pre-line;font-size:13px;color:var(--text-dim)" }, [narr.suggestText]));
    box.appendChild(el("div", { class: "hr" }, []));
    box.appendChild(el("div", { style: "font-size:12px;color:var(--text-dim)" }, [t("kitchen.pairingPrefix") + narr.pairing]));
    box.appendChild(el("div", { style: "font-size:12px;color:var(--text-dim)" }, [t("kitchen.scenePrefix") + narr.scene]));
    box.appendChild(el("div", { style: "margin-top:6px;font-style:italic" }, [narr.touch]));
  }

  var overlay = el("div",{class:"serveOverlay",onclick:function(e){if(e.target===overlay)close();}},[
    el("div",{class:"serveCard"},[
      el("div",{class:"serveHeader"},[
        el("h2",{},[t("kitchen.serveTitle", { name: nm })]),
        el("div",{class:"row"},[
          el("button",{class:"btn btnWarn",id:"btnExportJson"},[t("kitchen.copyJson")]),
          el("button",{class:"btn",onclick:close},[t("kitchen.close")]),
        ]),
      ]),
      el("div",{class:"serveBody"},[
        el("div",{class:"serveVisual"},[
          el("canvas",{id:"dishCanvas",width:"400",height:"400"}),
          el("div",{class:"serveAiSection"},[
            el("button",{class:"btn btnSuccess",id:"btnAiGenerate"},[t("kitchen.aiImage")]),
            el("div",{id:"aiImageContainer"},[]),
          ]),
        ]),
        el("div",{class:"serveMetrics"},[
          el("canvas",{id:"radarCanvas",width:"360",height:"360"}),
          el("div",{class:"serveStats"},[
            sp(t("kitchen.statTemp"),round1(m.temp_c)+"°C"), sp(t("kitchen.statDoneness"),pct(m.doneness)), sp(t("kitchen.statBrowning"),pct(m.browning)), sp(t("kitchen.statBurn"),pct(m.burn_risk)),
            sp(t("kitchen.statEmulsion"),pct(m.emulsion)), sp(t("kitchen.statWater"),round1(m.water_g)+"g"), sp(t("kitchen.statOil"),round1(m.oil_g)+"g"), sp(t("kitchen.statSolids"),round1(m.solids_g)+"g"),
          ]),
          el("div",{class:"hr"}),
          el("div",{class:"muted",style:"margin-bottom:6px;font-size:14px;font-weight:700"},[judge.playerComment]),
          judge.valid === false ? el("div",{class:"muted",style:"margin-bottom:8px;font-size:12px"},[judge.reason]) : null,
          judge.dimensions.length > 0 ? el("div",{class:"col",style:"gap:3px"},judge.dimensions.map(function(d){
            var pct = Math.round(d.score/d.max*100);
            var cls = pct >= 70 ? "barFill" : pct >= 45 ? "barFillWarn" : "barFillDanger";
            return el("div",{class:"col",style:"gap:1px"},[
              el("div",{style:"display:flex;justify-content:space-between;font-size:10px;color:var(--text-dim)"},[
                el("span",{},[d.name]),el("span",{},[d.score+"/"+d.max]),
              ]),
              el("div",{class:"barTrack",style:"height:5px"},[el("div",{class:cls,style:"width:"+pct+"%"},[])]),
            ]);
          })) : null,
          el("div",{class:"muted",style:"margin-top:6px;font-size:11px"},[judge.analysis]),
          judge.suggestions.length > 0 ? el("div",{class:"muted",style:"font-size:11px;white-space:pre-line;margin-top:4px"},[t("kitchen.issuesPrefix")+judge.suggestions.map(function(s){return "• "+s;}).join("\n")]) : null,
          el("div",{class:"hr"}),
          el("div",{id:"serveAiStatus",class:"col",style:"gap:4px"},[]),
          el("div",{class:"serveEval",id:"serveEvalBox"},[
            el("div",{style:"font-size:16px;margin-bottom:8px"},[na.emoji+" "+"⭐".repeat(Math.round(na.score))+"☆".repeat(Math.max(0,5-Math.round(na.score)))]),
            el("div",{style:"margin-bottom:6px"},[na.intro]),
            el("div",{style:"margin-bottom:8px;color:var(--text-dim)"},[na.body]),
            el("div",{style:"margin-bottom:8px;white-space:pre-line;font-size:13px;color:var(--text-dim)"},[na.suggestText]),
            el("div",{class:"hr"}),
            el("div",{style:"font-size:12px;color:var(--text-dim)"},[t("kitchen.pairingPrefix")+na.pairing]),
            el("div",{style:"font-size:12px;color:var(--text-dim)"},[t("kitchen.scenePrefix")+na.scene]),
            el("div",{style:"margin-top:6px;font-style:italic"},[na.touch]),
          ]),
        ]),
      ]),
      el("div",{class:"serveFooter"},[el("button",{class:"btn",onclick:close},[t("kitchen.continueCook")])]),
      ]),
  ]);
  document.body.appendChild(overlay);
  document.addEventListener("keydown",function onKey(e){if(e.key==="Escape"){close();document.removeEventListener("keydown",onKey);}});
  setTimeout(function(){
    var dc=document.getElementById("dishCanvas"); if(dc) drawDishOnCanvas(dc,session);
    var rc=document.getElementById("radarCanvas"); if(rc) drawRadarChart(rc, generateRadarData(session), {fontSize:11});
    renderServeEval(na);
  },100);

  var aiStatus = document.getElementById("serveAiStatus");
  if (aiStatus) {
    aiStatus.appendChild(el("div", {
      id: "serveAiLoading",
      class: "pill",
      style: "font-size:11px;color:var(--text-dim)",
    }, [t("kitchen.aiReportLoading")]));
  }

  generateAiServeReport(session).then(function(aiNa) {
    if (aiStatus) aiStatus.innerHTML = "";
    if (!aiNa) return;
    if (aiNa.error && !aiNa.aiGenerated) {
      if (aiStatus) {
        aiStatus.appendChild(el("div", {
          class: "pill",
          style: "font-size:11px;color:var(--warn)",
        }, [t("kitchen.aiReportFail", { detail: shortenAiError(aiNa.error) })]));
      }
      return;
    }
    if (aiNa.aiGenerated) {
      na = aiNa;
      renderServeEval(na);
    }
  });

  var btnAi = document.getElementById("btnAiGenerate");
  if (btnAi) btnAi.onclick = async function() {
    btnAi.textContent = t("kitchen.aiQueue"); btnAi.disabled = true;
    var container = document.getElementById("aiImageContainer");
    var startedAt = Date.now();
    var progressEl = null;
    function renderProgress(text) {
      if (!container) return;
      container.innerHTML = '<div class="skeleton" style="height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px">'
        + '<span class="pulse" style="color:var(--text-dim)">' + text + '</span>'
        + '<span id="aiProgressTimer" style="color:var(--text-dim);font-size:11px"></span>'
        + '</div>';
      progressEl = document.getElementById("aiProgressTimer");
    }
    renderProgress(t("kitchen.aiProgress"));
    var timer = setInterval(function() {
      if (progressEl) progressEl.textContent = t("kitchen.aiWait", { s: Math.floor((Date.now() - startedAt) / 1000) });
    }, 1000);
    var imgUrl = null;
    var imgErr = null;
    try {
      var imgResult = await generateAiImage(session, {}, function(p) {
        btnAi.textContent = t("kitchen.aiAttempt", { attempt: p.attempt, total: p.total, model: p.model });
        renderProgress(t("kitchen.aiModel", { model: p.model }));
      });
      imgUrl = imgResult && imgResult.url;
      imgErr = imgResult && imgResult.error;
    } catch(e) { console.error(e); imgErr = e.message || String(e); }
    clearInterval(timer);
    if (container && imgUrl) {
      container.innerHTML = "";
      var img = document.createElement("img"); img.src = imgUrl; img.alt = t("kitchen.aiAlt");
      img.style.cssText = "border-radius:12px;border:1px solid var(--panel-border);max-width:100%;max-height:320px;object-fit:contain;display:none";
      img.onload = function(){ img.style.display="block"; btnAi.textContent=t("kitchen.aiRetry"); btnAi.disabled=false; };
      img.onerror = function(){ container.innerHTML = '<div class="pill" style="padding:14px;color:var(--text-dim);text-align:center">'+t("kitchen.aiLoadFail")+'</div>'; btnAi.textContent=t("kitchen.aiRealBtn"); btnAi.disabled=false; };
      container.appendChild(img);
    } else if (container) {
      var failMsg = imgErr ? t("kitchen.aiFailDetail", { detail: shortenAiError(imgErr) }) : t("kitchen.aiFail");
      container.innerHTML = '<div class="pill" style="padding:14px;color:var(--text-dim);text-align:center">'+failMsg+'</div>';
      btnAi.textContent = t("kitchen.aiImage"); btnAi.disabled = false;
    }
  };

  var btnExport = document.getElementById("btnExportJson");
  if (btnExport) btnExport.onclick = function(){
    var payload = { id:session.id, name:session.name, metrics:session.metrics, timeline:session.timeline, pot:session.pot };
    var json = JSON.stringify(payload,null,2);
    navigator.clipboard.writeText(json).then(function(){btnExport.textContent=t("kitchen.copied");setTimeout(function(){btnExport.textContent=t("kitchen.copyJson")},2000);}).catch(function(){window.prompt(t("kitchen.manualCopy"),json);});
  };
}

function sp(label, value) { return el("div",{class:"statPill"},[el("span",{class:"label"},[label]),el("span",{class:"value"},[value])]); }

function shortenAiError(msg) {
  if (!msg) return "";
  var s = String(msg).replace(/\s+/g, " ").trim();
  if (s.length > 120) return s.slice(0, 117) + "…";
  return s;
}

function buildSuggestion(session) {
  var m = session.metrics||{}, taste = m.taste||{}, steps = session.timeline||[], last = steps.length>0?steps[steps.length-1].action.type:null;
  var cook = analyzePotDoneness(session.pot||[], session.ingredients||{});
  if (!steps.length) return t("kitchen.sugPickMain");
  if ((session.pot||[]).length===0) return t("kitchen.sugEmptyPot");
  if (cook.worst) return t("kitchen.sugRaw", { name: cook.worst.name, level: cook.worst.level.label });
  if (cook.alerts.length) return cook.alerts[0];
  if (m.temp_c<40&&last!=="heat") return t("kitchen.sugLowTemp");
  if (m.burn_risk>0.7) return t("kitchen.sugBurn");
  if (taste.salty>0.8) return t("kitchen.sugSalty");
  if (taste.salty<0.2&&taste.umami>0.3&&last==="heat") return t("kitchen.sugLight");
  if (m.doneness>0.9&&m.browning<0.2&&m.burn_risk<0.4) return t("kitchen.sugOvercooked");
  if (last==="taste") return t("kitchen.sugAfterTaste");
  if (last==="add") return t("kitchen.sugAfterAdd");
  return t("kitchen.sugDefault");
}

function buildTasteFace(session) {
  var m = session.metrics||{}, taste = m.taste||{}, burn = m.burn_risk||0, any = (session.timeline||[]).length>0;
  if (!any) return t("kitchen.notTasted");
  if (burn>0.7||taste.bitter>0.6) return t("kitchen.tasteBurnt");
  if (taste.salty>0.85) return t("kitchen.tasteTooSalty");
  var intensity = taste.salty+taste.sour+taste.sweet+taste.spicy+taste.umami+taste.bitter;
  if (intensity<0.4) return t("kitchen.tasteBland");
  if (taste.umami>0.5&&taste.salty>=0.3&&taste.salty<=0.7&&taste.bitter<0.3) return t("kitchen.tasteGood");
  return t("kitchen.tasteOk");
}

function toggleTheme() {
  var cur = document.documentElement.dataset.theme;
  var next = cur === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("cookingsim.theme", next);
  updatePotTheme(next === "light");
  var btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = getThemeIcon();
}

function getThemeIcon() {
  return (document.documentElement.dataset.theme || localStorage.getItem("cookingsim.theme")) === "light" ? "☀️" : "🌙";
}

(function initTheme() {
  var saved = localStorage.getItem("cookingsim.theme");
  if (saved) { document.documentElement.dataset.theme = saved; updatePotTheme(saved === "light"); }
})();
