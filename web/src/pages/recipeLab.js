import { api } from "../services/api.js";
import { el, mount } from "../shared/dom.js";
import { t, createLangToggle } from "../shared/i18n.js";
import {
  difficultyLabel,
  featureLabel,
  difficultyBadgeClass,
  sortRecipesByDifficulty,
} from "../shared/recipeMeta.js";

let exampleFilter = "all";
let cachedExamples = [];

export async function renderRecipeLab(root) {
  root.innerHTML = "";

  const header = el("div", { class: "panelHeader" }, [
    el("h2", {}, [t("recipeLab.title")]),
    el("div", { class: "row" }, [
      el("a", { href: "#/", class: "btn", style: "text-decoration:none" }, [t("nav.home")]),
      createLangToggle({ style: "padding:6px 10px;font-weight:600" }),
      el("a", { href: "#/kitchen", class: "btn btnPrimary", style: "text-decoration:none" }, [t("nav.backKitchen")]),
    ]),
  ]);

  const left = el("div", { class: "panel" }, [
    el("div", { class: "panelHeader" }, [
      el("h2", {}, [t("recipeLab.examples")]),
      el("span", { class: "tag", id: "exampleCountTag" }, [t("nav.loading")]),
    ]),
    el("div", { class: "muted", style: "padding:0 12px 8px;font-size:12px" }, [
      t("recipeLab.examplesHint"),
    ]),
    el("div", { class: "recipeDiffFilters", id: "recipeDiffFilters", style: "padding:0 12px 8px;display:flex;flex-wrap:wrap;gap:4px" }, []),
    el("div", { class: "panelBody" }, [
      el("div", { id: "examples", class: "ingredientList recipeLabList" }, [t("nav.loading")]),
    ]),
  ]);

  const importPanel = el("div", { class: "panel" }, [
    header,
    el("div", { class: "panelBody" }, [
      el("div", { class: "recipeGuideBox" }, [
        el("strong", {}, [t("recipeLab.importTitle")]),
        el("ul", { class: "recipeGuideList" }, [
          el("li", {}, [t("recipeLab.importLi1")]),
          el("li", {}, [t("recipeLab.importLi2")]),
          el("li", {}, [t("recipeLab.importLi3")]),
          el("li", {}, [t("recipeLab.importLi4")]),
        ]),
      ]),
      el("div", { class: "hr" }),
      renderImportForm(),
    ]),
  ]);

  const right = el("div", { class: "panel" }, [
    el("div", { class: "panelHeader" }, [
      el("h2", {}, [t("recipeLab.myRecipes")]),
      el("span", { class: "tag" }, [t("recipeLab.localStorage")]),
    ]),
    el("div", { class: "panelBody" }, [
      el("div", { id: "userRecipes", class: "ingredientList recipeLabList" }, [t("nav.loading")]),
    ]),
  ]);

  mount(root, el("div", { class: "app recipeLabApp" }, [left, importPanel, right]));

  const examplesEl = document.getElementById("examples");
  const countTag = document.getElementById("exampleCountTag");
  const filtersEl = document.getElementById("recipeDiffFilters");
  try {
    const data = await api.exampleRecipes();
    cachedExamples = sortRecipesByDifficulty(data.recipes || []);
    if (countTag) countTag.textContent = t("recipeLab.count", { n: cachedExamples.length });
    renderDifficultyFilters(filtersEl, () => renderExampleList(examplesEl));
    renderExampleList(examplesEl);
  } catch (e) {
    if (examplesEl) examplesEl.textContent = t("recipeLab.loadFail");
    if (countTag) countTag.textContent = "—";
  }

  const userEl = document.getElementById("userRecipes");
  try {
    const data = await api.userRecipes();
    const recipes = data.recipes || [];
    if (userEl) {
      userEl.innerHTML = "";
      if (!recipes.length) {
        userEl.appendChild(
          el("div", { class: "muted", style: "padding:12px" }, [
            t("recipeLab.noUserRecipes"),
          ])
        );
      } else {
        recipes.forEach((r) => userEl.appendChild(recipeCard(r)));
      }
    }
  } catch (e) {
    if (userEl) userEl.textContent = t("recipeLab.userLoadFail");
  }
}

