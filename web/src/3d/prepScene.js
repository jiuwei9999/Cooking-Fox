import * as THREE from "https://unpkg.com/three@0.162.0/build/three.module.js";
import { createIngredientMesh, INGREDIENT_COLORS } from "./ingredientModels.js";
import { createSingleChopSegment, createSingleMinceFlake } from "./prepCutModels.js";
import { createKnifeModel } from "./knifeModel.js";
import { createGlassBowl } from "./prepBowlModels.js";
import {
  clearBowlPhysics,
  syncMarinateBowlPhysics,
  syncSeasoningBowlPhysics,
  stepBowlPhysics,
  lockMarinateBodies,
} from "./prepBowlPhysics.js";
import { spawnPeelScraps } from "./prepVisuals.js";
import { getInitialPrepFlags } from "../shared/ingredientMeta.js";
import { playCutSound } from "../shared/audioFeedback.js";

// ── Easing functions ──
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInCubic(t) { return t * t * t; }
function easeInOutCubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }
function easeOutBack(t) { var c1 = 1.70158; var c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
function easeOutBounce(t) {
  var n1 = 7.5625, d1 = 2.75;
  if (t < 1/d1) return n1*t*t;
  else if (t < 2/d1) { t -= 1.5/d1; return n1*t*t + 0.75; }
  else if (t < 2.5/d1) { t -= 2.25/d1; return n1*t*t + 0.9375; }
  else { t -= 2.625/d1; return n1*t*t + 0.984375; }
}

var renderer, scene, camera, boardMesh, ingredientGroup;
var animTime = 0;
var cutParticles = [];
var themeObjects = {};
var knifeMesh;
var bowlMesh = null;
var prepStation = "board";
var boardIngredientId = null;

var camBoard = { x: 0, y: 2.8, z: 5.2, ly: 0.05 };
var camBowl = { x: 0, y: 6.8, z: 4.6, ly: -0.12 };
var camCur = { x: 0, y: 2.8, z: 5.2, ly: 0.05 };

function applyPrepCamera(mode, instant) {
  if (!camera) return;
  const tgt = mode === "board" ? camBoard : camBowl;
  if (instant) {
    camCur.x = tgt.x; camCur.y = tgt.y; camCur.z = tgt.z; camCur.ly = tgt.ly;
  }
  camera.position.set(camCur.x, camCur.y, camCur.z);
  camera.lookAt(0, camCur.ly, 0);
}

export function setPrepStation(mode) {
  prepStation = mode || "board";
  if (knifeMesh) knifeMesh.visible = prepStation === "board";
  if (boardMesh) boardMesh.visible = prepStation === "board";
  if (bowlMesh) bowlMesh.visible = prepStation !== "board";
  applyPrepCamera(prepStation, true);
}

function clearIngredientGroup() {
  clearBowlPhysics(ingredientGroup);
  for (var k = 0; k < cutParticles.length; k++) {
    var cp = cutParticles[k];
    scene.remove(cp);
    if (cp.geometry) cp.geometry.dispose();
    if (cp.material) cp.material.dispose();
  }
  cutParticles.length = 0;
  if (ingredientGroup) {
    while (ingredientGroup.children.length) {
      var child = ingredientGroup.children[0];
      ingredientGroup.remove(child);
      child.traverse(function(c) {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach(function(m) { m.dispose(); });
          else c.material.dispose();
        }
      });
    }
    scene.remove(ingredientGroup);
  }
  ingredientGroup = new THREE.Group();
  scene.add(ingredientGroup);
}

function ensureBowl() {
  if (bowlMesh) return bowlMesh;
  bowlMesh = createGlassBowl();
  bowlMesh.visible = false;
  scene.add(bowlMesh);
  return bowlMesh;
}

