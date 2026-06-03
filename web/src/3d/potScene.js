import * as THREE from "three";
import { createIngredientMesh } from "./ingredientModels.js";
import { playCutSound } from "../shared/audioFeedback.js";
import { initCookingVfx, updateCookingVfx, disposeCookingVfx, syncCookingVfxLayout } from "./cookingVfx.js";
// cache-bust v8

let renderer, scene, camera, wokMesh, ingredientGroup, liquidGroup;
let cachedPotSession = null;
const LIQUID_BAND_H = 0.05;
/** 与 server 份数上限配合，防止 WebGL 物理网格过多 */
const MAX_PHYS_BODIES = 120;
let steamParticles, steamData;
let bubbleParticles, bubbleData;
let oilDrops, oilData;
let animTime = 0;
let currentTheme = "dark";
let themeObjects = {};

// Multi-layer liquid meshes
let liquidLayers = {};

// Per-liquid-type state
let liquidState = {
  water: 0, oil: 0, soy_sauce: 0, dark_soy_sauce: 0, vinegar: 0, sesame_oil: 0,
  cooking_wine: 0, oyster_sauce: 0, chili_oil: 0,
};

// Liquid type config: color, opacity, density (lower = floats on top)
const LIQUID_CONFIG = {
  water: { color: 0xa8d8ea, opacity: 0.22, density: 1.0, name: "water" },
  oil: { color: 0xfacc15, opacity: 0.55, density: 0.92, name: "oil" },
  soy_sauce: { color: 0x3d1f0a, opacity: 0.7, density: 1.05, name: "soy_sauce" },
  dark_soy_sauce: { color: 0x1a0808, opacity: 0.78, density: 1.06, name: "dark_soy_sauce" },
  vinegar: { color: 0xd4c890, opacity: 0.45, density: 0.99, name: "vinegar" },
  sesame_oil: { color: 0xe8b830, opacity: 0.6, density: 0.91, name: "sesame_oil" },
  cooking_wine: { color: 0xc9a86c, opacity: 0.35, density: 0.98, name: "cooking_wine" },
  oyster_sauce: { color: 0x4a2810, opacity: 0.72, density: 1.08, name: "oyster_sauce" },
  chili_oil: { color: 0xdc2626, opacity: 0.65, density: 0.90, name: "chili_oil" },
};

// Equipment defaults (wok)
let eqConfig = {
  id: "wok",
  radius: 2.65,
  bottomY: -0.12,
  topY: 0.55,
  flare: 0.3,
  depth: 0.67,  // topY - bottomY
};

// Equipment profiles (mirrors backend equipment.py)
var EQUIPMENT = {
  wok:      { id:"wok", name:"铁炒锅", radius:2.65, bottomY:-0.12, topY:0.55, flare:0.3, color:0x3a3a4a, accent:0x2a2a35 },
  flat_pan: { id:"flat_pan", name:"平底煎锅", radius:2.4, bottomY:-0.08, topY:0.3, flare:0.1, color:0x2e3238, accent:0x1a1c20 },
  deep_pot: { id:"deep_pot", name:"深汤锅", radius:2.5, bottomY:-0.25, topY:0.7, flare:0.05, color:0x4a5058, accent:0x353a42 },
  casserole:{ id:"casserole", name:"砂锅", radius:2.3, bottomY:-0.2, topY:0.5, flare:0.08, color:0x8b5a3a, accent:0x6b4530 },
};

let currentEquipmentId = "wok";
let equipmentDecor = [];

function buildEquipmentProfile(eqId, eq) {
  const profile = [];
  const rBase = eq.radius;
  const yBase = eq.bottomY;
  const yTop = eq.topY;
  const flare = eq.flare;
  const segments = 32;

  if (eqId === "flat_pan") {
    // 平底煎锅：极浅、宽平底、短直壁 + 微外撇锅缘
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = yBase + t * (yTop - yBase);
      let r;
      if (t < 0.08) r = rBase * (0.92 + t * 0.6);
      else if (t < 0.55) r = rBase * (0.98 + (t - 0.08) * 0.04);
      else r = rBase * (1.0 + (t - 0.55) * flare * 0.35);
      profile.push(new THREE.Vector2(r, y));
    }
  } else if (eqId === "deep_pot") {
    // 深汤锅：平底 + 近直筒壁 + 外翻锅沿
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = yBase + t * (yTop - yBase);
      let r;
      if (t < 0.12) r = rBase * (0.82 + t * 1.5);
      else if (t < 0.82) r = rBase * (0.96 + (t - 0.12) * 0.02);
      else r = rBase * (1.0 + (t - 0.82) * flare * 2.5);
      profile.push(new THREE.Vector2(r, y));
    }
  } else if (eqId === "casserole") {
    // 砂锅：圆腹、收口、厚锅沿
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = yBase + t * (yTop - yBase);
      let r;
      if (t < 0.2) r = rBase * (0.75 + t * 1.1);
      else if (t < 0.65) r = rBase * (0.95 + Math.sin((t - 0.2) / 0.45 * Math.PI) * 0.12);
      else r = rBase * (1.04 - (t - 0.65) * 0.08 + (t - 0.65) * flare);
      profile.push(new THREE.Vector2(r, y));
    }
  } else {
    // 铁炒锅：圆底、弧壁、宽口外撇
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = yBase + t * (yTop - yBase + 0.35);
      let r;
      if (t < 0.15) r = rBase * (0.55 + t * 2.8);
      else if (t < 0.68) r = rBase * (0.95 + Math.sin((t - 0.15) / 0.53 * Math.PI * 0.5) * 0.22);
      else r = rBase * (1.12 - (t - 0.68) * flare * 1.1);
      profile.push(new THREE.Vector2(r, y));
    }
  }
  return profile;
}

/** 锅底封口：轮廓起点移到中心轴，避免锅底圆片与锅身半径不一致而「解体」 */
function sealProfileBottom(profile, yBase) {
  const sealed = profile.map((p) => p.clone());
  if (sealed.length === 0) return sealed;
  if (sealed[0].x > 0.001) {
    sealed.unshift(new THREE.Vector2(0, yBase));
  }
  const wall = sealed[sealed[0].x < 0.001 ? 1 : 0];
  if (wall && Math.abs(wall.y - yBase) > 0.002) {
    const idx = sealed[0].x < 0.001 ? 1 : 0;
    sealed.splice(idx, 0, new THREE.Vector2(wall.x, yBase));
  }
  return sealed;
}

function radiusAtY(profile, y) {
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i];
    const b = profile[i + 1];
    if (y >= Math.min(a.y, b.y) - 0.001 && y <= Math.max(a.y, b.y) + 0.001) {
      const t = (y - a.y) / (b.y - a.y || 1e-6);
      return THREE.MathUtils.lerp(a.x, b.x, THREE.MathUtils.clamp(t, 0, 1));
    }
  }
  return profile[profile.length - 1].x;
}

