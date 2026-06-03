/**
 * 灶台特效：3D 仅锅底光晕+灯光（不穿锅）；炉焰由 CSS .stoveFlameLayer 绘制
 */
import * as THREE from "https://unpkg.com/three@0.162.0/build/three.module.js";

let stoveVfxGroup = null;
let sparks = [];
let sparkMeta = [];
let smokePuffs = [];
let smokeMeta = [];
let flameLight = null;
let glowRing = null;
let glowRing2 = null;
let sceneRef = null;
let clipPlane = null;

const SPARK_COUNT = 32;
const SMOKE_COUNT = 20;

/** 灶台平面（低于所有锅底），火焰视觉不进入锅体高度 */
const STOVE_PLANE_Y = -0.5;

const layout = {
  potBottomY: -0.12,
  potBottomR: 1.85,
  rimY: 0.55,
};

function makeStoveMat() {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff6600,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    clippingPlanes: clipPlane ? [clipPlane] : [],
  });
  return mat;
}

function rebuildGlowRings() {
  if (!stoveVfxGroup) return;
  const r = layout.potBottomR + 0.42;

  if (glowRing) {
    stoveVfxGroup.remove(glowRing);
    glowRing.geometry?.dispose();
    glowRing.material?.dispose();
  }
  glowRing = new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 8, 52), makeStoveMat());
  glowRing.rotation.x = Math.PI / 2;
  glowRing.position.y = 0.02;
  glowRing.renderOrder = 1;
  stoveVfxGroup.add(glowRing);

  if (glowRing2) {
    stoveVfxGroup.remove(glowRing2);
    glowRing2.geometry?.dispose();
    glowRing2.material?.dispose();
  }
  glowRing2 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.55, 0.11, 6, 40), makeStoveMat());
  glowRing2.rotation.x = Math.PI / 2;
  glowRing2.position.y = 0.05;
  glowRing2.renderOrder = 1;
  stoveVfxGroup.add(glowRing2);
}

/** 裁剪：任何高于锅底线的 3D 灶光一律不绘制，防止穿锅 */
function updateClipPlane() {
  const ceiling = layout.potBottomY - 0.06;
  if (!clipPlane) clipPlane = new THREE.Plane();
  clipPlane.set(new THREE.Vector3(0, -1, 0), ceiling);
}

/** 随厨具更新锅底高度与光晕大小 */
export function syncCookingVfxLayout(eq, metrics) {
  layout.potBottomY = eq?.bottomY ?? -0.12;
  layout.potBottomR = metrics?.bottomR ?? (eq?.radius ?? 2.5) * 0.88;
  layout.rimY = metrics?.rimY ?? eq?.topY ?? 0.55;
  updateClipPlane();
  rebuildGlowRings();
  applyClipToStoveMaterials();
}

function applyClipToStoveMaterials() {
  const planes = clipPlane ? [clipPlane] : [];
  for (const m of [glowRing?.material, glowRing2?.material]) {
    if (m) m.clippingPlanes = planes;
  }
}

export function initCookingVfx(scene) {
  disposeCookingVfx();
  sceneRef = scene;
  updateClipPlane();

  stoveVfxGroup = new THREE.Group();
  stoveVfxGroup.name = "stoveVfx";
  stoveVfxGroup.position.y = STOVE_PLANE_Y;
  scene.add(stoveVfxGroup);

  flameLight = new THREE.PointLight(0xff7722, 0, 14);
  flameLight.position.set(0, STOVE_PLANE_Y + 0.08, 0);
  scene.add(flameLight);

  rebuildGlowRings();

  const sparkGeo = new THREE.SphereGeometry(0.05, 5, 5);
  for (let i = 0; i < SPARK_COUNT; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffee55,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
    const p = new THREE.Mesh(sparkGeo, mat);
    p.visible = false;
    p.renderOrder = 12;
    scene.add(p);
    sparks.push(p);
    sparkMeta.push({ life: 0, maxLife: 0.3 + Math.random() * 0.4, vx: 0, vy: 0, vz: 0 });
  }

  const smokeGeo = new THREE.SphereGeometry(0.14, 6, 6);
  for (let i = 0; i < SMOKE_COUNT; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x2a2a2a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true,
    });
    const p = new THREE.Mesh(smokeGeo, mat);
    p.visible = false;
    p.renderOrder = 11;
    scene.add(p);
    smokePuffs.push(p);
    smokeMeta.push({
      life: 0,
      maxLife: 1.6 + Math.random() * 2,
      speed: 0.35 + Math.random() * 0.55,
      driftX: (Math.random() - 0.5) * 0.25,
      driftZ: (Math.random() - 0.5) * 0.25,
    });
  }

  stoveVfxGroup.visible = false;
}

