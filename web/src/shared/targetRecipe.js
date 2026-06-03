/** 目标菜谱（localStorage）读写 */

export function loadTargetRecipe() {
  try {
    const raw = localStorage.getItem("cookingsim.targetRecipe");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem("cookingsim.targetRecipe");
    return null;
  }
}

export function saveTargetRecipe(recipe) {
  if (recipe) localStorage.setItem("cookingsim.targetRecipe", JSON.stringify(recipe));
}

export function clearTargetRecipe() {
  localStorage.removeItem("cookingsim.targetRecipe");
}

/** 本道菜用料 id 列表（已匹配系统库） */
export function getTargetRecipeIngredientIds(recipe) {
  if (!recipe) return [];
  return (recipe.ingredients || [])
    .map((it) => it.ingredient_id)
    .filter(Boolean);
}
