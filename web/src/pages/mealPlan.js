import { el, mount } from "../shared/dom.js";
import { t, createLangToggle, getLang } from "../shared/i18n.js";
import {
  CONDITION_IDS,
  buildLocalMealPlan,
  normalizeMealPlan,
} from "../shared/mealPlanPresets.js";
import { generateAiMealPlan } from "../shared/mealPlanAi.js";
import { fetchAiStatus } from "../shared/aiStatus.js";
import { calcDailyCalories } from "../shared/calorieCalc.js";
import { buildSitePageNav } from "../shared/sitePageNav.js";

const tp = (k, params) => t("mealPlan." + k, params);

function getThemeIcon() {
  return (document.documentElement.dataset.theme || localStorage.getItem("cookingsim.theme")) === "light"
    ? "🌙" : "☀️";
}

function toggleTheme() {
  const cur = document.documentElement.dataset.theme || localStorage.getItem("cookingsim.theme");
  const next = cur === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("cookingsim.theme", next);
  document.querySelectorAll("[data-meal-theme]").forEach((btn) => {
    btn.textContent = getThemeIcon();
  });
}

function formWantsWeightLoss(formEl) {
  return formEl.querySelector('[name="cond_weight_loss"]')?.checked === true;
}

function readForm(formEl) {
  const fd = new FormData(formEl);
  const conditions = CONDITION_IDS.filter((id) => fd.get("cond_" + id) === "on");
  const wantsWeightLoss = conditions.includes("weight_loss");
  const profile = {
    duration: fd.get("duration") === "month" ? "month" : "week",
    conditions: conditions.length ? conditions : ["general"],
    wants_weight_loss: wantsWeightLoss,
    age: fd.get("age") || "",
    sex: fd.get("sex") || "",
    activity: fd.get("activity") || "mid",
    allergies: fd.get("allergies") || "",
    dislikes: fd.get("dislikes") || "",
    notes: fd.get("notes") || "",
    useAi: fd.get("useAi") === "on",
    full_ai: fd.get("useAi") === "on",
    lang: getLang(),
  };

  if (wantsWeightLoss) {
    profile.height_cm = fd.get("height_cm") || "";
    profile.weight_current_kg = fd.get("weight_current_kg") || "";
    profile.weight_target_kg = fd.get("weight_target_kg") || "";
    profile.weeks_for_goal = fd.get("weeks_for_goal") || "";
    profile.meal_plan_duration = profile.duration;
    const calc = calcDailyCalories(profile, { weightLossOnly: true });
    if (!calc.error) {
      profile.calorie_plan = calc;
      profile.calorie_target = calc.daily_kcal;
    } else {
      profile.calorie_plan = null;
      const manual = fd.get("calorie_target");
      profile.calorie_target = manual ? Number(manual) : null;
    }
  } else {
    profile.calorie_plan = null;
    profile.calorie_target = null;
  }
  return profile;
}

function renderCalorieCard(host, calc) {
  host.innerHTML = "";
  if (!calc || calc.error) {
    const hintMap = {
      target_not_lower: tp("targetNotLower"),
      sex_required: tp("sexRequired"),
      invalid_age: tp("invalidAge"),
      invalid_current_weight: tp("calorieHintFill"),
      invalid_target_weight: tp("calorieHintFill"),
    };
    const hint = hintMap[calc?.error] || tp("calorieHintFill");
    host.appendChild(el("div", { class: "mealPlanCalorieCard mealPlanCalorieEmpty muted" }, [hint]));
    return;
  }
  const weekly = Math.abs(calc.weekly_kg_change);
  const goalKey = calc.goal === "lose" ? "goalLose" : calc.goal === "gain" ? "goalGain" : "goalKeep";
  host.appendChild(el("div", { class: "mealPlanCalorieCard" }, [
    el("div", { class: "mealPlanCalorieLabel" }, [tp("calorieInPlan")]),
    el("div", { class: "mealPlanCalorieMain" }, [
      el("span", { class: "mealPlanCalorieNum" }, [String(calc.daily_kcal)]),
      el("span", { class: "mealPlanCalorieUnit" }, [tp("kcalPerDay")]),
    ]),
    el("p", { class: "mealPlanCalorieGoal" }, [
      tp(goalKey, {
        w0: calc.weight_current_kg,
        w1: calc.weight_target_kg,
        weeks: calc.weeks_for_goal,
        weekly,
      }),
    ]),
    el("p", { class: "mealPlanCalorieMeta muted" }, [
      tp("calorieMeta", {
        bmr: calc.bmr,
        tdee: calc.tdee,
        adj: calc.daily_adjustment,
        act: calc.activity_factor || "—",
      }),
    ]),
    el("p", { class: "mealPlanCalorieMeta muted", style: "font-size:11px" }, [
      tp("calorieScienceNote"),
    ]),
    calc.weeks_manual
      ? el("p", { class: "mealPlanCalorieMeta muted", style: "font-size:11px" }, [tp("weeksManualNote")])
      : el("p", { class: "mealPlanCalorieMeta muted", style: "font-size:11px" }, [
        tp(calc.meal_plan_duration === "month" ? "weeksAutoMonth" : "weeksAutoWeek"),
      ]),
    calc.deficit_capped
      ? el("p", { class: "mealPlanCalorieWarn" }, [tp("deficitCappedNote")])
      : null,
  ].filter(Boolean)));
}