export function updateCookingVfx(opts) {
  if (!stoveVfxGroup) return;

  const tempC = opts.tempC ?? 25;
  const heating = !!opts.heatingActive;
  const burnRisk = opts.burnRisk ?? 0;
  const mixF = opts.mixForce ?? 0;
  const t = opts.animTime ?? 0;
  const dt = opts.dt ?? 0.016;
  const liquidY = opts.liquidLevel ?? layout.potBottomY;
  const rimY = opts.rimY ?? layout.rimY;
  const potBottomR = opts.potBottomR ?? layout.potBottomR;

  if (opts.potBottomY != null) {
    layout.potBottomY = opts.potBottomY;
    updateClipPlane();
    applyClipToStoveMaterials();
  }

  const heatOn = heating || tempC > 70;
  let intensity = 0;
  if (heatOn) {
    const tempPart = THREE.MathUtils.clamp((tempC - 50) / 170, 0, 1);
    intensity = tempPart * (heating ? 1.1 : 0.6) + (heating ? 0.4 : 0);
    intensity = THREE.MathUtils.clamp(intensity, 0, 1);
    if (heating) intensity = Math.max(intensity, 0.7);
  }

  stoveVfxGroup.visible = intensity > 0.03;
  stoveVfxGroup.rotation.y = t * 0.25;

  if (flameLight) {
    flameLight.intensity = intensity * 5;
    flameLight.color.setHSL(0.06 + Math.sin(t * 7) * 0.02, 1, 0.52);
  }

  const ringOp = intensity * 0.95;
  if (glowRing) {
    glowRing.material.opacity = ringOp;
    glowRing.scale.setScalar(1 + Math.sin(t * 6) * 0.05 * intensity);
  }
  if (glowRing2) {
    glowRing2.material.opacity = ringOp * 0.7;
    glowRing2.scale.setScalar(1 + Math.sin(t * 9) * 0.07 * intensity);
  }

  const sparkCeil = Math.min(rimY - 0.08, liquidY + 0.5);
  const sizzle = tempC > 110 && intensity > 0.12;

  for (let i = 0; i < sparks.length; i++) {
    const p = sparks[i];
    const d = sparkMeta[i];
    if (!sizzle) {
      p.visible = false;
      d.life = 0;
      continue;
    }
    if (d.life <= 0 && Math.random() < (intensity * 0.8 + mixF * 0.1) * dt * 20) {
      d.life = d.maxLife;
      const ang = Math.random() * Math.PI * 2;
      const r = 0.3 + Math.random() * potBottomR * 0.5;
      p.position.set(Math.cos(ang) * r, liquidY + 0.05, Math.sin(ang) * r);
      d.vx = (Math.random() - 0.5) * 1.6;
      d.vy = 0.7 + Math.random() * 1.4;
      d.vz = (Math.random() - 0.5) * 1.6;
      p.material.opacity = 1;
      p.scale.setScalar(1.1);
      p.visible = true;
    }
    if (d.life <= 0) continue;
    d.life -= dt;
    p.position.x += d.vx * dt;
    p.position.y += d.vy * dt;
    p.position.z += d.vz * dt;
    d.vy -= 3 * dt;
    if (p.position.y > sparkCeil) {
      p.position.y = sparkCeil;
      d.vy *= -0.1;
    }
    const frac = d.life / d.maxLife;
    p.material.opacity = frac;
    if (d.life <= 0) p.visible = false;
  }

  const smokeFloor = liquidY + 0.15;
  const smokeCeil = rimY + 0.3;
  const smokeOn = burnRisk > 0.3 || (tempC > 185 && intensity > 0.4);

  for (let i = 0; i < smokePuffs.length; i++) {
    const p = smokePuffs[i];
    const d = smokeMeta[i];
    if (!smokeOn) {
      p.visible = false;
      d.life = 0;
      continue;
    }
    if (d.life <= 0 && Math.random() < (burnRisk * 0.6 + 0.1) * dt * 12) {
      d.life = d.maxLife;
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * potBottomR * 0.55;
      p.position.set(Math.cos(ang) * r, smokeFloor, Math.sin(ang) * r);
      p.material.opacity = 0.35 + burnRisk * 0.3;
      p.scale.setScalar(0.8);
      p.visible = true;
    }
    if (d.life <= 0) continue;
    d.life -= dt;
    p.position.y += d.speed * dt;
    p.position.x += d.driftX * dt;
    p.position.z += d.driftZ * dt;
    const frac = d.life / d.maxLife;
    p.material.opacity = frac * (0.4 + burnRisk * 0.4);
    p.scale.setScalar(0.7 + (1 - frac) * 2.5);
    if (d.life <= 0 || p.position.y > smokeCeil) {
      d.life = 0;
      p.visible = false;
    }
  }
}

export function disposeCookingVfx() {
  const disposeMesh = (m) => {
    if (!m) return;
    m.geometry?.dispose();
    m.material?.dispose();
  };

  if (stoveVfxGroup && sceneRef) sceneRef.remove(stoveVfxGroup);
  stoveVfxGroup?.traverse((c) => {
    if (c.isMesh) disposeMesh(c);
  });
  stoveVfxGroup = null;
  glowRing = null;
  glowRing2 = null;

  if (flameLight && sceneRef) sceneRef.remove(flameLight);
  flameLight = null;

  for (const p of sparks) {
    if (sceneRef) sceneRef.remove(p);
    disposeMesh(p);
  }
  sparks = [];
  sparkMeta = [];

  for (const p of smokePuffs) {
    if (sceneRef) sceneRef.remove(p);
    disposeMesh(p);
  }
  smokePuffs = [];
  smokeMeta = [];

  sceneRef = null;
}
