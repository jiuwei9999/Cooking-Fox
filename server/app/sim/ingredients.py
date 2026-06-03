from __future__ import annotations

from .models import IngredientBase


# Small seed ingredient library for MVP (extendable).
DEFAULT_INGREDIENTS: list[IngredientBase] = [
    IngredientBase(id="egg", name="鸡蛋", water_frac=0.74, protein_frac=0.125, oil_frac=0.10, umami_frac=0.02),
    IngredientBase(id="tomato", name="番茄", water_frac=0.94, sugar_frac=0.03, acid_frac=0.006),
    IngredientBase(id="cucumber", name="黄瓜", water_frac=0.96, sugar_frac=0.02),
    IngredientBase(id="potato", name="土豆", water_frac=0.79, starch_frac=0.17),
    IngredientBase(id="carrot", name="胡萝卜", water_frac=0.88, sugar_frac=0.05, starch_frac=0.07),
    IngredientBase(id="onion", name="洋葱", water_frac=0.89, sugar_frac=0.05, spice_frac=0.03),
    IngredientBase(id="pork", name="猪肉", water_frac=0.70, protein_frac=0.19, oil_frac=0.10, umami_frac=0.03),
    IngredientBase(id="beef", name="牛肉", water_frac=0.69, protein_frac=0.20, oil_frac=0.09, umami_frac=0.035),
    IngredientBase(id="chicken", name="鸡肉", water_frac=0.71, protein_frac=0.20, oil_frac=0.08, umami_frac=0.03),
    IngredientBase(id="shrimp", name="虾仁", water_frac=0.78, protein_frac=0.19, umami_frac=0.04),
    IngredientBase(id="mushroom", name="蘑菇", water_frac=0.92, umami_frac=0.04),
    IngredientBase(id="rice", name="大米(生)", water_frac=0.12, starch_frac=0.78, protein_frac=0.07),
    IngredientBase(id="noodle", name="面条(生)", water_frac=0.12, starch_frac=0.72, protein_frac=0.10),
    IngredientBase(id="water", name="水", water_frac=1.0),
    IngredientBase(id="salt", name="食盐", salt_frac=1.0),
    IngredientBase(id="sugar", name="白砂糖", sugar_frac=1.0),
    IngredientBase(id="vinegar", name="米醋", water_frac=0.95, acid_frac=0.05),
    IngredientBase(id="soy_sauce", name="生抽", water_frac=0.70, salt_frac=0.18, umami_frac=0.05, sugar_frac=0.03),
    IngredientBase(id="dark_soy_sauce", name="老抽", water_frac=0.70, salt_frac=0.16, umami_frac=0.05, sugar_frac=0.05),
    IngredientBase(id="oil", name="食用油", oil_frac=1.0, smoke_point_c=220),
    IngredientBase(id="sesame_oil", name="香油", oil_frac=1.0, smoke_point_c=180),
    IngredientBase(id="garlic", name="蒜", water_frac=0.58, spice_frac=0.08, sugar_frac=0.03),
    IngredientBase(id="ginger", name="姜", water_frac=0.79, spice_frac=0.06),
    IngredientBase(id="chili", name="辣椒", water_frac=0.88, spice_frac=0.10, sugar_frac=0.03),
    IngredientBase(id="scallion", name="葱", water_frac=0.90, spice_frac=0.04),
    IngredientBase(id="pepper", name="胡椒粉", spice_frac=0.8),
    IngredientBase(id="five_spice", name="五香粉", spice_frac=0.9),
    IngredientBase(id="butter", name="黄油", oil_frac=0.82, water_frac=0.16, smoke_point_c=175),
    # --- 蔬菜 / 豆制品 ---
    IngredientBase(id="tofu", name="豆腐", water_frac=0.85, protein_frac=0.08, oil_frac=0.02, umami_frac=0.02),
    IngredientBase(id="cabbage", name="卷心菜", water_frac=0.92, sugar_frac=0.04, starch_frac=0.02),
    IngredientBase(id="bok_choy", name="油菜", water_frac=0.95, sugar_frac=0.02),
    IngredientBase(id="broccoli", name="西兰花", water_frac=0.90, protein_frac=0.03, sugar_frac=0.03),
    IngredientBase(id="bell_pepper", name="彩椒", water_frac=0.92, sugar_frac=0.05),
    IngredientBase(id="eggplant", name="茄子", water_frac=0.92, sugar_frac=0.03, starch_frac=0.02),
    IngredientBase(id="corn", name="玉米", water_frac=0.76, starch_frac=0.19, sugar_frac=0.03),
    IngredientBase(id="green_bean", name="豆角", water_frac=0.90, protein_frac=0.02, sugar_frac=0.04),
    IngredientBase(id="spinach", name="菠菜", water_frac=0.92, protein_frac=0.03, sugar_frac=0.02),
    IngredientBase(id="celery", name="芹菜", water_frac=0.94, sugar_frac=0.02, spice_frac=0.02),
    # --- 肉类 / 水产 ---
    IngredientBase(id="fish", name="鱼肉", water_frac=0.76, protein_frac=0.18, oil_frac=0.04, umami_frac=0.04),
    IngredientBase(id="lamb", name="羊肉", water_frac=0.68, protein_frac=0.19, oil_frac=0.11, umami_frac=0.035, spice_frac=0.02),
    IngredientBase(id="duck", name="鸭肉", water_frac=0.65, protein_frac=0.19, oil_frac=0.14, umami_frac=0.03),
    IngredientBase(id="squid", name="鱿鱼", water_frac=0.80, protein_frac=0.16, umami_frac=0.05),
    IngredientBase(id="clam", name="花蛤", water_frac=0.82, protein_frac=0.12, umami_frac=0.06, salt_frac=0.02),
    # --- 主食原料 ---
    IngredientBase(id="flour", name="面粉", water_frac=0.12, starch_frac=0.75, protein_frac=0.10),
    # --- 调料 / 液体 ---
    IngredientBase(id="cooking_wine", name="料酒", water_frac=0.85, acid_frac=0.02, umami_frac=0.03),
    IngredientBase(id="oyster_sauce", name="蚝油", water_frac=0.55, salt_frac=0.12, umami_frac=0.18, sugar_frac=0.08),
    IngredientBase(id="chili_oil", name="辣椒油", oil_frac=0.88, spice_frac=0.08, smoke_point_c=200),
    IngredientBase(id="starch", name="淀粉", starch_frac=0.92, water_frac=0.08),
    IngredientBase(id="chicken_powder", name="鸡精", umami_frac=0.85, salt_frac=0.10, sugar_frac=0.03),
    IngredientBase(id="sesame", name="芝麻", oil_frac=0.50, protein_frac=0.18, umami_frac=0.02),
    IngredientBase(id="bean_paste", name="豆瓣酱", water_frac=0.35, salt_frac=0.14, umami_frac=0.12, spice_frac=0.08, oil_frac=0.15),
]