function mealTypeLabel(type) {
  return tp("mealTypes." + type) || type;
}

function renderPlan(plan, host) {
  host.innerHTML = "";
  if (!plan) {
    host.appendChild(el("div", { class: "mealPlanEmpty muted" }, [tp("empty")]));
    return;
  }

  host.appendChild(el("div", { class: "mealPlanResultHead" }, [
    el("h2", { class: "mealPlanResultTitle" }, [plan.title || tp("resultTitle")]),
    plan.calorie_plan?.daily_kcal
      ? el("div", { class: "mealPlanResultCalorie pill" }, [
        tp("calorieInPlan") + "：",
        el("strong", {}, [String(plan.calorie_plan.daily_kcal) + " " + tp("kcalPerDay")]),
      ])
      : null,
    plan.summary ? el("p", { class: "mealPlanResultSummary" }, [plan.summary]) : null,
    plan.aiGenerated
      ? el("span", { class: "pill mealPlanAiBadge" }, ["✨ AI · DeepSeek"])
      : el("span", { class: "pill" }, [tp("useAiHint")]),
  ].filter(Boolean)));

  if (plan.disclaimer) {
    host.appendChild(el("div", { class: "guideCallout guideCallout-warn mealPlanDisclaimer" }, [
      el("p", { class: "guideCalloutText" }, [plan.disclaimer]),
    ]));
  }

  const daysWrap = el("div", { class: "mealPlanDays" }, []);
  (plan.days || []).forEach((day) => {
    const mealsEl = el("div", { class: "mealPlanMeals" }, (day.meals || []).map((meal) =>
      el("div", { class: "mealPlanMeal" }, [
        el("span", { class: "mealPlanMealType" }, [mealTypeLabel(meal.type)]),
        el("strong", { class: "mealPlanMealName" }, [meal.name || tp("unnamedMeal")]),
        (() => {
          let items = meal.items;
          if (typeof items === "string") items = [items];
          if (!Array.isArray(items)) items = [];
          return items.length
            ? el("ul", { class: "mealPlanMealItems" }, items.map((it) => el("li", {}, [String(it)])))
            : null;
        })(),
        meal.note ? el("p", { class: "mealPlanMealNote muted" }, [meal.note]) : null,
        meal.calories_estimate != null
          ? el("span", { class: "mealPlanMealCal" }, [`~${meal.calories_estimate} kcal`])
          : null,
      ].filter(Boolean))
    ));
    daysWrap.appendChild(el("article", { class: "mealPlanDayCard" }, [
      el("header", { class: "mealPlanDayHead" }, [
        el("span", { class: "mealPlanDayNum" }, [tp("dayLabel", { n: day.day })]),
        el("span", { class: "mealPlanDayLabel" }, [day.label || ""]),
      ]),
      mealsEl,
    ]));
  });
  host.appendChild(daysWrap);

  if (plan.tips?.length) {
    host.appendChild(el("div", { class: "mealPlanTips" }, [
      el("h3", {}, ["💡"]),
      el("ul", {}, plan.tips.map((tip) => el("li", {}, [tip]))),
    ]));
  }

}

