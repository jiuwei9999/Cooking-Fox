import * as THREE from "https://unpkg.com/three@0.162.0/build/three.module.js";
import {
  MEAT_IDS,
  createCartoonPork,
  createCartoonBeef,
  createCartoonChicken,
  createCartoonShrimp,
  createCartoonFish,
  createCartoonLamb,
  createCartoonDuck,
  createCartoonSquid,
  createCartoonClam,
  createShuckedClam,
  createMeatMincePieces,
  createMeatDicePiece,
  toyMat,
} from "./cartoonMeat.js";
import { createSingleMinceFlake } from "./prepCutModels.js";
import { attachVegetableSkin, applyVegetablePrepFlags, applyMeatPrepFlags, applyMarinateTint } from "./prepVisuals.js";
import { getInitialPrepFlags, PEELABLE_IDS } from "../shared/ingredientMeta.js";
// cache v18

export const INGREDIENT_COLORS = {
  egg: 0xfff5e0,
  egg_yolk: 0xffd87c,
  tomato: 0xef4444,
  tomato_stem: 0x4ade80,
  cucumber: 0x22c55e,
  potato: 0xc4a56e,
  carrot: 0xf97316,
  carrot_top: 0x22c55e,
  onion: 0x9b59b6,
  pork: 0xff9aad,
  beef: 0xc87858,
  chicken: 0xffe8e0,
  shrimp: 0xff8855,
  mushroom_stem: 0xe8d5b7,
  mushroom_cap: 0xb8956a,
  rice: 0xfefefe,
  noodle: 0xfde68a,
  garlic: 0xfefef5,
  ginger: 0xe8c46c,
  chili: 0xef4444,
  scallion: 0x4ade80,
  butter: 0xfef08a,
  salt: 0xf5f5f5,
  sugar: 0xfffde7,
  pepper: 0x6b4e31,
  five_spice: 0x8b6914,
  tofu: 0xf5f5dc,
  cabbage: 0xe8f5e9,
  bok_choy: 0x86efac,
  broccoli: 0x22c55e,
  broccoli_stem: 0xecfccb,
  bell_pepper: 0xef4444,
  eggplant: 0x6b21a8,
  corn: 0xfbbf24,
  corn_husk: 0x84cc16,
  green_bean: 0x4ade80,
  spinach: 0x15803d,
  celery: 0xbbf7d0,
  fish: 0xa8d4f0,
  lamb: 0xd4a574,
  duck: 0xc4a882,
  squid: 0xf5d0c5,
  clam: 0xf0e6d2,
  flour: 0xfffbeb,
  cooking_wine: 0xd4a574,
  oyster_sauce: 0x5c3317,
  chili_oil: 0xdc2626,
  starch: 0xffffff,
  chicken_powder: 0xfef3c7,
  sesame: 0xf5e6c8,
  bean_paste: 0x991b1b,
};

const COLOR_MAP = INGREDIENT_COLORS;

const LIQUID_IDS = new Set([
  "water", "oil", "soy_sauce", "dark_soy_sauce", "vinegar", "sesame_oil",
  "cooking_wine", "oyster_sauce", "chili_oil",
]);

