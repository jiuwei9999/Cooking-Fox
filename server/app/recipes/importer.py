from __future__ import annotations

import re
from dataclasses import dataclass
from uuid import uuid4

from .lexicon import canonical_name, find_ingredients_in_text, guess_ingredient_id

@dataclass
class ParsedRecipe:
    id: str
    title: str
    ingredients: list[dict]
    steps: list[str]
    warnings: list[str]

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "ingredients": self.ingredients,
            "steps": self.steps,
            "warnings": self.warnings,
            "source": "pasted_text",
        }


_SECTION_ING = re.compile(r"^[\[【]?(用料|材料|配料|食材)[\]】]?[:：]?$", re.I)
_SECTION_STEP = re.compile(r"^[\[【]?(做法|步骤|流程|制作方法)[\]】]?[:：]?$", re.I)
_INLINE_ING = re.compile(r"^[\[【]?(用料|材料|配料|食材)[\]】]?[:：]\s*(.+)$", re.I)
_INLINE_STEP = re.compile(r"^[\[【]?(做法|步骤|流程|制作方法)[\]】]?[:：]\s*(.+)$", re.I)

_AMOUNT_G = re.compile(
    r"(?P<num>\d+(\.\d+)?)\s*(?P<unit>g|克|kg|千克|ml|毫升|l|升|勺|汤勺|茶勺|小勺|大勺|个|颗|片|根|瓣|撮|适量|少许)"
)

_STEP_NUM = re.compile(
    r"^(\d+[\.\、\)]\s*|步骤\s*\d+\s*[:：]\s*|第[一二三四五六七八九十百千]+步\s*[:：]?\s*|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫]\s*)",
    re.I,
)

_COOKING_HINT = re.compile(
    r"(炒|煮|蒸|煎|炸|烤|炖|烧|焯|腌|切|剁|打散|下锅|出锅|调味|翻炒|加热|烧开|沥干|装盘|盛出|下油|爆香|翻炒|搅匀|混合|去皮|切块|切丝|切片|焯水|勾芡|尝味)"
)


def parse_recipe_text(text: str) -> ParsedRecipe:
    raw = (text or "").strip()
    rid = f"user_{uuid4().hex[:10]}"
    if not raw:
        return ParsedRecipe(id=rid, title="未命名", ingredients=[], steps=[], warnings=["内容为空。"])

    lines = [ln.strip() for ln in raw.splitlines()]
    lines = [ln for ln in lines if ln and not ln.startswith("#")]

    title, body_start = _resolve_title(lines)
    warnings: list[str] = []

    ing_lines: list[str] = []
    step_lines: list[str] = []
    mode = "auto"

    for ln in lines[body_start:]:
        m_ing = _INLINE_ING.match(ln)
        if m_ing:
            mode = "ing"
            ing_lines.extend(_split_inline_list(m_ing.group(2)))
            continue
        m_step = _INLINE_STEP.match(ln)
        if m_step:
            mode = "step"
            step_lines.extend(_split_step_blob(m_step.group(2)))
            continue
        if _SECTION_ING.match(ln):
            mode = "ing"
            continue
        if _SECTION_STEP.match(ln):
            mode = "step"
            continue

        if mode == "ing":
            ing_lines.append(ln)
        elif mode == "step":
            step_lines.extend(_expand_step_line(ln))
        else:
            if _looks_like_step_line(ln):
                step_lines.extend(_expand_step_line(ln))
            else:
                ing_lines.append(ln)

    ing_lines, step_lines = _repartition_misclassified(ing_lines, step_lines)

    ingredients = [_parse_ingredient_line(ln) for ln in ing_lines]
    ingredients = [i for i in ingredients if i["name"]]
    steps = []
    for ln in step_lines:
        steps.extend(_expand_step_line(ln))
    steps = [_clean_step_line(s) for s in steps]
    steps = [s for s in steps if s]

    if not ingredients:
        warnings.append("未识别到用料清单：你可以加上「用料/配料」标题，或每行写「食材 10g」。")
    if not steps:
        warnings.append("未识别到步骤：你可以加上「步骤/做法」标题，或用 1. 2. 这样的序号。")

    return ParsedRecipe(id=rid, title=title, ingredients=ingredients, steps=steps, warnings=warnings)


def _resolve_title(lines: list[str]) -> tuple[str, int]:
    if not lines:
        return "未命名", 0
    first = lines[0]
    if _looks_like_step_line(first) or re.match(r"^\d+[\.\、\)]", first):
        return _infer_title(lines), 0
    return first[:40], 1


def _infer_title(lines: list[str]) -> str:
    blob = "\n".join(lines)
    m = re.search(r"(清炒|爆炒|凉拌|红烧|干煸|香煎|蒜蓉)([一-龥]{1,8})", blob)
    if m:
        return m.group(0)[:40]
    counts: dict[str, int] = {}
    for ln in lines:
        for h in find_ingredients_in_text(ln):
            iid = h["ingredient_id"]
            counts[iid] = counts.get(iid, 0) + 1
    _SEASONING = {
        "salt", "oil", "sugar", "vinegar", "soy_sauce", "dark_soy_sauce",
        "pepper", "sesame_oil", "chicken_powder", "five_spice", "starch",
        "water", "cooking_wine", "oyster_sauce", "chili_oil", "bean_paste",
    }
    candidates = [(iid, c) for iid, c in counts.items() if iid not in _SEASONING]
    if not candidates:
        return "未命名"
    main_iid, main_count = max(candidates, key=lambda x: x[1])
    if main_count < 2:
        return "未命名"
    # 保留原文叫法（如青瓜 vs 黄瓜）
    display = name = canonical_name(main_iid) or main_iid
    for ln in lines:
        for h in find_ingredients_in_text(ln):
            if h["ingredient_id"] == main_iid and len(h["keyword"]) >= 2:
                display = h["keyword"]
                break
        if display != name:
            break
    if "炒" in blob:
        return f"清炒{display}"[:40]
    return display[:40]


