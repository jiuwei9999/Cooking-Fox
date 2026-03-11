import { api } from "../services/api.js";
import { fmtAction, pct, round1 } from "../shared/format.js";
import { el, mount } from "../shared/dom.js";

let state = {
  session: null,
  busy: false,
  selectedIngredient: "egg",
  amountG: 50,
  heatMethod: "stir_fry",
  targetTempC: 160,
  durationS: 30,
  mixIntensity: 0.6,
  cutStyle: "chop",
  particleMm: 8,
  suggestion: "",
};

export async function renderKitchen(root) {
  root.innerHTML = "";

  const header = el("div", { class: "panelHeader" }, [
    el("h2", {}, ["KitchenSandBox"]),
    el("div", { class: "row" }, [
      el(
        "a",
        { href: "#/recipes", class: "btn", style: "text-decoration:none" },
        ["RecipeLab"]
      ),
      el(
        "button",
        { class: "btn btnPrimary", onclick: () => newSession() },
        ["新建会话"]
      ),
    ]),
  ]);

  const left = el("div", { class: "panel" }, [
    el("div", { class: "panelHeader" }, [el("h2", {}, ["食材/调料库"]), el("span", { class: "tag" }, ["MVP"]) ]),
    el("div", { class: "panelBody" }, [
      el("div", { id: "ingredientList", class: "ingredientList" }, []),
      el("div", { class: "hr" }),
      el("div", { class: "muted" }, ["锅内清单（便于新手复盘）"]),
      el("div", { id: "potList", class: "ingredientList" }, []),
    ]),
  ]);

  const center = el("div", { class: "panel kitchenCenter" }, [
    header,
    el("div", { class: "potView" }, [
      el("div", { class: "pot" }, [
        el("div", { class: "potBubble" }, []),
        el("div", { class: "potTop" }, [
          el("span", { class: "pill", id: "potSummary" }, ["还没有开始"]),
          el("span", { class: "pill", id: "tempPill" }, ["25°C"]),
        ]),
      ]),
    ]),
    el("div", { class: "panelBody" }, [
      el("div", { class: "metricBars", id: "metrics" }, []),
      el("div", { class: "hr" }),
      el("div", { id: "suggestion", class: "muted" }, ["根据当前锅内状态给出下一步建议…"]),
    ]),
  ]);

  const right = el("div", { class: "panel" }, [
    el("div", { class: "panelHeader" }, [el("h2", {}, ["操作"]), el("span", { id: "busy", class: "tag" }, ["ready"]) ]),
    el("div", { class: "panelBody" }, [
      el("div", { class: "col" }, [
        el("div", { id: "targetRecipe" }, []),
        renderActionForm(),
        el("div", { class: "hr" }),
        el("div", { class: "row" }, [
          el("button", { class: "btn", onclick: () => doTaste() }, ["尝味"]),
          el("button", { class: "btn btnDanger", onclick: () => doServe() }, ["出锅报告"]),
        ]),
        el("div", { class: "hr" }),
        el("div", { class: "timeline", id: "timeline" }, []),
      ]),
    ]),
  ]);

  mount(root, el("div", { class: "app" }, [left, center, right]));

  await ensureSession();
  rerenderAll();
}