function renderDifficultyFilters(host, onChange) {
  if (!host) return;
  host.innerHTML = "";
  const counts = { all: cachedExamples.length };
  cachedExamples.forEach((r) => {
    const d = r.difficulty || "medium";
    counts[d] = (counts[d] || 0) + 1;
  });
  const mk = (id, label) =>
    el("button", {
      class: "btn recipeDiffFilter" + (exampleFilter === id ? " recipeDiffFilterActive" : ""),
      style: "padding:4px 10px;font-size:11px",
      onclick: () => {
        exampleFilter = id;
        onChange();
        renderDifficultyFilters(host, onChange);
      },
    }, [label]);
  host.appendChild(mk("all", `${t("difficulty.all")} ${counts.all}`));
  ["easy", "medium", "hard", "expert"].forEach((d) => {
    if (counts[d]) host.appendChild(mk(d, `${difficultyLabel(d)} ${counts[d]}`));
  });
}

function renderExampleList(host) {
  if (!host) return;
  host.innerHTML = "";
  const list =
    exampleFilter === "all"
      ? cachedExamples
      : cachedExamples.filter((r) => (r.difficulty || "medium") === exampleFilter);
  if (!list.length) {
    host.appendChild(el("div", { class: "muted", style: "padding:12px" }, [t("recipeLab.noExamplesDiff")]));
    return;
  }
  list.forEach((r) => host.appendChild(recipeCard(r)));
}

function recipeCard(r) {
  const ingN = (r.ingredients || []).length;
  const stepN = (r.steps || []).length;
  const diff = r.difficulty || "medium";
  const diffLabel = r.difficulty_label || difficultyLabel(diff);
  const feats = r.features || [];
  const hints = (r.prep_hints || []).slice(0, 2);

  const titleRow = el("div", { style: "display:flex;align-items:center;gap:8px;flex-wrap:wrap" }, [
    el("div", { class: "recipeTitle", style: "margin:0" }, [r.title || r.id]),
    el("span", { class: difficultyBadgeClass(diff) }, [diffLabel]),
  ]);

  const featRow =
    feats.length > 0
      ? el("div", { class: "recipeFeatureTags", style: "margin:6px 0" }, feats.map((f) =>
          el("span", { class: "tag tagEst", style: "margin:2px 4px 2px 0;font-size:10px" }, [
            featureLabel(f),
          ])
        ))
      : null;

  const hintRow =
    hints.length > 0
      ? el("div", { class: "muted", style: "font-size:10px;line-height:1.45;margin:4px 0" }, [
          hints.map((h, i) => (i ? " · " : "") + h).join(""),
        ])
      : null;

  return el("div", { class: "recipeCard" }, [
    titleRow,
    el("div", { class: "recipeDesc" }, [
      t("recipeLab.ingKinds", { n: ingN }),
      stepN ? t("recipeLab.stepCount", { n: stepN }) : t("recipeLab.noSteps"),
    ]),
    featRow,
    hintRow,
    el("div", { class: "recipeActions" }, [
      el("button", { class: "btn btnSuccess", onclick: () => loadAsGuide(r) }, [t("recipeLab.setTarget")]),
    ]),
  ].filter(Boolean));
}

function loadAsGuide(recipe) {
  localStorage.setItem("cookingsim.targetRecipe", JSON.stringify(recipe));
  const g = recipe.guide || {};
  const diffLabel = recipe.difficulty_label || difficultyLabel(recipe.difficulty) || "";
  let msg = t("recipeLab.setTargetOk");
  if (diffLabel) msg = `【${diffLabel}】${msg}`;
  if (g.estimated_amounts) msg += `\n（含 ${g.estimated_amounts} 项推荐用量）`;
  if (g.steps_suggested) msg += "\n（步骤为系统参考，可自由发挥）";
  if ((g.prep_hints || recipe.prep_hints || []).length) {
    msg += "\n" + t("recipeLab.setTargetPrep");
  }
  alert(msg);
}