/** 锅体几何指标：把手锚定在真实锅壁半径上 */
function getPotMetrics(eqId, eq) {
  const profile = sealProfileBottom(buildEquipmentProfile(eqId, eq), eq.bottomY);
  const rim = profile[profile.length - 1];
  const handleT = eqId === "flat_pan" ? 0.42 : eqId === "deep_pot" ? 0.68 : 0.55;
  const handleY = eq.bottomY + (rim.y - eq.bottomY) * handleT;
  const handleR = radiusAtY(profile, handleY);
  const bottomR = profile.find((p) => p.x > 0.01 && Math.abs(p.y - eq.bottomY) < 0.02)?.x ?? profile[1]?.x ?? rim.x;
  return { profile, bottomR, rimR: rim.x, rimY: rim.y, handleY, handleR, eqId };
}

const LIQUID_REF_RADIUS = 2.5;

function liquidInset(eqId) {
  if (eqId === "casserole") return 0.945;
  if (eqId === "deep_pot") return 0.96;
  return 0.93;
}

/** 锅内液体起始高度：对齐轮廓内壁底，而非固定 +0.06 */
function liquidBaseY(metrics) {
  const yBase = eqConfig?.bottomY ?? -0.12;
  if (!metrics?.profile?.length) return yBase + 0.04;
  const floor = metrics.profile.find((p) => p.x > 0.06) || metrics.profile[1];
  return (floor?.y ?? yBase) + 0.012;
}

/** 液层圆台上下半径：按该段高度贴合锅壁；砂锅仅在收口段限制上沿 */
function liquidRadiiForBand(metrics, yBottom, yTop) {
  const profile = metrics.profile;
  const inset = liquidInset(metrics.eqId);
  const yLo = Math.min(yBottom, yTop) + 0.004;
  const yHi = Math.max(yBottom, yTop) - 0.004;
  let rBot = radiusAtY(profile, yLo) * inset;
  let rTop = radiusAtY(profile, yHi) * inset;

  if (metrics.eqId === "casserole") {
    const span = (eqConfig.topY ?? 0.5) - (eqConfig.bottomY ?? -0.2);
    const neckY = (eqConfig.bottomY ?? -0.2) + span * 0.68;
    if (yHi > neckY) {
      let neckCap = Infinity;
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const y = THREE.MathUtils.lerp(Math.max(yLo, neckY), yHi, i / steps);
        neckCap = Math.min(neckCap, radiusAtY(profile, y));
      }
      rTop = Math.min(rTop, neckCap * inset);
      if (yLo > neckY) rBot = Math.min(rBot, neckCap * inset);
    }
  }

  return { rBot: Math.max(0.15, rBot), rTop: Math.max(0.15, rTop) };
}

function updateLayerLiquidGeometry(layer, rTop, rBot) {
  const key = rTop.toFixed(3) + ":" + rBot.toFixed(3);
  if (layer._geoKey === key) return;
  layer._geoKey = key;
  if (layer.mesh.geometry) layer.mesh.geometry.dispose();
  const geo = new THREE.CylinderGeometry(rTop, rBot, LIQUID_BAND_H, 40);
  geo.translate(0, LIQUID_BAND_H * 0.5, 0);
  layer.mesh.geometry = geo;
  layer.mesh.scale.x = 1;
  layer.mesh.scale.z = 1;
}

/** 某高度处锅内壁有效半径（食材/液体共用） */
function interiorRadiusAt(metrics, y, bodyMargin) {
  const margin = bodyMargin ?? 0;
  if (!metrics?.profile) return POT_RADIUS - 0.25 - margin;
  const yLo = eqConfig.bottomY ?? -0.25;
  const yHi = eqConfig.topY ?? 0.7;
  const yClamped = THREE.MathUtils.clamp(y, yLo, yHi);
  return Math.max(0.18, radiusAtY(metrics.profile, yClamped) * liquidInset(metrics.eqId) - margin);
}

function getLiquidSurfaceY(metrics) {
  let top = liquidBaseY(metrics);
  for (const layer of Object.values(liquidLayers)) {
    if (layer.stackIndex < 0 || layer.currentScale < 0.02) continue;
    const t = layer.currentY + LIQUID_BAND_H * layer.currentScale;
    if (t > top) top = t;
  }
  return top;
}

function potHasLiquid(metrics) {
  return getLiquidSurfaceY(metrics) > liquidBaseY(metrics) + 0.025;
}

/** 搅拌晃动：限制在壁内，用轻微倾斜代替大幅平移 */
function applyLiquidSlosh(layer, metrics, mixF, dt) {
  if (!layer.sloshX) layer.sloshX = 0;
  if (!layer.sloshZ) layer.sloshZ = 0;

  if (mixF < 0.08 || layer.currentScale < 0.05) {
    layer.sloshX *= 1 - 5 * dt;
    layer.sloshZ *= 1 - 5 * dt;
    layer.mesh.position.x = layer.sloshX;
    layer.mesh.position.z = layer.sloshZ;
    layer.mesh.rotation.x *= 1 - 4 * dt;
    layer.mesh.rotation.z *= 1 - 4 * dt;
    return;
  }

  const bandH = LIQUID_BAND_H * layer.currentScale;
  const yMid = layer.currentY + bandH * 0.5;
  const band = liquidRadiiForBand(metrics, layer.currentY, layer.currentY + bandH);
  const rEff = (band.rTop + band.rBot) * 0.5;
  const wallR = interiorRadiusAt(metrics, yMid, 0.04);
  const headroom = Math.max(0, wallR - rEff);
  const maxSlosh = Math.max(0.008, Math.min(rEff * 0.055, headroom * 0.35));
  const wobble = Math.min(1.15, mixF * 0.18);
  const phase = layer.stackIndex * 0.9 + animTime;

  layer.sloshX = Math.sin(phase * 14) * maxSlosh * wobble;
  layer.sloshZ = Math.cos(phase * 15) * maxSlosh * wobble;
  const dist = Math.hypot(layer.sloshX, layer.sloshZ);
  if (dist > maxSlosh && dist > 1e-6) {
    const s = maxSlosh / dist;
    layer.sloshX *= s;
    layer.sloshZ *= s;
  }

  layer.mesh.position.x = layer.sloshX;
  layer.mesh.position.z = layer.sloshZ;
  layer.mesh.rotation.x = (layer.sloshZ / Math.max(maxSlosh, 0.01)) * 0.06 * wobble;
  layer.mesh.rotation.z = -(layer.sloshX / Math.max(maxSlosh, 0.01)) * 0.06 * wobble;
}

function createEquipmentMaterial(eqId, eq) {
  if (eqId === "casserole") {
    return new THREE.MeshStandardMaterial({
      color: eq.color,
      metalness: 0.04,
      roughness: 0.88,
      emissive: 0x1a1008,
      emissiveIntensity: 0.15,
      side: THREE.DoubleSide,
    });
  }
  if (eqId === "flat_pan") {
    return new THREE.MeshStandardMaterial({
      color: eq.color,
      metalness: 0.9,
      roughness: 0.18,
      emissive: 0x0a0a10,
      emissiveIntensity: 0.25,
      side: THREE.DoubleSide,
    });
  }
  if (eqId === "deep_pot") {
    return new THREE.MeshStandardMaterial({
      color: eq.color,
      metalness: 0.82,
      roughness: 0.28,
      emissive: 0x101418,
      emissiveIntensity: 0.2,
      side: THREE.DoubleSide,
    });
  }
  return new THREE.MeshStandardMaterial({
    color: eq.color,
    metalness: 0.94,
    roughness: 0.15,
    emissive: 0x111111,
    emissiveIntensity: 0.3,
    side: THREE.DoubleSide,
  });
}

