import { t } from "./i18n.js";

/** 菜谱难度与功能标签（与 server/app/recipes/meta.py 对齐） */
export const DIFFICULTY_ORDER = { easy: 0, medium: 1, hard: 2, expert: 3 };

export function difficultyLabel(diff) {
  const d = diff || "medium";
  return t("difficulty." + d) || d;
}

export function featureLabel(f) {
  return t("feature." + f) || f;
}

export function difficultyBadgeClass(diff) {
  return `recipeDiff recipeDiff-${diff || "medium"}`;
}

export function sortRecipesByDifficulty(recipes) {
  return [...(recipes || [])].sort(
    (a, b) =>
      (DIFFICULTY_ORDER[a.difficulty] ?? 1) - (DIFFICULTY_ORDER[b.difficulty] ?? 1)
  );
}
