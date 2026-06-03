"""导入后补全：推荐用量、缺失提示、简易步骤建议、步骤内食材识别。"""
from __future__ import annotations

import re
from typing import Any

from .lexicon import canonical_name, find_ingredients_in_text
from .meta import apply_recipe_meta

# 与前端 ingredientMeta.QAMT 对齐的默认克数
DEFAULT_G: dict[str, float] = {
    "salt": 1.0,
    "sugar": 3.0,
    "pepper": 0.5,
    "five_spice": 0.5,
    "chicken_powder": 2.0,
    "sesame": 2.0,
    "starch": 5.0,
    "soy_sauce": 8.0,
    "dark_soy_sauce": 5.0,
    "vinegar": 6.0,
    "sesame_oil": 4.0,
    "oyster_sauce": 10.0,
    "bean_paste": 12.0,
    "cooking_wine": 10.0,
    "chili_oil": 8.0,
    "oil": 12.0,
    "water": 200.0,
    "butter": 10.0,
    "garlic": 6.0,
    "ginger": 8.0,
    "chili": 8.0,
    "scallion": 12.0,
    "egg": 55.0,
    "tomato": 180.0,
    "cucumber": 120.0,
    "potato": 150.0,
    "carrot": 80.0,
    "onion": 100.0,
    "pork": 120.0,
    "beef": 120.0,
    "chicken": 150.0,
    "shrimp": 80.0,
    "fish": 150.0,
    "lamb": 120.0,
    "duck": 200.0,
    "squid": 150.0,
    "clam": 200.0,
    "tofu": 300.0,
    "mushroom": 100.0,
    "rice": 150.0,
    "noodle": 120.0,
    "flour": 40.0,
    "cabbage": 200.0,
    "bok_choy": 150.0,
    "broccoli": 180.0,
    "bell_pepper": 120.0,
    "eggplant": 200.0,
    "corn": 150.0,
    "green_bean": 120.0,
    "spinach": 100.0,
    "celery": 80.0,
}

# 步骤/菜名里作为主菜出现的蔬菜水产，推荐用量略高于调料
MAIN_DISH_G: dict[str, float] = {
    "cucumber": 200.0,
    "potato": 280.0,
    "tomato": 220.0,
    "carrot": 150.0,
    "onion": 120.0,
    "bell_pepper": 150.0,
    "eggplant": 250.0,
    "cabbage": 300.0,
    "bok_choy": 200.0,
    "broccoli": 250.0,
    "green_bean": 200.0,
    "spinach": 150.0,
    "celery": 120.0,
    "mushroom": 150.0,
    "tofu": 350.0,
    "pork": 150.0,
    "beef": 150.0,
    "chicken": 180.0,
    "shrimp": 120.0,
    "fish": 200.0,
    "egg": 110.0,
}

_SEASONING_IDS = {
    "salt", "oil", "sugar", "vinegar", "soy_sauce", "dark_soy_sauce",
    "pepper", "sesame_oil", "chicken_powder", "five_spice", "starch",
    "water", "cooking_wine", "oyster_sauce", "chili_oil", "bean_paste",
    "garlic", "ginger", "scallion", "chili",
}

PIECE_UNIT = re.compile(
    r"(?P<num>\d+(\.\d+)?)\s*(?P<unit>个|颗|只|条|根|瓣|片|块|勺|汤勺|茶勺|小勺|大勺|撮|g|克|kg|千克|ml|毫升|升|l)"
)


