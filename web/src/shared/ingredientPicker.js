import { el } from "./dom.js";
import { t } from "./i18n.js";
import {
  EMOJI,
  CAT,
  INGREDIENT_SECTIONS,
  buildIngredientSections,
  displayIngredientName,
  getDefaultAmountG,
  ingredientSectionLabel,
} from "./ingredientMeta.js";
import { getTargetRecipeIngredientIds, loadTargetRecipe } from "./targetRecipe.js";

const LEGACY_RECENT_KEY = "cookingsim.recentIngredients";
const MAX_RECENT = 14;

/** 仅当前页面会话有效；刷新或新建会话后清空 */
let recentIds = [];

try {
  localStorage.removeItem(LEGACY_RECENT_KEY);
} catch {
  /* ignore */
}

function loadRecent() {
  return recentIds.slice();
}

/** 新建会话时调用 */
export function clearRecentIngredients() {
  recentIds = [];
}

export function pushRecentIngredient(id) {
  if (!id) return;
  recentIds = [id, ...recentIds.filter((x) => x !== id)].slice(0, MAX_RECENT);
}

function matchQuery(ing, q) {
  if (!q) return true;
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const name = (ing.name || "").toLowerCase();
  const id = (ing.id || "").toLowerCase();
  return name.includes(s) || id.includes(s);
}

/**
 * @param {HTMLElement} container
 * @param {{
 *   ingredients: Record<string, { id: string, name: string, image_url?: string }>,
 *   filterFn?: (id: string) => boolean,
 *   selectedId?: string | null,
 *   onSelect: (ing: object) => void,
 *   onQuickAdd?: (id: string) => void,
 *   showQuickAdd?: boolean,
 *   showPrepBtn?: boolean,
 *   onPrep?: (id: string) => void,
 *   recipeIds?: string[],
 *   listMaxHeight?: string,
 *   compact?: boolean,
 * }} opts
 */
