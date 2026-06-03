import * as THREE from "https://unpkg.com/three@0.162.0/build/three.module.js";
import { INGREDIENT_COLORS } from "./ingredientModels.js";

/** 备菜玻璃碗尺寸（世界坐标，与 prepScene 中 bowlMesh.position 对齐） */
export const BOWL_CFG = {
  worldY: -0.08,
  bottomY: -0.36,
  rimY: 0.26,
  rTop: 0.88,
  rBot: 0.68,
  height: 0.62,
};

const LIQUID_REF_R = 0.72;
const LIQUID_BAND_H = 0.14;

const LIQUID_VIS = {
  soy_sauce: { color: 0x5c3820, opacity: 0.78, density: 1.05, label: "生抽" },
  dark_soy_sauce: { color: 0x1a0a04, opacity: 0.85, density: 1.08, label: "老抽" },
  vinegar: { color: 0xc8b888, opacity: 0.7, density: 1.0, label: "醋" },
  sesame_oil: { color: 0xf0d858, opacity: 0.62, density: 0.88, label: "香油" },
  oyster_sauce: { color: 0x6b3a18, opacity: 0.8, density: 1.06, label: "蚝油" },
  bean_paste: { color: 0x8b2810, opacity: 0.82, density: 1.1, label: "豆瓣酱" },
  oil: { color: 0xffe8a0, opacity: 0.55, density: 0.82, label: "食用油" },
  cooking_wine: { color: 0xd4a060, opacity: 0.68, density: 1.02, label: "料酒" },
  chili_oil: { color: 0xe83818, opacity: 0.65, density: 0.9, label: "辣椒油" },
  water: { color: 0x6ab8e8, opacity: 0.5, density: 1.0, label: "水" },
  brine: { color: 0x9a7838, opacity: 0.62, density: 1.04, label: "卤水" },
  seasoning_mix: { color: 0x6a5848, opacity: 0.6, density: 1.02, label: "干料层" },
};

export const LIQUID_LABELS = Object.fromEntries(
  Object.entries(LIQUID_VIS).map(([k, v]) => [k, v.label || k])
);

/** CSS 色块用（#rrggbb） */
export function liquidColorCss(id) {
  const c = LIQUID_VIS[id]?.color ?? 0x888888;
  return `#${c.toString(16).padStart(6, "0")}`;
}

/** 大碗：磨砂玻璃感（低折射，减轻眩晕） */
export function createGlassBowl() {
  const bowl = new THREE.Group();
  bowl.userData.isBowl = true;
  const { rTop, rBot, height } = BOWL_CFG;

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xc8dce8,
    transparent: true,
    opacity: 0.28,
    roughness: 0.45,
    metalness: 0.04,
    side: THREE.FrontSide,
    depthWrite: true,
  });

  const innerMat = new THREE.MeshStandardMaterial({
    color: 0x2a2838,
    transparent: true,
    opacity: 0.35,
    roughness: 0.85,
    metalness: 0,
    side: THREE.BackSide,
  });

  const outer = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBot, height, 32, 1, true),
    wallMat
  );
  outer.position.y = height * 0.5 - 0.18;
  bowl.add(outer);

  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop * 0.94, rBot * 0.94, height * 0.98, 32, 1, true),
    innerMat
  );
  inner.position.y = height * 0.5 - 0.18;
  bowl.add(inner);

  const bottom = new THREE.Mesh(
    new THREE.CircleGeometry(rBot * 0.96, 32),
    new THREE.MeshStandardMaterial({ color: 0x3a3548, roughness: 0.75, metalness: 0.02 })
  );
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = BOWL_CFG.bottomY - BOWL_CFG.worldY + 0.02;
  bowl.add(bottom);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(rTop, 0.028, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0xe8f0f8, roughness: 0.35, metalness: 0.12 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = BOWL_CFG.rimY - BOWL_CFG.worldY;
  bowl.add(rim);

  const contents = new THREE.Group();
  contents.name = "bowlContents";
  contents.position.y = 0;
  bowl.add(contents);
  bowl.userData.contentsGroup = contents;

  bowl.position.set(0, BOWL_CFG.worldY, 0);
  return bowl;
}

export function bowlRadiusAtY(y) {
  const t = THREE.MathUtils.clamp(
    (y - BOWL_CFG.bottomY) / (BOWL_CFG.rimY - BOWL_CFG.bottomY),
    0,
    1
  );
  return THREE.MathUtils.lerp(BOWL_CFG.rBot, BOWL_CFG.rTop, t);
}

/** 碗内壁液体层（调料碗 / 腌制卤水） */
export function createBowlLiquidLayer(key, color, opacity) {
  const geo = new THREE.CylinderGeometry(LIQUID_REF_R, LIQUID_REF_R, LIQUID_BAND_H, 36);
  geo.translate(0, LIQUID_BAND_H * 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: color || 0x8b6914,
    transparent: true,
    opacity: opacity ?? 0.6,
    roughness: 0.18,
    metalness: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.set(0.01, 0.01, 0.01);
  mesh.renderOrder = 12;
  return {
    key,
    mesh,
    targetScale: 0,
    currentScale: 0,
    targetY: BOWL_CFG.bottomY,
    currentY: BOWL_CFG.bottomY,
    targetRTop: LIQUID_REF_R * 0.92,
    targetRBot: LIQUID_REF_R * 0.92,
    currentRTop: LIQUID_REF_R * 0.92,
    currentRBot: LIQUID_REF_R * 0.92,
    density: LIQUID_VIS[key]?.density ?? 1,
  };
}

export function updateBowlLiquidGeometry(layer, rTop, rBot) {
  const mesh = layer.mesh;
  const pos = mesh.geometry.attributes.position;
  const rT = rTop ?? layer.currentRTop;
  const rB = rBot ?? layer.currentRBot;
  const h = LIQUID_BAND_H;
  const segments = 36;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = t * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let ring = 0; ring <= 1; ring++) {
      const vi = i + ring * (segments + 1);
      const r = ring === 0 ? rB : rT;
      const y = ring === 0 ? 0 : h;
      pos.setXYZ(vi, cos * r, y, sin * r);
    }
  }
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

export function getLiquidVisual(id) {
  if (LIQUID_VIS[id]) return LIQUID_VIS[id];
  const c = INGREDIENT_COLORS[id] || 0xaaaaaa;
  return { color: c, opacity: 0.65, density: 1, label: id };
}

export const BOWL_LIQUID_BAND_H = LIQUID_BAND_H;
