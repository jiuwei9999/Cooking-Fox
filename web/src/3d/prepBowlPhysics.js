/**
 * 备菜台大碗物理：固体落体 + 稳定液体池（无干料小白球）
 */
import * as THREE from "https://unpkg.com/three@0.162.0/build/three.module.js";
import { createIngredientMesh, INGREDIENT_COLORS } from "./ingredientModels.js";
import { createSingleMinceFlake, createSingleChopSegment } from "./prepCutModels.js";
import {
  BOWL_CFG,
  bowlRadiusAtY,
  createBowlLiquidLayer,
  getLiquidVisual,
  BOWL_LIQUID_BAND_H,
} from "./prepBowlModels.js";
import { LIQUID_IDS, DRY_SEASONING_IDS, AROMATIC_IDS } from "../shared/ingredientMeta.js";
import { playCutSound } from "../shared/audioFeedback.js";

const GRAVITY = 9;
const DAMPING = 0.9;
const BOUNCE = 0.22;
const WALL_BOUNCE = 0.28;
const FRICTION = 0.82;
const LIQUID_DRAG = 0.82;
const BUOYANCY = 14;

const LIQUID_SET = new Set(LIQUID_IDS);
const DRY_SET = new Set(DRY_SEASONING_IDS);
const AROMATIC_SET = new Set(AROMATIC_IDS);

let physBodies = [];
let liquidLayers = [];

function disposeObj(obj) {
  if (!obj) return;
  obj.traverse((c) => {
    if (c.geometry) c.geometry.dispose();
    if (c.material) {
      if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
      else c.material.dispose();
    }
  });
}

export function clearBowlPhysics(ingredientGroup) {
  for (const b of physBodies) {
    if (b.group && ingredientGroup) ingredientGroup.remove(b.group);
    disposeObj(b.group);
  }
  physBodies = [];
  for (const layer of liquidLayers) {
    if (layer.mesh.parent) layer.mesh.parent.remove(layer.mesh);
    disposeObj(layer.mesh);
  }
  liquidLayers = [];
}

function applyLiquidLayerMesh(layer) {
  if (layer.currentScale > 0.04) {
    const rMid = (layer.currentRTop + layer.currentRBot) * 0.5;
    const s = rMid / 0.72;
    layer.mesh.scale.set(s, layer.currentScale, s);
    layer.mesh.position.set(0, layer.currentY, 0);
    layer.mesh.visible = true;
  } else {
    layer.mesh.visible = false;
  }
}

function snapLiquidLayersToTarget() {
  for (const layer of liquidLayers) {
    layer.currentScale = layer.targetScale;
    layer.currentY = layer.targetY;
    layer.currentRTop = layer.targetRTop;
    layer.currentRBot = layer.targetRBot;
    applyLiquidLayerMesh(layer);
  }
}

function spawnBody(ingredientGroup, ingredientId, prepState, cut, prepFlags, opts = {}) {
  const mesh = opts.mesh || createIngredientMesh(
    ingredientId,
    cut || "chop",
    8,
    prepState || "whole",
    prepFlags
  );
  const scale = opts.scale ?? 0.72;
  mesh.scale.setScalar(scale);
  const isStatic = !!opts.static;
  const halfH = opts.halfH ?? 0.1;

  mesh.position.set(
    (opts.offsetX ?? 0) + (isStatic ? 0 : (Math.random() - 0.5) * 0.2),
    opts.spawnY ?? (BOWL_CFG.rimY + 0.12 + Math.random() * 0.18),
    (opts.offsetZ ?? 0) + (isStatic ? 0 : (Math.random() - 0.5) * 0.2)
  );
  if (isStatic) {
    mesh.rotation.set(0.12, Math.random() * Math.PI * 2, 0.08);
  } else {
    mesh.rotation.set(
      Math.random() * 0.6,
      Math.random() * Math.PI,
      Math.random() * 0.6
    );
  }
  ingredientGroup.add(mesh);

  physBodies.push({
    group: mesh,
    ingredientId,
    velocity: isStatic
      ? new THREE.Vector3(0, 0, 0)
      : new THREE.Vector3((Math.random() - 0.5) * 0.2, -0.5, (Math.random() - 0.5) * 0.2),
    angVelocity: isStatic
      ? new THREE.Vector3(0, 0, 0)
      : new THREE.Vector3(
        (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5) * 1.2
      ),
    halfH,
    settled: isStatic,
    locked: !!opts.locked || isStatic,
  });
}

