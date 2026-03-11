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

  const right = el("div", { class: "panel" }, [
    header,
    el("div", { class: "panelBody" }, [
      el("div", { class: "pill" }, ["MVP 先支持“示例菜谱 + 文本粘贴导入（下一步实现）”。你可以先在厨房里自由尝试。"]),
      el("div", { class: "hr" }),
      el("div", { class: "muted" }, ["后续这里会支持：粘贴配料/步骤文本 → 自动解析结构化 → 一键加载到厨房。"]),
    ]),
  ]);

  mount(root, el("div", { class: "app" }, [left, right, el("div", { class: "panel" }, [el("div", { class: "panelHeader" }, [el("h2", {}, ["提示"])]), el("div", { class: "panelBody" }, [el("div", { class: "muted" }, ["选择一个练习菜谱，然后切回厨房按自己的顺序做。"])])])]));

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
}

function loadAsGuide(recipe) {
  localStorage.setItem("cookingsim.targetRecipe", JSON.stringify(recipe));
  alert("已保存为“目标菜谱”。回到厨房后，你仍可以任意顺序操作，但会看到建议与配料清单。");
}