export function initPrep3D(container) {
  if (!container || renderer) return;

  var cw = container.clientWidth || 400, ch = container.clientHeight || 300;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(cw, ch);
  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x12101c);

  camera = new THREE.PerspectiveCamera(40, cw / ch, 0.1, 100);
  applyPrepCamera("board", true);

  var hemi = new THREE.HemisphereLight(0xfff0e8, 0x5a4a68, 0.85);
  scene.add(hemi);
  themeObjects.hemi = hemi;
  var ambient = new THREE.AmbientLight(0x998877, 0.55);
  scene.add(ambient);
  themeObjects.ambient = ambient;
  var key = new THREE.DirectionalLight(0xffeedd, 1.0);
  key.position.set(3, 6, 3);
  scene.add(key);
  var fill = new THREE.DirectionalLight(0xc8d8ff, 0.55);
  fill.position.set(-2, 2, -1);
  scene.add(fill);
  var rim = new THREE.DirectionalLight(0xffccaa, 0.35);
  rim.position.set(0, 1, -4);
  scene.add(rim);

  // Cutting board
  var boardGeo = new THREE.BoxGeometry(3.6, 0.15, 2.4);
  var boardMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.6, metalness: 0.02 });
  boardMesh = new THREE.Mesh(boardGeo, boardMat);
  boardMesh.position.y = -0.4;
  scene.add(boardMesh);
  themeObjects.boardMat = boardMat;

  var topGeo = new THREE.PlaneGeometry(3.55, 2.35);
  var topMat = new THREE.MeshStandardMaterial({ color: 0xa6804a, roughness: 0.55, metalness: 0.01 });
  var top = new THREE.Mesh(topGeo, topMat);
  top.rotation.x = -Math.PI / 2;
  top.position.y = -0.32;
  scene.add(top);
  themeObjects.topMat = topMat;

  for (var i = 0; i < 6; i++) {
    var lineGeo = new THREE.PlaneGeometry(3.4, 0.015);
    var lineMat = new THREE.MeshStandardMaterial({ color: 0x7a5a1a, roughness: 0.7, metalness: 0 });
    var line = new THREE.Mesh(lineGeo, lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.y = -0.315;
    line.position.z = -0.8 + i * 0.32;
    scene.add(line);
  }

  ingredientGroup = new THREE.Group();
  scene.add(ingredientGroup);

  var baseGeo = new THREE.PlaneGeometry(8, 8);
  var baseMat = new THREE.MeshStandardMaterial({ color: 0x1a1520, roughness: 0.8, metalness: 0.05 });
  var base = new THREE.Mesh(baseGeo, baseMat);
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.48;
  scene.add(base);
  themeObjects.baseMat = baseMat;

  // Knife — vertical, edge down, pivot at guard
  knifeMesh = createKnifeModel();
  var rp = knifeMesh.userData.restPos;
  knifeMesh.position.copy(rp);
  knifeMesh.rotation.set(0, 0, 0);
  scene.add(knifeMesh);

  ensureBowl();
  animate();

  window.addEventListener("resize", function() {
    if (!renderer || !container) return;
    var w2 = container.clientWidth || 400, h2 = container.clientHeight || 300;
    renderer.setSize(w2, h2);
    camera.aspect = w2 / h2;
    camera.updateProjectionMatrix();
  });
}

export function updatePrepTheme(isLight) {
  if (!scene) return;
  scene.background = new THREE.Color(isLight ? 0xe8edf2 : 0x12101c);
  if (themeObjects.hemi) {
    themeObjects.hemi.color.set(isLight ? 0xffffff : 0xfff0e8);
    themeObjects.hemi.groundColor.set(isLight ? 0xccccdd : 0x5a4a68);
    themeObjects.hemi.intensity = isLight ? 0.95 : 0.85;
  }
  if (themeObjects.ambient) themeObjects.ambient.color.set(isLight ? 0xaabbcc : 0x998877);
  if (themeObjects.boardMat) themeObjects.boardMat.color.set(isLight ? 0xc49a5a : 0x8b6914);
  if (themeObjects.topMat) themeObjects.topMat.color.set(isLight ? 0xd4ae6e : 0xa6804a);
  if (themeObjects.baseMat) themeObjects.baseMat.color.set(isLight ? 0xd8d4cc : 0x1a1520);
}

