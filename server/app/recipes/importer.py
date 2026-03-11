from __future__ import annotations

import re
from dataclasses import dataclass
from uuid import uuid4


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


_SECTION_ING = re.compile(r"^(用料|材料|配料|食材)[:：]?$")
_SECTION_STEP = re.compile(r"^(做法|步骤|流程)[:：]?$")

_AMOUNT_G = re.compile(r"(?P<num>\d+(\.\d+)?)\s*(?P<unit>g|克|kg|千克|ml|毫升|l|升|勺|汤勺|茶勺|小勺|大勺|个|颗|片|根|瓣|撮)")


def parse_recipe_text(text: str) -> ParsedRecipe:
    raw = (text or "").strip()
    rid = f"user_{uuid4().hex[:10]}"
    if not raw:
        return ParsedRecipe(id=rid, title="未命名", ingredients=[], steps=[], warnings=["内容为空。"])

    lines = [ln.strip() for ln in raw.splitlines()]
    lines = [ln for ln in lines if ln and not ln.startswith("#")]

    title = lines[0][:40] if lines else "未命名"
    warnings: list[str] = []

    ing_lines: list[str] = []
    step_lines: list[str] = []
    mode = "auto"

    for ln in lines[1:]:
        if _SECTION_ING.match(ln):
            mode = "ing"
            continue
        if _SECTION_STEP.match(ln):
            mode = "step"
            continue
        if mode == "ing":
            ing_lines.append(ln)
        elif mode == "step":
            step_lines.append(ln)
        else:
            # auto: if looks like step numbering, treat as step; else ingredient-ish.
            if re.match(r"^(\d+[\.\、]\s*)", ln) or ln.startswith(("步骤", "Step")):
                step_lines.append(ln)
            else:
                ing_lines.append(ln)

    ingredients = [_parse_ingredient_line(ln) for ln in ing_lines]
    ingredients = [i for i in ingredients if i["name"]]
    steps = [_clean_step_line(ln) for ln in step_lines]
    steps = [s for s in steps if s]

    if not ingredients:
        warnings.append("未识别到用料清单：你可以加上“用料/配料”标题，或每行写“食材 10g”。")
    if not steps:
        warnings.append("未识别到步骤：你可以加上“步骤/做法”标题，或用 1. 2. 这样的序号。")

    return ParsedRecipe(id=rid, title=title, ingredients=ingredients, steps=steps, warnings=warnings)


def _parse_ingredient_line(line: str) -> dict:
    ln = re.sub(r"^[\-\*\u2022]\s*", "", line).strip()
    ln = re.sub(r"^\d+[\.\、]\s*", "", ln).strip()

    # Common pattern: "番茄 2个" / "盐 1g" / "鸡蛋2个"
    m = _AMOUNT_G.search(ln)
    amount_g: float | None = None
    unit: str | None = None
    if m:
        num = float(m.group("num"))
        unit = m.group("unit")
        amount_g = _to_grams(num, unit)

    name = ln
    if m:
        name = (ln[: m.start()] + ln[m.end() :]).strip()
    name = re.sub(r"\s{2,}", " ", name).strip()

    ingredient_id = _guess_ingredient_id(name)
    return {
        "name": name,
        "ingredient_id": ingredient_id,
        "amount_g": amount_g,
        "unit_raw": unit,
        "line_raw": line,
    }


def _clean_step_line(line: str) -> str:
    ln = re.sub(r"^\d+[\.\、]\s*", "", line).strip()
    return ln


def _to_grams(num: float, unit: str) -> float | None:
    u = unit.lower()
    if u in {"g", "克"}:
        return num
    if u in {"kg", "千克"}:
        return num * 1000.0
    if u in {"ml", "毫升"}:
        return num  # assume density ~1 for MVP
    if u in {"l", "升"}:
        return num * 1000.0
    # Spoons and pieces are ambiguous: return None to force user confirmation.
    return None


def _guess_ingredient_id(name: str) -> str | None:
    n = (name or "").strip()
    if not n:
        return None
    mapping = [
        ("鸡蛋", "egg"),
        ("蛋", "egg"),
        ("番茄", "tomato"),
        ("西红柿", "tomato"),
        ("米", "rice"),
        ("大米", "rice"),
        ("水", "water"),
        ("盐", "salt"),
        ("糖", "sugar"),
        ("醋", "vinegar"),
        ("生抽", "soy_sauce"),
        ("酱油", "soy_sauce"),
        ("油", "oil"),
        ("蒜", "garlic"),
        ("姜", "ginger"),
        ("葱", "scallion"),
        ("辣椒", "chili"),
        ("黄油", "butter"),
    ]
    for k, v in mapping:
        if k in n:
            return v
    return None

