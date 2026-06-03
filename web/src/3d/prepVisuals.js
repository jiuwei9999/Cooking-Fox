import * as THREE from "https://unpkg.com/three@0.162.0/build/three.module.js";
import { INGREDIENT_COLORS } from "./ingredientModels.js";

const PEEL_SKIN_COLOR = {
  potato: 0x8b7355,
  tomato: 0x4ade80,
  eggplant: 0x4c1d95,
  carrot: 0xb45309,
  cucumber: 0x166534,
};

export function attachVegetableSkin(group, ingredientId) {
  if (!group || !PEEL_SKIN_COLOR[ingredientId]) return;
  const col = PEEL_SKIN_COLOR[ingredientId];
  const mat = new THREE.MeshStandardMaterial({
    color: col,
    roughness: 0.75,
    metalness: 0.02,
    transparent: true,
    opacity: 0.92,
  });
  let shell;
  if (ingredientId === "potato") {
    shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 1), mat);
    shell.scale.set(1.08, 0.88, 0.98);
  } else if (ingredientId === "tomato") {
    shell = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 14), mat);
    shell.scale.set(1.06, 0.95, 1.06);
  } else if (ingredientId === "eggplant") {
    shell = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), mat);
    shell.scale.set(1.05, 1.1, 1.05);
  } else if (ingredientId === "carrot") {
    shell = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.52, 10), mat);
    shell.rotation.x = Math.PI / 2;
  } else {
    shell = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.58, 12), mat);
    shell.rotation.z = Math.PI / 2;
  }
  shell.userData.prepPart = "skin";
  group.add(shell);
  if (!group.userData.prepSkinParts) group.userData.prepSkinParts = [];
  group.userData.prepSkinParts.push(shell);
}

export function applyVegetablePrepFlags(group, prepFlags) {
  if (!group || !prepFlags || prepFlags.withSkin !== false) return;
  const remove = [];
  group.traverse((c) => {
    if (c.isMesh && c.userData.prepPart === "skin") remove.push(c);
  });
  remove.forEach((m) => {
    group.remove(m);
    if (m.geometry) m.geometry.dispose();
    if (m.material) m.material.dispose();
  });
}

export function applyMeatPrepFlags(group, prepFlags) {
  if (!group || !prepFlags) return;
  const remove = [];
  group.traverse((c) => {
    if (!c.isMesh) return;
    if (prepFlags.withBone === false && c.userData.prepPart === "bone") remove.push(c);
    if (prepFlags.withSkin === false && c.userData.prepPart === "skin") remove.push(c);
  });
  remove.forEach((m) => {
    if (m.parent) m.parent.remove(m);
    if (m.geometry) m.geometry.dispose();
    if (m.material) m.material.dispose();
  });
}

export function applyMarinateTint(group) {
  if (!group) return;
  group.traverse((c) => {
    if (c.isMesh && c.material && c.material.color && c.userData.prepPart !== "skin") {
      c.material = c.material.clone();
      c.material.color.multiplyScalar(0.88);
      if (c.material.emissive) c.material.emissive.setHex(0x221100);
    }
  });
}

export function spawnPeelScraps(scene, ingredientId, pos) {
  const col = PEEL_SKIN_COLOR[ingredientId] || 0x8b7355;
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const geo = new THREE.PlaneGeometry(0.06 + Math.random() * 0.05, 0.04);
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, side: THREE.DoubleSide });
    const p = new THREE.Mesh(geo, mat);
    p.position.copy(pos || new THREE.Vector3(0, -0.2, 0));
    p.position.x += (Math.random() - 0.5) * 0.4;
    p.position.z += (Math.random() - 0.5) * 0.3;
    p.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    p.userData = { life: 0.8, vy: 0.5 + Math.random(), vx: (Math.random() - 0.5) * 0.8, vz: (Math.random() - 0.5) * 0.8 };
    scene.add(p);
    parts.push(p);
  }
  return parts;
}