function renderActionForm() {
  const select = el("select", {
    class: "input",
    onchange: (e) => {
      state.selectedIngredient = e.target.value;
      rerenderAll();
    },
  });

  const amount = el("input", {
    class: "input",
    type: "number",
    min: "0",
    step: "0.1",
    value: String(state.amountG),
    oninput: (e) => (state.amountG = Number(e.target.value || 0)),
  });

  const addBtn = el("button", { class: "btn btnPrimary", onclick: () => doAdd() }, ["加入锅里"]);

  const cutStyle = el(
    "select",
    {
      class: "input",
      onchange: (e) => (state.cutStyle = e.target.value),
    },
    [
      el("option", { value: "chop" }, ["切段/粗切"]),
      el("option", { value: "dice" }, ["切丁"]),
      el("option", { value: "slice" }, ["切片"]),
      el("option", { value: "mince" }, ["剁碎/切末"]),
    ]
  );
  cutStyle.value = state.cutStyle;

  const particle = el("input", {
    class: "input",
    type: "number",
    min: "1",
    step: "1",
    value: String(state.particleMm),
    oninput: (e) => (state.particleMm = Number(e.target.value || 8)),
  });
  const cutBtn = el("button", { class: "btn", onclick: () => doCut() }, ["对锅内食材切配"]);

  const heatMethod = el(
    "select",
    { class: "input", onchange: (e) => (state.heatMethod = e.target.value) },
    [
      el("option", { value: "stir_fry" }, ["炒/煸"]),
      el("option", { value: "pan_fry" }, ["煎"]),
      el("option", { value: "boil" }, ["煮"]),
      el("option", { value: "steam" }, ["蒸"]),
      el("option", { value: "bake" }, ["烤"]),
    ]
  );
  heatMethod.value = state.heatMethod;

  const temp = el("input", {
    class: "input",
    type: "number",
    min: "25",
    step: "5",
    value: String(state.targetTempC),
    oninput: (e) => (state.targetTempC = Number(e.target.value || 160)),
  });
  const dur = el("input", {
    class: "input",
    type: "number",
    min: "1",
    step: "1",
    value: String(state.durationS),
    oninput: (e) => (state.durationS = Number(e.target.value || 30)),
  });
  const heatBtn = el("button", { class: "btn", onclick: () => doHeat() }, ["加热"]);

  const mixInt = el("input", {
    class: "input",
    type: "number",
    min: "0",
    max: "1",
    step: "0.1",
    value: String(state.mixIntensity),
    oninput: (e) => (state.mixIntensity = Number(e.target.value || 0)),
  });
  const mixBtn = el("button", { class: "btn", onclick: () => doMix() }, ["搅拌"]);

  return el("div", { class: "col" }, [
    el("div", { class: "pill" }, ["不会操作？先点“新建会话”，再从左侧选食材加入。任何顺序都可以。"]),
    el("div", { class: "grid2" }, [
      el("div", { class: "col" }, [el("div", { class: "muted" }, ["选择食材"]), select]),
      el("div", { class: "col" }, [el("div", { class: "muted" }, ["加入量(g)"]), amount]),
    ]),
    addBtn,
    el("div", { class: "hr" }),
    el("div", { class: "grid2" }, [
      el("div", { class: "col" }, [el("div", { class: "muted" }, ["切法"]), cutStyle]),
      el("div", { class: "col" }, [el("div", { class: "muted" }, ["颗粒(mm)"]), particle]),
    ]),
    cutBtn,
    el("div", { class: "hr" }),
    el("div", { class: "grid2" }, [
      el("div", { class: "col" }, [el("div", { class: "muted" }, ["方式"]), heatMethod]),
      el("div", { class: "col" }, [el("div", { class: "muted" }, ["目标温度(°C)"]), temp]),
    ]),
    el("div", { class: "col" }, [el("div", { class: "muted" }, ["持续(s)"]), dur]),
    heatBtn,
    el("div", { class: "hr" }),
    el("div", { class: "col" }, [el("div", { class: "muted" }, ["搅拌强度(0-1)"]), mixInt]),
    mixBtn,
  ]);
}

async function ensureSession() {
  if (state.session) return;
  const data = await api.newSession();
  state.session = data.session;
}

async function newSession() {
  setBusy(true);
  try {
    const data = await api.newSession();
    state.session = data.session;
    rerenderAll();
  } finally {
    setBusy(false);
  }
}

function setBusy(v) {
  state.busy = v;
  const b = document.getElementById("busy");
  if (b) b.textContent = v ? "working" : "ready";
}