function spawnSmallPieces(ingredientGroup, ingredientId, count, prepState, cut, prepFlags) {
  for (let i = 0; i < count; i++) {
    let mesh;
    if (prepState === "minced") {
      mesh = createSingleMinceFlake(ingredientId, INGREDIENT_COLORS);
    } else if (prepState === "chopped" || cut === "chop") {
      mesh = createSingleChopSegment(ingredientId, INGREDIENT_COLORS);
    } else {
      mesh = createIngredientMesh(ingredientId, cut || "dice", 6, prepState, prepFlags);
      mesh.scale.setScalar(0.45);
    }
    spawnBody(ingredientGroup, ingredientId, prepState, cut, prepFlags, { mesh, scale: 0.5, halfH: 0.05 });
  }
}

/** 合并为 1～2 层液体，减少晃动与眩晕 */
function setLiquidPool(ingredientGroup, poolSpec) {
  liquidLayers.forEach((l) => {
    if (l.mesh.parent) l.mesh.parent.remove(l.mesh);
    disposeObj(l.mesh);
  });
  liquidLayers = [];

  let stackY = BOWL_CFG.bottomY + 0.03;
  for (const spec of poolSpec) {
    if (!spec || spec.level <= 0) continue;
    const vis = getLiquidVisual(spec.key);
    const layer = createBowlLiquidLayer(spec.key, spec.color || vis.color, spec.opacity ?? vis.opacity);
    const level = Math.min(0.92, spec.level);
    layer.targetScale = level;
    layer.targetY = stackY;
    const rBot = bowlRadiusAtY(stackY) * 0.9;
    const rTop = bowlRadiusAtY(stackY + BOWL_LIQUID_BAND_H * level) * 0.88;
    layer.targetRTop = rTop;
    layer.targetRBot = rBot;
    layer.currentRTop = rBot;
    layer.currentRBot = rBot;
    ingredientGroup.add(layer.mesh);
    liquidLayers.push(layer);
    stackY += BOWL_LIQUID_BAND_H * level * 0.96;
  }
}

function getLiquidSurfaceY() {
  let top = BOWL_CFG.bottomY;
  for (const layer of liquidLayers) {
    if (layer.currentScale > 0.03) {
      top = Math.max(top, layer.currentY + BOWL_LIQUID_BAND_H * layer.currentScale);
    }
  }
  return top;
}

function bowlHasLiquid() {
  return getLiquidSurfaceY() > BOWL_CFG.bottomY + 0.05;
}

function buildDistinctLiquidPools(liquidCounts, dryIds) {
  const pools = [];
  const entries = Object.entries(liquidCounts).filter(([, c]) => c > 0);
  entries.sort((a, b) => getLiquidVisual(a[0]).density - getLiquidVisual(b[0]).density);

  for (const [id, count] of entries) {
    const vis = getLiquidVisual(id);
    pools.push({
      key: id,
      level: Math.min(0.32, 0.08 + count * 0.09),
      color: vis.color,
      opacity: vis.opacity,
    });
  }

  if (dryIds.length > 0) {
    pools.push({
      key: "seasoning_mix",
      level: Math.min(0.18, 0.05 + dryIds.length * 0.025),
      color: 0x8a8078,
      opacity: 0.45,
    });
  }

  return pools;
}

function spawnMarinateItem(ingredientGroup, item, offsetX, offsetZ, itemIndex, surfaceY) {
  const id = item.id;
  const prepFlags = item.prepFlags || {};
  const st = item.prepState || "whole";
  const ct = item.cut || "chop";
  const halfH = 0.045;
  const yBase = surfaceY + halfH * 0.55 + itemIndex * 0.022;

  if (st === "minced" || st === "chopped" || st === "diced" || st === "sliced") {
    const n = st === "minced" ? 3 : st === "diced" ? 3 : 2;
    const spread = 0.07;
    for (let i = 0; i < n; i++) {
      let mesh;
      if (st === "minced") {
        mesh = createSingleMinceFlake(id, INGREDIENT_COLORS);
      } else if (st === "chopped" || ct === "chop") {
        mesh = createSingleChopSegment(id, INGREDIENT_COLORS);
      } else {
        mesh = createIngredientMesh(id, ct || "dice", 6, st, prepFlags);
        mesh.scale.setScalar(0.4);
      }
      spawnBody(ingredientGroup, id, st, ct, prepFlags, {
        mesh,
        scale: 0.48,
        halfH: 0.035,
        offsetX: offsetX + (i - (n - 1) / 2) * spread,
        offsetZ: offsetZ + (i % 2 === 0 ? -0.03 : 0.03),
        spawnY: yBase + i * 0.012,
        static: true,
        locked: true,
      });
    }
  } else {
    spawnBody(ingredientGroup, id, st, ct, prepFlags, {
      scale: 0.56,
      halfH: 0.07,
      offsetX,
      offsetZ,
      spawnY: yBase,
      static: true,
      locked: true,
    });
  }
}

