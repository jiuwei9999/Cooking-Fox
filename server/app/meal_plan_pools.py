"""本地菜谱库：与 web/src/shared/mealPlanPresets.js 同步，用于 AI 食谱扩展时保证多样性。"""
from __future__ import annotations

import copy
from typing import Any

WEEKDAY_ZH = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
WEEKDAY_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

_SLOT_SALT = {"breakfast": 0, "lunch": 13, "dinner": 27, "snack": 9}

_POOLS_ZH: dict[str, dict[str, list[dict]]] = {
    "weight_loss": {
        "breakfast": [
            {"type": "breakfast", "name": "燕麦鸡蛋碗", "items": ["燕麦40g", "水煮蛋1个", "小番茄", "无糖豆浆200ml"], "note": "高纤维低 GI"},
            {"type": "breakfast", "name": "全麦三明治", "items": ["全麦面包2片", "鸡胸肉50g", "生菜", "黄瓜"], "note": "少酱少油"},
            {"type": "breakfast", "name": "希腊酸奶杯", "items": ["无糖酸奶150g", "蓝莓", "奇亚籽5g"], "note": "控糖"},
            {"type": "breakfast", "name": "杂粮粥配小菜", "items": ["杂粮粥1小碗", "凉拌黄瓜", "茶叶蛋1个"], "note": "清淡饱腹"},
        ],
        "lunch": [
            {"type": "lunch", "name": "清蒸鱼配杂粮饭", "items": ["鲈鱼150g", "杂粮饭100g", "西兰花", "香菇"], "note": "蒸制少油"},
            {"type": "lunch", "name": "番茄牛肉荞麦面", "items": ["瘦牛肉80g", "荞麦面80g", "番茄", "青菜"], "note": "牛肉焯水"},
            {"type": "lunch", "name": "鸡胸沙拉碗", "items": ["鸡胸肉100g", "混合生菜", "彩椒", "藜麦50g"], "note": "柠檬汁调味"},
            {"type": "lunch", "name": "白灼虾配糙米饭", "items": ["虾仁100g", "糙米饭80g", "芦笋", "木耳"], "note": "少盐"},
        ],
        "dinner": [
            {"type": "dinner", "name": "冬瓜虾仁汤套餐", "items": ["虾仁80g", "冬瓜", "豆腐", "青菜"], "note": "七分饱"},
            {"type": "dinner", "name": "菌菇蔬菜锅", "items": ["各菌菇150g", "娃娃菜", "豆腐50g"], "note": "清汤"},
            {"type": "dinner", "name": "白灼菜心配蒸蛋", "items": ["菜心200g", "鸡蛋1个", "少量生抽"], "note": "少油"},
            {"type": "dinner", "name": "凉拌鸡丝魔芋面", "items": ["鸡胸丝80g", "魔芋面", "黄瓜丝", "香菜"], "note": "晚餐轻食"},
        ],
        "snack": [{"type": "snack", "name": "小份坚果", "items": ["原味杏仁10g"], "note": "饥饿时少量"}],
    },
    "diabetes": {
        "breakfast": [
            {"type": "breakfast", "name": "杂豆粥+水煮蛋", "items": ["杂豆粥1小碗", "鸡蛋1个", "黄瓜条"], "note": "延缓升糖"},
            {"type": "breakfast", "name": "牛奶全麦馒头", "items": ["全麦馒头半个", "牛奶200ml", "核桃2个"], "note": "固定碳水"},
            {"type": "breakfast", "name": "蔬菜蛋饼", "items": ["鸡蛋1个", "菠菜", "全麦粉30g"], "note": "搭配蔬菜"},
        ],
        "lunch": [
            {"type": "lunch", "name": "糙米饭配清炒时蔬", "items": ["糙米饭80g", "瘦肉60g", "时蔬200g"], "note": "先菜后饭"},
            {"type": "lunch", "name": "藜麦鸡胸便当", "items": ["藜麦50g", "鸡胸80g", "芦笋", "胡萝卜"], "note": "无含糖酱"},
            {"type": "lunch", "name": "豆腐海带汤配杂粮", "items": ["北豆腐", "海带", "杂粮饭70g"], "note": "稳血糖"},
        ],
        "dinner": [
            {"type": "dinner", "name": "鲫鱼豆腐汤", "items": ["鲫鱼1小条", "豆腐", "生姜", "青菜"], "note": "少盐"},
            {"type": "dinner", "name": "蒸南瓜配菠菜", "items": ["南瓜100g", "菠菜", "豆腐干50g"], "note": "南瓜算碳水"},
            {"type": "dinner", "name": "鸡丝菌菇煲", "items": ["鸡胸丝", "菌菇", "青菜"], "note": "清淡"},
        ],
    },
    "hypertension": {
        "breakfast": [
            {"type": "breakfast", "name": "低钠早餐盘", "items": ["全麦吐司", "无盐花生酱", "香蕉半根", "低脂奶"], "note": "少盐"},
            {"type": "breakfast", "name": "紫薯小米粥", "items": ["紫薯", "小米", "芹菜粒"], "note": "无咸菜"},
            {"type": "breakfast", "name": "燕麦香蕉杯", "items": ["燕麦", "香蕉", "低脂酸奶"], "note": "控钠"},
        ],
        "lunch": [
            {"type": "lunch", "name": "DASH 午餐盘", "items": ["糙米", "烤鸡胸", "大量蔬菜", "橄榄油5ml"], "note": "香料代盐"},
            {"type": "lunch", "name": "芹菜木耳炒百合", "items": ["芹菜", "木耳", "百合", "豆腐"], "note": "补钾镁"},
            {"type": "lunch", "name": "清蒸鳕鱼套餐", "items": ["鳕鱼", "红薯", "西兰花"], "note": "蒸制"},
        ],
        "dinner": [
            {"type": "dinner", "name": "番茄豆腐煲", "items": ["番茄", "北豆腐", "香菇"], "note": "晚餐控盐"},
            {"type": "dinner", "name": "清蒸鲈鱼", "items": ["鲈鱼", "葱姜", "蒸鱼豉油极少量"], "note": "柠檬汁提鲜"},
            {"type": "dinner", "name": "凉拌海带豆芽", "items": ["海带", "豆芽", "醋"], "note": "清爽"},
        ],
    },
    "kidney": {
        "breakfast": [
            {"type": "breakfast", "name": "低蛋白早餐", "items": ["低蛋白大米粥", "鸡蛋白1个", "苹果"], "note": "遵医嘱"},
            {"type": "breakfast", "name": "麦淀粉饼", "items": ["麦淀粉", "少量蔬菜"], "note": "个体化"},
        ],
        "lunch": [
            {"type": "lunch", "name": "控钾午餐", "items": ["低钾蔬菜", "适量蛋白", "麦淀粉主食"], "note": "避高钾果"},
            {"type": "lunch", "name": "清炖鸡丝", "items": ["鸡胸丝50g", "冬瓜", "米饭少量"], "note": "限蛋白"},
        ],
        "dinner": [
            {"type": "dinner", "name": "冬瓜汤面", "items": ["冬瓜", "细面条少量", "青菜"], "note": "控水控盐"},
            {"type": "dinner", "name": "蒸蛋白羹", "items": ["鸡蛋白", "低钠调味"], "note": "少蛋黄"},
        ],
    },
    "heart": {
        "breakfast": [
            {"type": "breakfast", "name": "燕麦莓果", "items": ["燕麦", "蓝莓", "亚麻籽"], "note": "可溶性纤维"},
            {"type": "breakfast", "name": "全麦牛油果吐司", "items": ["全麦吐司", "牛油果1/4", "番茄"], "note": "好脂肪"},
        ],
        "lunch": [
            {"type": "lunch", "name": "三文鱼沙拉", "items": ["三文鱼80g", "混合蔬菜", "橄榄油5ml"], "note": "每周2次鱼"},
            {"type": "lunch", "name": "扁豆蔬菜饭", "items": ["扁豆", "糙米", "时蔬"], "note": "少红肉"},
        ],
        "dinner": [
            {"type": "dinner", "name": "地中海蔬菜锅", "items": ["番茄", "西葫芦", "鹰嘴豆"], "note": "橄榄油少量"},
            {"type": "dinner", "name": "烤鸡胸配烤蔬菜", "items": ["鸡胸", "彩椒", "洋葱"], "note": "少油炸"},
        ],
    },
    "general": {
        "breakfast": [
            {"type": "breakfast", "name": "经典中式早餐", "items": ["小米粥", "鸡蛋", "小菜"], "note": "均衡"},
            {"type": "breakfast", "name": "豆浆全麦包", "items": ["豆浆", "全麦包", "水果"], "note": "少油炸"},
            {"type": "breakfast", "name": "馄饨+小菜", "items": ["小馄饨", "紫菜", "青菜"], "note": "适量"},
            {"type": "breakfast", "name": "红薯山药粥", "items": ["红薯", "山药", "红枣1颗"], "note": "暖胃"},
        ],
        "lunch": [
            {"type": "lunch", "name": "一荤两素套餐", "items": ["瘦肉80g", "两种时蔬", "米饭"], "note": "半盘蔬菜"},
            {"type": "lunch", "name": "番茄炒蛋盖饭", "items": ["番茄", "鸡蛋", "米饭"], "note": "家常"},
            {"type": "lunch", "name": "青椒肉丝面", "items": ["瘦肉", "青椒", "面条"], "note": "少油炒"},
            {"type": "lunch", "name": "酸菜鱼配米饭", "items": ["鱼片", "酸菜", "米饭半碗"], "note": "少喝汤油"},
        ],
        "dinner": [
            {"type": "dinner", "name": "家常小炒套餐", "items": ["时令蔬菜", "豆腐或鱼", "少量主食"], "note": "七分饱"},
            {"type": "dinner", "name": "蔬菜汤面", "items": ["面条", "青菜", "菌菇"], "note": "清淡"},
            {"type": "dinner", "name": "蒜蓉西兰花配鸡胸", "items": ["西兰花", "鸡胸", "玉米半根"], "note": "少油"},
            {"type": "dinner", "name": "皮蛋瘦肉粥", "items": ["瘦肉粥", "小菜"], "note": "易消化"},
        ],
    },
}