async function doStep(action) {
  if (!state.session) return;
  setBusy(true);
  try {
    const data = await api.step(state.session.id, action);
    if (data.error) {
      alert(data.error);
      return;
    }
    state.session = data.session;
    rerenderAll();
  } finally {
    setBusy(false);
  }
}

async function doAdd() {
  return doStep({ type: "add", ingredient_id: state.selectedIngredient, amount_g: Number(state.amountG) });
}
async function doCut() {
  return doStep({ type: "cut", cut_style: state.cutStyle, particle_mm: Number(state.particleMm) });
}
async function doHeat() {
  const t = Number(state.targetTempC);
  const d = Number(state.durationS);
  const safeT = Math.max(25, Math.min(260, t));
  const safeD = Math.max(1, Math.min(900, d));
  if (safeT !== t || safeD !== d) {
    alert("已自动把温度/时间修正到合理范围（防呆）。");
  }
  return doStep({ type: "heat", heat_method: state.heatMethod, target_temp_c: safeT, duration_s: safeD });
}
async function doMix() {
  const i = Math.max(0, Math.min(1, Number(state.mixIntensity)));
  return doStep({ type: "mix", mix_intensity: i, duration_s: 10 });
}
async function doTaste() {
  return doStep({ type: "taste" });
}
async function doServe() {
  if (!state.session) return;
  const m = state.session.metrics;
  const taste = m.taste;
  const msg =
    `出锅报告\\n\\n` +
    `温度: ${round1(m.temp_c)}°C\\n熟度: ${pct(m.doneness)}\\n焦香/上色: ${pct(m.browning)}\\n糊底风险: ${pct(m.burn_risk)}\\n\\n` +
    `咸:${pct(taste.salty)} 甜:${pct(taste.sweet)} 酸:${pct(taste.sour)} 辣:${pct(taste.spicy)} 鲜:${pct(taste.umami)} 香:${pct(taste.aroma)} 苦:${pct(taste.bitter)}\\n\\n` +
    `提示：打开右侧时间线可复盘每一步的原因。\\n\\n` +
    `如需保存实验结果，点击“确定”后会弹出本次烹饪的 JSON，复制即可。`;
  const ok = window.confirm(msg);
  if (!ok) return;
  const exportPayload = {
    id: state.session.id,
    name: state.session.name,
    metrics: state.session.metrics,
    timeline: state.session.timeline,
    pot: state.session.pot,
  };
  const json = JSON.stringify(exportPayload, null, 2);
  window.prompt("本次烹饪的 JSON（可复制保存为实验记录）:", json);
}

