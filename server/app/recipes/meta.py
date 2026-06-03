"""菜谱元数据：难度分级、备菜台功能指引。"""
from __future__ import annotations

from typing import Any

DIFFICULTY_LABELS: dict[str, str] = {
    "easy": "简单",
    "medium": "中等",
    "hard": "困难",
    "expert": "挑战",
}

DIFFICULTY_ORDER: dict[str, int] = {
    "easy": 0,
    "medium": 1,
    "hard": 2,
    "expert": 3,
}

FEATURE_LABELS: dict[str, str] = {
    "prep_board": "砧板切配",
    "marinate": "腌制碗",
    "seasoning_bowl": "调料碗",
    "reserve": "捞出备用",
    "pot_scoop": "锅中捞出",
    "clear_pot": "清空锅内",
}

_MARINATABLE = {"pork", "beef", "chicken", "duck", "fish", "shrimp", "lamb", "tofu"}
_PEELABLE = {"potato", "tomato", "carrot", "cucumber", "eggplant"}
_COMPLEX_KW = ("腌", "焯", "炸", "炖", "焖", "泡", "切丝", "切丁", "去骨", "勾芡", "备用", "捞出")


def normalize_difficulty(value: str | None) -> str:
    if not value:
        return "medium"
    v = str(value).strip().lower()
    alias = {
        "简单": "easy",
        "容易": "easy",
        "easy": "easy",
        "中等": "medium",
        "普通": "medium",
        "medium": "medium",
        "困难": "hard",
        "难": "hard",
        "hard": "hard",
        "挑战": "expert",
        "大师": "expert",
        "expert": "expert",
    }
    return alias.get(v, v if v in DIFFICULTY_LABELS else "medium")


def infer_difficulty(recipe: dict[str, Any]) -> str:
    explicit = recipe.get("difficulty")
    if explicit:
        return normalize_difficulty(explicit)

    steps = recipe.get("steps") or []
    ingredients = recipe.get("ingredients") or []
    text = (recipe.get("title") or "") + "\n".join(steps)
    n_step = len(steps)
    n_ing = len(ingredients)
    kw = sum(1 for k in _COMPLEX_KW if k in text)
    has_marinate = any(
        (i.get("ingredient_id") in _MARINATABLE) and ("腌" in text)
        for i in ingredients
    )
    has_prep = bool(recipe.get("prep_workflow")) or kw >= 2

    if n_step <= 3 and n_ing <= 5 and kw == 0:
        return "easy"
    if n_step >= 8 or (has_marinate and has_prep and kw >= 4):
        return "expert"
    if n_step >= 6 or n_ing >= 9 or has_marinate or kw >= 3:
        return "hard"
    if n_step >= 4 or n_ing >= 7 or kw >= 1:
        return "medium"
    return "easy"


def infer_features(recipe: dict[str, Any]) -> list[str]:
    if recipe.get("features"):
        return list(recipe["features"])

    feats: set[str] = set()
    ids = {i.get("ingredient_id") for i in (recipe.get("ingredients") or [])}
    text = (recipe.get("title") or "") + "\n".join(recipe.get("steps") or [])

    if ids & _PEELABLE or ids & _MARINATABLE or "切" in text:
        feats.add("prep_board")
    if ids & _MARINATABLE and ("腌" in text or "卤" in text):
        feats.add("marinate")
    if ids & {"soy_sauce", "vinegar", "oil", "garlic", "ginger"} or "调料" in text:
        feats.add("seasoning_bowl")
    if "捞出" in text or "备用" in text or "盛出" in text:
        feats.add("reserve")
        feats.add("pot_scoop")
    if len(ids) >= 6:
        feats.add("clear_pot")

    workflow = recipe.get("prep_workflow") or []
    for w in workflow:
        st = w.get("station") if isinstance(w, dict) else None
        if st == "board":
            feats.add("prep_board")
        elif st == "marinate":
            feats.add("marinate")
        elif st == "seasoning":
            feats.add("seasoning_bowl")
        elif st in ("reserve", "scoop"):
            feats.add("reserve")

    if not feats and ids:
        feats.add("prep_board")
    return sorted(feats)


def build_prep_hints(recipe: dict[str, Any], features: list[str]) -> list[str]:
    hints: list[str] = []
    if recipe.get("prep_hints"):
        hints.extend(recipe["prep_hints"])

    workflow = recipe.get("prep_workflow") or []
    for w in workflow:
        if not isinstance(w, dict):
            continue
        st = w.get("station", "")
        act = w.get("action") or w.get("text") or ""
        label = {
            "board": "砧板",
            "marinate": "腌制碗",
            "seasoning": "调料碗",
            "reserve": "捞出备用",
            "pot": "入锅",
        }.get(st, st)
        if act:
            hints.append(f"【{label}】{act}")

    if "prep_board" in features and not any("砧板" in h for h in hints):
        hints.append("备菜台·砧板：削皮/去骨/切配后，可「放入腌制碗」或「捞出备用」。")
    if "marinate" in features and not any("腌" in h for h in hints):
        hints.append("备菜台·腌制：自选腌料与时长（5～60分钟），腌好「捞出备用」再入锅。")
    if "seasoning_bowl" in features and not any("调料" in h for h in hints):
        hints.append("备菜台·调料碗：酱汁分层调配，可「捞出备用」后暂存。")
    if "reserve" in features and not any("备用" in h for h in hints):
        hints.append("锅中或腌制后可用「捞出备用」暂放，需要时再回锅。")
    if "clear_pot" in features:
        hints.append("多道菜衔接时可用左侧「清空锅内」快速换菜（备用区保留）。")

    # 去重保序
    seen: set[str] = set()
    out: list[str] = []
    for h in hints:
        if h not in seen:
            seen.add(h)
            out.append(h)
    return out[:8]


def apply_recipe_meta(recipe: dict[str, Any]) -> dict[str, Any]:
    out = dict(recipe)
    diff = infer_difficulty(out)
    feats = infer_features(out)
    hints = build_prep_hints(out, feats)
    out["difficulty"] = diff
    out["difficulty_label"] = DIFFICULTY_LABELS.get(diff, diff)
    out["features"] = feats
    out["prep_hints"] = hints
    guide = dict(out.get("guide") or {})
    guide["difficulty"] = diff
    guide["difficulty_label"] = out["difficulty_label"]
    guide["features"] = feats
    guide["prep_hints"] = hints
    if hints:
        tips = list(guide.get("tips") or [])
        tips.insert(0, f"难度「{out['difficulty_label']}」· 建议备菜流程见下方「备菜指引」。")
        guide["tips"] = tips
    out["guide"] = guide
    return out
