/**
 * 狐闹厨房 · Cooking-Fox — 商业游戏级卡通肉类
 * 70% 强轮廓 + 30% 大而清晰的特征（无噪声形变）
 */
import * as THREE from "https://unpkg.com/three@0.162.0/build/three.module.js";
import { RoundedBoxGeometry } from "https://unpkg.com/three@0.162.0/examples/jsm/geometries/RoundedBoxGeometry.js";

export const MEAT_IDS = new Set([
  "pork", "beef", "chicken", "shrimp",
  "fish", "lamb", "duck", "squid", "clam",
]);

export const MEAT_PALETTE = {
  pork: { main: 0xff92aa, fat: 0xfffdf8, edge: 0xff6888, crust: 0xf08870 },
  beef: { main: 0xc07050, fat: 0xfff6ee, edge: 0x904838, sear: 0x6a3828 },
  chicken: { main: 0xffc878, skin: 0xffa848, bone: 0xfff5e8, edge: 0xe08838 },
  shrimp: { main: 0xff8040, edge: 0xe05028, tail: 0xff9858 },
  fish: { flesh: 0xfff0e8, skin: 0x5a9ec8, edge: 0x3d7aaa, belly: 0xffe8d8 },
  lamb: { main: 0xd87868, fat: 0xfff8f0, bone: 0xfff5e8, edge: 0xb05048 },
  duck: { meat: 0xc48858, skin: 0x8b4518, fat: 0xffd090, edge: 0x6b3410 },
  squid: { body: 0xfff5f0, edge: 0xf0c8b8, tentacle: 0xfff0ea },
  clam: { shell: 0xe8d8c0, inner: 0xfff8f0, edge: 0xc4a882 },
};

const SEG = 10;

export function markBone(...meshes) {
  // prepPart: bone | skin — 备菜台去骨/削皮时移除
  meshes.forEach((m) => { if (m) m.userData.prepPart = "bone"; });
}
function markSkin(...meshes) {
  meshes.forEach((m) => { if (m) m.userData.prepPart = "skin"; });
}

export function toyMat(color, opts = {}) {
  const c = new THREE.Color(color);
  const em = opts.warmTint
    ? c.clone().lerp(new THREE.Color(0xffd090), 0.2)
    : c.clone().multiplyScalar(0.06);
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.sear ? 0.95 : 0.86,
    metalness: 0,
    clearcoat: opts.sear ? 0 : 0.07,
    clearcoatRoughness: 0.85,
    emissive: em,
    emissiveIntensity: opts.warmTint ? 0.52 : 0.38,
  });
}

// ── 猪：五花五层 + 焦皮顶 + 侧边皮 ─────────────────────────

const PORK_LAYERS = [
  { dy: -0.11, h: 0.072, fat: true },
  { dy: -0.038, h: 0.088, fat: false },
  { dy: 0.048, h: 0.062, fat: true },
  { dy: 0.108, h: 0.072, fat: false },
  { dy: 0.175, h: 0.048, fat: true },
];

function addPorkBellyLayers(g, p, width, depth, withDetails) {
  for (const L of PORK_LAYERS) {
    const m = new THREE.Mesh(
      new RoundedBoxGeometry(width, L.h, depth, 4, 0.038),
      toyMat(L.fat ? p.fat : p.main)
    );
    m.position.y = L.dy;
    g.add(m);
  }
  if (!withDetails) return;
  const crust = new THREE.Mesh(
    new RoundedBoxGeometry(width * 0.96, 0.028, depth * 0.94, 2, 0.02),
    toyMat(p.crust, { warmTint: true })
  );
  crust.position.set(0, 0.2, 0);
  g.add(crust);
  const rind = new THREE.Mesh(
    new RoundedBoxGeometry(0.06, 0.2, depth * 0.98, 2, 0.02),
    toyMat(p.crust)
  );
  rind.position.set(width * 0.48, 0.02, 0);
  g.add(rind);
}

export function createCartoonPork() {
  const g = new THREE.Group();
  g.userData.meatKind = "pork";
  addPorkBellyLayers(g, MEAT_PALETTE.pork, 0.56, 0.36, true);
  g.rotation.set(0.04, 0.24, 0.02);
  return g;
}

// ── 牛：🥩 牛排 + 双边脂肪 + 油花 + 焦痕 ───────────────────

let _steakGeo = null;
function steakGeo() {
  if (!_steakGeo) _steakGeo = new RoundedBoxGeometry(0.52, 0.16, 0.4, 5, 0.06);
  return _steakGeo;
}