/** @param {{ items: object[], brine: object[], avgSoakProgress?: number }} state */
export function showMarinateBowl(state) {
  setPrepStation("marinate");
  clearIngredientGroup();
  var bowl = ensureBowl();
  bowl.visible = true;
  const s = state || {};
  if (ingredientGroup) {
    syncMarinateBowlPhysics(
      ingredientGroup,
      s.items || [],
      s.brine || [],
      {
        avgSoakProgress: s.avgSoakProgress ?? 0,
        lockBodies: !!s.lockBodies,
      }
    );
  }
  if (renderer && scene && camera) renderer.render(scene, camera);
}

export function lockMarinateBowlBodies() {
  lockMarinateBodies();
}

export function showSeasoningBowl(seasoningItems) {
  setPrepStation("seasoning");
  clearIngredientGroup();
  var bowl = ensureBowl();
  bowl.visible = true;
  if (ingredientGroup) {
    syncSeasoningBowlPhysics(ingredientGroup, seasoningItems || []);
  }
  if (renderer && scene && camera) renderer.render(scene, camera);
}

export function showIngredientOnBoard(ingredientId, prepState, cutStyle, particleMm, prepFlags) {
  setPrepStation("board");
  if (bowlMesh) bowlMesh.visible = false;
  clearIngredientGroup();
  if (renderer && scene && camera) renderer.render(scene, camera);

  if (!ingredientId) return;
  boardIngredientId = ingredientId;
  var flags = prepFlags || getInitialPrepFlags(ingredientId);
  var amount = prepState === "minced" ? 9 : prepState === "diced" ? 7 : prepState === "sliced" ? 5 : prepState === "chopped" ? 4 : 1;
  var minceSpread = 0.52;

  for (var i = 0; i < amount; i++) {
    var mesh;
    if (prepState === "minced") {
      mesh = createSingleMinceFlake(ingredientId, INGREDIENT_COLORS);
    } else if (prepState === "chopped") {
      mesh = createSingleChopSegment(ingredientId, INGREDIENT_COLORS);
    } else {
      mesh = createIngredientMesh(ingredientId, cutStyle || "chop", particleMm || 8, prepState, flags);
    }
    mesh.position.y = -0.22 + (prepState === "minced" ? (Math.random() - 0.5) * 0.04 : 0);
    if (prepState === "minced") {
      mesh.position.x = (Math.random() - 0.5) * minceSpread;
      mesh.position.z = (Math.random() - 0.5) * minceSpread * 0.85;
    } else {
      mesh.position.x = (Math.random() - 0.5) * 2.2;
      mesh.position.z = (Math.random() - 0.5) * 1.4;
    }
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.rotation.x = Math.random() * 0.4;
    mesh.rotation.z = Math.random() * 0.4;
    ingredientGroup.add(mesh);
  }
}

// ── 5-stage Y-axis chop with hard board stop ──
export function animateSliceMotion() {
  if (!knifeMesh || !ingredientGroup || ingredientGroup.children.length === 0) return;
  var ud = knifeMesh.userData;

  var EDGE_OFFSET = 0.44;  // 刀枢轴到刀刃距离（片刀竖直放置）
  var BOARD_TOP = -0.32;
  var HARD_MIN_PIVOT = BOARD_TOP + EDGE_OFFSET; // ~0.005, edge level with board

  var restY = ud.restPos ? ud.restPos.y : 0.58;
  var peakY = restY + 0.40;
  var chopY = HARD_MIN_PIVOT + 0.02;

  ud.slicing = true;
  ud.slicePhase = 0;
  ud.sFloatEnd = 0.18;
  ud.sHoverEnd = 0.25;
  ud.sChopEnd = 0.55;
  ud.sBounceEnd = 0.68;
  ud.sliceRestY = restY;
  ud.slicePeakY = peakY;
  ud.sliceChopY = chopY;
  ud.sliceMinY = HARD_MIN_PIVOT;
  ud.sliceHitTriggered = false;
}