export function createIngredientMesh(ingredientId, cutStyle, particleMm, prepState, prepFlags) {
  const flags = prepFlags || getInitialPrepFlags(ingredientId);
  if (ingredientId === "egg" && prepState === "cracked") {
    return createCrackedEgg();
  }
  if (ingredientId === "butter" && prepState === "melted") {
    return createMeltedButter();
  }
  if (ingredientId === "clam" && prepState === "shucked") {
    return createShuckedClam();
  }
  if (prepState === "marinated") {
    const g = createIngredientMesh(ingredientId, cutStyle || "chop", particleMm, "whole", { ...flags, marinated: false });
    applyMarinateTint(g);
    return g;
  }
  if (LIQUID_IDS.has(ingredientId)) {
    return new THREE.Group();
  }

  if (cutStyle === "mince") {
    const size = Math.max(0.03, (particleMm || 3) / 100);
    if (MEAT_IDS.has(ingredientId)) return createMeatMincePieces(ingredientId, size);
    const group = new THREE.Group();
    const pile = Math.max(0.42, size * 6);
    for (let i = 0; i < 6; i++) {
      const piece = createSingleMinceFlake(ingredientId, COLOR_MAP);
      piece.position.set(
        (Math.random() - 0.5) * pile,
        (Math.random() - 0.5) * pile * 0.35,
        (Math.random() - 0.5) * pile
      );
      group.add(piece);
    }
    return group;
  }

  if (cutStyle === "dice") {
    const size = Math.max(0.06, (particleMm || 8) / 150);
    const group = new THREE.Group();
    if (MEAT_IDS.has(ingredientId)) {
      group.add(createMeatDicePiece(ingredientId, size));
    } else {
      group.add(
        new THREE.Mesh(
          new THREE.BoxGeometry(size, size * 0.8, size),
          toyMat(COLOR_MAP[ingredientId] || 0xcccccc)
        )
      );
    }
    return group;
  }

  const group = createRawModel(ingredientId);

  if (cutStyle === "slice") {
    group.scale.set(1, 0.2, 1);
  }

  if (PEELABLE_IDS.includes(ingredientId) && flags.withSkin !== false) {
    attachVegetableSkin(group, ingredientId);
  }
  applyVegetablePrepFlags(group, flags);
  if (MEAT_IDS.has(ingredientId)) {
    applyMeatPrepFlags(group, flags);
  }

  return group;
}

function createCrackedEgg() {
  const group = new THREE.Group();
  const rough = 0.55;
  const metal = 0.05;
  const matShell = new THREE.MeshStandardMaterial({ color: COLOR_MAP.egg, roughness: rough, metalness: metal });
  const matYolk = new THREE.MeshStandardMaterial({ color: COLOR_MAP.egg_yolk, roughness: 0.3, metalness: 0 });
  const matWhite = new THREE.MeshStandardMaterial({ color: 0xfffff8, roughness: 0.3, metalness: 0, transparent: true, opacity: 0.7 });

  // Exposed yolk
  const yolk = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), matYolk);
  yolk.position.y = 0.04;
  group.add(yolk);

  // Egg white puddle
  const white = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 6), matWhite);
  white.scale.set(1, 0.25, 0.8);
  white.position.y = -0.02;
  group.add(white);

  // Shell fragments around
  for (let i = 0; i < 6; i++) {
    const fragGeo = new THREE.BoxGeometry(0.06 + Math.random() * 0.06, 0.02 + Math.random() * 0.03, 0.06 + Math.random() * 0.06);
    const frag = new THREE.Mesh(fragGeo, matShell);
    const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 0.14 + Math.random() * 0.1;
    frag.position.set(Math.cos(angle) * dist, 0.02 + Math.random() * 0.06, Math.sin(angle) * dist);
    frag.rotation.set(Math.random() * 0.8, Math.random() * Math.PI, Math.random() * 0.8);
    group.add(frag);
  }

  return group;
}

function createMeltedButter() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: COLOR_MAP.butter,
    roughness: 0.15,
    metalness: 0.02,
    transparent: true,
    opacity: 0.45,
  });
  const puddle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 6), mat);
  puddle.scale.set(1, 0.12, 0.9);
  puddle.position.y = -0.03;
  group.add(puddle);
  return group;
}