# 英文池精简但保持多选项
_POOLS_EN: dict[str, dict[str, list[dict]]] = {
    "weight_loss": {
        "breakfast": [
            {"type": "breakfast", "name": "Oat egg bowl", "items": ["Oats 40g", "1 boiled egg", "Tomatoes"], "note": "High fiber"},
            {"type": "breakfast", "name": "Whole-grain sandwich", "items": ["Whole bread", "Chicken 50g", "Lettuce"], "note": "Light dressing"},
            {"type": "breakfast", "name": "Yogurt berry cup", "items": ["Plain yogurt", "Berries", "Chia"], "note": "Low sugar"},
        ],
        "lunch": [
            {"type": "lunch", "name": "Steamed fish + grain", "items": ["White fish 150g", "Brown rice 80g", "Broccoli"], "note": "Steamed"},
            {"type": "lunch", "name": "Beef tomato noodles", "items": ["Lean beef", "Noodles", "Tomato"], "note": "Blanch beef"},
            {"type": "lunch", "name": "Chicken salad bowl", "items": ["Chicken breast", "Greens", "Quinoa"], "note": "Lemon dressing"},
        ],
        "dinner": [
            {"type": "dinner", "name": "Shrimp melon soup set", "items": ["Shrimp", "Winter melon", "Tofu"], "note": "Light dinner"},
            {"type": "dinner", "name": "Mushroom veg hot pot", "items": ["Mixed mushrooms", "Greens"], "note": "Clear broth"},
            {"type": "dinner", "name": "Steamed egg + greens", "items": ["Egg", "Choy sum"], "note": "Low oil"},
        ],
    },
    "diabetes": {
        "breakfast": [
            {"type": "breakfast", "name": "Bean porridge + egg", "items": ["Bean porridge", "1 egg"], "note": "Slow carbs"},
            {"type": "breakfast", "name": "Milk whole-grain bun", "items": ["Whole bun half", "Milk"], "note": "Count carbs"},
        ],
        "lunch": [
            {"type": "lunch", "name": "Brown rice plate", "items": ["Brown rice", "Lean meat", "Veg"], "note": "Veg first"},
            {"type": "lunch", "name": "Quinoa chicken box", "items": ["Quinoa", "Chicken", "Asparagus"], "note": "No sugary sauce"},
        ],
        "dinner": [
            {"type": "dinner", "name": "Fish tofu soup", "items": ["Fish", "Tofu", "Greens"], "note": "Low salt"},
            {"type": "dinner", "name": "Pumpkin spinach plate", "items": ["Pumpkin", "Spinach"], "note": "Count pumpkin as carb"},
        ],
    },
    "hypertension": {
        "breakfast": [
            {"type": "breakfast", "name": "Low-sodium plate", "items": ["Whole toast", "Low-fat milk"], "note": "No pickles"},
            {"type": "breakfast", "name": "Purple sweet potato porridge", "items": ["Sweet potato", "Millet"], "note": "Herbs not salt"},
        ],
        "lunch": [
            {"type": "lunch", "name": "DASH lunch", "items": ["Whole grains", "Grilled chicken", "Veg"], "note": "Spices"},
            {"type": "lunch", "name": "Steamed cod set", "items": ["Cod", "Sweet potato", "Broccoli"], "note": "Steamed"},
        ],
        "dinner": [
            {"type": "dinner", "name": "Tomato tofu stew", "items": ["Tomato", "Tofu"], "note": "Evening low sodium"},
            {"type": "dinner", "name": "Steamed sea bass", "items": ["Sea bass", "Ginger"], "note": "Minimal soy"},
        ],
    },
    "kidney": {
        "breakfast": [{"type": "breakfast", "name": "Low-protein breakfast", "items": ["Low-protein porridge", "Egg white"], "note": "Clinician plan"}],
        "lunch": [
            {"type": "lunch", "name": "Low-potassium lunch", "items": ["Low-K veg", "Limited protein"], "note": "Avoid high-K fruit"},
            {"type": "lunch", "name": "Chicken shred stew", "items": ["Chicken shred", "Winter melon"], "note": "Portion control"},
        ],
        "dinner": [{"type": "dinner", "name": "Light soup noodles", "items": ["Melon", "Small noodles"], "note": "Fluid limits"}],
    },
    "heart": {
        "breakfast": [{"type": "breakfast", "name": "Oat berries", "items": ["Oats", "Berries"], "note": "Fiber"}],
        "lunch": [
            {"type": "lunch", "name": "Salmon salad", "items": ["Salmon", "Greens"], "note": "Fish twice weekly"},
            {"type": "lunch", "name": "Lentil veg rice", "items": ["Lentils", "Brown rice"], "note": "Less red meat"},
        ],
        "dinner": [{"type": "dinner", "name": "Med veg stew", "items": ["Tomato", "Zucchini", "Chickpeas"], "note": "Olive oil little"}],
    },
    "general": {
        "breakfast": [
            {"type": "breakfast", "name": "Classic breakfast", "items": ["Millet porridge", "Egg"], "note": "Balanced"},
            {"type": "breakfast", "name": "Soy milk whole bread", "items": ["Soy milk", "Whole bread"], "note": "Light"},
            {"type": "breakfast", "name": "Wonton + greens", "items": ["Small wonton", "Seaweed"], "note": "Moderate"},
        ],
        "lunch": [
            {"type": "lunch", "name": "Protein veg grain", "items": ["Lean meat", "Two veg", "Rice"], "note": "Half plate veg"},
            {"type": "lunch", "name": "Tomato egg rice", "items": ["Tomato", "Egg", "Rice"], "note": "Home style"},
            {"type": "lunch", "name": "Pork pepper noodles", "items": ["Pork", "Pepper", "Noodles"], "note": "Less oil"},
        ],
        "dinner": [
            {"type": "dinner", "name": "Light stir-fry set", "items": ["Seasonal veg", "Tofu or fish"], "note": "70% full"},
            {"type": "dinner", "name": "Veg soup noodles", "items": ["Noodles", "Greens"], "note": "Easy digest"},
            {"type": "dinner", "name": "Garlic broccoli chicken", "items": ["Broccoli", "Chicken"], "note": "Low oil"},
        ],
    },
}