def enrich_recipe(recipe: dict[str, Any]) -> dict[str, Any]:
    """在解析结果上填充推荐用量、指引与步骤建议。"""
    out = dict(recipe)
    ingredients = [dict(i) for i in (out.get("ingredients") or [])]
    steps = list(out.get("steps") or [])
    warnings = list(out.get("warnings") or [])
    tips: list[str] = []
    estimated_count = 0
    unknown_ids: list[str] = []

    for ing in ingredients:
        if not ing.get("ingredient_id") and ing.get("name"):
            unknown_ids.append(ing["name"])
        if ing.get("amount_g") is None:
            est, note = _estimate_amount(ing)
            if est is not None:
                ing["amount_g"] = round(est, 1)
                ing["amount_estimated"] = True
                ing["amount_note"] = note
                estimated_count += 1
            else:
                ing["amount_note"] = "未能估算，请在厨房手动输入克数"
        else:
            ing["amount_estimated"] = False

    steps_estimated = False
    if not steps:
        steps = _suggest_steps(out.get("title") or "", ingredients)
        steps_estimated = True
        tips.append("未识别到做法步骤，已根据用料生成「参考步骤」（可保存后回厨房对照，不必严格按序）。")

    step_details, merged_from_steps = _build_step_details(steps, ingredients)
    if merged_from_steps:
        tips.insert(
            0,
            f"已从做法步骤中识别出 {merged_from_steps} 种食材，并补全到用料清单（可与上方用料对照）。",
        )
        for ing in ingredients:
            if ing.get("from_step") and ing.get("amount_g") is None:
                est, note = _estimate_amount(ing)
                if est is not None:
                    ing["amount_g"] = round(est, 1)
                    ing["amount_estimated"] = True
                    ing["amount_note"] = note or "根据步骤提及推断"
                    estimated_count += 1

    _boost_main_ingredient_amounts(out.get("title") or "", steps, ingredients)

    if estimated_count:
        tips.append(
            f"有 {estimated_count} 项用料缺少克数，已填入推荐大致用量（约 1～2 人份，可按口味加减）。"
        )
    if unknown_ids:
        tips.append(
            "以下食材未能自动匹配系统库，导入后请在厨房手动选对食材："
            + "、".join(unknown_ids[:6])
            + ("…" if len(unknown_ids) > 6 else "")
        )
    if not ingredients:
        tips.append("未识别到用料：建议在文本中加入「用料」标题，或每行写「食材名 + 数量」。")

    tips.append("设为「目标菜谱」后回厨房：右侧面板可一键加料；复杂菜请先在「备菜台」完成切配/腌制。")

    out["ingredients"] = ingredients
    out["steps"] = steps
    out["step_details"] = step_details
    out["warnings"] = warnings
    out["guide"] = {
        "tips": tips,
        "estimated_amounts": estimated_count,
        "steps_suggested": steps_estimated,
        "step_ingredients_detected": sum(len(sd.get("ingredients") or []) for sd in step_details),
        "ready_for_kitchen": bool(ingredients) and all(i.get("ingredient_id") for i in ingredients),
    }
    return apply_recipe_meta(out)


def _display_name_from_hit(hit: dict[str, Any]) -> str:
    kw = (hit.get("keyword") or "").strip()
    if len(kw) >= 2:
        return kw
    return canonical_name(hit.get("ingredient_id")) or hit.get("name") or "?"


def _boost_main_ingredient_amounts(
    title: str, steps: list[str], ingredients: list[dict[str, Any]]
) -> None:
    """步骤里多次出现的主料（如青瓜）给更大参考克数。"""
    counts: dict[str, int] = {}
    for ln in [title, *steps]:
        for h in find_ingredients_in_text(ln):
            iid = h["ingredient_id"]
            counts[iid] = counts.get(iid, 0) + 1

    candidates = [(iid, c) for iid, c in counts.items() if iid not in _SEASONING_IDS]
    if not candidates:
        return
    main_iid, main_count = max(candidates, key=lambda x: x[1])
    if main_count < 2 and main_iid not in (title or ""):
        return

    main_g = MAIN_DISH_G.get(main_iid) or DEFAULT_G.get(main_iid)
    if main_g is None:
        return

    for ing in ingredients:
        if ing.get("ingredient_id") != main_iid:
            continue
        ing["amount_g"] = round(main_g, 1)
        ing["amount_estimated"] = True
        ing["amount_note"] = f"推荐约 {int(main_g)}g（步骤中主料，约 1～2 人份）"


def _build_step_details(
    steps: list[str], ingredients: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], int]:
    """为每步标注提及的食材，并把步骤里出现但用料未列的食材补进清单。"""
    known_ids = {i.get("ingredient_id") for i in ingredients if i.get("ingredient_id")}
    merged = 0
    details: list[dict[str, Any]] = []

    for text in steps:
        hits = find_ingredients_in_text(text)
        refs: list[dict[str, str]] = []
        seen: set[str] = set()
        for h in hits:
            iid = h["ingredient_id"]
            if iid in seen:
                continue
            seen.add(iid)
            refs.append({"ingredient_id": iid, "name": h["name"]})
            if iid not in known_ids:
                known_ids.add(iid)
                merged += 1
                ingredients.append(
                    {
                        "name": _display_name_from_hit(h),
                        "ingredient_id": iid,
                        "amount_g": None,
                        "from_step": True,
                        "line_raw": f"步骤提及：{h['keyword']}",
                    }
                )
        details.append({"text": text, "ingredients": refs})

    return details, merged


