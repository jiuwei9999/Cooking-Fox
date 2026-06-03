"""食材别名与文本内识别（用料行、步骤描述共用）。"""
from __future__ import annotations

import re
from functools import lru_cache

from ..sim.ingredients import DEFAULT_INGREDIENTS

# (关键词, ingredient_id) — 长词优先匹配
_ALIAS_PAIRS: list[tuple[str, str]] = [
    ("西红柿", "tomato"),
    ("马铃薯", "potato"),
    ("五花肉", "pork"),
    ("白砂糖", "sugar"),
    ("食用油", "oil"),
    ("老抽", "dark_soy_sauce"),
    ("生抽", "soy_sauce"),
    ("豆瓣酱", "bean_paste"),
    ("花蛤", "clam"),
    ("蛤蜊", "clam"),
    ("鸡蛋", "egg"),
    ("番茄", "tomato"),
    ("黄瓜", "cucumber"),
    ("青瓜", "cucumber"),
    ("大蒜", "garlic"),
    ("蒜末", "garlic"),
    ("姜片", "ginger"),
    ("生姜", "ginger"),
    ("小葱", "scallion"),
    ("香葱", "scallion"),
    ("葱花", "scallion"),
    ("土豆", "potato"),
    ("胡萝卜", "carrot"),
    ("洋葱", "onion"),
    ("猪肉", "pork"),
    ("牛肉", "beef"),
    ("鸡肉", "chicken"),
    ("鸡腿", "chicken"),
    ("虾仁", "shrimp"),
    ("香菇", "mushroom"),
    ("蘑菇", "mushroom"),
    ("大米", "rice"),
    ("面条", "noodle"),
    ("面粉", "flour"),
    ("豆腐", "tofu"),
    ("卷心菜", "cabbage"),
    ("西兰花", "broccoli"),
    ("彩椒", "bell_pepper"),
    ("青椒", "bell_pepper"),
    ("茄子", "eggplant"),
    ("玉米", "corn"),
    ("豆角", "green_bean"),
    ("菠菜", "spinach"),
    ("芹菜", "celery"),
    ("鱼肉", "fish"),
    ("羊肉", "lamb"),
    ("鱿鱼", "squid"),
    ("油菜", "bok_choy"),
    ("青菜", "bok_choy"),
    ("米醋", "vinegar"),
    ("酱油", "soy_sauce"),
    ("料酒", "cooking_wine"),
    ("蚝油", "oyster_sauce"),
    ("辣椒油", "chili_oil"),
    ("鸡精", "chicken_powder"),
    ("五香粉", "five_spice"),
    ("胡椒粉", "pepper"),
    ("香油", "sesame_oil"),
    ("黄油", "butter"),
    ("淀粉", "starch"),
    ("芝麻", "sesame"),
    ("蛋", "egg"),
    ("虾", "shrimp"),
    ("鱼", "fish"),
    ("鸭", "duck"),
    ("米", "rice"),
    ("面", "noodle"),
    ("水", "water"),
    ("盐", "salt"),
    ("糖", "sugar"),
    ("醋", "vinegar"),
    ("油", "oil"),
    ("蒜", "garlic"),
    ("姜", "ginger"),
    ("葱", "scallion"),
    ("辣椒", "chili"),
    ("胡椒", "pepper"),
]

_ID_TO_NAME: dict[str, str] = {i.id: i.name for i in DEFAULT_INGREDIENTS}


@lru_cache(maxsize=1)
def _sorted_aliases() -> list[tuple[str, str]]:
    return sorted(_ALIAS_PAIRS, key=lambda x: len(x[0]), reverse=True)


def canonical_name(ingredient_id: str | None) -> str:
    if not ingredient_id:
        return ""
    return _ID_TO_NAME.get(ingredient_id, ingredient_id)


def guess_ingredient_id(name: str) -> str | None:
    n = (name or "").strip()
    if not n:
        return None
    for keyword, iid in _sorted_aliases():
        if keyword in n:
            return iid
    return None


def find_ingredients_in_text(text: str) -> list[dict]:
    """在一段文字中找出提及的食材（不重叠，长词优先）。"""
    if not text:
        return []
    occupied: list[tuple[int, int]] = []
    hits: list[dict] = []

    for keyword, iid in _sorted_aliases():
        start = 0
        while True:
            idx = text.find(keyword, start)
            if idx < 0:
                break
            end = idx + len(keyword)
            if any(not (end <= a or idx >= b) for a, b in occupied):
                start = idx + 1
                continue
            occupied.append((idx, end))
            hits.append(
                {
                    "ingredient_id": iid,
                    "name": canonical_name(iid) or keyword,
                    "keyword": keyword,
                    "start": idx,
                    "end": end,
                }
            )
            start = end

    hits.sort(key=lambda h: h["start"])
    return hits