function addSteakDetails(g, p) {
  const fatRimBack = new THREE.Mesh(
    new RoundedBoxGeometry(0.48, 0.058, 0.11, 2, 0.025),
    toyMat(p.fat)
  );
  fatRimBack.position.set(0, 0.055, -0.17);
  g.add(fatRimBack);

  const fatRimSide = new THREE.Mesh(
    new RoundedBoxGeometry(0.09, 0.05, 0.36, 2, 0.02),
    toyMat(p.fat)
  );
  fatRimSide.position.set(0.24, 0.05, 0);
  g.add(fatRimSide);

  const marbles = [
    { pos: [0.1, 0.05, 0.1], scale: [0.13, 0.038, 0.11] },
    { pos: [-0.08, 0.045, -0.05], scale: [0.1, 0.032, 0.09] },
  ];
  for (const m of marbles) {
    const spot = new THREE.Mesh(
      new RoundedBoxGeometry(1, 1, 1, 2, 0.02),
      toyMat(p.fat)
    );
    spot.position.set(m.pos[0], m.pos[1], m.pos[2]);
    spot.scale.set(m.scale[0], m.scale[1], m.scale[2]);
    g.add(spot);
  }

  const marks = [
    { pos: [-0.06, 0.085, 0.04], rot: 0.15, sx: 0.2 },
    { pos: [0.08, 0.085, -0.02], rot: -0.12, sx: 0.16 },
  ];
  for (const mk of marks) {
    const sear = new THREE.Mesh(
      new RoundedBoxGeometry(mk.sx, 0.018, 0.05, 1, 0.01),
      toyMat(p.sear, { sear: true })
    );
    sear.position.set(mk.pos[0], mk.pos[1], mk.pos[2]);
    sear.rotation.y = mk.rot;
    g.add(sear);
  }
}

export function createCartoonBeef() {
  const g = new THREE.Group();
  g.userData.meatKind = "beef";
  const p = MEAT_PALETTE.beef;
  g.add(new THREE.Mesh(steakGeo(), toyMat(p.main)));
  addSteakDetails(g, p);
  g.rotation.set(0.08, 0.18, 0.02);
  return g;
}

// ── 鸡：🍗 鸡腿 上粗下细 + 皮帽 + 骨节 ─────────────────────

export function createCartoonChicken() {
  const g = new THREE.Group();
  g.userData.meatKind = "chicken";
  const p = MEAT_PALETTE.chicken;

  const thigh = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, SEG, SEG),
    toyMat(p.main, { warmTint: true })
  );
  thigh.scale.set(1.2, 1.08, 1.25);
  thigh.position.set(0, 0.08, 0);
  g.add(thigh);

  const shank = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, SEG, SEG),
    toyMat(p.main, { warmTint: true })
  );
  shank.scale.set(1.05, 1.15, 0.95);
  shank.position.set(0.02, -0.04, 0.04);
  g.add(shank);

  const skinCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, SEG, SEG),
    toyMat(p.skin, { warmTint: true })
  );
  skinCap.scale.set(1.15, 0.5, 1.1);
  skinCap.position.set(0, 0.18, 0.02);
  g.add(skinCap);

  const skinFlap = new THREE.Mesh(
    new RoundedBoxGeometry(0.14, 0.06, 0.18, 2, 0.03),
    toyMat(p.skin, { warmTint: true })
  );
  skinFlap.position.set(0.14, 0.06, 0.1);
  skinFlap.rotation.set(0.2, 0.4, 0.1);
  g.add(skinFlap);

  const bone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.03, 0.32, 7),
    toyMat(p.bone)
  );
  bone.rotation.z = Math.PI / 2.1;
  bone.position.set(0.22, -0.07, 0);
  g.add(bone);

  const knuckle = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 6, 6),
    toyMat(p.bone)
  );
  knuckle.position.set(0.08, -0.02, 0);
  knuckle.scale.set(1.1, 0.9, 1);
  g.add(knuckle);

  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 5, 5),
    toyMat(p.bone)
  );
  tip.position.set(0.38, -0.1, 0);
  g.add(tip);
  markBone(bone, knuckle, tip);
  markSkin(skinCap, skinFlap);

  g.rotation.set(0.1, 0.2, 0.05);
  return g;
}

// ── 虾：🦐 弯管 + 扁尾 + 浅分节（低凸起）────────────────────

