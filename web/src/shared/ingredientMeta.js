/** 前端食材 UI / 备菜 / 液体分层等元数据（与 server/sim/ingredients.py 的 id 对齐） */

import { getLang, t } from "./i18n.js";

export const QAMT = {
  seasoning: 1,
  liquid_seasoning: 5,
  aromatic: 3,
  main: 30,
  butter: 10,
  liquid: 50,
  grain: 40,
};

export const LIQUID_IDS = [
  "water", "oil", "vinegar", "soy_sauce", "dark_soy_sauce", "sesame_oil",
  "cooking_wine", "oyster_sauce", "chili_oil",
];

export const DRY_SEASONING_IDS = ["salt", "sugar", "pepper", "five_spice", "chicken_powder", "sesame", "starch"];

export const LIQUID_SEASONING_IDS = ["soy_sauce", "dark_soy_sauce", "vinegar", "sesame_oil", "oyster_sauce", "bean_paste"];

export const AROMATIC_IDS = ["garlic", "ginger", "chili", "scallion"];

export const SEASONING_IDS = [...DRY_SEASONING_IDS, ...LIQUID_SEASONING_IDS, "oil", "water"];

export const EMOJI = {
  egg: "🥚", tomato: "🍅", cucumber: "🥒", potato: "🥔", carrot: "🥕", onion: "🧅",
  pork: "🥩", beef: "🥩", chicken: "🍗", shrimp: "🍤", mushroom: "🍄",
  rice: "🍚", noodle: "🍝", flour: "🌾",
  tofu: "🫘", cabbage: "🥬", bok_choy: "🥬", broccoli: "🥦", bell_pepper: "🫑",
  eggplant: "🍆", corn: "🌽", green_bean: "🫛", spinach: "🥬", celery: "🥬",
  fish: "🐟", lamb: "🍖", duck: "🦆", squid: "🦑", clam: "🐚",
  water: "💧", oil: "🫗", vinegar: "🍶", soy_sauce: "🫙", dark_soy_sauce: "🫙",
  sesame_oil: "🫗", cooking_wine: "🍶", oyster_sauce: "🫙", chili_oil: "🌶️",
  salt: "🧂", sugar: "🍬", pepper: "🌶️", five_spice: "🌿",
  garlic: "🧄", ginger: "🫚", chili: "🌶️", scallion: "🫑", butter: "🧈",
  starch: "⚪", chicken_powder: "✨", sesame: "⚪", bean_paste: "🫙",
};

export const CAT = {
  egg: "catMeat", tomato: "catVeg", cucumber: "catVeg", potato: "catVeg", carrot: "catVeg",
  onion: "catVeg", pork: "catMeat", beef: "catMeat", chicken: "catMeat", shrimp: "catMeat",
  mushroom: "catVeg", rice: "catGrain", noodle: "catGrain", flour: "catGrain",
  tofu: "catVeg", cabbage: "catVeg", bok_choy: "catVeg", broccoli: "catVeg", bell_pepper: "catVeg",
  eggplant: "catVeg", corn: "catVeg", green_bean: "catVeg", spinach: "catVeg", celery: "catVeg",
  fish: "catMeat", lamb: "catMeat", duck: "catMeat", squid: "catMeat", clam: "catMeat",
  water: "catLiquid", oil: "catLiquid", vinegar: "catLiquid", cooking_wine: "catLiquid", chili_oil: "catLiquid",
  soy_sauce: "catSeasoning", dark_soy_sauce: "catSeasoning", sesame_oil: "catLiquid",
  oyster_sauce: "catSeasoning", bean_paste: "catSeasoning",
  salt: "catSeasoning", sugar: "catSeasoning", pepper: "catSeasoning", five_spice: "catSeasoning",
  chicken_powder: "catSeasoning", sesame: "catSeasoning", starch: "catSeasoning",
  garlic: "catVeg", ginger: "catVeg", chili: "catVeg", scallion: "catVeg", butter: "catSeasoning",
};