function renderImportForm() {
  const text = el("textarea", {
    class: "input",
    rows: 12,
    placeholder:
      "示例（可只写菜名+食材名，不写克数）：\n番茄炒蛋\n\n用料：\n鸡蛋\n番茄\n盐\n油\n\n做法：\n（可留空，系统会猜步骤）",
    style: "resize:vertical;min-height:160px",
  });
  const preview = el("div", { class: "recipePreviewHost" }, []);
  const btnParse = el(
    "button",
    {
      class: "btn btnWarn",
      onclick: async () => {
        preview.innerHTML = "";
        preview.appendChild(el("div", { class: "muted pulse", style: "padding:12px" }, ["解析中…"]));
        try {
          const { recipe } = await api.importRecipe(text.value || "");
          if (!recipe) {
            preview.innerHTML = "";
            preview.appendChild(
              el("div", { class: "muted", style: "padding:12px" }, ["解析失败，请检查文本格式。"])
            );
            return;
          }
          renderPreview(preview, recipe);
        } catch (e) {
          preview.innerHTML = "";
          preview.appendChild(
            el("div", { class: "muted", style: "padding:12px" }, ["解析失败，请检查网络或后端是否启动。"])
          );
        }
      },
    },
    ["解析并生成指引"]
  );
  return el("div", { class: "col" }, [
    text,
    el("div", { class: "row", style: "margin-top:8px" }, [btnParse]),
    el("div", { class: "hr" }),
    el("div", { class: "muted", style: "font-size:12px" }, ["解析结果"]),
    preview,
  ]);
}

function renderPreview(host, recipe) {
  host.innerHTML = "";
  const guide = recipe.guide || {};
  const warnings = recipe.warnings || [];

  if ((guide.tips || []).length) {
    const box = el("div", { class: "recipeGuideBox recipeGuideBoxHighlight" }, [
      el("strong", {}, ["导入指引"]),
    ]);
    const ul = el("ul", { class: "recipeGuideList" }, []);
    (guide.tips || []).forEach((t) => ul.appendChild(el("li", {}, [t])));
    box.appendChild(ul);
    if (guide.ready_for_kitchen === false) {
      box.appendChild(
        el("div", { class: "muted", style: "margin-top:8px;font-size:11px" }, [
          "部分食材未匹配系统库，设为目标后请在厨房手动选对食材。",
        ])
      );
    }
    host.appendChild(box);
  }

  if (warnings.length) {
    host.appendChild(
      el("div", { class: "eventNotes", style: "color:var(--gold);padding:8px;margin-top:8px;font-size:12px" }, [
        warnings.join("\n"),
      ])
    );
  }

  const diff = recipe.difficulty || guide.difficulty || "medium";
  const diffLabel = recipe.difficulty_label || guide.difficulty_label || difficultyLabel(diff);

  const card = el("div", { class: "recipeCard", style: "margin-top:10px" }, [
    el("div", { style: "display:flex;align-items:center;gap:8px;flex-wrap:wrap" }, [
      el("div", { class: "recipeTitle", style: "margin:0" }, [recipe.title || recipe.id]),
      el("span", { class: difficultyBadgeClass(diff) }, [diffLabel]),
    ]),
    el("div", { class: "recipeDesc" }, [
      `${(recipe.ingredients || []).length} 种原料 / ${(recipe.steps || []).length} 步`,
      guide.steps_suggested ? " · 参考步骤" : "",
      guide.estimated_amounts ? ` · ${guide.estimated_amounts} 项推荐用量` : "",
    ]),
    el("div", { class: "muted", style: "font-size:11px;margin:8px 0" }, ["用料（点击保存后可在厨房一键添加）"]),
    el(
      "div",
      { class: "ingredientList", style: "margin-top:4px" },
      (recipe.ingredients || []).map((it) => ingredientPreviewRow(it))
    ),
  ]);

  const prepBlock = renderPrepHintsBlock(recipe, guide);
  if (prepBlock) card.appendChild(prepBlock);

  const stepsBlock = renderStepsBlock(recipe, guide);
  if (stepsBlock) card.appendChild(stepsBlock);

  card.appendChild(
    el("div", { class: "row", style: "margin-top:12px;flex-wrap:wrap;gap:8px" }, [
      el(
        "button",
        {
          class: "btn btnPrimary",
          onclick: async () => {
            await api.saveRecipe(recipe);
            alert("已保存到「我的菜谱」。");
            location.reload();
          },
        },
        ["保存为我的菜谱"]
      ),
      el(
        "button",
        {
          class: "btn btnSuccess",
          onclick: () => loadAsGuide(recipe),
        },
        ["设为目标并去厨房"]
      ),
    ])
  );

  host.appendChild(card);
}

