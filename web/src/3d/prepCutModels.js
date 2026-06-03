/**
 * 备菜切段/切末：每次只生成「一根段」或「一粒屑」，由 prepScene 分散摆在砧板上
 */
import * as THREE from "https://unpkg.com/three@0.162.0/build/three.module.js";
import { MEAT_IDS, createMeatDicePiece, createPlainMinceGrain, toyMat } from "./cartoonMeat.js";

function matFor(id, colorMap) {
  return toyMat(colorMap[id] || 0xcccccc);
}

/** 单根条段（切段） */
export function createSingleChopSegment(ingredientId, colorMap) {
  if (MEAT_IDS.has(ingredientId)) {
    const piece = createMeatDicePiece(ingredientId, 0.1);
    piece.rotation.z = Math.PI / 2 + (Math.random() - 0.5) * 0.3;
    return piece;
  }

  const mat = matFor(ingredientId, colorMap);
  const segLen = ingredientId === "green_bean" ? 0.16 : 0.13;
  const segRad = ingredientId === "carrot" ? 0.038 : 0.032;
  let geo;
  if (ingredientId === "carrot") {
    geo = new THREE.CylinderGeometry(segRad * 0.85, segRad, segLen, 7);
  } else if (ingredientId === "mushroom") {
    geo = new THREE.CylinderGeometry(segRad * 1.1, segRad * 0.9, segLen * 0.7, 8);
  } else {
    geo = new THREE.CylinderGeometry(segRad, segRad * 0.92, segLen, 8);
  }
  const seg = new THREE.Mesh(geo, mat);
  seg.rotation.z = Math.PI / 2 + (Math.random() - 0.5) * 0.35;
  return seg;
}

/** 单粒肉末（扁圆碎屑，无花纹） */
export function createSingleMinceFlake(ingredientId, colorMap) {
  const flake = MEAT_IDS.has(ingredientId)
    ? createPlainMinceGrain(ingredientId, colorMap)
    : createVegMinceGrain(ingredientId, colorMap);
  flake.rotation.set(
    (Math.random() - 0.5) * 0.8,
    Math.random() * Math.PI * 2,
    (Math.random() - 0.5) * 0.8
  );
  return flake;
}

function createVegMinceGrain(ingredientId, colorMap) {
  const color = colorMap[ingredientId] || 0xcccccc;
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
