import * as THREE from "https://unpkg.com/three@0.162.0/build/three.module.js";

/**
 * 中式厨刀 / 片刀 — 竖直放置，刀刃朝下，适配备菜台 Y 轴切菜动画
 * 轮廓在 XY 平面，沿 Z 挤出（薄刃侧视剪影）
 */
export function createKnifeModel() {
  const group = new THREE.Group();

  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xd8dce4, metalness: 0.92, roughness: 0.22,
  });
  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0xf8f8fc, metalness: 0.97, roughness: 0.06,
  });
  const spineMat = new THREE.MeshStandardMaterial({
    color: 0x9a9ea8, metalness: 0.85, roughness: 0.32,
  });
  const bolsterMat = new THREE.MeshStandardMaterial({
    color: 0xb0b4bc, metalness: 0.9, roughness: 0.2,
  });
  const handleMat = new THREE.MeshStandardMaterial({
    color: 0x3d2810, metalness: 0.02, roughness: 0.72,
  });
  const rivetMat = new THREE.MeshStandardMaterial({
    color: 0xc8ccd4, metalness: 0.95, roughness: 0.1,
  });

  const extrudeOpts = {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.003,
    bevelSegments: 3,
  };

  // ── 刀身剪影（片刀：宽刃、弧腹、方背）──
  const bladeShape = new THREE.Shape();
  const tipY = -0.38;
  const heelY = 0.02;
  const halfW = 0.11;

  bladeShape.moveTo(0, tipY);
  bladeShape.quadraticCurveTo(halfW * 1.35, tipY + 0.14, halfW, heelY - 0.04);
  bladeShape.lineTo(halfW * 0.92, heelY);
  bladeShape.lineTo(-halfW * 0.92, heelY);
  bladeShape.quadraticCurveTo(-halfW * 1.35, tipY + 0.14, 0, tipY);

  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, extrudeOpts);
  bladeGeo.translate(0, 0, -0.011);
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  group.add(blade);

  // 刀刃斜面（更薄的一层贴在下缘）
  const edgeShape = new THREE.Shape();
  edgeShape.moveTo(0, tipY + 0.01);
  edgeShape.quadraticCurveTo(halfW * 1.2, tipY + 0.16, halfW * 0.88, heelY - 0.06);
  edgeShape.lineTo(-halfW * 0.88, heelY - 0.06);
  edgeShape.quadraticCurveTo(-halfW * 1.2, tipY + 0.16, 0, tipY + 0.01);

  const edgeGeo = new THREE.ExtrudeGeometry(edgeShape, {
    depth: 0.008,
    bevelEnabled: true,
    bevelThickness: 0.001,
    bevelSize: 0.001,
    bevelSegments: 2,
  });
  edgeGeo.translate(0, 0, -0.004);
  const edge = new THREE.Mesh(edgeGeo, edgeMat);
  group.add(edge);

  // 刀背加厚棱
  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(halfW * 1.7, 0.012, 0.026),
    spineMat
  );
  spine.position.set(0, heelY - 0.01, 0);
  group.add(spine);

  // ── 护手 / 刀箍 ──
  const bolster = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.04, 0.034),
    bolsterMat
  );
  bolster.position.set(0, 0.06, 0);
  group.add(bolster);

  const bolsterCurve = new THREE.Mesh(
    new THREE.TorusGeometry(0.055, 0.012, 8, 16, Math.PI),
    bolsterMat
  );
  bolsterCurve.rotation.x = Math.PI / 2;
  bolsterCurve.position.set(0, 0.04, 0);
  group.add(bolsterCurve);

  // ── 刀柄（椭圆截面柱体）──
  const handleLen = 0.2;
  const handleGeo = new THREE.CylinderGeometry(0.028, 0.032, handleLen, 14);
  handleGeo.scale(1, 1, 0.65);
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.position.set(0, 0.06 + handleLen / 2 + 0.02, 0);
  group.add(handle);

  // 柄头金属帽
  const pommel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.03, 0.018, 12),
    bolsterMat
  );
  pommel.position.set(0, 0.06 + handleLen + 0.03, 0);
  group.add(pommel);

  // 铆钉 ×3
  for (let i = 0; i < 3; i++) {
    const rivet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.042, 8),
      rivetMat
    );
    rivet.rotation.x = Math.PI / 2;
    rivet.position.set(0, 0.1 + i * 0.055, 0.022);
    group.add(rivet);
  }

  //  invisible 刀刃检测点
  const det = new THREE.Mesh(
    new THREE.BoxGeometry(halfW * 1.6, 0.006, 0.01),
    edgeMat
  );
  det.position.set(0, tipY + 0.02, 0);
  det.visible = false;
  det.name = "knifeEdge";
  det.userData = { isCuttingEdge: true };
  group.add(det);

  group.scale.set(1.15, 1.15, 1.15);
  group.name = "knife";
  group.userData = {
    slicing: false,
    slicePhase: 0,
    restPos: new THREE.Vector3(0, 0.58, 0.2),
    restRot: new THREE.Euler(0, 0, 0),
  };

  return group;
}

export function getKnifeEdgeBox(knifeMesh) {
  if (!knifeMesh) return null;
  let ec = null;
  knifeMesh.traverse((c) => { if (c.name === "knifeEdge") ec = c; });
  if (!ec) return null;
  return new THREE.Box3().setFromObject(ec);
}