function renderPrepHintsBlock(recipe, guide) {
  const hints = recipe.prep_hints || guide.prep_hints || [];
  const feats = recipe.features || guide.features || [];
  if (!hints.length && !feats.length) return null;

  const wrap = el("div", { class: "recipeGuideBox", style: "margin-top:10px" }, [
    el("strong", {}, [t("recipeLab.prepGuideTitle")]),
  ]);
  if (feats.length) {
    wrap.appendChild(
      el("div", { class: "recipeFeatureTags", style: "margin:8px 0" }, feats.map((f) =>
        el("span", { class: "tag", style: "margin:2px 4px 2px 0;font-size:10px" }, [
          featureLabel(f),
        ])
      ))
    );
  }
  if (hints.length) {
    const ul = el("ul", { class: "recipeGuideList" }, []);
    hints.forEach((h) => ul.appendChild(el("li", {}, [h])));
    wrap.appendChild(ul);
  }
  return wrap;
}

function renderStepsBlock(recipe, guide) {
  const steps = recipe.steps || [];
  if (!steps.length) return null;

  const details = recipe.step_details || [];
  const useDetails = details.length === steps.length && details.some((d) => (d.ingredients || []).length);

  const wrap = el("div", { class: "recipeStepsSection" });
  wrap.appendChild(
    el("div", { class: "muted", style: "font-size:11px;margin:10px 0 6px" }, [
      guide.steps_suggested
        ? "参考做法（系统生成，可按习惯调整）"
        : useDetails
          ? "做法（已标注每步涉及的食材）"
          : "做法",
    ])
  );

  if (useDetails) {
    const list = el("div", { class: "recipeStepsList" });
    details.forEach((sd, i) => {
      const row = el("div", { class: "recipeStepRow" });
      row.appendChild(el("div", { class: "recipeStepText" }, [`${i + 1}. ${sd.text || steps[i]}`]));
      const refs = sd.ingredients || [];
      if (refs.length) {
        const tags = el("div", { class: "recipeStepTags" });
        refs.forEach((ing) =>
          tags.appendChild(el("span", { class: "tag tagEst", title: ing.ingredient_id || "" }, [ing.name || ing.ingredient_id]))
        );
        row.appendChild(tags);
      }
      list.appendChild(row);
    });
    wrap.appendChild(list);
  } else {
    wrap.appendChild(
      el("div", { class: "eventNotes recipeStepsBox" }, [steps.map((s, i) => `${i + 1}. ${s}`).join("\n")])
    );
  }
  return wrap;
}

function ingredientPreviewRow(it) {
  const id = it.ingredient_id;
  const noMatch = !id;
  const amt = it.amount_g;
  const est = it.amount_estimated;
  let tagText = "待确认";
  if (amt != null && amt > 0) {
    tagText = est ? `约 ${Math.round(amt)}g` : `${Math.round(amt)}g`;
  } else if (it.unit_raw) {
    tagText = it.unit_raw;
  }
  return el("div", { class: "ingredientItem" + (noMatch ? " ingredientItemWarn" : "") }, [
    el("div", {}, [
      el("strong", {}, [it.name || id || "?"]),
      el("div", {}, [
        el("small", {}, [id || "未匹配 — 厨房需手选"]),
        it.from_step
          ? el("small", { style: "display:block;color:var(--gold);margin-top:2px" }, ["从步骤识别"])
          : null,
        it.amount_note
          ? el("small", { style: "display:block;color:var(--mint);margin-top:2px" }, [it.amount_note])
          : null,
      ]),
    ]),
    el("span", { class: "tag" + (est ? " tagEst" : "") }, [tagText]),
  ]);
}
