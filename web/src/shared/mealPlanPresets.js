/** 本地规则模板：无 AI 时生成一周/一月食谱 */

const WEEKDAY_ZH = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const WEEKDAY_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** @typedef {{ type: string, name: string, items: string[], note?: string }} MealTemplate */

/** @type {Record<string, { breakfast: MealTemplate[], lunch: MealTemplate[], dinner: MealTemplate[], snack?: MealTemplate[] }>} */
const POOLS_ZH = {
  weight_loss: {
    breakfast: [
      { type: "breakfast", name: "燕麦鸡蛋碗", items: ["燕麦40g", "水煮蛋1个", "小番茄", "无糖豆浆200ml"], note: "高纤维低 GI，延长饱腹感" },
      { type: "breakfast", name: "全麦三明治", items: ["全麦面包2片", "鸡胸肉50g", "生菜", "黄瓜"], note: "少酱少油" },
      { type: "breakfast", name: "希腊酸奶杯", items: ["无糖酸奶150g", "蓝莓", "奇亚籽5g"], note: "控糖加餐型早餐" },
    ],
    lunch: [
      { type: "lunch", name: "清蒸鱼配杂粮饭", items: ["鲈鱼/鳕鱼150g", "杂粮饭100g", "西兰花", "香菇"], note: "蒸制，少油少盐" },
      { type: "lunch", name: "番茄牛肉荞麦面", items: ["瘦牛肉80g", "荞麦面80g", "番茄", "青菜"], note: "牛肉先焯水去浮沫" },
      { type: "lunch", name: "鸡胸沙拉碗", items: ["鸡胸肉100g", "混合生菜", "彩椒", "quinoa 50g"], note: "柠檬汁代替沙拉酱" },
    ],
    dinner: [
      { type: "dinner", name: "冬瓜虾仁汤+凉拌菜", items: ["虾仁80g", "冬瓜", "豆腐", "木耳"], note: "晚餐七分饱" },
      { type: "dinner", name: "菌菇蔬菜锅", items: ["各菌菇150g", "娃娃菜", "豆腐50g"], note: "清汤，不勾芡" },
      { type: "dinner", name: "白灼菜心配蒸蛋", items: ["菜心200g", "鸡蛋1个", "少量生抽"], note: "避免夜间高油炒" },
    ],
    snack: [{ type: "snack", name: "小份坚果", items: ["原味杏仁10g"], note: "仅饥饿时少量" }],
  },
  diabetes: {
    breakfast: [
      { type: "breakfast", name: "杂豆粥+水煮蛋", items: ["杂豆粥1小碗", "鸡蛋1个", "黄瓜条"], note: "粥不宜过烂，搭配蛋白减缓升糖" },
      { type: "breakfast", name: "牛奶全麦馒头", items: ["全麦馒头半个", "牛奶200ml", "核桃2个"], note: "监测餐后血糖" },
    ],
    lunch: [
      { type: "lunch", name: "糙米饭配清炒时蔬", items: ["糙米饭80g", "瘦肉60g", "时蔬200g"], note: "先菜后饭，固定碳水量" },
      { type: "lunch", name: "藜麦鸡胸便当", items: ["藜麦50g", "鸡胸80g", "芦笋", "胡萝卜"], note: "不加含糖酱汁" },
    ],
    dinner: [
      { type: "dinner", name: "鲫鱼豆腐汤", items: ["鲫鱼1小条", "豆腐", "生姜", "青菜"], note: "少盐，避免勾芡" },
      { type: "dinner", name: "蒸南瓜配清炒菠菜", items: ["南瓜100g", "菠菜", "豆腐干50g"], note: "南瓜算碳水，需计入总量" },
    ],
  },
  hypertension: {
    breakfast: [
      { type: "breakfast", name: "低钠早餐盘", items: ["全麦吐司", "无盐花生酱", "香蕉半根", "低脂奶"], note: "每日钠<2000mg，避免腌制品" },
      { type: "breakfast", name: "紫薯粥", items: ["紫薯", "小米", "芹菜粒"], note: "不放咸菜" },
    ],
    lunch: [
      { type: "lunch", name: "DASH 风格午餐", items: ["糙米", "烤鸡胸", "大量蔬菜", "少量橄榄油"], note: "用香料代替盐" },
      { type: "lunch", name: "芹菜木耳炒百合", items: ["芹菜", "木耳", "百合", "豆腐"], note: "有助于钾镁摄入" },
    ],
    dinner: [
      { type: "dinner", name: "番茄豆腐煲", items: ["番茄", "北豆腐", "香菇", "少油"], note: "晚餐尤其控盐" },
      { type: "dinner", name: "清蒸鲈鱼", items: ["鲈鱼", "葱姜", "蒸鱼豉油极少量"], note: "可用柠檬汁提鲜" },
    ],
  },
  kidney: {
    breakfast: [
      { type: "breakfast", name: "低蛋白早餐", items: ["低蛋白大米粥", "鸡蛋白1个", "苹果"], note: "限制磷钾；需个体化调整" },
      { type: "breakfast", name: "麦淀粉饼", items: ["麦淀粉", "少量蔬菜"], note: "透析患者方案需遵医嘱" },
    ],
    lunch: [
      { type: "lunch", name: "控钾午餐", items: ["低钾蔬菜", "适量优质蛋白", "麦淀粉主食"], note: "避免香蕉、橙子、土豆等高钾食物" },
      { type: "lunch", name: "清炖鸡丝", items: ["鸡胸丝50g", "冬瓜", "米饭少量"], note: "蛋白质按体重与分期计算" },
    ],
    dinner: [
      { type: "dinner", name: "冬瓜汤面", items: ["冬瓜", "细面条少量", "青菜"], note: "控水控盐" },
      { type: "dinner", name: "蒸蛋羹", items: ["鸡蛋1个", "低钠调味"], note: "蛋黄含磷，可只吃蛋白" },
    ],
  },
  heart: {
    breakfast: [
      { type: "breakfast", name: "燕麦莓果", items: ["燕麦", "蓝莓", "亚麻籽"], note: "富含可溶性膳食纤维" },
    ],
    lunch: [
      { type: "lunch", name: "三文鱼沙拉", items: ["三文鱼80g", "混合蔬菜", "橄榄油5ml"], note: "每周2次深海鱼" },
    ],
    dinner: [
      { type: "dinner", name: "地中海蔬菜锅", items: ["番茄", "西葫芦", "鹰嘴豆", "橄榄油"], note: "少红肉" },
    ],
  },
  general: {
    breakfast: [
      { type: "breakfast", name: "经典中式早餐", items: ["小米粥", "鸡蛋", "小菜"], note: "均衡起步" },
      { type: "breakfast", name: "豆浆油条替代", items: ["豆浆", "全麦包", "水果"], note: "少油炸" },
    ],
    lunch: [
      { type: "lunch", name: "一荤两素套餐", items: ["瘦肉80g", "两种时蔬", "米饭"], note: "半盘蔬菜" },
      { type: "lunch", name: "番茄炒蛋盖饭", items: ["番茄", "鸡蛋", "米饭"], note: "可在厨房模拟练习" },
    ],
    dinner: [
      { type: "dinner", name: "家常小炒", items: ["时令蔬菜", "豆腐或鱼", "少量主食"], note: "七分饱" },
      { type: "dinner", name: "蔬菜汤面", items: ["面条", "青菜", "菌菇"], note: "清淡易消化" },
    ],
  },
};