let _shrimpCurve = null;
function shrimpCurve() {
  if (!_shrimpCurve) {
    _shrimpCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.28, 0.05, 0),
      new THREE.Vector3(-0.12, 0.11, 0.025),
      new THREE.Vector3(0.1, 0.08, 0.01),
      new THREE.Vector3(0.3, 0.02, 0),
    ]);
  }
  return _shrimpCurve;
}

function addShrimpDetails(g, p, curve, fullSize) {
  const body = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 16, fullSize ? 0.082 : 0.065, SEG, false),
    toyMat(p.main)
  );
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(fullSize ? 0.1 : 0.065, SEG, SEG),
    toyMat(p.edge)
  );
  const hp = curve.getPointAt(0);
  head.position.copy(hp);
  head.scale.set(1.15, 1.05, 1.08);
  g.add(head);

  if (fullSize) {
    const ringMat = toyMat(p.edge);
    for (const t of [0.42, 0.72]) {
      const pt = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.095, 0.014, 5, SEG),
        ringMat
      );
      ring.position.copy(pt);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
      g.add(ring);
    }
  }

  const tailPt = curve.getPointAt(1);
  const tailTan = curve.getTangentAt(1).normalize();
  const fin = new THREE.Mesh(
    new THREE.ConeGeometry(fullSize ? 0.09 : 0.055, fullSize ? 0.12 : 0.08, 4),
    toyMat(p.tail)
  );
  fin.position.copy(tailPt);
  fin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tailTan);
  g.add(fin);
}

export function createCartoonShrimp() {
  const g = new THREE.Group();
  g.userData.meatKind = "shrimp";
  addShrimpDetails(g, MEAT_PALETTE.shrimp, shrimpCurve(), true);
  g.rotation.y = 0.15;
  return g;
}

// ── 鱼：🐟 鱼片 + 鱼皮条 + 鱼尾 ───────────────────────────

export function createCartoonFish() {
  const g = new THREE.Group();
  g.userData.meatKind = "fish";
  const p = MEAT_PALETTE.fish;

  const fillet = new THREE.Mesh(
    new RoundedBoxGeometry(0.52, 0.1, 0.28, 4, 0.05),
    toyMat(p.flesh)
  );
  fillet.position.y = 0.02;
  g.add(fillet);

  const skin = new THREE.Mesh(
    new RoundedBoxGeometry(0.5, 0.028, 0.26, 2, 0.02),
    toyMat(p.skin)
  );
  skin.position.set(0, 0.08, 0);
  g.add(skin);
  markSkin(skin);

  const belly = new THREE.Mesh(
    new RoundedBoxGeometry(0.42, 0.04, 0.2, 2, 0.02),
    toyMat(p.belly)
  );
  belly.position.set(0, -0.03, 0);
  g.add(belly);

  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.16, 4),
    toyMat(p.edge)
  );
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-0.34, 0.02, 0);
  g.add(tail);

  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 6, 6),
    toyMat(0x1a1a1a)
  );
  eye.position.set(0.2, 0.06, 0.1);
  g.add(eye);

  g.rotation.set(0.05, 0.22, 0.04);
  return g;
}

// ── 羊：🍖 羊排 + 外露骨 + 脂肪帽 ─────────────────────────

export function createCartoonLamb() {
  const g = new THREE.Group();
  g.userData.meatKind = "lamb";
  const p = MEAT_PALETTE.lamb;

  const chop = new THREE.Mesh(
    new RoundedBoxGeometry(0.38, 0.22, 0.14, 4, 0.05),
    toyMat(p.main)
  );
  chop.position.set(0, 0.04, 0);
  g.add(chop);

  const fatCap = new THREE.Mesh(
    new RoundedBoxGeometry(0.34, 0.06, 0.12, 2, 0.025),
    toyMat(p.fat)
  );
  fatCap.position.set(0, 0.16, 0);
  g.add(fatCap);

  const bone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.038, 0.36, 7),
    toyMat(p.bone)
  );
  bone.rotation.z = Math.PI / 2.05;
  bone.position.set(0.2, 0.1, 0);
  g.add(bone);

  const boneEnd = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 6, 6),
    toyMat(p.bone)
  );
  boneEnd.position.set(0.38, 0.1, 0);
  boneEnd.scale.set(1.1, 0.85, 1);
  g.add(boneEnd);
  markBone(bone, boneEnd);

  const edge = new THREE.Mesh(
    new RoundedBoxGeometry(0.08, 0.18, 0.12, 2, 0.02),
    toyMat(p.edge)
  );
  edge.position.set(-0.16, 0.02, 0);
  g.add(edge);

  g.rotation.set(0.08, 0.2, 0.06);
  return g;
}

