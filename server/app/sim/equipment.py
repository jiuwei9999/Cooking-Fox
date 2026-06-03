from dataclasses import dataclass, field
from typing import Literal

COOKWARE_PROFILES: dict[str, "CookwareProfile"] = {}

@dataclass
class CookwareProfile:
    id: str
    name: str
    volume_l: float
    heat_transfer: float  # 0.3~1.5, how fast it heats up
    heat_retention: float  # 0.3~1.5, how well it holds heat
    heat_evenness: float   # 0.3~1.0, how evenly heat distributes
    max_safe_temp_c: float
    pot_air_bonus: float   # 0~1.0, extra aroma from high-heat wok cooking
    stick_risk: float      # 0~1.0, how easily food sticks
    splash_risk: float     # 0~1.0, how easily oil splashes
    geometry_radius: float
    geometry_bottom_y: float
    geometry_top_y: float
    geometry_flare: float   # rim flare factor
    allowed_actions: list[str] = field(default_factory=list)
    best_for: list[str] = field(default_factory=list)

    def __post_init__(self):
        COOKWARE_PROFILES[self.id] = self


# ── 4 built-in cookware types ──

CookwareProfile(
    id="wok",
    name="铁炒锅",
    volume_l=3.0,
    heat_transfer=1.4,
    heat_retention=0.5,
    heat_evenness=0.7,
    max_safe_temp_c=280,
    pot_air_bonus=1.0,
    stick_risk=0.7,
    splash_risk=0.3,
    geometry_radius=2.65,
    geometry_bottom_y=-0.12,
    geometry_top_y=0.55,
    geometry_flare=0.3,
    allowed_actions=["stir_fry","pan_fry","boil","steam","flip","pour"],
    best_for=["stir_fry","pan_fry"],
)

CookwareProfile(
    id="flat_pan",
    name="平底煎锅",
    volume_l=2.0,
    heat_transfer=1.0,
    heat_retention=0.6,
    heat_evenness=0.9,
    max_safe_temp_c=260,
    pot_air_bonus=0.3,
    stick_risk=0.2,
    splash_risk=0.2,
    geometry_radius=2.4,
    geometry_bottom_y=-0.08,
    geometry_top_y=0.3,
    geometry_flare=0.1,
    allowed_actions=["pan_fry","stir_fry","flip"],
    best_for=["pan_fry"],
)

CookwareProfile(
    id="deep_pot",
    name="深汤锅",
    volume_l=5.0,
    heat_transfer=0.7,
    heat_retention=1.3,
    heat_evenness=0.5,
    max_safe_temp_c=220,
    pot_air_bonus=0.0,
    stick_risk=0.4,
    splash_risk=0.1,
    geometry_radius=2.5,
    geometry_bottom_y=-0.25,
    geometry_top_y=0.7,
    geometry_flare=0.05,
    allowed_actions=["boil","steam","stir_fry"],
    best_for=["boil","steam"],
)

CookwareProfile(
    id="casserole",
    name="砂锅",
    volume_l=3.5,
    heat_transfer=0.4,
    heat_retention=1.5,
    heat_evenness=0.6,
    max_safe_temp_c=240,
    pot_air_bonus=0.0,
    stick_risk=0.3,
    splash_risk=0.05,
    geometry_radius=2.3,
    geometry_bottom_y=-0.2,
    geometry_top_y=0.5,
    geometry_flare=0.08,
    allowed_actions=["boil","steam"],
    best_for=["boil","steam"],
)