def merge_pools(conditions: list[str], lang: str) -> dict[str, list[dict]]:
    pools = _POOLS_EN if lang == "en" else _POOLS_ZH
    keys = conditions if conditions else ["general"]
    merged: dict[str, list[dict]] = {"breakfast": [], "lunch": [], "dinner": [], "snack": []}
    for key in keys:
        p = pools.get(key) or pools["general"]
        for slot in ("breakfast", "lunch", "dinner", "snack"):
            merged[slot].extend(p.get(slot) or [])
    general = pools["general"]
    for slot in ("breakfast", "lunch", "dinner"):
        if not merged[slot]:
            merged[slot].extend(general.get(slot) or [])
    return merged


def _pick_meal(pool: dict[str, list[dict]], day_index: int, slot: str, avoid_names: set[str]) -> dict | None:
    arr = pool.get(slot) or []
    if not arr:
        return None
    salt = _SLOT_SALT.get(slot, 0)
    for attempt in range(len(arr)):
        idx = (day_index + salt + attempt * 3) % len(arr)
        meal = arr[idx]
        name = meal.get("name") or ""
        if name not in avoid_names or attempt == len(arr) - 1:
            avoid_names.add(name)
            return copy.deepcopy(meal)
    return copy.deepcopy(arr[0])


def build_local_day(
    pool: dict[str, list[dict]],
    day_index: int,
    day_count: int,
    lang: str,
    recent_names: set[str],
) -> dict[str, Any]:
    weekdays = WEEKDAY_EN if lang == "en" else WEEKDAY_ZH
    week_idx = day_index % 7
    cycle = day_index // 7 + 1
    label = (
        f"第{cycle}周 {weekdays[week_idx]}"
        if day_count > 7
        else weekdays[week_idx]
    )
    avoid = set(recent_names)
    meals: list[dict] = []
    for slot in ("breakfast", "lunch", "dinner"):
        m = _pick_meal(pool, day_index + week_idx, slot, avoid)
        if m:
            meals.append(m)
    if pool.get("snack") and day_index % 2 == 0:
        sm = _pick_meal(pool, day_index, "snack", avoid)
        if sm:
            meals.append(sm)
    for m in meals:
        if m.get("name"):
            recent_names.add(m["name"])
    # 控制记忆窗口，避免整月后无处可选
    if len(recent_names) > 40:
        recent_names.clear()
    return {"day": day_index + 1, "label": label, "meals": meals}