function createRawModel(id) {
  const group = new THREE.Group();
  const rough = 0.55;
  const metal = 0.05;

  const mat = (color) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

  switch (id) {
    case "egg": {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 20, 16),
        mat(COLOR_MAP.egg)
      );
      body.scale.set(1, 1.15, 1);
      group.add(body);

      const yolk = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 12, 8),
        new THREE.MeshStandardMaterial({ color: COLOR_MAP.egg_yolk, roughness: 0.4, metalness: 0 })
      );
      yolk.position.y = 0.08;
      group.add(yolk);
      break;
    }
    case "tomato": {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 20, 16),
        mat(COLOR_MAP.tomato)
      );
      body.scale.set(1, 0.88, 1);
      group.add(body);

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.06, 0.1, 6),
        mat(COLOR_MAP.tomato_stem)
      );
      stem.position.y = 0.22;
      group.add(stem);

      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.06, 5),
        mat(COLOR_MAP.tomato_stem)
      );
      leaf.position.y = 0.29;
      group.add(leaf);
      break;
    }
    case "cucumber": {
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.11, 0.55, 12),
        mat(COLOR_MAP.cucumber)
      );
      body.rotation.z = Math.PI / 2;
      group.add(body);
      break;
    }
    case "potato": {
      const body = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.22, 1),
        mat(COLOR_MAP.potato)
      );
      body.scale.set(1, 0.8, 0.9);
      group.add(body);
      break;
    }
    case "carrot": {
      const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.1, 0.5, 8, 8),
        mat(COLOR_MAP.carrot)
      );
      body.rotation.x = -Math.PI / 2;
      group.add(body);

      const top = new THREE.Mesh(
        new THREE.ConeGeometry(0.07, 0.12, 6),
        mat(COLOR_MAP.carrot_top)
      );
      top.position.z = -0.28;
      group.add(top);
      break;
    }
    case "onion": {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 16, 14),
        mat(COLOR_MAP.onion)
      );
      body.scale.set(1, 0.85, 1);
      group.add(body);

      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.05, 0.1, 6),
        mat(0xc39bd3)
      );
      tip.position.y = 0.2;
      group.add(tip);
      break;
    }
    case "pork":
      return createCartoonPork();
    case "beef":
      return createCartoonBeef();
    case "chicken":
      return createCartoonChicken();
    case "shrimp":
      return createCartoonShrimp();
    case "fish":
      return createCartoonFish();
    case "lamb":
      return createCartoonLamb();
    case "duck":
      return createCartoonDuck();
    case "squid":
      return createCartoonSquid();
    case "clam":
      return createCartoonClam();
    case "mushroom": {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.07, 0.2, 8),
        mat(COLOR_MAP.mushroom_stem)
      );
      group.add(stem);

      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.17, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        mat(COLOR_MAP.mushroom_cap)
      );
      cap.position.y = 0.08;
      group.add(cap);
      break;
    }
    case "rice": {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 6),
        mat(COLOR_MAP.rice)
      );
      body.scale.set(1, 1.4, 0.7);
      group.add(body);
      break;
    }
    case "noodle": {
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6),
        mat(COLOR_MAP.noodle)
      );
      body.rotation.z = Math.PI / 2 + Math.random() * 0.5 - 0.25;
      body.rotation.x = Math.random() * 0.5 - 0.25;
      group.add(body);
      break;
    }
    case "garlic": {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 10),
        mat(COLOR_MAP.garlic)
      );
      body.scale.set(1, 1.1, 0.85);
      group.add(body);

      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.04, 0.1, 6),
        mat(0xf0f0e0)
      );
      tip.position.y = 0.18;
      group.add(tip);
      break;
    }
    case "ginger": {
      const body = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.16, 1),
        mat(COLOR_MAP.ginger)
      );
      body.scale.set(1, 0.75, 0.8);
      group.add(body);
      break;
    }
    case "chili": {
      const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.4, 8),
        mat(COLOR_MAP.chili)
      );
      body.rotation.z = -0.3;
      group.add(body);

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.04, 0.1, 6),
        mat(COLOR_MAP.tomato_stem)
      );
      stem.position.set(0.08, 0.16, 0);
      group.add(stem);
      break;
    }
    case "scallion": {
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.06, 0.4, 8),
        mat(COLOR_MAP.scallion)
      );
      body.rotation.z = Math.PI / 2 + Math.random() * 0.3 - 0.15;
      group.add(body);
      break;
    }
    case "butter": {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.1, 0.22),
        mat(COLOR_MAP.butter)
      );
      group.add(body);
      break;
    }
    case "tofu": {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.14, 0.22),
        mat(COLOR_MAP.tofu)
      );
      group.add(body);
      break;
    }
    case "cabbage": {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 14, 12),
        mat(COLOR_MAP.cabbage)
      );
      body.scale.set(1, 0.75, 1);
      group.add(body);
      break;
    }
    case "bok_choy": {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.07, 0.35, 8),
        mat(COLOR_MAP.bok_choy)
      );
      group.add(stem);
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.2, 6),
        mat(0x4ade80)
      );
      leaf.position.y = 0.22;
      group.add(leaf);
      break;
    }
    case "broccoli": {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 0.22, 8),
        mat(COLOR_MAP.broccoli_stem)
      );
      group.add(stem);
      const head = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.16, 1),
        mat(COLOR_MAP.broccoli)
      );
      head.position.y = 0.16;
      group.add(head);
      break;
    }
    case "bell_pepper": {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 14, 12),
        mat(COLOR_MAP.bell_pepper)
      );
      body.scale.set(1, 1.1, 0.9);
      group.add(body);
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.04, 0.08, 6),
        mat(COLOR_MAP.tomato_stem)
      );
      stem.position.y = 0.22;
      group.add(stem);
      break;
    }
    case "eggplant": {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 10),
        mat(COLOR_MAP.eggplant)
      );
      body.scale.set(1, 2.2, 1);
      group.add(body);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.08, 0.08, 8),
        mat(COLOR_MAP.tomato_stem)
      );
      cap.position.y = 0.28;
      group.add(cap);
      break;
    }
    case "corn": {
      const cob = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.42, 10),
        mat(COLOR_MAP.corn)
      );
      group.add(cob);
      const husk = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.15, 8),
        mat(COLOR_MAP.corn_husk)
      );
      husk.position.y = 0.24;
      group.add(husk);
      break;
    }
    case "green_bean": {
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6),
        mat(COLOR_MAP.green_bean)
      );
      body.rotation.z = Math.PI / 2;
      group.add(body);
      break;
    }
    case "spinach": {
      for (let i = 0; i < 4; i++) {
        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 8, 6),
          mat(COLOR_MAP.spinach)
        );
        leaf.scale.set(0.6, 0.2, 1);
        leaf.position.set((i - 1.5) * 0.08, 0.02 * i, 0);
        group.add(leaf);
      }
      break;
    }
    case "celery": {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.42, 0.08),
        mat(COLOR_MAP.celery)
      );
      group.add(body);
      break;
    }
    case "flour": {
      const pile = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 0.12, 8),
        mat(COLOR_MAP.flour)
      );
      pile.rotation.x = Math.PI;
      pile.position.y = -0.04;
      group.add(pile);
      break;
    }
    case "salt":
    case "sugar":
    case "pepper":
    case "five_spice":
    case "starch":
    case "chicken_powder":
    case "sesame": {
      const color =
        id === "salt" ? COLOR_MAP.salt :
        id === "sugar" ? COLOR_MAP.sugar :
        id === "pepper" ? COLOR_MAP.pepper :
        id === "starch" ? COLOR_MAP.starch :
        id === "chicken_powder" ? COLOR_MAP.chicken_powder :
        id === "sesame" ? COLOR_MAP.sesame :
        COLOR_MAP.five_spice;
      for (let i = 0; i < 4; i++) {
        const grain = new THREE.Mesh(
          new THREE.SphereGeometry(0.04, 4, 4),
          new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0 })
        );
        grain.position.set(
          (Math.random() - 0.5) * 0.12,
          (Math.random() - 0.5) * 0.12,
          (Math.random() - 0.5) * 0.12
        );
        group.add(grain);
      }
      break;
    }
    default: {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 10),
        mat(COLOR_MAP[id] || 0xcccccc)
      );
      group.add(body);
      break;
    }
  }

  return group;
}