function clearEquipmentDecor() {
  if (!scene) return;
  for (const obj of equipmentDecor) {
    scene.remove(obj);
    obj.traverse((c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material && c.material.dispose) c.material.dispose();
    });
  }
  equipmentDecor = [];
}

function addEquipmentDecor(eqId, eq, bodyMat, metrics) {
  clearEquipmentDecor();
  const accent = eq.accent || eq.color;
  const { rimR, rimY, handleY } = metrics;

  if (eqId === "wok") {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(rimR * 1.02, 0.04, 10, 48),
      new THREE.MeshStandardMaterial({ color: accent, metalness: 0.9, roughness: 0.2 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = rimY + 0.02;
    scene.add(ring);
    equipmentDecor.push(ring);
  }

  if (eqId === "flat_pan") {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(rimR * 1.01, 0.025, 8, 48),
      new THREE.MeshStandardMaterial({ color: 0x555860, metalness: 0.85, roughness: 0.25 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = rimY;
    scene.add(rim);
    equipmentDecor.push(rim);
  }

  if (eqId === "deep_pot") {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(rimR * 0.99, 0.03, 8, 48),
      new THREE.MeshStandardMaterial({ color: accent, metalness: 0.8, roughness: 0.3 })
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = rimY - 0.02;
    scene.add(band);
    equipmentDecor.push(band);

    const lidHint = new THREE.Mesh(
      new THREE.CylinderGeometry(rimR * 0.94, rimR * 0.94, 0.04, 40),
      new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.7, roughness: 0.35, transparent: true, opacity: 0.35 })
    );
    lidHint.position.y = rimY + 0.12;
    scene.add(lidHint);
    equipmentDecor.push(lidHint);
    themeObjects.potLidMesh = lidHint;
  } else {
    themeObjects.potLidMesh = null;
  }

  if (eqId === "casserole") {
    const glaze = new THREE.Mesh(
      new THREE.TorusGeometry(rimR * 1.0, 0.055, 10, 40),
      new THREE.MeshStandardMaterial({ color: 0xa07050, metalness: 0.02, roughness: 0.75 })
    );
    glaze.rotation.x = Math.PI / 2;
    glaze.position.y = rimY + 0.01;
    scene.add(glaze);
    equipmentDecor.push(glaze);

    for (let side = -1; side <= 1; side += 2) {
      const lug = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.025, 8, 16, Math.PI),
        new THREE.MeshStandardMaterial({ color: accent, metalness: 0.05, roughness: 0.8 })
      );
      lug.rotation.y = side * Math.PI / 2;
      lug.rotation.z = Math.PI / 2;
      lug.position.set(side * rimR * 0.98, handleY, 0);
      scene.add(lug);
      equipmentDecor.push(lug);
    }
  }
}

function rebuildEquipmentHandles(eqId, eq, bodyMat, metrics) {
  if (themeObjects.handleGroups) {
    for (const hg of themeObjects.handleGroups) {
      scene.remove(hg);
      hg.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material && c.material.dispose) c.material.dispose();
      });
    }
  }
  themeObjects.handleGroups = [];

  const { handleR, handleY, rimR } = metrics;
  const connLen = eqId === "flat_pan" ? 0.32 : 0.26;
  const gripLen = eqId === "flat_pan" ? 1.45 : 1.15;

  if (eqId === "flat_pan") {
    const hg = new THREE.Group();
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x1a1208, metalness: 0.05, roughness: 0.7 });
    const conn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, connLen, 8),
      bodyMat
    );
    conn.rotation.z = Math.PI / 2;
    conn.position.set(handleR + connLen * 0.5, handleY, 0);
    hg.add(conn);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, gripLen, 10), gripMat);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(handleR + connLen + gripLen * 0.5, handleY, 0);
    hg.add(grip);
    scene.add(hg);
    themeObjects.handleGroups.push(hg);
    return;
  }

  for (let side = -1; side <= 1; side += 2) {
    const hg = new THREE.Group();
    if (eqId === "casserole") {
      const lug = new THREE.Mesh(
        new THREE.TorusGeometry(0.13, 0.028, 8, 14, Math.PI * 0.85),
        new THREE.MeshStandardMaterial({ color: eq.accent, metalness: 0.03, roughness: 0.85 })
      );
      lug.rotation.y = side * Math.PI / 2;
      lug.rotation.z = Math.PI / 2;
      lug.position.set(side * (rimR + 0.02), handleY, 0);
      hg.add(lug);
    } else if (eqId === "deep_pot") {
      const lugMat = new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.75, roughness: 0.35 });
      const lug = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.12), lugMat);
      lug.position.set(side * (handleR + 0.1), handleY, 0);
      hg.add(lug);
    } else {
      const gripMat = new THREE.MeshStandardMaterial({ color: 0x2d1f0e, metalness: 0.05, roughness: 0.65 });
      const conn = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, connLen, 8),
        bodyMat
      );
      conn.rotation.z = Math.PI / 2;
      conn.position.set(side * (handleR + connLen * 0.5), handleY, 0);
      hg.add(conn);
      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.17, gripLen, 10),
        gripMat
      );
      grip.rotation.z = Math.PI / 2;
      grip.position.set(side * (handleR + connLen + gripLen * 0.5), handleY, 0);
      hg.add(grip);
    }
    scene.add(hg);
    themeObjects.handleGroups.push(hg);
  }
}

// Physics state per ingredient
let physBodies = [];
let meltedRefs = new Set();
let physicsParams = {
  mixForce: 0,
  tempC: 25,
  burnRisk: 0,
};
let potHeatingActive = false;

let POT_RADIUS = 2.65;
let POT_BOTTOM_Y = -0.12;
let POT_TOP_Y = 0.55;
const GRAVITY = 11;
const DAMPING = 0.94;
const BOUNCE = 0.28;
const WALL_BOUNCE = 0.35;
const FRICTION = 0.88;
const WALL_FRICTION = 0.88;

function onPotWindowResize() {
  if (!renderer || !camera) return;
  const host = document.getElementById("pot3dHost");
  if (!host) return;
  const w2 = host.clientWidth || 400;
  const h2 = host.clientHeight || 260;
  renderer.setSize(w2, h2);
  camera.aspect = w2 / h2;
  camera.updateProjectionMatrix();
}