export function renderMealPlan(root) {
  root.innerHTML = "";
  root.className = "welcomeRoot mealPlanRoot";

  let currentPlan = null;

  const resultHost = el("div", { class: "mealPlanResultHost" }, []);
  const statusLine = el("div", { class: "mealPlanStatus muted" }, []);
  const aiCheckBox = el("div", { id: "mealPlanAiCheck", class: "mealPlanAiCheck mealPlanAiCheckPending" }, [tp("aiChecking")]);
  const aiProbeBtn = el("button", { type: "button", class: "btn mealPlanAiProbeBtn" }, [tp("aiProbeBtn")]);
  let aiReady = false;

  async function updateAiCheck(probe = true) {
    aiCheckBox.className = "mealPlanAiCheck mealPlanAiCheckPending";
    aiCheckBox.textContent = tp("aiChecking");
    aiProbeBtn.disabled = true;
    const { ok, data, error } = await fetchAiStatus(probe);
    aiProbeBtn.disabled = false;
    const st = data || {};
    if (ok && st.ok) {
      aiReady = true;
      aiCheckBox.className = "mealPlanAiCheck mealPlanAiCheckOk";
      aiCheckBox.textContent = st.message || tp("aiOk");
      return true;
    }
    aiReady = false;
    aiCheckBox.className = "mealPlanAiCheck mealPlanAiCheckErr";
    aiCheckBox.textContent = tp("aiStatusFail", { detail: st.error || error || "—" });
    const useAiInput = form.querySelector('input[name="useAi"]');
    if (useAiInput) useAiInput.checked = false;
    return false;
  }

  aiProbeBtn.onclick = () => updateAiCheck(true);

  const exportBtn = el("button", { type: "button", class: "btn", disabled: !currentPlan }, [tp("exportJson")]);

  exportBtn.onclick = () => {
    if (!currentPlan) return;
    const json = JSON.stringify(currentPlan, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      exportBtn.textContent = tp("copied");
      setTimeout(() => { exportBtn.textContent = tp("exportJson"); }, 2000);
    }).catch(() => window.prompt(tp("exportJson"), json));
  };

  const calorieCardHost = el("div", { id: "mealPlanCalorieCardHost", class: "mealPlanCalorieCardHost" }, []);

  const weightFieldset = el("fieldset", {
    class: "mealPlanFieldset mealPlanFieldsetHighlight mealPlanWeightSection",
    id: "mealPlanWeightSection",
    hidden: true,
  }, [
    el("legend", {}, [tp("weightSection")]),
    el("p", { class: "guideSectionSub", style: "margin:0 0 10px" }, [tp("weightSectionHint")]),
    el("div", { class: "mealPlanRow mealPlanRow3" }, [
      el("label", {}, [tp("height"), el("input", { class: "input", type: "number", name: "height_cm", min: "120", max: "230", placeholder: "170", value: "170" })]),
      el("label", {}, [tp("weightCurrent"), el("input", { class: "input", type: "number", name: "weight_current_kg", min: "30", max: "250", step: "0.1", placeholder: "70", value: "70" })]),
      el("label", {}, [tp("weightTarget"), el("input", { class: "input", type: "number", name: "weight_target_kg", min: "30", max: "250", step: "0.1", placeholder: "65", value: "65" })]),
    ]),
    el("label", {}, [tp("weeksForGoal"), el("input", { class: "input", type: "number", name: "weeks_for_goal", min: "2", max: "104", placeholder: tp("weeksForGoalPh") })]),
    el("button", { type: "button", class: "btn btnSuccess", id: "btnCalcCalories" }, [tp("calcCalories")]),
    calorieCardHost,
    el("label", {}, [tp("calorieOverride"), el("input", { class: "input", type: "number", name: "calorie_target", placeholder: tp("caloriePh") })]),
  ]);

  const form = el("form", { class: "mealPlanForm" }, [
    el("h2", { class: "guideSectionTitle" }, [tp("formTitle")]),
    el("p", { class: "guideSectionSub" }, [tp("formSub")]),
    el("div", { class: "mealPlanAiCheckRow" }, [aiCheckBox, aiProbeBtn]),

    el("div", { class: "mealPlanRow" }, [
      el("label", {}, [tp("age"), el("input", { class: "input", type: "number", name: "age", min: "14", max: "90", placeholder: "30", required: true })]),
      el("label", {}, [
        tp("sex"),
        el("select", { class: "input", name: "sex", required: true }, [
          el("option", { value: "" }, [tp("sexPick")]),
          el("option", { value: "M" }, [tp("sexM")]),
          el("option", { value: "F" }, [tp("sexF")]),
        ]),
      ]),
      el("label", {}, [
        tp("activity"),
        el("select", { class: "input", name: "activity" }, [
          el("option", { value: "low" }, [tp("actLow")]),
          el("option", { value: "mid", selected: true }, [tp("actMid")]),
          el("option", { value: "high" }, [tp("actHigh")]),
        ]),
      ]),
    ]),

    el("fieldset", { class: "mealPlanFieldset" }, [
      el("legend", {}, [tp("mealPlanDuration")]),
      el("p", { class: "guideSectionSub", style: "margin:0 0 8px;font-size:12px" }, [tp("mealPlanDurationHint")]),
      el("label", { class: "mealPlanRadio" }, [
        el("input", { type: "radio", name: "duration", value: "week", checked: true }),
        " " + tp("week"),
      ]),
      el("label", { class: "mealPlanRadio" }, [
        el("input", { type: "radio", name: "duration", value: "month" }),
        " " + tp("month"),
      ]),
    ]),

    el("fieldset", { class: "mealPlanFieldset" }, [
      el("legend", {}, [tp("conditions")]),
      el("div", { class: "mealPlanCondGrid" }, CONDITION_IDS.map((id) =>
        el("label", { class: "mealPlanCheck" }, [
          el("input", { type: "checkbox", name: "cond_" + id, ...(id === "general" ? { checked: true } : {}) }),
          " " + tp("cond." + id),
        ])
      )),
    ]),

    weightFieldset,

    el("label", {}, [tp("allergies"), el("input", { class: "input", name: "allergies", placeholder: tp("allergiesPh") })]),
    el("label", {}, [tp("dislikes"), el("input", { class: "input", name: "dislikes", placeholder: tp("dislikesPh") })]),
    el("label", {}, [tp("notes"), el("textarea", { class: "input mealPlanTextarea", name: "notes", rows: "3", placeholder: tp("notesPh") })]),

    el("label", { class: "mealPlanAiToggle" }, [
      el("input", { type: "checkbox", name: "useAi", checked: true }),
      el("span", {}, [" " + tp("useAi")]),
      el("small", { class: "muted" }, [tp("useAiHint")]),
    ]),

    el("button", { type: "submit", class: "btn btnPrimary mealPlanSubmit", id: "mealPlanSubmitBtn" }, [tp("generate")]),
  ]);

  function syncWeightSection() {
    const show = formWantsWeightLoss(form);
    weightFieldset.hidden = !show;
    if (!show) {
      calorieCardHost.innerHTML = "";
      statusLine.textContent = "";
      return;
    }
    tryRefreshCalories();
  }

  function tryRefreshCalories() {
    if (!formWantsWeightLoss(form)) return;
    const profile = readForm(form);
    renderCalorieCard(calorieCardHost, calcDailyCalories(profile, { weightLossOnly: true }));
  }

  const btnCalc = form.querySelector("#btnCalcCalories");
  if (btnCalc) btnCalc.onclick = (e) => { e.preventDefault(); tryRefreshCalories(); };

  form.querySelector('[name="cond_weight_loss"]')?.addEventListener("change", syncWeightSection);

  const recalcIfWeightLoss = () => {
    if (formWantsWeightLoss(form)) tryRefreshCalories();
  };

  ["height_cm", "weight_current_kg", "weight_target_kg", "weeks_for_goal", "age", "sex", "activity"].forEach((name) => {
    const input = form.querySelector(`[name="${name}"]`);
    if (!input) return;
    input.addEventListener("change", recalcIfWeightLoss);
    input.addEventListener("input", recalcIfWeightLoss);
  });

  form.querySelectorAll('input[name="duration"]').forEach((radio) => {
    radio.addEventListener("change", recalcIfWeightLoss);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    let profile = readForm(form);
    const submitBtn = form.querySelector("#mealPlanSubmitBtn");
    if (profile.wants_weight_loss && !profile.calorie_plan?.daily_kcal) {
      tryRefreshCalories();
      profile = readForm(form);
      if (!profile.calorie_plan?.daily_kcal) {
        statusLine.textContent = tp("calorieRequired");
        return;
      }
    }
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = tp("generating"); }

    let waitTimer = null;
    try {
      if (profile.useAi && !aiReady) {
        const ok = await updateAiCheck(true);
        if (!ok) {
          statusLine.textContent = tp("aiNotConfigured");
          return;
        }
      }

      const startedAt = Date.now();
      function refreshWaitText() {
        const days = profile.duration === "month" ? 30 : 7;
        const base = profile.useAi ? tp("aiGeneratingFull", { days }) : tp("generating");
        statusLine.textContent = profile.useAi
          ? base + " " + tp("aiWait", { s: Math.floor((Date.now() - startedAt) / 1000) })
          : base;
      }
      refreshWaitText();
      if (profile.useAi) waitTimer = setInterval(refreshWaitText, 1000);

      resultHost.innerHTML = "";
      resultHost.appendChild(el("div", {
        class: "mealPlanLoading skeleton",
        style: "padding:24px;text-align:center;color:var(--text-dim)",
      }, [statusLine.textContent]));

      let plan = null;
      let err = null;

      if (profile.useAi) {
        const res = await generateAiMealPlan(profile);
        if (res.error) {
          err = res.error;
          plan = buildLocalMealPlan(profile, t);
          plan.summary = tp("error", { detail: err }) + " · " + tp("aiFullFailHint");
        } else {
          plan = res.plan;
          if (res.warning) {
            statusLine.textContent = tp("aiWarning");
            plan.summary = tp("aiWarningShort") + (plan.summary ? " · " + plan.summary : "");
          }
        }
      } else {
        plan = buildLocalMealPlan(profile, t);
      }

      plan = normalizeMealPlan(plan, profile, t);
      if (err) {
        statusLine.textContent = tp("error", { detail: err });
      } else if (profile.useAi) {
        statusLine.textContent = statusLine.textContent || tp("aiDoneFull");
      }

      currentPlan = plan;
      exportBtn.disabled = false;
      renderPlan(plan, resultHost);
    } finally {
      if (waitTimer) clearInterval(waitTimer);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = tp("generate");
      }
    }
  });

  const sidebar = el("aside", { class: "guideSidebar guideReveal is-visible" }, [
    el("a", { href: "#/", class: "guideSidebarLogo" }, ["🦊", el("span", {}, ["狐闹厨房"])]),
    buildSitePageNav("meal"),
    el("div", { class: "guideSidebarCta" }, [
      el("a", { href: "#/", class: "btn", style: "width:100%;text-align:center" }, [tp("backGuide")]),
      el("a", { href: "#/kitchen", class: "btn btnPrimary", style: "width:100%;text-align:center;margin-top:8px" }, ["🍳 ", tp("toKitchen")]),
    ]),
  ]);

  const main = el("main", { class: "guideMain mealPlanMain" }, [
    el("header", { class: "guideTopBar" }, [
      el("span", { class: "guideTopBarTitle" }, [tp("pageTitle")]),
      el("div", { class: "guideTopBarActions" }, [
        createLangToggle({ style: "padding:9px 12px;font-weight:600;min-width:44px" }),
        el("button", { type: "button", class: "btn", "data-meal-theme": "1", onclick: toggleTheme }, [getThemeIcon()]),
        exportBtn,
        el("a", { href: "#/kitchen", class: "btn btnPrimary" }, [tp("toKitchen")]),
      ]),
    ]),
    el("section", { class: "mealPlanHero guideReveal is-visible" }, [
      el("span", { class: "guideHeroBadge" }, [tp("heroBadge")]),
      el("h1", { class: "guideHeroTitleXL" }, [tp("heroTitle")]),
      el("p", { class: "guideHeroLead" }, [tp("pageSub")]),
    ]),
    el("p", { class: "guideHeroLead", style: "margin:-8px 0 20px" }, [tp("heroLead")]),
    el("div", { class: "mealPlanLayout" }, [
      el("div", { class: "mealPlanFormCol" }, [form, statusLine]),
      el("div", { class: "mealPlanResultCol" }, [
        el("h2", { class: "guideSectionTitle" }, [tp("resultTitle")]),
        resultHost,
      ]),
    ]),
  ]);

  mount(root, el("div", { class: "guideLayout" }, [sidebar, main]));
  updateAiCheck(true);
  syncWeightSection();
  renderPlan(currentPlan, resultHost);
}