export function createHalvedModel(ingredientId) {
  var group = new THREE.Group();

  if (ingredientId === "tomato") {
    var halfGeo = new THREE.SphereGeometry(0.24, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    var halfMat = new THREE.MeshStandardMaterial({ color: COLOR_MAP.tomato, roughness: 0.55, metalness: 0.05 });

    var half1 = new THREE.Mesh(halfGeo, halfMat);
    half1.position.set(-0.13, -0.22, 0);
    half1.rotation.z = Math.PI / 2;
    group.add(half1);

    var half2 = new THREE.Mesh(halfGeo, halfMat);
    half2.position.set(0.13, -0.22, 0);
    half2.rotation.z = -Math.PI / 2;
    group.add(half2);

    var stemGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.08, 6);
    var stemMat = new THREE.MeshStandardMaterial({ color: COLOR_MAP.tomato_stem, roughness: 0.6, metalness: 0.02 });
    var stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(0.14, -0.16, 0);
    group.add(stem);

    return group;
  }

  var defColor = COLOR_MAP[ingredientId] || 0xcccccc;
  var defMat = new THREE.MeshStandardMaterial({ color: defColor, roughness: 0.55, metalness: 0.05 });
  for (var side = -1; side <= 1; side += 2) {
    var blob = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), defMat);
    blob.position.set(side * 0.12, -0.22, 0);
    blob.scale.set(0.8, 0.5, 0.8);
    group.add(blob);
  }

  return group;
}