export function initPot3D(container) {
  if (!container) return;
  if (renderer) disposePot3D();

  // Apply current equipment config to physics constants
  POT_RADIUS = eqConfig.radius;
  POT_BOTTOM_Y = eqConfig.bottomY;
  POT_TOP_Y = eqConfig.topY;

  const { clientWidth: w, clientHeight: h } = container;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w || 400, h || 260);
  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a18);

  camera = new THREE.PerspectiveCamera(45, (w || 4) / (h || 3), 0.1, 100);
  camera.position.set(0, 5.5, 8.5);
  camera.lookAt(0, 0.2, 0);

  // Lighting（柔和，适合肉团 Standard 材质）
  const hemi = new THREE.HemisphereLight(0xfff0e8, 0x2a2838, 0.7);
  scene.add(hemi);
  themeObjects.hemi = hemi;
  const ambient = new THREE.AmbientLight(0x505570, 0.65);
  scene.add(ambient);
  themeObjects.ambient = ambient;
  const key = new THREE.DirectionalLight(0xffeedd, 1.3);
  key.position.set(5, 9, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xaabbdd, 0.55);
  fill.position.set(-3, 3, -3);
  scene.add(fill);
  const rimLit = new THREE.DirectionalLight(0xffccaa, 0.5);
  rimLit.position.set(0, 2, -7);
  scene.add(rimLit);

  // Base platform
  const baseGeo = new THREE.CylinderGeometry(3.6, 3.9, 0.25, 56);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x2a1f14, metalness: 0.15, roughness: 0.65 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = -0.65;
  scene.add(base);
  themeObjects.baseMat = baseMat;

  const baseRingGeo = new THREE.TorusGeometry(3.75, 0.08, 16, 56);
  const baseRingMat = new THREE.MeshStandardMaterial({ color: 0x4a3828, metalness: 0.5, roughness: 0.35 });
  const baseRing = new THREE.Mesh(baseRingGeo, baseRingMat);
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = -0.52;
  scene.add(baseRing);
  themeObjects.baseRingMat = baseRingMat;

  initCookingVfx(scene);

  // ── 厨具主体（封口轮廓 Lathe，无分离锅底圆片）──
  currentEquipmentId = eqConfig.id || "wok";
  const potMetrics = getPotMetrics(currentEquipmentId, eqConfig);
  themeObjects.potMetrics = potMetrics;
  const wokGeo = new THREE.LatheGeometry(potMetrics.profile, 56);
  const wokMat = createEquipmentMaterial(currentEquipmentId, eqConfig);
  wokMesh = new THREE.Mesh(wokGeo, wokMat);
  wokMesh.renderOrder = 2;
  scene.add(wokMesh);
  themeObjects.wokMat = wokMat;
  themeObjects.capMesh = null;

  rebuildEquipmentHandles(currentEquipmentId, eqConfig, wokMat, potMetrics);
  addEquipmentDecor(currentEquipmentId, eqConfig, wokMat, potMetrics);
  syncCookingVfxLayout(eqConfig, potMetrics);

  liquidGroup = new THREE.Group();
  liquidGroup.name = "liquidGroup";
  scene.add(liquidGroup);

  // ── Multi-layer liquid system ──
  initLiquidLayers();
  syncSceneRenderOrder();

  // Ingredient group
  ingredientGroup = new THREE.Group();
  scene.add(ingredientGroup);

  // Steam
  steamParticles = []; steamData = [];
  const steamGeo = new THREE.SphereGeometry(0.06, 5, 5);
  for (let i = 0; i < 50; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: true,
    });
    const sphere = new THREE.Mesh(steamGeo, mat);
    sphere.renderOrder = 15;
    sphere.visible = false;
    scene.add(sphere);
    steamParticles.push(sphere);
    steamData.push({ life: 0, maxLife: 1.2 + Math.random() * 2.4, speed: 0.3 + Math.random() * 0.7, driftX: (Math.random() - 0.5) * 0.35, driftZ: (Math.random() - 0.5) * 0.35 });
  }

  // Bubbles (boiling)
  bubbleParticles = []; bubbleData = [];
  const bubbleGeo = new THREE.SphereGeometry(0.04, 6, 6);
  for (let i = 0; i < 30; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    const sphere = new THREE.Mesh(bubbleGeo, mat);
    sphere.renderOrder = 998;
    sphere.visible = false;
    scene.add(sphere);
    bubbleParticles.push(sphere);
    bubbleData.push({ life: 0, maxLife: 0.6 + Math.random() * 1.2, speed: 0.4 + Math.random() * 0.8, baseX: (Math.random() - 0.5) * 4.5, baseZ: (Math.random() - 0.5) * 4.5 });
  }

  // Oil sizzle
  oilDrops = []; oilData = [];
  const sizzleGeo = new THREE.SphereGeometry(0.025, 4, 4);
  for (let i = 0; i < 20; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0, depthWrite: false });
    const drop = new THREE.Mesh(sizzleGeo, mat);
    drop.renderOrder = 997;
    drop.visible = false;
    scene.add(drop);
    oilDrops.push(drop);
    oilData.push({ life: 0, maxLife: 0.3 + Math.random() * 0.5, vx: (Math.random() - 0.5) * 1.5, vy: 0.8 + Math.random() * 1.8, vz: (Math.random() - 0.5) * 1.5 });
  }

  animate();

  window.removeEventListener("resize", onPotWindowResize);
  window.addEventListener("resize", onPotWindowResize);
}

export function updatePotTheme(isLight) {
  currentTheme = isLight ? "light" : "dark";
  if (!scene) return;

  if (isLight) {
    scene.background = new THREE.Color(0xe8edf2);
    scene.fog = new THREE.Fog(0xe8edf2, 5, 22);
    if (themeObjects.ambient) themeObjects.ambient.color.set(0x8899aa);
    if (themeObjects.wokMat) {
      const lc = currentEquipmentId === "casserole" ? 0xc49a78 : 0xc8c8d0;
      themeObjects.wokMat.color.set(lc);
      themeObjects.wokMat.emissive.set(currentEquipmentId === "casserole" ? 0x886644 : 0xcccccc);
      themeObjects.wokMat.emissiveIntensity = 0.2;
    }
    if (themeObjects.baseMat) themeObjects.baseMat.color.set(0x8b7355);
    if (themeObjects.baseRingMat) themeObjects.baseRingMat.color.set(0xa08060);
  } else {
    scene.background = new THREE.Color(0x0a0a18);
    scene.fog = new THREE.Fog(0x0a0a18, 4, 18);
    if (themeObjects.ambient) themeObjects.ambient.color.set(0x505570);
    if (themeObjects.wokMat && eqConfig) {
      themeObjects.wokMat.color.set(eqConfig.color || 0x3a3a4a);
      themeObjects.wokMat.emissive.set(currentEquipmentId === "casserole" ? 0x1a1008 : 0x111111);
      themeObjects.wokMat.emissiveIntensity = currentEquipmentId === "casserole" ? 0.15 : 0.3;
    }
    if (themeObjects.baseMat) themeObjects.baseMat.color.set(0x2a1f14);
    if (themeObjects.baseRingMat) themeObjects.baseRingMat.color.set(0x4a3828);
  }
}