def expand_plan_with_local_catalog(
    ai_days: list[dict],
    day_count: int,
    conditions: list[str],
    lang: str,
) -> list[dict]:
    """前段保留 AI 定制日，其余每天用本地菜谱库轮换，避免重复腻味。"""
    pool = merge_pools(conditions, lang)
    n_ai = len(ai_days)
    recent: set[str] = set()
    expanded: list[dict] = []

    for d in range(day_count):
        if d < n_ai:
            day = ai_days[d]
            expanded.append({
                "day": d + 1,
                "label": day.get("label") or "",
                "meals": copy.deepcopy(day.get("meals") or []),
            })
            for m in day.get("meals") or []:
                if isinstance(m, dict) and m.get("name"):
                    recent.add(m["name"])
        else:
            expanded.append(build_local_day(pool, d, day_count, lang, recent))

    return expanded


_SCIENCE_TIPS_ZH: dict[str, list[str]] = {
    "weight_loss": [
        "减脂期：每日蔬菜不少于500g，主食优先全谷物，烹调少油（25g/日内）。",
        "蛋白质分散到三餐（鱼禽豆蛋），避免夜间大量碳水。",
    ],
    "diabetes": [
        "控糖：固定每餐碳水份量，先吃蔬菜再吃主食，少喝含糖饮料。",
        "选择低 GI 主食（燕麦、糙米、杂豆），避免粥类过烂。",
    ],
    "hypertension": [
        "低钠：每日食盐<5g，少吃腌制品与外卖汤底，用香料/醋提味。",
        "增加钾镁来源：绿叶菜、豆类（肾病者遵医嘱）。",
    ],
    "kidney": [
        "肾病饮食需个体化：限蛋白、限磷钾钠，请务必遵循主治医生方案。",
    ],
    "heart": [
        "护心：少饱和脂肪与反式脂肪，每周2次深海鱼，少红肉多豆类。",
    ],
    "general": [
        "平衡膳食：每天12种以上食物，每周25种以上，足量饮水。",
        "三餐能量参考比例：早餐30%、午餐40%、晚餐30%，晚餐不过饱。",
    ],
}