/** 开始腌制后锁定，避免继续物理模拟导致穿模 */
export function lockMarinateBodies() {
  for (const body of physBodies) {
    body.locked = true;
    body.settled = true;
    body.velocity.set(0, 0, 0);
    body.angVelocity.set(0, 0, 0);
  }
}

/** 多主料 + 自选腌料液体；avgSoakProgress 0～1 控制液面高度 */
export function syncMarinateBowlPhysics(ingredientGroup, bowlItems, brineSeasonings, opts = {}) {
  clearBowlPhysics(ingredientGroup);
  if (!ingredientGroup) return;

  const liquidCounts = {};
  const dryIds = [];
  for (const it of brineSeasonings || []) {
    const id = it.id || it;
    if (LIQUID_SET.has(id) || ["soy_sauce", "dark_soy_sauce", "vinegar", "sesame_oil", "oyster_sauce", "bean_paste", "oil", "cooking_wine", "chili_oil"].includes(id)) {
      liquidCounts[id] = (liquidCounts[id] || 0) + 1;
    } else if (DRY_SET.has(id)) {
      dryIds.push(id);
    }
  }

  const avgProgress = opts.avgSoakProgress ?? 0;
  const baseLevel = 0.14 + avgProgress * 0.32;
  let pools = buildDistinctLiquidPools(liquidCounts, dryIds);
  if (pools.length === 0) {
    pools = [{ key: "brine", level: baseLevel, color: 0x9a7838, opacity: 0.55 }];
  } else {
    pools = pools.map((p) => ({
      ...p,
      level: Math.min(0.88, (p.level || 0.1) + baseLevel * 0.45),
    }));
  }
  setLiquidPool(ingredientGroup, pools);
  snapLiquidLayersToTarget();
  const surfaceY = getLiquidSurfaceY();

  const items = bowlItems || [];
  const n = items.length;
  const radius = n > 1 ? Math.min(0.3, 0.55 / n) : 0;
  items.forEach((item, i) => {
    const angle = n > 1 ? (i / n) * Math.PI * 2 + 0.4 : 0;
    const rx = Math.cos(angle) * radius;
    const rz = Math.sin(angle) * radius;
    spawnMarinateItem(ingredientGroup, item, rx, rz, i, surfaceY);
  });

  if (opts.lockBodies) lockMarinateBodies();
}

export function syncSeasoningBowlPhysics(ingredientGroup, items) {
  clearBowlPhysics(ingredientGroup);
  if (!ingredientGroup) return;

  const liquidCounts = {};
  const dryIds = [];
  const aromaticIds = [];

  for (const it of items || []) {
    const id = it.id || it;
    if (LIQUID_SET.has(id) || ["soy_sauce", "dark_soy_sauce", "vinegar", "sesame_oil", "oyster_sauce", "bean_paste", "oil", "cooking_wine", "chili_oil"].includes(id)) {
      liquidCounts[id] = (liquidCounts[id] || 0) + 1;
    } else if (DRY_SET.has(id)) {
      dryIds.push(id);
    } else if (AROMATIC_SET.has(id)) {
      aromaticIds.push(id);
    }
  }

  const pools = buildDistinctLiquidPools(liquidCounts, dryIds);
  if (pools.length === 0 && aromaticIds.length === 0) {
    pools.push({ key: "water", level: 0.08, color: 0x6ab8e8, opacity: 0.4 });
  }
  setLiquidPool(ingredientGroup, pools);

  aromaticIds.forEach((id) => {
    for (let i = 0; i < 2; i++) {
      const mesh = createSingleMinceFlake(id, INGREDIENT_COLORS);
      spawnBody(ingredientGroup, id, "seasoning_ready", "mince", {}, {
        mesh,
        scale: 0.55,
        halfH: 0.03,
      });
    }
  });
}