export const ING_EN = {
  egg: "egg", tomato: "tomato", cucumber: "cucumber", potato: "potato", carrot: "carrot",
  onion: "onion", pork: "pork belly", beef: "beef", chicken: "chicken", shrimp: "shrimp",
  mushroom: "mushroom", rice: "rice", noodle: "noodles", flour: "wheat flour",
  tofu: "tofu", cabbage: "napa cabbage", bok_choy: "bok choy", broccoli: "broccoli",
  bell_pepper: "bell pepper", eggplant: "eggplant", corn: "corn", green_bean: "green beans",
  spinach: "spinach", celery: "celery",
  fish: "fish fillet", lamb: "lamb", duck: "duck meat", squid: "squid", clam: "clams",
  water: "water", oil: "cooking oil", vinegar: "rice vinegar",
  soy_sauce: "light soy sauce", dark_soy_sauce: "dark soy sauce", sesame_oil: "sesame oil",
  cooking_wine: "Shaoxing wine", oyster_sauce: "oyster sauce", chili_oil: "chili oil",
  salt: "salt", sugar: "sugar", pepper: "ground pepper", five_spice: "five-spice powder",
  garlic: "garlic", ginger: "ginger", chili: "red chili", scallion: "scallion", butter: "butter",
  starch: "cornstarch", chicken_powder: "chicken bouillon", sesame: "sesame seeds",
  bean_paste: "fermented bean paste",
};

const VEG_PREP = [
  { id: "dice", label: "🔪 切丁", state: "diced", cut: "dice" },
  { id: "slice", label: "🔪 切片", state: "sliced", cut: "slice" },
  { id: "chop", label: "🔪 切段", state: "chopped", cut: "chop" },
  { id: "mince", label: "🔪 切末", state: "minced", cut: "mince" },
];

const MEAT_PREP = [
  { id: "dice", label: "🔪 切丁", state: "diced", cut: "dice" },
  { id: "slice", label: "🔪 切片", state: "sliced", cut: "slice" },
  { id: "chop", label: "🔪 切段", state: "chopped", cut: "chop" },
  { id: "mince", label: "🔪 切末", state: "minced", cut: "mince" },
];

const VEG_IDS = [
  "tomato", "cucumber", "potato", "carrot", "onion", "mushroom",
  "tofu", "cabbage", "bok_choy", "broccoli", "bell_pepper", "eggplant",
  "corn", "green_bean", "spinach", "celery",
];

const MEAT_IDS_PREP = ["pork", "beef", "chicken", "shrimp", "fish", "lamb", "duck", "squid"];

export const PREP_OPERATIONS = {
  egg: [{ id: "crack", label: "🥚 敲开鸡蛋", state: "cracked" }],
  tomato: VEG_PREP,
  cucumber: [
    { id: "slice", label: "🔪 切片", state: "sliced", cut: "slice" },
    { id: "dice", label: "🔪 切丁", state: "diced", cut: "dice" },
    { id: "chop", label: "🔪 切段", state: "chopped", cut: "chop" },
  ],
  potato: VEG_PREP,
  carrot: [
    { id: "slice", label: "🔪 切片", state: "sliced", cut: "slice" },
    { id: "dice", label: "🔪 切丁", state: "diced", cut: "dice" },
    { id: "chop", label: "🔪 切段", state: "chopped", cut: "chop" },
  ],
  onion: [
    { id: "dice", label: "🔪 切丁", state: "diced", cut: "dice" },
    { id: "slice", label: "🔪 切片", state: "sliced", cut: "slice" },
    { id: "mince", label: "🔪 切末", state: "minced", cut: "mince" },
  ],
  pork: MEAT_PREP,
  beef: [
    { id: "slice", label: "🔪 切片", state: "sliced", cut: "slice" },
    { id: "dice", label: "🔪 切丁", state: "diced", cut: "dice" },
    { id: "mince", label: "🔪 切末", state: "minced", cut: "mince" },
  ],
  chicken: MEAT_PREP,
  shrimp: [
    { id: "chop", label: "🔪 切段", state: "chopped", cut: "chop" },
    { id: "mince", label: "🔪 切末", state: "minced", cut: "mince" },
  ],
  mushroom: [
    { id: "slice", label: "🔪 切片", state: "sliced", cut: "slice" },
    { id: "dice", label: "🔪 切丁", state: "diced", cut: "dice" },
    { id: "chop", label: "🔪 切段", state: "chopped", cut: "chop" },
  ],
  garlic: [
    { id: "mince", label: "🔪 切末", state: "minced", cut: "mince" },
    { id: "slice", label: "🔪 切片", state: "sliced", cut: "slice" },
  ],
  ginger: [
    { id: "slice", label: "🔪 切片", state: "sliced", cut: "slice" },
    { id: "mince", label: "🔪 切末", state: "minced", cut: "mince" },
  ],
  chili: [
    { id: "chop", label: "🔪 切段", state: "chopped", cut: "chop" },
    { id: "mince", label: "🔪 切末", state: "minced", cut: "mince" },
  ],
  scallion: [
    { id: "chop", label: "🔪 切段", state: "chopped", cut: "chop" },
    { id: "mince", label: "🔪 切末", state: "minced", cut: "mince" },
  ],
  butter: [{ id: "melt", label: "🫠 融化黄油", state: "melted" }],
  clam: [{ id: "shuck", label: "🐚 去壳", state: "shucked", cut: "none" }],
};