def _estimate_amount(ing: dict[str, Any]) -> tuple[float | None, str]:
    line = ing.get("line_raw") or ing.get("name") or ""
    iid = ing.get("ingredient_id")
    unit_raw = ing.get("unit_raw")

    m = PIECE_UNIT.search(line)
    if m:
        num = float(m.group("num"))
        unit = m.group("unit")
        g = _unit_to_grams(num, unit, iid)
        if g is not None:
            return g, f"按「{num}{unit}」换算约 {int(g)}g"

    if iid and iid in DEFAULT_G:
        g = DEFAULT_G[iid]
        return g, f"推荐约 {int(g)}g（1～2 人份参考量）"

    if unit_raw in {"g", "克"} and m:
        return float(m.group("num")), "按原文克数"

    return None, ""


def _unit_to_grams(num: float, unit: str, ingredient_id: str | None) -> float | None:
    u = unit.lower() if unit in {"g", "克", "kg", "千克", "ml", "毫升", "l", "升"} else unit
    if u in {"g", "克"}:
        return num
    if u in {"kg", "千克"}:
        return num * 1000.0
    if u in {"ml", "毫升"}:
        return num
    if u in {"l", "升"}:
        return num * 1000.0
    if u in {"勺", "汤勺", "大勺"}:
        return num * 12.0
    if u in {"茶勺", "小勺"}:
        return num * 4.0
    if u in {"撮"}:
        return num * 1.0
    per = DEFAULT_G.get(ingredient_id or "", 50.0)
    if u in {"个", "颗", "只", "条", "根", "瓣", "片", "块"}:
        if ingredient_id == "egg":
            per = 55.0
        elif ingredient_id == "tomato":
            per = 150.0
        elif ingredient_id == "potato":
            per = 150.0
        elif ingredient_id == "garlic" and u == "瓣":
            per = 3.0
        return num * per
    return None


def _suggest_steps(title: str, ingredients: list[dict[str, Any]]) -> list[str]:
    ids = {i.get("ingredient_id") for i in ingredients if i.get("ingredient_id")}
    t = title or ""

    if "蛋" in t and ("番茄" in t or "tomato" in ids):
        return [
            "鸡蛋打散，热锅油炒成块盛出",
            "番茄切块下锅炒软出汁",
            "倒回鸡蛋，加盐、糖调味翻炒均匀出锅",
        ]
    if ids == {"rice", "water"} or ("饭" in t and "蒸" in t):
        return ["大米淘洗", "加水入锅", "大火烧开后转小火焖约 15 分钟", "关火焖 5 分钟后开盖"]
    if "汤" in t or "羹" in t:
        return [
            "主料洗净切好，如有肉类先焯水",
            "锅中加水烧开，下入主料",
            "转小火煮入味，加盐等调味",
            "撒葱花或蛋花，出锅",
        ]
    if "炒" in t or _has(ids, {"pork", "beef", "chicken", "shrimp"}):
        return [
            "主料改刀，配料洗净备用",
            "热锅下油，爆香姜蒜",
            "下主料大火翻炒至变色/断生",
            "加酱油等调味，炒匀出锅",
        ]
    if "豆腐" in t or "tofu" in ids:
        return [
            "豆腐切块，开水焯一下去豆腥",
            "热锅下油，炒香料或肉末",
            "下豆腐轻推翻炒，加少量水烧 2～3 分钟",
            "勾芡（可选），撒葱花出锅",
        ]
    if "面" in t or "noodle" in ids:
        return [
            "面条煮熟过凉水沥干",
            "热锅下油炒香配菜或酱料",
            "倒入面条拌匀调味即可",
        ]

    names = "、".join(i.get("name") or "?" for i in ingredients[:5])
    return [
        f"备好：{names}（按推荐用量称重更稳）",
        "该切的切、该腌的腌，锅具烧热",
        "按家常顺序下锅：一般先爆香，再下主料，最后调味",
        "尝味调整后装盘",
    ]


def _has(ids: set[str | None], want: set[str]) -> bool:
    return bool(ids & want)