function rerenderAll() {
  if (!state.session) return;

  renderTargetRecipeCard();

  const ingList = document.getElementById("ingredientList");
  const select = document.querySelector("select.input");
  if (select && select.tagName === "SELECT") {
    // no-op
  }

  // Ingredient list + populate dropdown
  if (ingList) {
    ingList.innerHTML = "";
    const ingredients = Object.values(state.session.ingredients || {});
    const dropdowns = Array.from(document.querySelectorAll("select.input"));
    const firstSelect = dropdowns[0];
    if (firstSelect && firstSelect.tagName === "SELECT") {
      firstSelect.innerHTML = "";
      ingredients.forEach((ing) => {
        const opt = document.createElement("option");
        opt.value = ing.id;
        opt.textContent = `${ing.name} (${ing.id})`;
        firstSelect.appendChild(opt);
      });
      firstSelect.value = state.selectedIngredient;
    }

    ingredients.forEach((ing) => {
      const row = el("div", { class: "ingredientItem" }, [
        el("div", {}, [el("strong", {}, [ing.name]), el("div", {}, [el("small", {}, [ing.id])])]),
        el("button", { class: "btn", onclick: () => doQuickAdd(ing.id) }, ["+10g"]),
      ]);
      ingList.appendChild(row);
    });
  }

  const potList = document.getElementById("potList");
  if (potList) {
    potList.innerHTML = "";
    const counts = new Map();
    for (const p of state.session.pot || []) {
      const k = p.ingredient_id;
      counts.set(k, (counts.get(k) || 0) + Number(p.amount_g || 0));
    }
    if (counts.size === 0) {
      potList.appendChild(el("div", { class: "muted" }, ["（空）"]));
    } else {
      for (const [id, amt] of counts.entries()) {
        const name = state.session.ingredients?.[id]?.name || id;
        potList.appendChild(
          el("div", { class: "ingredientItem" }, [
            el("div", {}, [el("strong", {}, [name]), el("div", {}, [el("small", {}, [id])])]),
            el("span", { class: "tag" }, [`${round1(amt)}g`]),
          ])
        );
      }
    }
  }

  const potSummary = document.getElementById("potSummary");
  if (potSummary) {
    const count = (state.session.pot || []).length;
    potSummary.textContent = count ? `锅里：${count}份食材` : "锅里空空的";
  }
  const tempPill = document.getElementById("tempPill");
  if (tempPill) tempPill.textContent = `${round1(state.session.metrics.temp_c)}°C`;

  const metricsEl = document.getElementById("metrics");
  if (metricsEl) {
    metricsEl.innerHTML = "";
    metricsEl.appendChild(renderBars(state.session.metrics));
  }

  const suggEl = document.getElementById("suggestion");
  if (suggEl) {
    suggEl.textContent = buildSuggestion(state.session);
  }

  const timeline = document.getElementById("timeline");
  if (timeline) {
    timeline.innerHTML = "";
    const events = state.session.timeline || [];
    [...events].slice(-40).reverse().forEach((ev, idx) => {
      const title = fmtAction(ev.action);
      const when = `#${events.length - idx}`;
      const notes = (ev.notes || []).join("\\n");
      timeline.appendChild(
        el("div", { class: "event" }, [
          el("div", { class: "eventTitle" }, [el("strong", {}, [title]), el("span", {}, [when])]),
          notes ? el("div", { class: "eventNotes" }, [notes]) : el("div", { class: "eventNotes" }, ["—"]),
        ])
      );
    });
  }
}

function renderTargetRecipeCard() {
  const host = document.getElementById("targetRecipe");
  if (!host) return;
  host.innerHTML = "";
  const raw = localStorage.getItem("cookingsim.targetRecipe");
  if (!raw) {
    host.appendChild(el("div", { class: "pill" }, ["未选择目标菜谱。你可以去 RecipeLab 选择一个练习菜谱作为目标（不强制按步骤）。"]));
    return;
  }
  let recipe = null;
  try {
    recipe = JSON.parse(raw);
  } catch {
    localStorage.removeItem("cookingsim.targetRecipe");
    host.appendChild(el("div", { class: "pill" }, ["目标菜谱数据已损坏，已清除。"]));
    return;
  }
  const title = recipe?.title || recipe?.id || "目标菜谱";
  const items = recipe?.ingredients || [];
  host.appendChild(
    el("div", { class: "panel", style: "border-radius:12px" }, [
      el("div", { class: "panelHeader" }, [
        el("h2", {}, ["目标：", title].join("")),
        el("button", { class: "btn", onclick: () => clearTargetRecipe() }, ["清除"]),
      ]),
      el("div", { class: "panelBody" }, [
        el("div", { class: "muted" }, ["配料清单（可一键加料，不会限制你的顺序）"]),
        el(
          "div",
          { class: "ingredientList", style: "margin-top:10px" },
          items.map((it) =>
            el("div", { class: "ingredientItem" }, [
              el("div", {}, [el("strong", {}, [it.name || it.ingredient_id || "?"]), el("div", {}, [el("small", {}, [it.ingredient_id || ""])])]),
              el("button", { class: "btn btnPrimary", onclick: () => addRecipeItem(it) }, [`+${round1(it.amount_g || 0)}g`]),
            ])
          )
        ),
      ]),
    ])
  );
}