export function switchEquipment(equipmentId) {
  var eq = EQUIPMENT[equipmentId] || EQUIPMENT["wok"];
  eqConfig = eq;
  currentEquipmentId = equipmentId;
  POT_RADIUS = eq.radius;
  POT_BOTTOM_Y = eq.bottomY;
  POT_TOP_Y = eq.topY;
  if (wokMesh && scene) {
    wokMesh.geometry.dispose();
    wokMesh.material.dispose();

    const potMetrics = getPotMetrics(equipmentId, eq);
    themeObjects.potMetrics = potMetrics;
    wokMesh.geometry = new THREE.LatheGeometry(potMetrics.profile, 56);
    wokMesh.material = createEquipmentMaterial(equipmentId, eq);
    themeObjects.wokMat = wokMesh.material;

    if (themeObjects.capMesh) {
      scene.remove(themeObjects.capMesh);
      themeObjects.capMesh.geometry.dispose();
      themeObjects.capMesh = null;
    }

    rebuildEquipmentHandles(equipmentId, eq, wokMesh.material, potMetrics);
    addEquipmentDecor(equipmentId, eq, wokMesh.material, potMetrics);
    syncCookingVfxLayout(eq, potMetrics);
    syncSceneRenderOrder();
  }
  if (cachedPotSession) updatePot3D(cachedPotSession);
}

function syncSceneRenderOrder() {
  if (wokMesh) wokMesh.renderOrder = 0;
  for (const obj of equipmentDecor) obj.renderOrder = 2;
  if (themeObjects.handleGroups) {
    for (const hg of themeObjects.handleGroups) hg.renderOrder = 3;
  }
  if (liquidGroup) liquidGroup.renderOrder = 8;
}

