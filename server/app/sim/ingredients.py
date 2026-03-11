from __future__ import annotations

from .models import IngredientBase


# Small seed ingredient library for MVP (extendable).
DEFAULT_INGREDIENTS: list[IngredientBase] = [
    IngredientBase(id="egg", name="鸡蛋", water_frac=0.74, protein_frac=0.125, oil_frac=0.10, umami_frac=0.02, image_url="/assets/ingredients/egg.jpg"),
    IngredientBase(id="tomato", name="番茄", water_frac=0.94, sugar_frac=0.03, acid_frac=0.006, image_url="/assets/ingredients/tomato.jpg"),
    IngredientBase(id="cucumber", name="黄瓜", water_frac=0.96, sugar_frac=0.02, image_url="/assets/ingredients/cucumber.jpg"),
    IngredientBase(id="potato", name="土豆", water_frac=0.79, starch_frac=0.17, image_url="/assets/ingredients/potato.jpg"),
    IngredientBase(id="carrot", name="胡萝卜", water_frac=0.88, sugar_frac=0.05, starch_frac=0.07, image_url="/assets/ingredients/carrot.jpg"),
    IngredientBase(id="onion", name="洋葱", water_frac=0.89, sugar_frac=0.05, spice_frac=0.03),
    IngredientBase(id="pork", name="猪肉", water_frac=0.70, protein_frac=0.19, oil_frac=0.10, umami_frac=0.03, image_url="/assets/ingredients/pork.jpg"),
    IngredientBase(id="beef", name="牛肉", water_frac=0.69, protein_frac=0.20, oil_frac=0.09, umami_frac=0.035, image_url="/assets/ingredients/beef.jpg"),
    IngredientBase(id="chicken", name="鸡肉", water_frac=0.71, protein_frac=0.20, oil_frac=0.08, umami_frac=0.03, image_url="/assets/ingredients/chicken.jpg"),
    IngredientBase(id="shrimp", name="虾仁", water_frac=0.78, protein_frac=0.19, umami_frac=0.04, image_url="/assets/ingredients/shrimp.jpg"),
    IngredientBase(id="mushroom", name="蘑菇", water_frac=0.92, umami_frac=0.04, image_url="/assets/ingredients/mushroom.jpg"),
    IngredientBase(id="rice", name="大米(生)", water_frac=0.12, starch_frac=0.78, protein_frac=0.07, image_url="/assets/ingredients/rice.jpg"),
    IngredientBase(id="noodle", name="面条(生)", water_frac=0.12, starch_frac=0.72, protein_frac=0.10, image_url="/assets/ingredients/noodle.jpg"),
    IngredientBase(id="water", name="水", water_frac=1.0),
    IngredientBase(id="salt", name="食盐", salt_frac=1.0, image_url="/assets/ingredients/salt.jpg"),
    IngredientBase(id="sugar", name="白砂糖", sugar_frac=1.0, image_url="/assets/ingredients/sugar.jpg"),
    IngredientBase(id="vinegar", name="米醋", water_frac=0.95, acid_frac=0.05),
    IngredientBase(id="soy_sauce", name="生抽", water_frac=0.70, salt_frac=0.18, umami_frac=0.05, sugar_frac=0.03, image_url="/assets/ingredients/soy_sauce.jpg"),
    IngredientBase(id="dark_soy_sauce", name="老抽", water_frac=0.70, salt_frac=0.16, umami_frac=0.05, sugar_frac=0.05),
    IngredientBase(id="oil", name="食用油", oil_frac=1.0, smoke_point_c=220, image_url="/assets/ingredients/oil.jpg"),
    IngredientBase(id="sesame_oil", name="香油", oil_frac=1.0, smoke_point_c=180),
    IngredientBase(id="garlic", name="蒜", water_frac=0.58, spice_frac=0.08, sugar_frac=0.03),
    IngredientBase(id="ginger", name="姜", water_frac=0.79, spice_frac=0.06),
    IngredientBase(id="chili", name="辣椒", water_frac=0.88, spice_frac=0.10, sugar_frac=0.03),
    IngredientBase(id="scallion", name="葱", water_frac=0.90, spice_frac=0.04),
    IngredientBase(id="pepper", name="胡椒粉", spice_frac=0.8),
    IngredientBase(id="five_spice", name="五香粉", spice_frac=0.9),
    IngredientBase(id="butter", name="黄油", oil_frac=0.82, water_frac=0.16, smoke_point_c=175),
]