for (const id of VEG_IDS) {
  if (!PREP_OPERATIONS[id]) PREP_OPERATIONS[id] = VEG_PREP;
}
for (const id of MEAT_IDS_PREP) {
  if (!PREP_OPERATIONS[id]) PREP_OPERATIONS[id] = MEAT_PREP;
}

export function getDefaultAmountG(id) {
  if (DRY_SEASONING_IDS.includes(id)) return QAMT.seasoning;
  if (LIQUID_SEASONING_IDS.includes(id)) return QAMT.liquid_seasoning;
  if (AROMATIC_IDS.includes(id)) return QAMT.aromatic;
  if (id === "butter") return QAMT.butter;
  if (LIQUID_IDS.includes(id)) return QAMT.liquid;
  if (id === "rice" || id === "noodle" || id === "flour") return QAMT.grain;
  return QAMT.main;
}

export function isLiquidId(id) {
  return LIQUID_IDS.includes(id);
}

/** 厨房/备菜台食材分区（顺序即展示顺序） */
export const INGREDIENT_SECTIONS = [
  {
    id: "meat",
    label: "肉类",
    emoji: "🥩",
    ids: ["pork", "beef", "chicken", "lamb", "duck"],
  },
  {
    id: "seafood",
    label: "海鲜",
    emoji: "🦐",
    ids: ["shrimp", "fish", "squid", "clam"],
  },
  {
    id: "egg",
    label: "蛋类",
    emoji: "🥚",
    ids: ["egg"],
  },
  {
    id: "veg",
    label: "蔬菜豆制品",
    emoji: "🥬",
    ids: [
      "tomato", "cucumber", "potato", "carrot", "onion", "mushroom",
      "tofu", "cabbage", "bok_choy", "broccoli", "bell_pepper", "eggplant",
      "corn", "green_bean", "spinach", "celery",
    ],
  },
  {
    id: "grain",
    label: "主食",
    emoji: "🍚",
    ids: ["rice", "noodle", "flour"],
  },
  {
    id: "aromatic",
    label: "葱姜蒜椒",
    emoji: "🧄",
    ids: ["garlic", "ginger", "chili", "scallion"],
  },
  {
    id: "dry_seasoning",
    label: "干调料",
    emoji: "🧂",
    ids: ["salt", "sugar", "pepper", "five_spice", "starch", "chicken_powder", "sesame"],
  },
  {
    id: "sauce",
    label: "酱汁酱料",
    emoji: "🫙",
    ids: [
      "soy_sauce", "dark_soy_sauce", "vinegar", "sesame_oil",
      "oyster_sauce", "bean_paste", "butter",
    ],
  },
  {
    id: "liquid",
    label: "汤水油",
    emoji: "💧",
    ids: ["water", "oil", "cooking_wine", "chili_oil"],
  },
];