export function animateCut() {
  if (!ingredientGroup || ingredientGroup.children.length === 0) return;
  var mesh = ingredientGroup.children[0];
  mesh.userData.cutAnim = 0.3;
  for (var i = 0; i < 6; i++) {
    var geo = new THREE.BoxGeometry(0.03, 0.03, 0.03);
    var mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.1 + Math.random() * 0.2, 0.5, 0.5 + Math.random() * 0.3),
      roughness: 0.5, metalness: 0.1,
    });
    var p = new THREE.Mesh(geo, mat);
    p.position.copy(mesh.position);
    p.userData = { life: 0.4 + Math.random() * 0.3, vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 2 };
    scene.add(p);
    cutParticles.push(p);
  }
}

export function animateCrack() {
  if (!ingredientGroup || ingredientGroup.children.length === 0) return;
  var mesh = ingredientGroup.children[0];
  mesh.userData.crackAnim = 0.25;
}

export function animatePeel(ingredientId) {
  if (!ingredientGroup || ingredientGroup.children.length === 0) return;
  var mesh = ingredientGroup.children[0];
  mesh.userData.peelAnim = 0.45;
  playCutSound("soft");
  var scraps = spawnPeelScraps(scene, ingredientId, mesh.position);
  cutParticles.push.apply(cutParticles, scraps);
}

export function disposePrep3D() {
  if (ingredientGroup) clearBowlPhysics(ingredientGroup);
  if (renderer) { renderer.dispose(); renderer = null; }
  scene = null; ingredientGroup = null; boardMesh = null; knifeMesh = null; bowlMesh = null;
  prepStation = "board";
}

function spawnCutParticles(pos) {
  for (var i = 0; i < 8; i++) {
    var geo = new THREE.BoxGeometry(0.02, 0.02, 0.02);
    var mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.1 + Math.random() * 0.3, 0.6, 0.5),
      roughness: 0.5, metalness: 0.1,
    });
    var p = new THREE.Mesh(geo, mat);
    p.position.copy(pos);
    p.userData = { life: 0.5 + Math.random() * 0.4, vx: (Math.random() - 0.5) * 1.5, vy: 0.8 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 1.5 };
    scene.add(p);
    cutParticles.push(p);
  }
}