function initLiquidLayers() {
  const layerKeys = [
    "water", "vinegar", "soy_sauce", "dark_soy_sauce", "cooking_wine", "oyster_sauce",
    "oil", "sesame_oil", "chili_oil",
  ];
  const metrics = themeObjects.potMetrics;
  const baseY = liquidBaseY(metrics);
  const parent = liquidGroup || scene;
  for (const key of layerKeys) {
    const cfg = LIQUID_CONFIG[key];
    if (!cfg) continue;
    const geo = new THREE.CylinderGeometry(LIQUID_REF_RADIUS, LIQUID_REF_RADIUS, LIQUID_BAND_H, 40);
    geo.translate(0, LIQUID_BAND_H * 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: cfg.color,
      transparent: true,
      opacity: 0,
      metalness: 0.05,
      roughness: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(0.01, 0.01, 0.01);
    mesh.position.y = baseY;
    mesh.visible = false;
    mesh.renderOrder = 10;
    parent.add(mesh);
    liquidLayers[key] = {
      mesh, targetScale: 0, targetY: baseY, currentScale: 0, currentY: baseY,
      density: cfg.density, stackIndex: -1, _geoKey: "",
      targetRTop: LIQUID_REF_RADIUS, targetRBot: LIQUID_REF_RADIUS,
      currentRTop: LIQUID_REF_RADIUS, currentRBot: LIQUID_REF_RADIUS,
    };
  }
}

export function updatePot3D(session) {
  if (!scene || !wokMesh || !ingredientGroup || !session) return;
  cachedPotSession = session;
  const m = session.metrics || {};
  const water = m.water_g || 0;
  const oil = m.oil_g || 0;
  const solids = m.solids_g || 0;
  const total = water + oil + solids;

  // ── Update liquid state from explicit liquid additions only ──
  liquidState.water = countExplicitLiquid(session, "water");
  liquidState.oil = countExplicitLiquid(session, "oil");
  liquidState.soy_sauce = countExplicitLiquid(session, "soy_sauce");
  liquidState.dark_soy_sauce = countExplicitLiquid(session, "dark_soy_sauce");
  liquidState.vinegar = countExplicitLiquid(session, "vinegar");
  liquidState.sesame_oil = countExplicitLiquid(session, "sesame_oil");
  liquidState.cooking_wine = countExplicitLiquid(session, "cooking_wine");
  liquidState.oyster_sauce = countExplicitLiquid(session, "oyster_sauce");
  liquidState.chili_oil = countExplicitLiquid(session, "chili_oil");

  const totalLiquid = Object.values(liquidState).reduce((a, b) => a + b, 0);
  const hasLiquid = totalLiquid > 1;

  const layers = buildLayerStack(totalLiquid, themeObjects.potMetrics);

  if (themeObjects.potLidMesh) {
    themeObjects.potLidMesh.visible = !hasLiquid;
  }

  for (const [, layer] of Object.entries(liquidLayers)) {
    layer.stackIndex = -1;
  }

  for (const [key, layer] of Object.entries(liquidLayers)) {
    const stack = layers.find((l) => l.key === key);
    if (stack && hasLiquid) {
      layer.targetScale = Math.max(0.12, stack.height / LIQUID_BAND_H);
      layer.targetY = stack.baseY;
      layer.targetRTop = stack.rTop;
      layer.targetRBot = stack.rBot;
      layer.stackIndex = stack.index;
      layer.density = stack.density;
      layer.mesh.renderOrder = 10 + stack.index;
      layer.mesh.visible = true;
      layer.mesh.material.opacity = LIQUID_CONFIG[key]?.opacity || 0.5;
    } else {
      layer.targetScale = 0.01;
      layer.targetY = liquidBaseY(themeObjects.potMetrics);
      layer.targetRTop = LIQUID_REF_RADIUS;
      layer.targetRBot = LIQUID_REF_RADIUS;
      layer.stackIndex = -1;
      layer.mesh.visible = false;
      layer.mesh.material.opacity = 0;
    }
  }

  // Wok heat glow
  const temp = m.temp_c || 25;
  const glow = temp > 100 ? Math.min(0.65, (temp - 100) / 120) : 0;
  wokMesh.material.emissive = new THREE.Color().setHSL(0.06, 0.95, glow * 0.38);
  wokMesh.material.emissiveIntensity = glow * (potHeatingActive ? 1.0 : 0.75);

  // Update physics params
  physicsParams.tempC = temp;
  physicsParams.burnRisk = m.burn_risk || 0;

  // Sync physics bodies
  const pot = session.pot || [];
  syncPhysBodies(pot, session.ingredients || {}, hasLiquid ? totalLiquid / 400 : 0);

  updateAppearanceFromPot(solidPotFromSession(session));
}

function solidPotFromSession(session) {
  const LIQUID = new Set([
    "water", "oil", "soy_sauce", "dark_soy_sauce", "vinegar", "sesame_oil",
    "cooking_wine", "oyster_sauce", "chili_oil",
  ]);
  return (session.pot || []).filter((p) => !LIQUID.has(p.ingredient_id));
}

// Color-shift ingredients: per-portion doneness + burn
function updateAppearanceFromPot(solidPot) {
  const potIds = solidPot.map((p, idx) => {
    const f = p._prepFlags || {};
    const fk = (f.withSkin === false ? "p" : "P") + (f.withBone === false ? "d" : "D") + (f.marinated ? "m" : "");
    return idx + "_" + p.ingredient_id + "_" + (p.cut || "chop") + "_" + (p.particle_mm || 8) + "_" + (p._prepState || "whole") + "_" + fk;
  });
  for (var i = 0; i < physBodies.length; i++) {
    var body = physBodies[i];
    var idx = potIds.indexOf(body.potRef);
    var d = idx >= 0 ? (solidPot[idx].doneness || 0) : 0;
    var b = idx >= 0 ? (solidPot[idx].burn || 0) : 0;
    applyAppearanceToBody(body, d, b);
  }
}

function applyAppearanceToBody(body, doneness, burn) {
  if (body.prepState === "melted" || body.prepState === "cracked") return;
  if (!body.origColors) return;
  doneness = Math.max(0, Math.min(1, doneness || 0));
  burn = Math.max(0, Math.min(1, burn || 0));
  for (var j = 0; j < body.origColors.length; j++) {
    var oc = body.origColors[j];
    var dr = Math.min(255, Math.round(oc.r + doneness * 80));
    var dg = Math.round(oc.g * (1 - doneness * 0.45));
    var db = Math.round(oc.b * (1 - doneness * 0.65));
    var bb = Math.pow(burn, 1.5);
    var br = Math.round(dr * (1 - bb) + 3 * bb);
    var bg = Math.round(dg * (1 - bb) + 3 * bb);
    var bb2 = Math.round(db * (1 - bb) + 3 * bb);
    oc.mat.color.set("rgb(" + br + "," + bg + "," + bb2 + ")");
    oc.mat.roughness = burn > 0.2 ? Math.min(0.95, 0.2 + burn * 0.75) : 0.35;
  }
}

function countExplicitLiquid(session, id) {
  let total = 0;
  for (const p of session.pot || []) {
    if (p.ingredient_id === id) total += (p.amount_g || 0);
  }
  return total;
}

function buildLayerStack(totalLiquid, metrics) {
  const entries = Object.entries(liquidState)
    .filter(([, v]) => v > 0.5)
    .sort((a, b) => {
      const da = LIQUID_CONFIG[a[0]]?.density || 1;
      const db = LIQUID_CONFIG[b[0]]?.density || 1;
      return db - da;
    });

  if (entries.length === 0) return [];

  const potDepth = (eqConfig.topY ?? 0.55) - (eqConfig.bottomY ?? -0.12);
  const maxFill = potDepth * 0.82;
  const fillHeight = Math.min(maxFill, (totalLiquid / 260) * maxFill);

  const layers = [];
  let cumY = liquidBaseY(metrics);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  let idx = 0;

  for (const [key, amount] of entries) {
    const frac = amount / Math.max(1, total);
    const height = Math.max(0.018, frac * fillHeight);
    const density = LIQUID_CONFIG[key]?.density || 1;
    let rTop = LIQUID_REF_RADIUS;
    let rBot = LIQUID_REF_RADIUS;
    if (metrics) {
      const band = liquidRadiiForBand(metrics, cumY, cumY + height);
      rTop = band.rTop;
      rBot = band.rBot;
    }
    layers.push({ key, height, baseY: cumY, amount, density, index: idx, rTop, rBot });
    cumY += height;
    idx += 1;
  }

  return layers;
}

function syncPhysBodies(pot, ingredients, liquidLevel) {
  const LIQUID_IDS = new Set([
    "water", "oil", "soy_sauce", "dark_soy_sauce", "vinegar", "sesame_oil",
    "cooking_wine", "oyster_sauce", "chili_oil",
  ]);
  const solidPot = pot.filter(function(p) { return !LIQUID_IDS.has(p.ingredient_id); });

  // Build potIds with index prefix for uniqueness
  const potIds = solidPot.map((p, idx) => {
    const f = p._prepFlags || {};
    const fk = (f.withSkin === false ? "p" : "P") + (f.withBone === false ? "d" : "D") + (f.marinated ? "m" : "");
    return idx + "_" + p.ingredient_id + "_" + (p.cut || "chop") + "_" + (p.particle_mm || 8) + "_" + (p._prepState || "whole") + "_" + fk;
  });
  const currentIds = new Set(potIds);
  let removed = [];

  // Correct filter: track matching bodies without index confusion
  var keepers = [];
  for (var i = 0; i < physBodies.length; i++) {
    var body = physBodies[i];
    if (!currentIds.has(body.potRef)) {
      removed.push(body);
      continue;
    }
    var potIdx = potIds.indexOf(body.potRef);
    if (potIdx >= 0) {
      body.potRef = potIds[potIdx];
      keepers.push(body);
    } else {
      removed.push(body);
    }
  }
  physBodies = keepers;

  // Dispose removed bodies
  for (const body of removed) {
    ingredientGroup.remove(body.group);
    body.group.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
  }

  // Count existing bodies per pot item
  var bodyCount = new Array(solidPot.length).fill(0);
  for (var i = 0; i < physBodies.length; i++) {
    var idx = potIds.indexOf(physBodies[i].potRef);
    if (idx >= 0) bodyCount[idx]++;
  }

  // Create new bodies: scale count with grams (1 per ~30g, min 1)
  for (var i = 0; i < solidPot.length; i++) {
    var p = solidPot[i];
    var needed = Math.max(1, Math.ceil((p.amount_g || 30) / 30));
    var missing = needed - (bodyCount[i] || 0);
    if (missing <= 0) continue;

    var ref = potIds[i];
    var prepState = (p.ingredient_id === "butter" && meltedRefs.has(p.ingredient_id + "_" + (p.cut || "chop") + "_" + (p.particle_mm || 8) + "_" + (p._prepState || "whole"))) ? "melted" : (p._prepState || "whole");

    for (var j = 0; j < missing; j++) {
      if (physBodies.length >= MAX_PHYS_BODIES) break;
      var mesh = createIngredientMesh(p.ingredient_id, p.cut || "chop", p.particle_mm || 8, prepState, p._prepFlags || null);
      var angle = Math.random() * Math.PI * 2;
      var radius = 0.6 + Math.random() * 1.8;
      mesh.position.set(Math.cos(angle) * radius, 1.6 + Math.random() * 0.6, Math.sin(angle) * radius);
      ingredientGroup.add(mesh);
      var origColors = [];
      mesh.traverse(function(c) {
        if (c.material && c.material.color && c.material.color.getHex) {
          var hex = c.material.color.getHex();
          origColors.push({mat: c.material, r: (hex>>16)&0xff, g: (hex>>8)&0xff, b: hex&0xff});
        }
      });
      physBodies.push({
        group: mesh, potRef: ref, ingredientId: p.ingredient_id, prepState,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4),
        angVelocity: new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2),
        settled: false, meltProgress: 0, origColors: origColors,
      });
    }
  }

  // Clean up excess bodies
  var totalNeeded = 0;
  for (var i = 0; i < solidPot.length; i++) {
    totalNeeded += Math.max(1, Math.ceil((solidPot[i].amount_g || 30) / 30));
  }
  while (physBodies.length > totalNeeded) {
    const body = physBodies.pop();
    ingredientGroup.remove(body.group);
  }
}

/** 与厨房页「开始加热」同步，驱动灶台火焰强度 */
export function setPotHeatingActive(active) {
  potHeatingActive = !!active;
}