export function ingredientSectionLabel(sectionId) {
  return t("ingredient.section." + sectionId) || sectionId;
}

export function prepOpLabel(opId) {
  const map = {
    peel: "peel", debone: "debone", crack: "crack", melt: "melt", shuck: "shuck",
    dice: "dice", slice: "slice", chop: "chop", mince: "mince",
  };
  return map[opId] ? t("prep." + map[opId]) : opId;
}

export function displayIngredientName(ing) {
  if (!ing) return "";
  if (getLang() === "en" && ing.id && ING_EN[ing.id]) return ING_EN[ing.id];
  return ing.name || ing.id || "";
}

export function buildIngredientSections(ingredientsRecord) {
  const byId = ingredientsRecord || {};
  const placed = new Set();
  const sections = [];

  for (const def of INGREDIENT_SECTIONS) {
    const items = def.ids.map((id) => byId[id]).filter(Boolean);
    items.forEach((ing) => placed.add(ing.id));
    if (items.length > 0) {
      sections.push({ ...def, label: ingredientSectionLabel(def.id), items });
    }
  }

  const rest = Object.values(byId).filter((ing) => !placed.has(ing.id));
  if (rest.length > 0) {
    sections.push({ id: "other", label: ingredientSectionLabel("other"), emoji: "🍽️", items: rest });
  }
  return sections;
}

export function canPrepOnBoard(id) {
  return (
    (Boolean(PREP_OPERATIONS[id]) || PEELABLE_IDS.includes(id) || BONE_MEAT_IDS.includes(id))
    && !isLiquidId(id)
    && !DRY_SEASONING_IDS.includes(id)
    && !canSeasoningPrep(id)
  );
}

export function canPrepIngredient(id) {
  return canPrepOnBoard(id) || canSeasoningPrep(id) || canMarinateIngredient(id);
}

/** 砧板操作：削皮/去骨 + 原有切法 */
export function getBoardPrepOps(ingredientId, prepFlags) {
  const f = prepFlags || getInitialPrepFlags(ingredientId);
  const ops = [];
  if (PEELABLE_IDS.includes(ingredientId) && f.withSkin !== false) {
    ops.push({ ...PEEL_OP });
  }
  if (BONE_MEAT_IDS.includes(ingredientId) && f.withBone !== false) {
    ops.push({ ...DEBONE_OP });
  }
  const base = PREP_OPERATIONS[ingredientId] || [];
  base.forEach((op) => {
    if (op.id !== "peel" && op.id !== "debone") ops.push(op);
  });
  return ops;
}

/** 默认需削皮的蔬菜（初始 withSkin: true） */
export const PEELABLE_IDS = ["potato", "tomato", "eggplant", "carrot", "cucumber"];

/** 默认带骨的肉类/鱼（初始 withBone: true） */
export const BONE_MEAT_IDS = ["chicken", "duck", "fish", "lamb"];

/** 可腌制（砧板选料后放腌制碗） */
export const MARINATABLE_IDS = [
  ...BONE_MEAT_IDS,
  "pork", "beef", "shrimp", "squid",
  "tofu", "mushroom",
  ...PEELABLE_IDS.filter((id) => id !== "cucumber"),
];

/** 调料台可选：干调料 + 酱汁 + 葱姜蒜 */
export const SEASONING_PREP_IDS = [
  ...DRY_SEASONING_IDS,
  ...LIQUID_SEASONING_IDS,
  "oil", "cooking_wine", "chili_oil",
  "garlic", "ginger", "scallion", "chili",
];

export function getInitialPrepFlags(ingredientId) {
  if (!ingredientId) {
    return { withSkin: false, withBone: false, marinated: false };
  }
  return {
    withSkin: PEELABLE_IDS.includes(ingredientId),
    withBone: BONE_MEAT_IDS.includes(ingredientId),
    marinated: false,
  };
}