def _split_inline_list(blob: str) -> list[str]:
    blob = blob.strip()
    if not blob:
        return []
    parts = re.split(r"[、,，;；\s]+", blob)
    return [p.strip() for p in parts if p.strip()]


def _split_step_blob(blob: str) -> list[str]:
    blob = blob.strip()
    if not blob:
        return []
    markers = list(re.finditer(r"(?:^|\s)\d+[\.\、\)]\s*", blob))
    if len(markers) >= 2:
        out: list[str] = []
        for i, m in enumerate(markers):
            start = m.end()
            end = markers[i + 1].start() if i + 1 < len(markers) else len(blob)
            chunk = blob[start:end].strip()
            if chunk:
                out.append(chunk)
        if out:
            return out
    if "；" in blob or ";" in blob:
        return [p.strip() for p in re.split(r"[;；]", blob) if p.strip()]
    return [blob]


def _expand_step_line(ln: str) -> list[str]:
    ln = ln.strip()
    if not ln:
        return []
    if len(re.findall(r"\d+[\.\、\)]", ln)) >= 2:
        return _split_step_blob(ln)
    if "；" in ln and _COOKING_HINT.search(ln):
        return [p.strip() for p in ln.split("；") if p.strip()]
    return [ln]


def _looks_like_step_line(ln: str) -> bool:
    if _STEP_NUM.match(ln):
        return True
    if re.match(r"^步骤\s*\d+", ln, re.I):
        return True
    if len(ln) >= 6 and _COOKING_HINT.search(ln):
        return True
    if re.match(r"^(然后|接着|再|最后|先|将|把|待|至)", ln):
        return True
    return False


def _looks_like_ingredient_line(ln: str) -> bool:
    if _looks_like_step_line(ln):
        return False
    if _AMOUNT_G.search(ln):
        return True
    core = re.sub(r"^[\-\*\u2022]\s*", "", ln).strip()
    if len(core) <= 12 and guess_ingredient_id(core):
        return True
    if "、" in core and len(core) < 40:
        parts = [p.strip() for p in core.split("、") if p.strip()]
        if parts and all(guess_ingredient_id(p) for p in parts):
            return True
    return len(core) <= 8


def _repartition_misclassified(ing_lines: list[str], step_lines: list[str]) -> tuple[list[str], list[str]]:
    new_ing: list[str] = []
    new_step = list(step_lines)
    for ln in ing_lines:
        if _looks_like_step_line(ln) and not _looks_like_ingredient_line(ln):
            new_step.append(ln)
        else:
            new_ing.append(ln)
    return new_ing, new_step


def _parse_ingredient_line(line: str) -> dict:
    ln = re.sub(r"^[\-\*\u2022]\s*", "", line).strip()
    ln = re.sub(r"^\d+[\.\、]\s*", "", ln).strip()

    m = _AMOUNT_G.search(ln)
    amount_g: float | None = None
    unit: str | None = None
    if m and m.group("unit") not in {"适量", "少许"}:
        num = float(m.group("num"))
        unit = m.group("unit")
        amount_g = _to_grams(num, unit, ingredient_id=None)

    name = ln
    if m:
        name = (ln[: m.start()] + ln[m.end() :]).strip()
    name = re.sub(r"\s{2,}", " ", name).strip()
    name = re.sub(r"(适量|少许)$", "", name).strip()

    ingredient_id = guess_ingredient_id(name)
    if m and amount_g is None and ingredient_id and m.group("unit") not in {"适量", "少许"}:
        amount_g = _to_grams(float(m.group("num")), m.group("unit"), ingredient_id)
    return {
        "name": name,
        "ingredient_id": ingredient_id,
        "amount_g": amount_g,
        "unit_raw": unit,
        "line_raw": line,
    }


def _clean_step_line(line: str) -> str:
    ln = line.strip()
    ln = re.sub(r"^[\-\*\u2022]\s*", "", ln)
    ln = _STEP_NUM.sub("", ln, count=1).strip()
    ln = re.sub(r"^步骤\s*\d+\s*[:：]\s*", "", ln, flags=re.I).strip()
    return ln


def _to_grams(num: float, unit: str, ingredient_id: str | None) -> float | None:
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
    per_piece = 50.0
    if ingredient_id == "egg":
        per_piece = 55.0
    elif ingredient_id == "tomato":
        per_piece = 150.0
    elif ingredient_id == "garlic" and u == "瓣":
        per_piece = 3.0
    if u in {"个", "颗", "只", "条", "根", "瓣", "片", "块"}:
        return num * per_piece
    return None