export function setPotAction(actionType, intensity) {
  const metrics = themeObjects.potMetrics;
  const hasLiq = potHasLiquid(metrics);
  if (actionType === "mix") {
    physicsParams.mixForce = (intensity || 0.6) * (hasLiq ? 2.2 : 4.0);
  }
  if (actionType === "toss") {
    const tossMul = hasLiq ? 0.32 : 1;
    for (var i = 0; i < physBodies.length; i++) {
      var vel = physBodies[i].velocity;
      var av = physBodies[i].angVelocity;
      vel.y += (8 + Math.random() * 6) * tossMul;
      vel.x += (Math.random() - 0.5) * 10 * tossMul;
      vel.z += (Math.random() - 0.5) * 10 * tossMul;
      av.set(Math.random() * 8 * tossMul, Math.random() * 12 * tossMul, Math.random() * 6 * tossMul);
    }
    physicsParams.mixForce = hasLiq ? 1.4 : 3.0;
  }
}

export function disposePot3D() {
  window.removeEventListener("resize", onPotWindowResize);
  disposeCookingVfx();
  potHeatingActive = false;
  if (renderer) {
    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    renderer.dispose();
    renderer = null;
  }
  clearEquipmentDecor();
  scene = null;
  wokMesh = null;
  ingredientGroup = null;
  liquidGroup = null;
  cachedPotSession = null;
  physBodies = [];
  meltedRefs.clear();
  steamParticles = [];
  bubbleParticles = [];
  oilDrops = [];
  liquidLayers = {};
  themeObjects = {};
}

function physicsStep(dt) {
  const cappedDt = Math.min(dt, 0.05);
  const temp = physicsParams.tempC || 25;
  const mixF = physicsParams.mixForce;
  const metrics = themeObjects.potMetrics;
  const hasLiq = potHasLiquid(metrics);
  const surfaceY = hasLiq ? getLiquidSurfaceY(metrics) : Infinity;
  const rimY = metrics?.rimY ?? POT_TOP_Y;
  const bodyMargin = 0.34;

  for (const body of physBodies) {
    body.settled = false;
    const pos = body.group.position;
    const vel = body.velocity;
    const av = body.angVelocity;

    vel.y -= GRAVITY * cappedDt;

    if (body.ingredientId === "butter" && body.prepState !== "melted" && temp > 35) {
      body.meltProgress = Math.min(1, (body.meltProgress || 0) + cappedDt * (temp - 30) / 60);
      const s = 1 - body.meltProgress * 0.85;
      body.group.scale.setScalar(Math.max(0.15, s));
      body.group.children.forEach((c) => { if (c.material?.transparent !== undefined) { c.material.transparent = true; c.material.opacity = Math.max(0.1, 1 - body.meltProgress); } });
      if (body.meltProgress >= 1) { ingredientGroup.remove(body.group); body.group.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); physBodies = physBodies.filter((b) => b !== body); meltedRefs.add(body.potRef); continue; }
    }

    if (temp > 55) {
      const jitter = Math.min(1, (temp - 55) / 100) * 0.8;
      vel.x += (Math.random() - 0.5) * jitter * cappedDt * 2;
      vel.z += (Math.random() - 0.5) * jitter * cappedDt * 2;
      if (temp > 90) vel.y += (Math.random() - 0.3) * jitter * cappedDt * 3;
    }

    if (mixF > 0.01) {
      const dist = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
      if (dist > 0.05) {
        const tx = -pos.z / dist; const tz = pos.x / dist;
        const swirl = hasLiq ? 1.6 : 3;
        vel.x += tx * mixF * cappedDt * swirl; vel.z += tz * mixF * cappedDt * swirl;
        const upKick = hasLiq ? 0.2 : 1;
        vel.y += ((Math.random() - 0.3) * mixF * cappedDt * 3 + mixF * cappedDt * 2) * upKick;
        av.y += (Math.random() - 0.5) * mixF * cappedDt * (hasLiq ? 8 : 15);
        av.x += (Math.random() - 0.5) * mixF * cappedDt * (hasLiq ? 5 : 8);
      }
    }

    pos.x += vel.x * cappedDt; pos.y += vel.y * cappedDt; pos.z += vel.z * cappedDt;

    const halfH = 0.12;
    const floorY = metrics ? liquidBaseY(metrics) + halfH * 0.5 : POT_BOTTOM_Y + halfH;
    if (pos.y - halfH < floorY - halfH) {
      pos.y = floorY;
      if (vel.y < 0) { vel.y = Math.abs(vel.y) * BOUNCE; vel.x *= FRICTION; vel.z *= FRICTION; }
      if (Math.abs(vel.y) < 0.4) { vel.y = 0; pos.y = floorY; body.settled = true; }
    }

    const dist = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
    const maxR = interiorRadiusAt(metrics, pos.y, bodyMargin);
    if (dist > maxR) {
      const nx = pos.x / dist; const nz = pos.z / dist;
      const dot = vel.x * nx + vel.z * nz;
      if (dot > 0) { vel.x -= (1 + WALL_BOUNCE) * dot * nx; vel.z -= (1 + WALL_BOUNCE) * dot * nz; }
      pos.x = nx * maxR; pos.z = nz * maxR;
      vel.x *= WALL_FRICTION; vel.z *= WALL_FRICTION;
      if (dot > 0.15) playCutSound("board");
    }

    if (hasLiq) {
      const splashH = 0.1 + Math.min(0.22, mixF * 0.06);
      const maxBodyY = surfaceY + splashH;
      if (pos.y > maxBodyY) {
        pos.y = maxBodyY;
        if (vel.y > 0) vel.y *= -0.2;
      }
      if (pos.y > rimY - 0.12) {
        pos.y = rimY - 0.12;
        vel.y = Math.min(vel.y, 0) * 0.25;
      }
    } else if (pos.y > POT_TOP_Y + 0.6) {
      pos.y = POT_TOP_Y + 0.6;
      vel.y *= -0.1;
    }

    for (const other of physBodies) {
      if (other === body) continue;
      const dx = pos.x - other.group.position.x;
      const dy = pos.y - other.group.position.y;
      const dz = pos.z - other.group.position.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const minDist = 0.55;
      if (d < minDist && d > 0.001) {
        const force = (minDist - d) / minDist * 3.0;
        vel.x += dx / d * force * cappedDt;
        vel.y += dy / d * force * cappedDt * 0.5;
        vel.z += dz / d * force * cappedDt;
        av.x += (Math.random() - 0.5) * force * cappedDt * 2;
        av.y += (Math.random() - 0.5) * force * cappedDt * 2;
      }
      }

    vel.x *= DAMPING; vel.y *= DAMPING; vel.z *= DAMPING;
    av.x *= DAMPING; av.y *= DAMPING; av.z *= DAMPING;
    if (body.settled && vel.lengthSq() < 0.001) { vel.set(0, 0, 0); av.set(0, 0, 0); }
    body.group.rotation.x += av.x * cappedDt;
    body.group.rotation.y += av.y * cappedDt;
    body.group.rotation.z += av.z * cappedDt;
  }

  physicsParams.mixForce *= 0.97;
}