// ── 鸭：🦆 鸭胸 + 深皮 + 翅根凸起 ─────────────────────────

export function createCartoonDuck() {
  const g = new THREE.Group();
  g.userData.meatKind = "duck";
  const p = MEAT_PALETTE.duck;

  const breast = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, SEG, SEG),
    toyMat(p.meat)
  );
  breast.scale.set(1.25, 0.72, 1.1);
  breast.position.y = 0.02;
  g.add(breast);

  const skin = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, SEG, SEG),
    toyMat(p.skin, { warmTint: true })
  );
  skin.scale.set(1.28, 0.42, 1.12);
  skin.position.set(0, 0.1, 0.02);
  g.add(skin);

  const fat = new THREE.Mesh(
    new RoundedBoxGeometry(0.22, 0.05, 0.16, 2, 0.02),
    toyMat(p.fat, { warmTint: true })
  );
  fat.position.set(0.08, 0.06, 0.1);
  fat.rotation.set(0.15, 0.35, 0.1);
  g.add(fat);

  const wing = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 7, 7),
    toyMat(p.edge, { warmTint: true })
  );
  wing.scale.set(1.3, 0.55, 0.9);
  wing.position.set(0.2, 0.04, 0.12);
  g.add(wing);

  const bone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.028, 0.28, 6),
    toyMat(0xfff5e8)
  );
  bone.rotation.z = Math.PI / 2.1;
  bone.position.set(0.18, -0.02, 0);
  g.add(bone);
  markBone(bone);
  markSkin(skin);

  g.rotation.set(0.06, 0.18, 0.04);
  return g;
}

// ── 鱿鱼：🦑 圆筒身 + 三角头 + 触须束 ─────────────────────

export function createCartoonSquid() {
  const g = new THREE.Group();
  g.userData.meatKind = "squid";
  const p = MEAT_PALETTE.squid;

  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.11, 0.34, 12),
    toyMat(p.body)
  );
  tube.position.y = 0.1;
  g.add(tube);

  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.14, 4),
    toyMat(p.edge)
  );
  head.rotation.x = Math.PI;
  head.position.y = 0.3;
  g.add(head);

  const eyeL = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 6, 6),
    toyMat(0x2a1810)
  );
  eyeL.position.set(-0.06, 0.28, 0.1);
  g.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.06;
  g.add(eyeR);

  for (let i = 0; i < 5; i++) {
    const tent = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.012, 0.14, 5),
      toyMat(p.tentacle)
    );
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    tent.position.set(Math.cos(a) * 0.07, -0.02, Math.sin(a) * 0.07);
    tent.rotation.set(0.35, a, 0);
    g.add(tent);
  }

  g.rotation.set(0.04, 0.12, 0);
  return g;
}

// ── 蛤：🐚 双壳 + 蚌肉 ─────────────────────────────────────

export function createCartoonClam() {
  const g = new THREE.Group();
  g.userData.meatKind = "clam";
  const p = MEAT_PALETTE.clam;
  const shellGeo = new THREE.SphereGeometry(0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);

  const bottom = new THREE.Mesh(shellGeo, toyMat(p.shell));
  bottom.rotation.x = Math.PI;
  bottom.position.y = -0.02;
  g.add(bottom);

  const top = new THREE.Mesh(shellGeo, toyMat(p.edge));
  top.position.y = 0.04;
  top.rotation.x = -0.35;
  g.add(top);

  const meat = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 6),
    toyMat(p.inner, { warmTint: true })
  );
  meat.scale.set(1.1, 0.45, 0.85);
  meat.position.y = 0.02;
  g.add(meat);

  g.rotation.set(0.1, 0.25, 0);
  return g;
}

/** 去壳蛤肉（备菜专用） */
export function createShuckedClam() {
  const g = new THREE.Group();
  g.userData.meatKind = "clam";
  g.userData.prepVisual = "shucked";
  const p = MEAT_PALETTE.clam;

  const meat = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 12, 10),
    toyMat(p.inner, { warmTint: true })
  );
  meat.scale.set(1.25, 0.5, 1.05);
  meat.position.y = 0.02;
  g.add(meat);

  const frill = new THREE.Mesh(
    new THREE.TorusGeometry(0.1, 0.018, 6, 12),
    toyMat(p.edge)
  );
  frill.rotation.x = Math.PI / 2;
  frill.position.y = -0.02;
  g.add(frill);

  g.rotation.set(0.06, 0.2, 0);
  return g;
}