const POOLS_EN = {
  weight_loss: {
    breakfast: [{ type: "breakfast", name: "Oat egg bowl", items: ["Oats 40g", "1 boiled egg", "Cherry tomatoes", "Unsweetened soy milk"], note: "High fiber, low GI" }],
    lunch: [{ type: "lunch", name: "Steamed fish + grain", items: ["White fish 150g", "Brown rice 100g", "Broccoli"], note: "Steam, minimal oil" }],
    dinner: [{ type: "dinner", name: "Veg soup + salad", items: ["Shrimp 80g", "Winter melon", "Tofu"], note: "Light dinner" }],
  },
  diabetes: {
    breakfast: [{ type: "breakfast", name: "Bean porridge + egg", items: ["Mixed bean porridge", "1 egg", "Cucumber"], note: "Pair carbs with protein" }],
    lunch: [{ type: "lunch", name: "Brown rice plate", items: ["Brown rice 80g", "Lean meat 60g", "Vegetables"], note: "Fixed carb portions" }],
    dinner: [{ type: "dinner", name: "Fish tofu soup", items: ["Fish", "Tofu", "Greens"], note: "No sugary sauces" }],
  },
  hypertension: {
    breakfast: [{ type: "breakfast", name: "Low-sodium plate", items: ["Whole-grain toast", "Low-fat milk", "Fruit"], note: "Avoid pickles" }],
    lunch: [{ type: "lunch", name: "DASH lunch", items: ["Whole grains", "Grilled chicken", "Vegetables"], note: "Herbs over salt" }],
    dinner: [{ type: "dinner", name: "Steamed fish", items: ["Fish", "Ginger", "Minimal soy"], note: "Control evening sodium" }],
  },
  kidney: {
    breakfast: [{ type: "breakfast", name: "Low-protein breakfast", items: ["Low-protein rice porridge", "Egg white", "Apple"], note: "Individualize with clinician" }],
    lunch: [{ type: "lunch", name: "Low-potassium lunch", items: ["Low-K vegetables", "Limited protein", "Starch"], note: "Avoid high-K fruits" }],
    dinner: [{ type: "dinner", name: "Light soup", items: ["Winter melon", "Small noodles", "Greens"], note: "Fluid/salt limits" }],
  },
  heart: {
    breakfast: [{ type: "breakfast", name: "Oat berries", items: ["Oats", "Berries", "Flax"], note: "Soluble fiber" }],
    lunch: [{ type: "lunch", name: "Salmon salad", items: ["Salmon 80g", "Mixed greens"], note: "Fatty fish twice weekly" }],
    dinner: [{ type: "dinner", name: "Med veg stew", items: ["Tomato", "Zucchini", "Chickpeas"], note: "Less red meat" }],
  },
  general: {
    breakfast: [{ type: "breakfast", name: "Balanced breakfast", items: ["Millet porridge", "Egg", "Side veg"], note: "Good baseline" }],
    lunch: [{ type: "lunch", name: "Protein + veg + grain", items: ["Lean meat", "Two vegetables", "Rice"], note: "Half plate vegetables" }],
    dinner: [{ type: "dinner", name: "Light home cooking", items: ["Seasonal veg", "Tofu or fish"], note: "70% full" }],
  },
};