function animate() {
  if (!renderer || !scene || !camera) return;
  requestAnimationFrame(animate);
  var dt = 0.016;
  animTime += dt;

  // Ingredient animations
  if (ingredientGroup && ingredientGroup.children.length > 0) {
    var mesh = ingredientGroup.children[0];
    if (mesh.userData.cutAnim > 0) {
      mesh.userData.cutAnim -= dt;
      var f = Math.max(0, mesh.userData.cutAnim / 0.3);
      mesh.scale.setScalar(1 - Math.sin(f * Math.PI) * 0.2);
    }
    if (mesh.userData.crackAnim > 0) {
      mesh.userData.crackAnim -= dt;
      var f2 = Math.max(0, mesh.userData.crackAnim / 0.25);
      mesh.scale.setScalar(1 + Math.sin(f2 * Math.PI) * 0.15);
      mesh.rotation.z = Math.sin(f2 * Math.PI * 2) * 0.3;
    }
    if (mesh.userData.peelAnim > 0) {
      mesh.userData.peelAnim -= dt;
      var f3 = Math.max(0, mesh.userData.peelAnim / 0.45);
      mesh.rotation.y += dt * 2.2;
      mesh.scale.setScalar(0.92 + f3 * 0.08);
    }
  }

  // Knife slice animation (Y-axis chop: lift → chop → bounce → return)
  if (knifeMesh) {
    var ud = knifeMesh.userData;
    if (ud.slicing) {
      ud.slicePhase += dt * 1.3;
      var p = Math.min(1, ud.slicePhase);
      var t, y;

      if (p < ud.sFloatEnd) {
        t = easeOutCubic(p / ud.sFloatEnd);
        y = ud.sliceRestY + (ud.slicePeakY - ud.sliceRestY) * t;
      } else if (p < ud.sHoverEnd) {
        y = ud.slicePeakY;
      } else if (p < ud.sChopEnd) {
        t = easeInCubic((p - ud.sHoverEnd) / (ud.sChopEnd - ud.sHoverEnd));
        y = ud.slicePeakY + (ud.sliceChopY - ud.slicePeakY) * t;
        if (p > ud.sHoverEnd + (ud.sChopEnd - ud.sHoverEnd) * 0.70 && !ud.sliceHitTriggered) {
          ud.sliceHitTriggered = true;
          playCutSound("crisp");
          spawnCutParticles(new THREE.Vector3(0, ud.sliceMinY - 0.42, 0.2));
        }
      } else if (p < ud.sBounceEnd) {
        t = easeOutBounce((p - ud.sChopEnd) / (ud.sBounceEnd - ud.sChopEnd));
        y = ud.sliceChopY + (ud.sliceMinY + 0.03 - ud.sliceChopY) * t;
      } else {
        t = easeInOutCubic((p - ud.sBounceEnd) / (1 - ud.sBounceEnd));
        y = (ud.sliceMinY + 0.03) + (ud.sliceRestY - (ud.sliceMinY + 0.03)) * t;
      }

      knifeMesh.position.y = Math.max(ud.sliceMinY, y);
      knifeMesh.position.x = 0;
      knifeMesh.position.z = 0.2;

      if (p >= 1) {
        ud.slicing = false;
        knifeMesh.position.set(0, ud.sliceRestY, 0.2);
      }
    } else {
      if (ud.restPos && !ud.slicing) {
        knifeMesh.position.y += (ud.restPos.y - knifeMesh.position.y) * 0.05;
        knifeMesh.position.x += (ud.restPos.x - knifeMesh.position.x) * 0.05;
        knifeMesh.position.z += (ud.restPos.z - knifeMesh.position.z) * 0.05;
      }
    }
  }

  if (prepStation !== "board") {
    var tgt = camBowl;
    camCur.x += (tgt.x - camCur.x) * 0.06;
    camCur.y += (tgt.y - camCur.y) * 0.06;
    camCur.z += (tgt.z - camCur.z) * 0.06;
    camCur.ly += (tgt.ly - camCur.ly) * 0.06;
    camera.position.set(camCur.x, camCur.y, camCur.z);
    camera.lookAt(0, camCur.ly, 0);
    stepBowlPhysics(dt, ingredientGroup);
  } else {
    var tgtB = camBoard;
    camCur.x += (tgtB.x - camCur.x) * 0.06;
    camCur.y += (tgtB.y - camCur.y) * 0.06;
    camCur.z += (tgtB.z - camCur.z) * 0.06;
    camCur.ly += (tgtB.ly - camCur.ly) * 0.06;
    camera.position.set(camCur.x, camCur.y, camCur.z);
    camera.lookAt(0, camCur.ly, 0);
  }

  // Clean up cut particles
  for (var i = cutParticles.length - 1; i >= 0; i--) {
    var cp = cutParticles[i];
    cp.userData.life -= dt;
    cp.position.x += cp.userData.vx * dt;
    cp.position.y += cp.userData.vy * dt;
    cp.position.z += cp.userData.vz * dt;
    cp.userData.vy -= 3 * dt;
    if (cp.userData.life <= 0) {
      scene.remove(cp);
      if (cp.geometry) cp.geometry.dispose();
      if (cp.material) cp.material.dispose();
      cutParticles.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
}