// ── 切法（保留主要特征）────────────────────────────────────

export function createPorkDiceChunk(scale) {
  const g = new THREE.Group();
  const s = 0.38 + scale * 0.52;
  addPorkBellyLayers(g, MEAT_PALETTE.pork, 0.56, 0.36, false);
  const crust = new THREE.Mesh(
    new RoundedBoxGeometry(0.5, 0.022, 0.32, 2, 0.02),
    toyMat(MEAT_PALETTE.pork.crust, { warmTint: true })
  );
  crust.position.y = 0.18 * s;
  g.add(crust);
  g.scale.setScalar(s);
  return g;
}

export function createBeefDiceChunk(scale) {
  const g = new THREE.Group();
  const s = 0.38 + scale * 0.55;
  const p = MEAT_PALETTE.beef;
  g.add(new THREE.Mesh(steakGeo(), toyMat(p.main)));
  const fat = new THREE.Mesh(
    new RoundedBoxGeometry(0.48, 0.055, 0.1, 2, 0.025),
    toyMat(p.fat)
  );
  fat.position.set(0, 0.05 * s, -0.17 * s);
  g.add(fat);
  const spot = new THREE.Mesh(
    new RoundedBoxGeometry(0.1, 0.032, 0.09, 2, 0.02),
    toyMat(p.fat)
  );
  spot.position.set(0.08 * s, 0.04 * s, 0.08 * s);
  g.add(spot);
  g.scale.setScalar(s);
  return g;
}

export function createChickenDiceChunk(scale) {
  const g = new THREE.Group();
  const s = 0.42 + scale * 0.58;
  const p = MEAT_PALETTE.chicken;
  const thigh = new THREE.Mesh(new THREE.SphereGeometry(0.21, 7, 7), toyMat(p.main, { warmTint: true }));
  thigh.scale.set(1.15 * s, 1.05 * s, 1.2 * s);
  thigh.position.y = 0.07 * s;
  g.add(thigh);
  const bone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032 * s, 0.026 * s, 0.24 * s, 5),
    toyMat(p.bone)
  );
  bone.rotation.z = Math.PI / 2.15;
  bone.position.set(0.15 * s, -0.04 * s, 0);
  g.add(bone);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.028 * s, 4, 4), toyMat(p.bone));
  tip.position.set(0.28 * s, -0.08 * s, 0);
  g.add(tip);
  return g;
}

export function createShrimpDiceChunk(scale) {
  const g = new THREE.Group();
  const s = 0.42 + scale * 0.55;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.17 * s, 0.03 * s, 0),
    new THREE.Vector3(-0.05 * s, 0.06 * s, 0.02 * s),
    new THREE.Vector3(0.1 * s, 0.04 * s, 0),
    new THREE.Vector3(0.19 * s, 0.01 * s, 0),
  ]);
  addShrimpDetails(g, MEAT_PALETTE.shrimp, curve, false);
  return g;
}

export function createFishDiceChunk(scale) {
  const g = new THREE.Group();
  const s = 0.4 + scale * 0.55;
  const p = MEAT_PALETTE.fish;
  g.add(
    new THREE.Mesh(
      new RoundedBoxGeometry(0.4 * s, 0.08 * s, 0.22 * s, 3, 0.04),
      toyMat(p.flesh)
    )
  );
  const skin = new THREE.Mesh(
    new RoundedBoxGeometry(0.38 * s, 0.02 * s, 0.2 * s, 2, 0.02),
    toyMat(p.skin)
  );
  skin.position.y = 0.05 * s;
  g.add(skin);
  return g;
}

export function createLambDiceChunk(scale) {
  const g = new THREE.Group();
  const s = 0.4 + scale * 0.55;
  const p = MEAT_PALETTE.lamb;
  g.add(
    new THREE.Mesh(
      new RoundedBoxGeometry(0.32 * s, 0.18 * s, 0.12 * s, 3, 0.04),
      toyMat(p.main)
    )
  );
  const bone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03 * s, 0.025 * s, 0.2 * s, 5),
    toyMat(p.bone)
  );
  bone.rotation.z = Math.PI / 2;
  bone.position.set(0.14 * s, 0.06 * s, 0);
  g.add(bone);
  return g;
}