function pick(pool, dayIndex, slot) {
  const arr = pool[slot] || [];
  if (!arr.length) return null;
  return arr[dayIndex % arr.length];
}

function mergePools(conditions, lang) {
  const pools = lang === "en" ? POOLS_EN : POOLS_ZH;
  const keys = conditions.length ? conditions : ["general"];
  const merged = { breakfast: [], lunch: [], dinner: [], snack: [] };
  keys.forEach((k) => {
    const p = pools[k] || pools.general;
    ["breakfast", "lunch", "dinner", "snack"].forEach((slot) => {
      if (p[slot]) merged[slot].push(...p[slot]);
    });
  });
  if (!merged.breakfast.length) merged.breakfast.push(...pools.general.breakfast);
  if (!merged.lunch.length) merged.lunch.push(...pools.general.lunch);
  if (!merged.dinner.length) merged.dinner.push(...pools.general.dinner);
  return merged;
}

/**
 * @param {object} form
 * @param {(k: string, p?: object) => string} t
 */
export function buildLocalMealPlan(form, t) {
  const lang = form.lang || "zh";
  const dayCount = form.duration === "month" ? 30 : 7;
  const weekdays = lang === "en" ? WEEKDAY_EN : WEEKDAY_ZH;
  const pool = mergePools(form.conditions || ["general"], lang);
  const condLabels = (form.conditions || ["general"]).map((c) => t(`mealPlan.cond.${c}`)).join(lang === "en" ? ", " : "、");

  let summary = t("mealPlan.localSummary", { cond: condLabels });
  const cp = (form.conditions || []).includes("weight_loss") ? form.calorie_plan : null;
  if (cp && cp.daily_kcal) {
    summary = t("mealPlan.summaryWithCal", {
      kcal: cp.daily_kcal,
      tdee: cp.tdee,
      bmr: cp.bmr,
      w0: cp.weight_current_kg,
      w1: cp.weight_target_kg,
      weeks: cp.weeks_for_goal,
    }) + " " + summary;
  }

  const days = [];
  for (let d = 0; d < dayCount; d++) {
    const weekIdx = d % 7;
    const cycle = Math.floor(d / 7) + 1;
    const label = dayCount <= 7
      ? weekdays[weekIdx]
      : (lang === "en" ? `Week ${cycle} · ${weekdays[weekIdx]}` : `第${cycle}周 ${weekdays[weekIdx]}`);

    const meals = ["breakfast", "lunch", "dinner"]
      .map((slot) => pick(pool, d + weekIdx, slot))
      .filter(Boolean);

    if (pool.snack?.length && d % 2 === 0) {
      meals.push(pick(pool, d, "snack"));
    }

    days.push({ day: d + 1, label, meals });
  }

  return {
    title: t("mealPlan.localTitle", { days: dayCount, cond: condLabels }),
    summary,
    calorie_plan: cp || null,
    disclaimer: t("mealPlan.disclaimer"),
    days,
    tips: [
      t("mealPlan.tip1"),
      t("mealPlan.tip2"),
      t("mealPlan.tip3"),
      form.allergies ? t("mealPlan.tipAllergies", { a: form.allergies }) : null,
    ].filter(Boolean),
    aiGenerated: false,
  };
}