export function mountIngredientPicker(container, opts) {
  const {
    ingredients = {},
    filterFn = () => true,
    selectedId = null,
    onSelect,
    onQuickAdd,
    showQuickAdd = false,
    showPrepBtn = false,
    onPrep,
    recipeIds: recipeIdsIn,
    listMaxHeight = "42vh",
    compact = false,
  } = opts;

  let query = "";
  let categoryId = "all";
  let pickerSelectedId = selectedId;

  const recipe = loadTargetRecipe();
  const recipeIds = recipeIdsIn ?? getTargetRecipeIngredientIds(recipe);

  const allSections = buildIngredientSections(ingredients);
  const flat = [];
  allSections.forEach((sec) => {
    sec.items.forEach((ing) => {
      if (filterFn(ing.id)) flat.push({ ...ing, _sectionId: sec.id, _sectionLabel: sec.label });
    });
  });

  const searchInput = el("input", {
    class: "input ingredientPickerSearch",
    type: "search",
    placeholder: t("ingredient.searchPlaceholder"),
    autocomplete: "off",
    oninput: (e) => {
      query = e.target.value || "";
      renderGrid();
    },
  });

  const catRow = el("div", { class: "ingredientPickerCats" }, []);
  const quickRow = el("div", { class: "ingredientPickerQuick" }, []);
  const gridHost = el("div", {
    class: "ingredientPickerGridHost",
    style: `max-height:${listMaxHeight};overflow-y:auto;margin-top:6px`,
  }, []);

  const mkCat = (id, label, emoji) =>
    el("button", {
      type: "button",
      class: "btn ingredientPickerCat" + (categoryId === id ? " ingredientPickerCatActive" : ""),
      onclick: () => {
        categoryId = id;
        renderCats();
        renderGrid();
      },
    }, [emoji ? `${emoji} ${label}` : label]);

  function renderCats() {
    catRow.innerHTML = "";
    catRow.appendChild(mkCat("all", t("ingredient.catAll"), "📋"));
    catRow.appendChild(mkCat("recipe", t("ingredient.catRecipe"), "🎯"));
    INGREDIENT_SECTIONS.forEach((def) => {
      const has = def.ids.some((id) => ingredients[id] && filterFn(id));
      if (has) catRow.appendChild(mkCat(def.id, ingredientSectionLabel(def.id), def.emoji));
    });
  }

  function renderQuick() {
    quickRow.innerHTML = "";
    const blocks = [];

    if (recipeIds.length > 0 && categoryId !== "recipe") {
      /* recipe row shown when cat=recipe or always as hint - show always compact */
    }

    if (categoryId === "recipe" || (recipeIds.length > 0 && !query)) {
      const rids = recipeIds.filter((id) => ingredients[id] && filterFn(id));
      if (rids.length > 0) {
        const wrap = el("div", { class: "ingredientPickerQuickBlock" }, [
          el("span", { class: "ingredientPickerQuickLabel" }, [t("ingredient.recipeChips")]),
        ]);
        const chips = el("div", { class: "ingredientPickerChips" }, []);
        rids.forEach((id) => {
          const ing = ingredients[id];
          chips.appendChild(
            el("button", {
              type: "button",
              class: "btn ingredientPickerChip ingredientPickerChipRecipe" + (pickerSelectedId === id ? " ingredientPickerChipActive" : ""),
              onclick: () => pick(ing),
            }, [`${EMOJI[id] || "🍽️"} ${displayIngredientName(ing)}`])
          );
        });
        wrap.appendChild(chips);
        blocks.push(wrap);
      }
    }

    const recent = loadRecent().filter((id) => ingredients[id] && filterFn(id));
    if (recent.length > 0 && categoryId === "all" && !query) {
      const wrap = el("div", { class: "ingredientPickerQuickBlock" }, [
        el("span", { class: "ingredientPickerQuickLabel" }, [t("ingredient.recent")]),
      ]);
      const chips = el("div", { class: "ingredientPickerChips" }, []);
      recent.slice(0, 10).forEach((id) => {
        const ing = ingredients[id];
        chips.appendChild(
          el("button", {
            type: "button",
            class: "btn ingredientPickerChip" + (pickerSelectedId === id ? " ingredientPickerChipActive" : ""),
            onclick: () => pick(ing),
          }, [`${EMOJI[id] || "🍽️"} ${displayIngredientName(ing)}`])
        );
      });
      wrap.appendChild(chips);
      blocks.push(wrap);
    }

    blocks.forEach((b) => quickRow.appendChild(b));
    quickRow.style.display = blocks.length ? "block" : "none";
  }

  function pick(ing, opts = {}) {
    const quickAdd = opts.quickAdd !== false && showQuickAdd && onQuickAdd;
    pickerSelectedId = ing.id;
    pushRecentIngredient(ing.id);
    onSelect(ing);
    if (quickAdd) {
      onQuickAdd(ing.id);
      return;
    }
    renderGrid();
    renderQuick();
    renderCats();
  }

  function filteredItems() {
    let items = flat;
    if (categoryId === "recipe") {
      items = items.filter((ing) => recipeIds.includes(ing.id));
    } else if (categoryId !== "all") {
      items = items.filter((ing) => ing._sectionId === categoryId);
    }
    if (query) items = items.filter((ing) => matchQuery(ing, query));
    return items;
  }

  function renderGrid(opts = {}) {
    const keepScroll = opts.keepScroll !== false;
    const scrollTop = keepScroll ? gridHost.scrollTop : 0;
    gridHost.innerHTML = "";
    renderQuick();
    const items = filteredItems();
    if (items.length === 0) {
      gridHost.appendChild(
        el("div", { class: "muted", style: "padding:12px;font-size:12px;text-align:center" }, [
          query ? t("ingredient.noMatch") : t("ingredient.noItems"),
        ])
      );
      return;
    }

    const grid = el("div", { class: compact ? "ingredientSectionGrid ingredientPickerGridCompact" : "ingredientSectionGrid" }, []);
    items.forEach((ing) => {
      const cat = CAT[ing.id] || "";
      const isSel = pickerSelectedId === ing.id;
      const card = el("div", {
        class: `ingredientCard ${cat}${isSel ? " ingredientCardSelected" : ""}`,
        "data-ingredient-id": ing.id,
        onclick: () => pick(ing),
      }, [
        el("div", { class: "imgWrap" }, [
          el("div", { class: "imgEmoji" }, [EMOJI[ing.id] || "🍽️"]),
          ing.image_url ? el("img", { class: "imgPhoto", src: ing.image_url, alt: displayIngredientName(ing) }) : null,
        ].filter(Boolean)),
        el("div", { class: "ingName" }, [displayIngredientName(ing)]),
        compact ? null : el("div", { class: "ingId" }, [ing.id]),
      ].filter(Boolean));

      const actions = el("div", { class: "ingredientPickerCardActions", onclick: (e) => e.stopPropagation() }, []);
      if (showQuickAdd && onQuickAdd) {
        actions.appendChild(
          el("button", {
            type: "button",
            class: "btn btnPrimary ingredientQuickAddBtn",
            onclick: () => onQuickAdd(ing.id),
          }, [`+${getDefaultAmountG(ing.id)}g`])
        );
      }
      if (showPrepBtn && onPrep) {
        actions.appendChild(
          el("button", {
            type: "button",
            class: "btn ingredientPrepBtn",
            title: t("ingredient.prepBtn"),
            onclick: () => onPrep(ing.id),
          }, ["🔪"])
        );
      }
      if (actions.childNodes.length) card.appendChild(actions);

      grid.appendChild(card);
    });
    gridHost.appendChild(grid);

    const count = el("div", { class: "muted", style: "font-size:10px;margin-top:6px;text-align:right" }, [
      `显示 ${items.length} / ${flat.length} 种`,
    ]);
    gridHost.appendChild(count);
    if (keepScroll) gridHost.scrollTop = scrollTop;
  }

  function updateSelectionHighlight() {
    const cards = gridHost.querySelectorAll(".ingredientCard[data-ingredient-id]");
    cards.forEach((card) => {
      const isSel = card.getAttribute("data-ingredient-id") === pickerSelectedId;
      card.classList.toggle("ingredientCardSelected", isSel);
    });
  }

  container.innerHTML = "";
  container.appendChild(searchInput);
  container.appendChild(catRow);
  container.appendChild(quickRow);
  container.appendChild(gridHost);

  renderCats();
  renderGrid();

  return {
    setSelectedId(id) {
      if (pickerSelectedId === id && gridHost.querySelector(".ingredientCard")) {
        updateSelectionHighlight();
        return;
      }
      pickerSelectedId = id;
      if (gridHost.querySelector(".ingredientCard")) {
        updateSelectionHighlight();
      } else {
        renderGrid();
      }
    },
    refresh() {
      renderCats();
      renderQuick();
      renderGrid({ keepScroll: true });
    },
    clearRecent() {
      clearRecentIngredients();
      renderQuick();
    },
    focusSearch() {
      searchInput.focus();
    },
    isMounted: true,
  };
}