export function createDuckDiceChunk(scale) {
  const g = new THREE.Group();
  const s = 0.42 + scale * 0.55;
  const p = MEAT_PALETTE.duck;
  const chunk = new THREE.Mesh(
    new THREE.SphereGeometry(0.16 * s, 7, 7),
    toyMat(p.meat)
  );
  chunk.scale.set(1.1, 0.65, 1);
  g.add(chunk);
  const skin = new THREE.Mesh(
    new RoundedBoxGeometry(0.18 * s, 0.04 * s, 0.14 * s, 2, 0.02),
    toyMat(p.skin, { warmTint: true })
  );
  skin.position.y = 0.08 * s;
  g.add(skin);
  return g;
}

export function createSquidDiceChunk(scale) {
  const g = new THREE.Group();
  const s = 0.4 + scale * 0.55;
  const p = MEAT_PALETTE.squid;
  g.add(
    new THREE.Mesh(
      new THREE.CylinderGeometry(0.08 * s, 0.09 * s, 0.22 * s, 8),
      toyMat(p.body)
    )
  );
  for (let i = 0; i < 3; i++) {
    const tent = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012 * s, 0.008 * s, 0.08 * s, 4),
      toyMat(p.tentacle)
    );
    tent.position.set((i - 1) * 0.05 * s, -0.1 * s, 0);
    g.add(tent);
  }
  return g;
}

export function createClamDiceChunk(scale) {
  const g = new THREE.Group();
  const s = 0.42 + scale * 0.55;
  const p = MEAT_PALETTE.clam;
  const half = new THREE.SphereGeometry(0.14 * s, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  g.add(new THREE.Mesh(half, toyMat(p.shell)));
  const meat = new THREE.Mesh(
    new THREE.SphereGeometry(0.07 * s, 6, 5),
    toyMat(p.inner, { warmTint: true })
  );
  meat.scale.y = 0.5;
  meat.position.y = 0.02 * s;
  g.add(meat);
  return g;
}

const DICE_BUILDERS = {
  pork: createPorkDiceChunk,
  beef: createBeefDiceChunk,
  chicken: createChickenDiceChunk,
  shrimp: createShrimpDiceChunk,
  fish: createFishDiceChunk,
  lamb: createLambDiceChunk,
  duck: createDuckDiceChunk,
  squid: createSquidDiceChunk,
  clam: createClamDiceChunk,
};

const MINCE_LAYOUT = [
  { pos: [0, 0.02, 0], rot: 0 },
  { pos: [-0.04, 0.01, 0.03], rot: 1.2 },
  { pos: [0.045, 0.015, -0.025], rot: 2.4 },
  { pos: [-0.02, 0.025, -0.035], rot: 3.6 },
  { pos: [0.03, 0.008, 0.04], rot: 4.8 },
  { pos: [-0.035, 0.018, 0.01], rot: 5.5 },
];

/** 纯色肉末粒（无五花/油花等花纹，颗粒偏大） */
export function createPlainMinceGrain(ingredientId, colorMap) {
  const p = MEAT_PALETTE[ingredientId];
  const color =
    p?.main ?? p?.flesh ?? p?.meat ?? p?.body ??
    (colorMap && colorMap[ingredientId]) ??
    0xcccccc;
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.94,
    metalness: 0,
  });
  const r = 0.038 + Math.random() * 0.016;
  const grain = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), mat);
  grain.scale.set(
    1.15 + Math.random() * 0.2,
    0.58 + Math.random() * 0.16,
    1.0 + Math.random() * 0.15
  );
  return grain;
}

export function createMeatMincePieces(meatId, size) {
  const group = new THREE.Group();
  group.userData.prepVisual = "minced";
  const colorMap = null;
  const pile = Math.max(1.35, size * 5.2);
  for (let i = 0; i < MINCE_LAYOUT.length; i++) {
    const piece = createPlainMinceGrain(meatId, colorMap);
    const lay = MINCE_LAYOUT[i];
    piece.position.set(lay.pos[0] * pile, lay.pos[1] * pile, lay.pos[2] * pile);
    piece.rotation.set(
      (Math.random() - 0.5) * 0.45,
      lay.rot + (Math.random() - 0.5) * 0.35,
      (Math.random() - 0.5) * 0.45
    );
    group.add(piece);
  }
  return group;
}

export function createMeatDicePiece(meatId, size) {
  const build = DICE_BUILDERS[meatId];
  return build ? build(size * 2) : minceFallback(meatId, size);
}

function minceFallback(meatId, size) {
  const g = new THREE.Group();
  g.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(size, 6, 6),
      toyMat(MEAT_PALETTE[meatId]?.main ?? 0xcccccc)
    )
  );
  return g;
}
