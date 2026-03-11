from __future__ import annotations

from .models import IngredientBase


# Small seed ingredient library for MVP (extendable).
DEFAULT_INGREDIENTS: list[IngredientBase] = [
    IngredientBase(id="egg", name="鸡蛋", water_frac=0.74, protein_frac=0.125, oil_frac=0.10, umami_frac=0.02),
    IngredientBase(id="tomato", name="番茄", water_frac=0.94, sugar_frac=0.03, acid_frac=0.006),
    IngredientBase(id="rice", name="大米(生)", water_frac=0.12, starch_frac=0.78, protein_frac=0.07),
    IngredientBase(id="water", name="水", water_frac=1.0),
    IngredientBase(id="salt", name="食盐", salt_frac=1.0),
    IngredientBase(id="sugar", name="白砂糖", sugar_frac=1.0),
    IngredientBase(id="vinegar", name="米醋", water_frac=0.95, acid_frac=0.05),
    IngredientBase(id="soy_sauce", name="生抽", water_frac=0.70, salt_frac=0.18, umami_frac=0.05, sugar_frac=0.03),
    IngredientBase(id="oil", name="食用油", oil_frac=1.0, smoke_point_c=220),
    IngredientBase(id="garlic", name="蒜", water_frac=0.58, spice_frac=0.08, sugar_frac=0.03),
    IngredientBase(id="ginger", name="姜", water_frac=0.79, spice_frac=0.06),
    IngredientBase(id="chili", name="辣椒", water_frac=0.88, spice_frac=0.10, sugar_frac=0.03),
    IngredientBase(id="scallion", name="葱", water_frac=0.90, spice_frac=0.04),
    IngredientBase(id="butter", name="黄油", oil_frac=0.82, water_frac=0.16, smoke_point_c=175),
]