function updateLiquidLayers(temp) {
  const dt = 0.016;
  const metrics = themeObjects.potMetrics;
  for (const [, layer] of Object.entries(liquidLayers)) {
    // Smooth lerp toward target
    layer.currentScale += (layer.targetScale - layer.currentScale) * 4 * dt;
    layer.currentY += (layer.targetY - layer.currentY) * 4 * dt;

    layer.mesh.scale.y = layer.currentScale;
    layer.mesh.position.y = layer.currentY;

    if (metrics && layer.currentScale > 0.02) {
      const bandH = LIQUID_BAND_H * layer.currentScale;
      const yBot = layer.currentY;
      const yTop = yBot + bandH;
      const band = liquidRadiiForBand(metrics, yBot, yTop);
      const aimTop = layer.targetRTop ?? band.rTop;
      const aimBot = layer.targetRBot ?? band.rBot;
      layer.currentRTop += (THREE.MathUtils.lerp(aimTop, band.rTop, 0.5) - layer.currentRTop) * 5 * dt;
      layer.currentRBot += (THREE.MathUtils.lerp(aimBot, band.rBot, 0.5) - layer.currentRBot) * 5 * dt;
      updateLayerLiquidGeometry(layer, layer.currentRTop, layer.currentRBot);
      if (layer.stackIndex >= 0 && layer.density) {
        const buoy = (1.02 - layer.density) * 0.012 * (layer.stackIndex + 1);
        layer.mesh.position.y = layer.currentY + buoy;
      }
    }

    // Boil jitter
    if (temp > 95 && layer.currentScale > 0.05) {
      layer.mesh.position.y += Math.sin(animTime * 12 + (layer.targetY * 10)) * 0.015;
      layer.mesh.scale.y += Math.sin(animTime * 15) * 0.02;
    }

    applyLiquidSlosh(layer, metrics, physicsParams.mixForce, dt);
  }
}

function updateParticles(temp, liquidLevel) {
  const dt = 0.016;

  // Steam
  const steamActive = temp > 65;
  const steamBaseY = liquidLevel;
  for (let i = 0; i < steamParticles.length; i++) {
    const p = steamParticles[i], d = steamData[i];
    if (!steamActive) { p.visible = false; d.life = 0; continue; }
    if (d.life <= 0) {
      d.life = d.maxLife;
      const r = 1.0 + Math.random() * 2.2;
      p.position.set(Math.cos(Math.random() * Math.PI * 2) * r, steamBaseY + Math.random() * 0.3, Math.sin(Math.random() * Math.PI * 2) * r);
      p.material.opacity = 0.22 + Math.random() * 0.45;
      p.scale.setScalar(0.4 + Math.random() * 1.8);
      p.visible = true;
    }
    d.life -= dt; p.position.y += d.speed * dt;
    p.position.x += d.driftX * dt; p.position.z += d.driftZ * dt;
    const frac = d.life / d.maxLife;
    p.material.opacity = Math.max(0, frac * 0.55);
    p.scale.setScalar(0.4 + frac * 2.5);
    if (p.position.y > 3.5 || d.life <= 0) { d.life = 0; p.visible = false; }
  }

  // Bubbles
  const boilActive = temp > 95;
  for (let i = 0; i < bubbleParticles.length; i++) {
    const p = bubbleParticles[i], d = bubbleData[i];
    if (!boilActive) { p.visible = false; d.life = 0; continue; }
    if (d.life <= 0) {
      d.life = d.maxLife;
      p.position.set(d.baseX + (Math.random() - 0.5) * 1.0, steamBaseY, d.baseZ + (Math.random() - 0.5) * 1.0);
      p.material.opacity = 0.3 + Math.random() * 0.4;
      p.scale.setScalar(0.6 + Math.random() * 1.2);
      p.visible = true;
    }
    d.life -= dt; p.position.y += d.speed * dt;
    p.position.x += (Math.random() - 0.5) * 0.03;
    p.position.z += (Math.random() - 0.5) * 0.03;
    const frac = d.life / d.maxLife;
    p.material.opacity = frac * 0.5;
    if (p.position.y > steamBaseY + 1.2 || d.life <= 0) { d.life = 0; p.visible = false; }
  }

  // Oil sizzle
  const sizzleActive = temp > 130;
  for (let i = 0; i < oilDrops.length; i++) {
    const p = oilDrops[i], d = oilData[i];
    if (!sizzleActive) { p.visible = false; d.life = 0; continue; }
    if (d.life <= 0) {
      d.life = d.maxLife;
      p.position.set((Math.random() - 0.5) * 4, steamBaseY + 0.05, (Math.random() - 0.5) * 4);
      p.material.opacity = 0.6 + Math.random() * 0.4;
      p.visible = true;
    }
    d.life -= dt; p.position.x += d.vx * dt; p.position.y += d.vy * dt; p.position.z += d.vz * dt;
    d.vy -= 2 * dt;
    const frac = d.life / d.maxLife;
    p.material.opacity = frac * 0.7;
    if (p.position.y < steamBaseY - 0.2 || d.life <= 0) { d.life = 0; p.visible = false; }
  }
}

function animate() {
  if (!renderer || !scene || !camera) return;
  requestAnimationFrame(animate);
  const dt = 0.016;
  animTime += dt;

  physicsStep(dt);

  // Suppress all particles at low temperature
  if (physicsParams.tempC < 50) {
    for (let i = 0; i < steamParticles.length; i++) { steamParticles[i].visible = false; steamData[i].life = 0; }
    for (let i = 0; i < bubbleParticles.length; i++) { bubbleParticles[i].visible = false; bubbleData[i].life = 0; }
    for (let i = 0; i < oilDrops.length; i++) { oilDrops[i].visible = false; oilData[i].life = 0; }
  }

  let maxY = liquidBaseY(themeObjects.potMetrics);
  for (const [, layer] of Object.entries(liquidLayers)) {
    if (layer.stackIndex < 0 || layer.currentScale < 0.02) continue;
    const top = layer.currentY + LIQUID_BAND_H * layer.currentScale;
    if (top > maxY) maxY = top;
  }
  updateLiquidLayers(physicsParams.tempC);
  if (physicsParams.tempC >= 50) {
    updateParticles(physicsParams.tempC, maxY);
  }

  const pm = themeObjects.potMetrics;
  updateCookingVfx({
    tempC: physicsParams.tempC,
    heatingActive: potHeatingActive,
    burnRisk: physicsParams.burnRisk,
    mixForce: physicsParams.mixForce,
    animTime,
    dt,
    liquidLevel: maxY,
    rimY: pm?.rimY ?? POT_TOP_Y,
    potBottomR: pm?.bottomR ?? POT_RADIUS,
    potBottomY: eqConfig?.bottomY ?? -0.12,
  });

  const t = performance.now() / 6000;
  camera.position.x = Math.sin(t) * 6.5;
  camera.position.z = Math.cos(t) * 6.5;
  camera.lookAt(0, 0.4, 0);
  renderer.render(scene, camera);
}