export const CONDITION_IDS = ["weight_loss", "diabetes", "hypertension", "kidney", "heart", "general"];

export function normalizeMealPlan(plan, form, tFn) {
  if (!plan || typeof plan !== "object") {
    return form ? buildLocalMealPlan(form, tFn) : null;
  }

  let days = plan.days;
  if (days && typeof days === "object" && !Array.isArray(days)) {
    days = Object.values(days);
  }
  if (!Array.isArray(days)) days = [];

  const slotTypes = ["breakfast", "lunch", "dinner", "snack"];

  days = days.map((day, i) => {
    let meals = day?.meals;
    if (!Array.isArray(meals)) meals = [];

    // 兼容 AI 把餐次写成 day.breakfast / lunch 字段
    if (!meals.length) {
      for (const slot of slotTypes) {
        const block = day?.[slot];
        if (!block) continue;
        if (typeof block === "string") {
          meals.push({ type: slot, name: block, items: [] });
        } else if (typeof block === "object") {
          meals.push({ type: slot, ...block, items: block.items || block.ingredients || [] });
        }
      }
    }

    meals = meals.map((meal) => {
      let items = meal?.items ?? meal?.ingredients ?? meal?.foods;
      if (typeof items === "string") {
        items = items.split(/[,，、;；\n]/).map((s) => s.trim()).filter(Boolean);
      }
      if (!Array.isArray(items)) items = [];
      return {
        type: meal?.type || "meal",
        name: meal?.name || meal?.title || "",
        items,
        note: meal?.note || meal?.tips || "",
        calories_estimate: meal?.calories_estimate ?? meal?.calories ?? null,
      };
    }).filter((m) => m.name || m.items.length);

    return {
      day: Number(day?.day) || i + 1,
      label: day?.label || day?.weekday || "",
      meals,
    };
  });

  const hasMeals = days.some((d) => d.meals.length > 0);
  if (!days.length || !hasMeals) {
    if (!form) {
      return { ...plan, days, tips: Array.isArray(plan.tips) ? plan.tips : [] };
    }
    const local = buildLocalMealPlan(form, tFn);
    local.summary = (plan.summary ? plan.summary + " · " : "") + local.summary;
    return local;
  }

  const wantsWl = form?.wants_weight_loss ?? (form?.conditions || []).includes("weight_loss");
  const cp = plan.calorie_plan || (wantsWl ? form?.calorie_plan : null) || null;
  return {
    ...plan,
    title: plan.title || tFn("mealPlan.resultTitle"),
    summary: plan.summary || "",
    calorie_plan: cp,
    disclaimer: plan.disclaimer || tFn("mealPlan.disclaimer"),
    tips: Array.isArray(plan.tips) ? plan.tips : [],
    days,
  };
}

/** 仅在手动画保存时使用；生成食谱不会自动写入。 */
export const MEAL_PLAN_STORAGE_KEY = "cookingsim.mealPlan.latest";

export function saveMealPlan(plan) {
  try {
    localStorage.setItem(MEAL_PLAN_STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), plan }));
  } catch { /* ignore */ }
}

export function loadSavedMealPlan() {
  try {
    const raw = localStorage.getItem(MEAL_PLAN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