_SCIENCE_TIPS_EN: dict[str, list[str]] = {
    "weight_loss": ["Weight loss: ≥500g vegetables/day, whole grains, cooking oil ≤25g/day."],
    "diabetes": ["Diabetes: fixed carb portions per meal; vegetables before starch; low-GI grains."],
    "hypertension": ["Hypertension: salt <5g/day; avoid pickles and salty broth."],
    "kidney": ["Kidney disease diets must be individualized—follow your clinician."],
    "heart": ["Heart health: less saturated fat; fatty fish twice weekly."],
    "general": ["Balanced diet: variety across the week; ~30/40/30 energy split across meals."],
}


def scientific_tips(conditions: list[str], lang: str, calorie_plan: dict | None) -> list[str]:
    tips_map = _SCIENCE_TIPS_EN if lang == "en" else _SCIENCE_TIPS_ZH
    keys = conditions if conditions else ["general"]
    tips: list[str] = []
    for k in keys:
        tips.extend(tips_map.get(k, []))
    if not tips:
        tips.extend(tips_map.get("general", []))
    if calorie_plan and calorie_plan.get("daily_kcal"):
        if lang == "en":
            tips.insert(0, f"Daily energy target ~{calorie_plan['daily_kcal']} kcal (estimate; adjust with clinician).")
        else:
            tips.insert(0, f"每日目标热量约 {calorie_plan['daily_kcal']} 大卡（估算值，请结合体检与医嘱调整）。")
    # 去重保序
    seen: set[str] = set()
    out: list[str] = []
    for t in tips:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out[:6]


