from __future__ import annotations

from enum import Enum
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


class CutStyle(str, Enum):
    none = "none"
    chop = "chop"
    dice = "dice"
    slice = "slice"
    mince = "mince"


class HeatMethod(str, Enum):
    pan_fry = "pan_fry"
    stir_fry = "stir_fry"
    boil = "boil"
    steam = "steam"
    bake = "bake"


class TasteVector(BaseModel):
    salty: float = 0.0
    sweet: float = 0.0
    sour: float = 0.0
    spicy: float = 0.0
    umami: float = 0.0
    bitter: float = 0.0
    aroma: float = 0.0


class SimMetrics(BaseModel):
    temp_c: float = 25.0
    water_g: float = 0.0
    oil_g: float = 0.0
    solids_g: float = 0.0
    evaporation_loss_g: float = 0.0
    browning: float = 0.0  # 0..1
    doneness: float = 0.0  # 0..1
    burn_risk: float = 0.0  # 0..1
    emulsion: float = 0.0  # 0..1
    taste: TasteVector = Field(default_factory=TasteVector)


class IngredientBase(BaseModel):
    id: str
    name: str
    water_frac: float = 0.0
    oil_frac: float = 0.0
    sugar_frac: float = 0.0
    protein_frac: float = 0.0
    starch_frac: float = 0.0
    salt_frac: float = 0.0
    acid_frac: float = 0.0
    spice_frac: float = 0.0
    umami_frac: float = 0.0
    smoke_point_c: float | None = None
    image_url: str | None = None


class IngredientPortion(BaseModel):
    ingredient_id: str
    amount_g: float
    cut: CutStyle = CutStyle.none
    particle_mm: float = 20.0  # coarse default


class SimAction(BaseModel):
    type: Literal["add", "cut", "mix", "heat", "rest", "taste", "serve"]
    at_ms: int | None = None

    ingredient_id: str | None = None
    amount_g: float | None = None

    cut_style: CutStyle | None = None
    particle_mm: float | None = None

    mix_intensity: float | None = None  # 0..1
    duration_s: float | None = None

    heat_method: HeatMethod | None = None
    target_temp_c: float | None = None


class SimEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    action: SimAction
    metrics_after: SimMetrics
    notes: list[str] = Field(default_factory=list)


class SimSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str = "Untitled cook"
    ingredients: dict[str, IngredientBase] = Field(default_factory=dict)
    pot: list[IngredientPortion] = Field(default_factory=list)
    metrics: SimMetrics = Field(default_factory=SimMetrics)
    timeline: list[SimEvent] = Field(default_factory=list)
    last_tasted: TasteVector | None = None

