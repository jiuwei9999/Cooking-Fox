import { el } from "./dom.js";
import { round1 } from "./format.js";
import { t } from "./i18n.js";
import { difficultyLabel, featureLabel, difficultyBadgeClass } from "./recipeMeta.js";
import { clearTargetRecipe, loadTargetRecipe } from "./targetRecipe.js";

/**
 * @param {HTMLElement} host
 * @param {{
 *   context: 'kitchen' | 'prep',
 *   onClear?: () => void,
 *   onAddIngredient?: (item: object) => void,
 *   onPrepIngredient?: (id: string) => void,
 *   collapsedDefault?: boolean,
 * }} opts
 */
export function mountTargetRecipeGuide(host, opts = {}) {
  const {
    context = "kitchen",
    onClear,
    onAddIngredient,
    onPrepIngredient,
    collapsedDefault = false,
  } = opts;

  let collapsed = collapsedDefault;

  function render() {
    host.innerHTML = "";
    const recipe = loadTargetRecipe();
    if (!recipe) {
      host.appendChild(
        el("div", { class: "targetGuideEmpty pill", style: "font-size:11px;padding:10px" }, [
          context === "prep" ? t("targetGuide.emptyPrep") : t("targetGuide.emptyKitchen"),
        ])
      );
      return;
    }

    const items = recipe.ingredients || [];
    const steps = recipe.steps || [];
    const guide = recipe.guide || {};
    const diff = recipe.difficulty || guide.difficulty || "medium";
    const diffLabel = recipe.difficulty_label || guide.difficulty_label || difficultyLabel(diff);
    const prepHints = recipe.prep_hints || guide.prep_hints || [];
    const feats = recipe.features || guide.features || [];

    const panel = el("div", { class: "targetGuidePanel" }, []);

    const head = el("div", { class: "targetGuideHead" }, [
      el("div", { style: "display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;flex:1" }, [
        el("strong", { style: "font-size:13px" }, ["🎯 " + (recipe.title || recipe.id)]),
        diffLabel ? el("span", { class: difficultyBadgeClass(diff) }, [diffLabel]) : null,
      ].filter(Boolean)),
      el("div", { style: "display:flex;gap:4px" }, [
        el("button", {
          type: "button",
          class: "btn",
          style: "padding:2px 8px;font-size:10px",
          onclick: () => {
            collapsed = !collapsed;
            render();
          },
        }, [collapsed ? t("targetGuide.expand") : t("targetGuide.collapse")]),
        el("button", {
          type: "button",
          class: "btn",
          style: "padding:2px 8px;font-size:10px",
          onclick: () => {
            clearTargetRecipe();
            onClear?.();
            render();
          },
        }, [t("targetGuide.clear")]),
      ]),
    ]);
    panel.appendChild(head);

    if (!collapsed) {
      const body = el("div", { class: "targetGuideBody" }, []);

      if (prepHints.length || feats.length) {
        const prepBox = el("div", { class: "recipeGuideBox recipeGuideBoxHighlight", style: "font-size:11px;margin-bottom:8px" }, [
          el("strong", {}, [t("targetGuide.prepTitle")]),
        ]);
        if (feats.length) {
          const ft = el("div", { style: "margin:6px 0;display:flex;flex-wrap:wrap;gap:4px" }, []);
          feats.forEach((f) => {
            ft.appendChild(el("span", { class: "tag tagEst", style: "font-size:10px" }, [featureLabel(f)]));
          });
          prepBox.appendChild(ft);
        }
        const ul = el("ul", { class: "recipeGuideList" }, []);
        prepHints.slice(0, 6).forEach((h) => ul.appendChild(el("li", {}, [h])));
        prepBox.appendChild(ul);
        body.appendChild(prepBox);
      }

      if ((guide.tips || []).length) {
        const tipBox = el("div", { class: "recipeGuideBox", style: "font-size:10px;margin-bottom:8px" }, []);
        (guide.tips || []).slice(0, 2).forEach((tip) => {
          tipBox.appendChild(el("div", { style: "margin-bottom:3px;color:var(--text-dim)" }, [tip]));
        });
        body.appendChild(tipBox);
      }

      body.appendChild(el("div", { class: "muted", style: "font-size:10px;margin-bottom:4px" }, [t("targetGuide.ingChipsHint")]));
      const chips = el("div", { class: "targetGuideIngChips" }, []);
      items.forEach((it) => {
        const id = it.ingredient_id;
        const amt = Number(it.amount_g || 0);
        const label = it.amount_estimated ? `约${round1(amt)}g` : `${round1(amt)}g`;
        chips.appendChild(
          el("button", {
            type: "button",
            class: "btn targetGuideIngChip" + (id ? "" : " ingredientItemWarn"),
            onclick: () => {
              if (!id) {
                alert(t("targetGuide.noMatch"));
                return;
              }
              if (context === "prep" && onPrepIngredient) {
                onPrepIngredient(id);
              } else if (onAddIngredient) {
                onAddIngredient(it);
              }
            },
          }, [
            `${it.name || id || "?"} · ${label}`,
            context === "kitchen" ? " ＋" : "",
          ])
        );
      });
      body.appendChild(chips);

      if (steps.length) {
        body.appendChild(el("div", { class: "muted", style: "font-size:10px;margin:8px 0 4px" }, [
          guide.steps_suggested ? t("targetGuide.stepsSuggested") : t("targetGuide.stepsRecipe"),
        ]));
        const stepDetails = recipe.step_details || [];
        const useDetails = stepDetails.length === steps.length
          && stepDetails.some((d) => (d.ingredients || []).length);
        const list = el("div", { class: "recipeStepsList targetGuideSteps" }, []);
        const limit = context === "prep" ? steps.length : Math.min(steps.length, 8);
        for (let si = 0; si < limit; si++) {
          const sd = useDetails ? stepDetails[si] : null;
          const row = el("div", { class: "recipeStepRow" });
          row.appendChild(el("div", { class: "recipeStepText" }, [`${si + 1}. ${sd?.text || steps[si]}`]));
          if (sd?.ingredients?.length) {
            const tags = el("div", { class: "recipeStepTags" }, []);
            sd.ingredients.forEach((ref) => {
              tags.appendChild(el("span", { class: "tag tagEst" }, [ref.name || ref.ingredient_id]));
            });
            row.appendChild(tags);
          }
          list.appendChild(row);
        }
        body.appendChild(list);
      }

      panel.appendChild(body);
    }

    host.appendChild(panel);
  }

  render();

  return { refresh: render };
}
