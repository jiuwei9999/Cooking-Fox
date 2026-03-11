import * as THREE from "https://unpkg.com/three@0.162.0/build/three.module.js";

let renderer;
let scene;
let camera;
let liquid;
let panBottom;
let ingredientGroup;

export function initPot3D(container) {
  if (!container || renderer) return;

  const { clientWidth: w, clientHeight: h } = container;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(w || 400, h || 260);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, (w || 4) / (h || 3), 0.1, 100);
  camera.position.set(0, 4, 7);
  camera.lookAt(0, 0, 0);

  const ambient = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(3, 6, 4);
  scene.add(dir);

  const panGeo = new THREE.CylinderGeometry(3.2, 3.4, 0.4, 48, 1, true);
  const panMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.85,
    roughness: 0.3,
  });
  panBottom = new THREE.Mesh(panGeo, panMat);
  panBottom.position.y = -0.25;
  scene.add(panBottom);

  const innerGeo = new THREE.CircleGeometry(3, 64);
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0x020617,
    metalness: 0.7,
    roughness: 0.5,
  });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = -0.05;
  scene.add(inner);

  const liquidGeo = new THREE.CylinderGeometry(2.7, 2.7, 0.2, 48);
  const liquidMat = new THREE.MeshStandardMaterial({
    color: 0x0f766e,
    transparent: true,
    opacity: 0.9,
    metalness: 0.3,
    roughness: 0.4,
  });
  liquid = new THREE.Mesh(liquidGeo, liquidMat);
  liquid.position.y = 0;
  scene.add(liquid);

  ingredientGroup = new THREE.Group();
  scene.add(ingredientGroup);

  animate();

  window.addEventListener("resize", () => {
    if (!renderer || !container) return;
    const w2 = container.clientWidth || 400;
    const h2 = container.clientHeight || 260;
    renderer.setSize(w2, h2);
    camera.aspect = w2 / h2;
    camera.updateProjectionMatrix();
  });
}

export function updatePot3D(session) {
  if (!scene || !liquid || !panBottom || !ingredientGroup || !session) return;
  const m = session.metrics || {};
  const water = m.water_g || 0;
  const oil = m.oil_g || 0;
  const solids = m.solids_g || 0;
  const total = water + oil + solids;

  const level = Math.max(0.05, Math.min(1.0, total / 500));
  liquid.scale.y = 0.3 + level * 1.4;

  const waterRatio = total > 0 ? water / total : 0;
  const oilRatio = total > 0 ? oil / total : 0;
  const brown = m.browning || 0;
  let baseColor;
  if (brown > 0.6) {
    baseColor = new THREE.Color().setHSL(0.07, 0.8, 0.22);
  } else if (waterRatio >= oilRatio) {
    baseColor = new THREE.Color().setHSL(0.54, 0.7, 0.35 + brown * 0.25);
  } else {
    baseColor = new THREE.Color().setHSL(0.13, 0.8, 0.4 - brown * 0.18);
  }
  liquid.material.color.copy(baseColor);

  const burn = m.burn_risk || 0;
  const panColor = new THREE.Color().setHSL(0.6, 0, 0.08 - burn * 0.03);
  panBottom.material.color.copy(panColor);

  while (ingredientGroup.children.length) {
    ingredientGroup.remove(ingredientGroup.children[0]);
  }
  const pot = session.pot || [];
  const max = 18;
  pot.slice(0, max).forEach((p, idx) => {
    const geo = new THREE.BoxGeometry(0.4, 0.1, 0.4);
    const color = new THREE.Color().setStyle(chipColorForId(p.ingredient_id));
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 });
    const cube = new THREE.Mesh(geo, mat);
    const t = max > 1 ? idx / (max - 1) : 0.5;
    const angle = t * Math.PI * 2;
    const radius = 1.4 + (idx % 3) * 0.18;
    cube.position.set(Math.cos(angle) * radius, 0.25 + level * 0.8, Math.sin(angle) * radius);
    cube.rotation.y = angle / 2;
    ingredientGroup.add(cube);
  });
}

function animate() {
  if (!renderer || !scene || !camera) return;
  requestAnimationFrame(animate);
  const t = performance.now() / 4000;
  camera.position.x = Math.sin(t) * 6.5;
  camera.position.z = Math.cos(t) * 6.5;
  camera.lookAt(0, 0.4, 0);
  renderer.render(scene, camera);
}

function chipColorForId(id) {
  switch (id) {
    case "egg":
      return "#fee2b3";
    case "tomato":
      return "#f97373";
    case "rice":
      return "#f9fafb";
    case "water":
      return "#bae6fd";
    case "oil":
      return "#facc15";
    case "salt":
      return "#e5e7eb";
    case "sugar":
      return "#fef9c3";
    case "soy_sauce":
      return "#0f172a";
    case "garlic":
      return "#fef3c7";
    case "ginger":
      return "#facc15";
    case "chili":
      return "#fb7185";
    case "scallion":
      return "#4ade80";
    case "butter":
      return "#fef08a";
    default:
      return "#e5e7eb";
  }
}