function updateLiquidMeshes(dt) {
  for (const layer of liquidLayers) {
    layer.currentScale += (layer.targetScale - layer.currentScale) * 3.5 * dt;
    layer.currentY += (layer.targetY - layer.currentY) * 3.5 * dt;
    layer.currentRTop += (layer.targetRTop - layer.currentRTop) * 3 * dt;
    layer.currentRBot += (layer.targetRBot - layer.currentRBot) * 3 * dt;

    applyLiquidLayerMesh(layer);
  }
  return getLiquidSurfaceY();
}

export function stepBowlPhysics(dt, ingredientGroup) {
  if (!ingredientGroup) return;
  const capped = Math.min(dt, 0.05);
  const surfaceY = updateLiquidMeshes(capped);
  const hasLiq = bowlHasLiquid();
  const margin = 0.18;

  for (const body of physBodies) {
    if (body.locked) continue;
    body.settled = false;
    const pos = body.group.position;
    const vel = body.velocity;
    const av = body.angVelocity;
    const halfH = body.halfH || 0.08;

    vel.y -= GRAVITY * capped;

    if (hasLiq && pos.y < surfaceY + halfH) {
      const submerge = Math.max(0, surfaceY + halfH * 0.5 - pos.y);
      vel.y += submerge * BUOYANCY * capped;
      vel.x *= LIQUID_DRAG;
      vel.z *= LIQUID_DRAG;
      vel.y *= 0.9;
      if (submerge > 0.05) {
        av.multiplyScalar(0.85);
      }
    }

    pos.x += vel.x * capped;
    pos.y += vel.y * capped;
    pos.z += vel.z * capped;

    const floorY = BOWL_CFG.bottomY + halfH;
    if (pos.y < floorY) {
      pos.y = floorY;
      if (vel.y < 0) {
        vel.y = Math.abs(vel.y) * BOUNCE;
        vel.x *= FRICTION;
        vel.z *= FRICTION;
        if (Math.abs(vel.y) < 0.25) {
          vel.y = 0;
          body.settled = true;
        } else if (Math.abs(vel.y) > 0.4) {
          playCutSound("soft");
        }
      }
    }

    const maxR = bowlRadiusAtY(pos.y) - margin;
    const dist = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
    if (dist > maxR) {
      const nx = pos.x / dist;
      const nz = pos.z / dist;
      const dot = vel.x * nx + vel.z * nz;
      if (dot > 0) {
        vel.x -= (1 + WALL_BOUNCE) * dot * nx;
        vel.z -= (1 + WALL_BOUNCE) * dot * nz;
      }
      pos.x = nx * maxR;
      pos.z = nz * maxR;
      vel.x *= FRICTION;
      vel.z *= FRICTION;
    }

    if (hasLiq) {
      const floatLine = surfaceY + halfH * 0.35;
      if (pos.y > floatLine) {
        pos.y = floatLine;
        if (vel.y > 0) vel.y = 0;
      }
    }

    if (pos.y > BOWL_CFG.rimY + 0.25) {
      pos.y = BOWL_CFG.rimY + 0.25;
      vel.y = Math.min(vel.y, 0);
    }

    for (const other of physBodies) {
      if (other === body) continue;
      const dx = pos.x - other.group.position.x;
      const dy = pos.y - other.group.position.y;
      const dz = pos.z - other.group.position.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const minD = (body.halfH + other.halfH) * 1.5 + 0.06;
      if (d < minD && d > 0.001) {
        const force = ((minD - d) / minD) * 2.5;
        vel.x += (dx / d) * force * capped;
        vel.y += (dy / d) * force * capped * 0.25;
        vel.z += (dz / d) * force * capped;
      }
    }

    vel.multiplyScalar(DAMPING);
    av.multiplyScalar(DAMPING);
    if (body.settled && vel.lengthSq() < 0.0015) {
      vel.set(0, 0, 0);
      av.set(0, 0, 0);
    }
    body.group.rotation.x += av.x * capped;
    body.group.rotation.y += av.y * capped;
    body.group.rotation.z += av.z * capped;
  }
}