def build_scientific_meal_plan(
    *,
    day_count: int,
    conditions: list[str],
    lang: str,
    cond_text: str,
    calorie_plan: dict | None,
    allergies: str = "",
    dislikes: str = "",
) -> dict[str, Any]:
    """AI 不可用时的循证导向本地食谱（菜谱库轮换 + 科学提示）。"""
    days = expand_plan_with_local_catalog([], day_count, conditions, lang)
    if lang == "en":
        summary = (
            f"Evidence-informed {day_count}-day plan for {cond_text}. "
            "Meals rotate from a nutrition catalog; not a substitute for medical advice."
        )
        disclaimer = "For education only. Follow your doctor or dietitian for medical conditions."
    else:
        summary = (
            f"依据《中国居民膳食指南》原则，为「{cond_text}」生成的{day_count}天参考食谱，"
            "强调食物多样、均衡营养；不能替代个体化医疗与营养处方。"
        )
        disclaimer = "本食谱仅供参考，慢病患者（尤其肾病、糖尿病）请在医生或注册营养师指导下调整。"

    if allergies:
        summary += (" Avoid: " if lang == "en" else " 忌口注意：") + allergies
    if dislikes:
        summary += (" Dislikes: " if lang == "en" else " 已避开：") + dislikes

    return {
        "title": f"{day_count}天{cond_text}科学食谱" if lang != "en" else f"{day_count}-day {cond_text} plan",
        "summary": summary,
        "disclaimer": disclaimer,
        "days": days,
        "tips": scientific_tips(conditions, lang, calorie_plan),
        "calorie_plan": calorie_plan,
    }
