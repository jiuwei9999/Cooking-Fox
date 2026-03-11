import { api } from "../services/api.js";
import { el, mount } from "../shared/dom.js";

export async function renderRecipeLab(root) {
  root.innerHTML = "";

  const header = el("div", { class: "panelHeader" }, [
    el("h2", {}, ["RecipeLab"]),
    el("div", { class: "row" }, [
      el("a", { href: "#/kitchen", class: "btn", style: "text-decoration:none" }, ["返回厨房"]),
    ]),
  ]);

  const left = el("div", { class: "panel" }, [
    el("div", { class: "panelHeader" }, [el("h2", {}, ["示例菜谱（离线内置）"]), el("span", { class: "tag" }, ["0-key"]) ]),
    el("div", { class: "panelBody" }, [el("div", { id: "examples", class: "ingredientList" }, ["加载中…"])]),
  ]);

  const importPanel = el("div", { class: "panel" }, [
    header,
    el("div", { class: "panelBody" }, [
      el("div", { class: "pill" }, ["从任意网站复制“用料 + 做法”文本粘贴到下面，我们会帮你解析成结构化菜谱。不会爬图，不会抓整站。"]),
      el("div", { class: "hr" }),
      renderImportForm(),
    ]),
  ]);

  const right = el("div", { class: "panel" }, [
    el("div", { class: "panelHeader" }, [el("h2", {}, ["我的菜谱"]), el("span", { class: "tag" }, ["本机存储"]) ]),
    el("div", { class: "panelBody" }, [el("div", { id: "userRecipes", class: "ingredientList" }, ["加载中…"])]),
  ]);

  mount(
    root,
    el("div", { class: "app" }, [
      left,
      importPanel,
      right,
    ])
  );

  const examplesEl = document.getElementById("examples");
  try {
    const data = await api.exampleRecipes();
    const recipes = data.recipes || [];
    if (examplesEl) {
      examplesEl.innerHTML = "";
      recipes.forEach((r) => {
        examplesEl.appendChild(
          el("div", { class: "ingredientItem" }, [
            el("div", {}, [el("strong", {}, [r.title || r.id]), el("div", {}, [el("small", {}, [`${(r.ingredients || []).length}种原料`])])]),
            el("button", { class: "btn", onclick: () => loadAsGuide(r) }, ["当作目标"]),
          ])
        );
      });
    }
  } catch (e) {
    if (examplesEl) examplesEl.textContent = "加载失败（请确认后端已启动）。";
  }

  const userEl = document.getElementById("userRecipes");
  try {
    const data = await api.userRecipes();
    const recipes = data.recipes || [];
    if (userEl) {
      userEl.innerHTML = "";
      if (!recipes.length) {
        userEl.appendChild(el("div", { class: "muted" }, ["暂无自建菜谱。你可以通过中间的粘贴导入生成。"]));
      } else {
        recipes.forEach((r) => {
          userEl.appendChild(
            el("div", { class: "ingredientItem" }, [
              el("div", {}, [el("strong", {}, [r.title || r.id]), el("div", {}, [el("small", {}, [`${(r.ingredients || []).length}种原料`])])]),
              el("div", { class: "row" }, [
                el("button", { class: "btn", onclick: () => loadAsGuide(r) }, ["当作目标"]),
              ]),
            ])
          );
        });
      }
    }
  } catch (e) {
    if (userEl) userEl.textContent = "我的菜谱加载失败。";
  }
}

function loadAsGuide(recipe) {
  localStorage.setItem("cookingsim.targetRecipe", JSON.stringify(recipe));
  alert("已保存为“目标菜谱”。回到厨房后，你仍可以任意顺序操作，但会看到建议与配料清单。");
}

function renderImportForm() {
  const text = el("textarea", {
    class: "input",
    rows: 10,
    placeholder:
      "示例：\\n用料：\\n鸡蛋 2个\\n番茄 2个\\n盐 1g\\n糖 3g\\n\\n做法：\\n1. 鸡蛋打散，下锅炒熟盛出\\n2. 下番茄炒出汁\\n3. 回锅鸡蛋，调味出锅",
  });
  const preview = el("div", { class: "ingredientList", style: "margin-top:10px" }, []);
  const btnParse = el(
    "button",
    {
      class: "btn btnPrimary",
      onclick: async () => {
        preview.innerHTML = "解析中…";
        try {
          const { recipe } = await api.importRecipe(text.value || "");
          if (!recipe) {
            preview.textContent = "解析失败。";
            return;
          }
          renderPreview(preview, recipe);
        } catch (e) {
          preview.textContent = "解析失败，请检查网络或后端。";
        }
      },
    },
    ["解析文本"]
  );
  return el("div", { class: "col" }, [
    text,
    el("div", { class: "row" }, [btnParse]),
    el("div", { class: "hr" }),
    el("div", { class: "muted" }, ["解析结果（确认后可保存为“我的菜谱”，或直接设为目标菜谱）"]),
    preview,
  ]);
}

function renderPreview(host, recipe) {
  host.innerHTML = "";
  const warnings = recipe.warnings || [];
  if (warnings.length) {
    host.appendChild(
      el(
        "div",
        { class: "eventNotes" },
        warnings.map((w) => w + "\\n")
      )
    );
  }
  const header = el("div", { class: "eventTitle" }, [
    el("strong", {}, [recipe.title || recipe.id]),
    el("span", {}, [`${(recipe.ingredients || []).length} 种原料 / ${(recipe.steps || []).length} 步`]),
  ]);
  const ingList = el(
    "div",
    { class: "ingredientList", style: "margin-top:8px" },
    (recipe.ingredients || []).map((it) =>
      el("div", { class: "ingredientItem" }, [
        el("div", {}, [el("strong", {}, [it.name || it.ingredient_id || "?"]), el("div", {}, [el("small", {}, [it.ingredient_id || ""])])]),
        el("span", { class: "tag" }, [it.amount_g ? `${Math.round(it.amount_g)}g` : it.unit_raw || "未知用量"]),
      ])
    )
  );
  const steps = el(
    "div",
    { class: "eventNotes", style: "margin-top:6px; white-space:pre-line" },
    [(recipe.steps || []).map((s, i) => `${i + 1}. ${s}`).join("\\n")]
  );
  const actions = el("div", { class: "row", style: "margin-top:8px" }, [
    el(
      "button",
      {
        class: "btn btnPrimary",
        onclick: async () => {
          await api.saveRecipe(recipe);
          alert("已保存到“我的菜谱”。");
          location.reload();
        },
      },
      ["保存为我的菜谱"]
    ),
    el(
      "button",
      {
        class: "btn",
        onclick: () => {
          loadAsGuide(recipe);
        },
      },
      ["直接设为目标"],
    ),
  ]);
  host.appendChild(el("div", { class: "event" }, [header, ingList, steps, actions]));
}