function clearTargetRecipe() {
  localStorage.removeItem("cookingsim.targetRecipe");
  rerenderAll();
}

async function addRecipeItem(it) {
  if (!it?.ingredient_id) return;
  state.selectedIngredient = it.ingredient_id;
  state.amountG = Number(it.amount_g || 0);
  rerenderAll();
  return doAdd();
}

async function doQuickAdd(ingredientId) {
  state.selectedIngredient = ingredientId;
  state.amountG = 10;
  rerenderAll();
  return doAdd();
}

function renderBars(m) {
  const wrap = el("div", { class: "metricBars" }, []);
  wrap.appendChild(bar("熟度", m.doneness, false));
  wrap.appendChild(bar("焦香/上色", m.browning, false));
  wrap.appendChild(bar("糊底风险", m.burn_risk, true));
  wrap.appendChild(bar("乳化/浓稠", m.emulsion, false));
  wrap.appendChild(el("div", { class: "hr" }));
  wrap.appendChild(bar("咸", m.taste.salty, false));
  wrap.appendChild(bar("酸", m.taste.sour, false));
  wrap.appendChild(bar("甜", m.taste.sweet, false));
  wrap.appendChild(bar("辣", m.taste.spicy, false));
  wrap.appendChild(bar("鲜(旨味)", m.taste.umami, false));
  wrap.appendChild(bar("香气", m.taste.aroma, false));
  wrap.appendChild(bar("苦味风险", m.taste.bitter, true));
  return wrap;
}

function bar(label, v, danger) {
  const pctV = Math.round(Math.max(0, Math.min(1, v)) * 100);
  return el("div", { class: "col" }, [
    el("div", { class: "barLabel" }, [el("span", {}, [label]), el("span", {}, [`${pctV}%`])]),
    el("div", { class: "barTrack" }, [
      el("div", { class: `barFill ${danger ? "barFillDanger" : ""}`, style: `width:${pctV}%` }, []),
    ]),
  ]);
}

function buildSuggestion(session) {
  const m = session.metrics || {};
  const taste = m.taste || {};
  const steps = session.timeline || [];
  const last = steps[steps.length - 1]?.action?.type;

  // 简单规则引擎：根据当前状态给 1 条人话建议。
  if (!steps.length) {
    return "建议：先从左侧选择一种主食材（如鸡蛋/番茄/大米）加入锅中，再逐步加水/油/调味。";
  }

  if ((session.pot || []).length === 0) {
    return "锅里是空的，可以先加一点水或油，再加入食材。";
  }

  if (m.temp_c < 40 && last !== "heat") {
    return "锅温较低，可以先选择合适的加热方式（比如炒/煎/煮）和温度时间，加热一次。";
  }

  if (m.burn_risk > 0.7) {
    return "糊底风险偏高，建议立刻调低温度或短时间加点水/翻炒，避免烧糊。";
  }

  if (taste.salty > 0.8) {
    return "咸度已经很高，后续尽量不要再加盐/生抽，可以适当加水或无盐食材稀释。";
  }

  if (taste.salty < 0.2 && taste.umami > 0.3 && last === "heat") {
    return "整体偏淡，可以在关火前或出锅前少量多次地补一点盐/生抽，并随时“尝味”。";
  }

  if (m.doneness < 0.3 && last === "heat") {
    return "熟度偏低，可以继续加热一小段时间；注意不要一次把时间拉太长，建议多次少量加热并中间“尝味”。";
  }

  if (m.doneness > 0.9 && m.browning < 0.2 && m.burn_risk < 0.4) {
    return "熟度已经接近完成，如果想要更多焦香，可以短时间中火/大火加热，关注上色变化。";
  }

  if (last === "taste") {
    return "可以根据刚才的尝味结果，选择微调调味（盐/糖/酸/辣），或直接“出锅报告”看整体评价。";
  }

  return "状态较平衡，可以根据自己的想法继续加料、调味或“尝味”，也可以直接出锅查看报告。";
}