export function canMarinateIngredient(id) {
  return MARINATABLE_IDS.includes(id);
}

/** 腌制碗可选腌料（酱汁、干料、香料） */
export const MARINADE_SEASONING_IDS = [
  ...LIQUID_SEASONING_IDS,
  "oil", "cooking_wine", "chili_oil", "water",
  ...DRY_SEASONING_IDS,
  "garlic", "ginger", "scallion", "chili",
];

export const MARINATE_DURATIONS = [
  { min: 5, label: "5 分钟", hint: "快腌·表面入味" },
  { min: 15, label: "15 分钟", hint: "常规·家常腌制" },
  { min: 30, label: "30 分钟", hint: "入味·肉质松软" },
  { min: 60, label: "60 分钟", hint: "深腌·浓香味足" },
];

export function canMarinateSeasoning(id) {
  return MARINADE_SEASONING_IDS.includes(id);
}

/** 游戏计时：标注的「分钟」按秒推进（15 分钟 ≈ 15 秒） */
export const MARINATE_SEC_PER_LABEL_MIN = 1;

/** 腌制进度 0～1 */
export function getMarinateItemProgress(item, nowMs = Date.now()) {
  if (item?.done) return 1;
  if (!item?.startedAt) return 0;
  const elapsedSec = (nowMs - item.startedAt) / 1000;
  const durSec = Math.max(1, (item.durationMin || 15) * MARINATE_SEC_PER_LABEL_MIN);
  return Math.min(1, elapsedSec / durSec);
}

export function marinateStrengthFromMinutes(min) {
  if (min >= 60) return 1;
  if (min >= 30) return 0.85;
  if (min >= 15) return 0.65;
  if (min >= 5) return 0.4;
  return 0.25;
}

export function formatMarinateBrineLabel(ids) {
  if (!ids?.length) return "清水基底";
  return ids.slice(0, 4).map((id) => EMOJI[id] || "").join("") + ` 等 ${ids.length} 种`;
}

export function canSeasoningPrep(id) {
  return SEASONING_PREP_IDS.includes(id);
}

const PEEL_OP = { id: "peel", label: "🥔 削皮", state: "whole", action: "peel" };
const DEBONE_OP = { id: "debone", label: "🦴 去骨", state: "whole", action: "debone" };

export const PREP_STATE_LABELS = {
  whole: "整颗/原样",
  cracked: "已敲开",
  melted: "已融化",
  shucked: "已去壳",
  chopped: "已切段",
  sliced: "已切片",
  diced: "已切丁",
  minced: "已切末",
  marinated: "已腌制",
  seasoning_ready: "调料已备好",
};

export function formatPrepStateLabel(prepState, cut, prepFlags) {
  const parts = [];
  const f = prepFlags || {};
  if (f.withSkin === false) parts.push(t("prep.state.peeled"));
  if (f.withBone === false) parts.push(t("prep.state.deboned"));
  if (f.setAside) parts.push(t("prep.state.setAside"));
  if (prepState === "marinated" || f.marinated) {
    const m = f.marinateMinutes;
    parts.push(m ? t("prep.state.marinateMin", { n: m }) : t("prep.state.marinated"));
  } else if (f.marinateMinutes && f.marinated === false) {
    parts.push(t("prep.state.marinateBrine", { n: f.marinateMinutes }));
  }
  if (prepState === "seasoning_ready") parts.push(t("prep.state.seasoningHold"));
  if (prepState && !["whole", "marinated", "seasoning_ready"].includes(prepState)) {
    const sk = "prep.state." + prepState;
    const lbl = t(sk);
    if (lbl !== sk) parts.push(lbl);
  } else if (prepState === "whole" && parts.length === 0) {
    parts.push(t("prep.state.whole"));
  }
  if (cut && cut !== "none" && cut !== "chop" && !["sliced", "diced", "minced", "chopped"].includes(prepState)) {
    parts.push(t("prep.state.cut", { cut }));
  }
  if (parts.length) return parts.join(" · ");
  return t("prep.state.processed");
}
