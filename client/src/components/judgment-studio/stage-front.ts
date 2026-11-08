import * as THREE from "three";
import type { SceneHelpers, SceneModel, StageState } from "./studio-types";
import { createDicingExample } from "./wafer-dicing-example";

// Original teaching geometry. Factory layouts, scales and motion are not replicas
// or operating recipes. Inspection records never drive physical process geometry.
// Concepts checked against Samsung's wafer-manufacturing article, ASML's
// lithography-principles page, and Lam's Kiyo RIE product-family page.
const unit = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const lerp = (from: number, to: number, seconds: number, reduced: boolean) =>
  reduced ? to : THREE.MathUtils.lerp(from, to, 1 - Math.exp(-Math.min(.12, Math.max(.001, seconds)) * 9));
// The host pauses this teaching clock when the reaction button is released.
// Keep its phase instead of switching clocks, so particles resume in place.
const motion = (state: StageState, time: number) => state.reducedMotion ? state.progress * 9 : time;
const loadingTarget = (state: StageState & { loadProgress?: number }) =>
  state.setup >= 1 ? 1 : unit(state.loadProgress ?? 0);

export function siliconWaferMaterial(template: THREE.MeshPhysicalMaterial) {
  const material = template.clone();
  material.color.set(0x818b94);
  material.metalness = .78;
  material.roughness = .19;
  material.iridescence = .08;
  material.clearcoat = .25;
  return material;
}

export function siliconWaferGeometry(radius: number, thickness: number) {
  const shape = new THREE.Shape();
  const notchAngle = .017;
  for (let i = 0; i <= 128; i++) {
    const angle = -Math.PI / 2 + notchAngle + i / 128 * (Math.PI * 2 - 2 * notchAngle);
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.quadraticCurveTo(-radius * .006, -radius * .984, 0, -radius * .984);
  shape.quadraticCurveTo(radius * .006, -radius * .984, Math.sin(notchAngle) * radius, -Math.cos(notchAngle) * radius);
  shape.closePath();
  return horizontalLayer(shape, thickness);
}

function horizontalLayer(shape: THREE.Shape, thickness: number) {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -thickness / 2, 0);
  return geometry;
}

function waferStripGeometry(index: number, thickness: number) {
  const radius = .91;
  const left = radius * (2 * index / 9 - 1), right = radius * (2 * (index + 1) / 9 - 1);
  const shape = new THREE.Shape();
  const edge = (x: number) => Math.sqrt(Math.max(0, radius ** 2 - x ** 2));
  shape.moveTo(left, edge(left));
  for (let i = 1; i <= 12; i++) {
    const x = THREE.MathUtils.lerp(left, right, i / 12);
    shape.lineTo(x, edge(x));
  }
  for (let i = 12; i >= 0; i--) {
    const x = THREE.MathUtils.lerp(left, right, i / 12);
    shape.lineTo(x, -edge(x));
  }
  shape.closePath();
  return horizontalLayer(shape, thickness);
}

function geometry(root: THREE.Group, h: SceneHelpers) {
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = root) => {
    const object = new THREE.Mesh(geo, mat); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  };
  const box = (w: number, y: number, d: number, mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = root) => h.box(w, y, d, mat, p, parent);
  const cylinder = (radius: number, height: number, mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = root) => h.cylinder(radius, height, mat, p, parent);
  const ring = (radius: number, tube: number, mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = root) => {
    const m = mesh(new THREE.TorusGeometry(radius, tube, 8, 64), mat, parent); m.rotation.x = Math.PI / 2; m.position.set(...p); return m;
  };
  const tube = (points: [number, number, number][], radius: number, mat: THREE.Material, parent: THREE.Object3D = root) => {
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 28, radius, 8, false), mat, parent);
  };
  const ball = (radius: number, mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = root) => {
    const m = mesh(new THREE.SphereGeometry(radius, 10, 7), mat, parent); m.position.set(...p); m.castShadow = false; return m;
  };
  const bolts = (cx: number, y: number, cz: number, radius: number, count = 12) => {
    for (let i = 0; i < count; i++) { const a = i / count * Math.PI * 2; cylinder(.034, .038, h.steel, [cx + Math.cos(a) * radius, y, cz + Math.sin(a) * radius]); }
  };
  const stand = (x: number, z: number, width: number, depth: number) => {
    box(width, .38, depth, h.dark, [x, .32, z]);
    box(width - .13, .08, depth - .12, h.steel, [x, .55, z]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cylinder(.09, .25, h.dark, [x + sx * (width / 2 - .18), .08, z + sz * (depth / 2 - .18)]);
  };
  return { mesh, box, cylinder, ring, tube, ball, bolts, stand };
}

function waferScene(h: SceneHelpers): SceneModel {
  const root = new THREE.Group(); root.name = "wafer-surface-finishing-and-inspection";
  const { mesh, box, cylinder, ring, tube, ball, bolts, stand } = geometry(root, h);
  const padMat = h.material(0x314b42, .13, .83), ceramic = h.material(0xc4cfc5, .08, .5);
  const pale = h.material(0x9ab3ad, .43, .4), silicon = h.material(0x314f69, .5, .34);
  const scannerLight = new THREE.MeshBasicMaterial({ color: 0x8ee8c3, transparent: true, opacity: .7, depthWrite: false });
  const slurryMat = new THREE.MeshStandardMaterial({ color: 0xa7e0d0, transparent: true, opacity: .78, roughness: .26, depthWrite: false });
  const wetMat = slurryMat.clone(); wetMat.opacity = .34;
  const waferMaterial = siliconWaferMaterial(h.wafer);
  const sampleMaterial = h.material(0x5e7887, .18, .66);
  const waferRadius = 1.06, padRadius = 1.29;
  const padX = -1.15, headX = padX, headZ = -.16, shaftTop = 2.59;

  // Rotary surface-finishing station with visible pad, carrier, supply and arm.
  stand(-2.22, .09, 5.64, 3.55);
  const pad = new THREE.Group(); pad.position.set(padX, .8, 0); root.add(pad);
  cylinder(1.37, .26, h.steel, [0, -.08, 0], pad);
  const padFace = cylinder(padRadius, .105, padMat, [0, .1, 0], pad);
  ring(1.32, .045, ceramic, [0, .1, 0], pad);
  for (let r = .2; r < 1.23; r += .17) ring(r, .002, pale, [0, .1515, 0], pad);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const groove = box(1.17, .002, .012, pale, [Math.cos(a) * .65, .152, Math.sin(a) * .65], pad); groove.rotation.y = -a;
  }
  cylinder(.31, .25, h.dark, [padX, .67, 0]);
  box(.30, 2.88, .20, h.steel, [headX, 1.9, -1.47]);
  box(.48, .20, 1.62, h.steel, [headX, 3.2, -.76]);
  const raisedHeadY = 2.02, waferOffset = .155, waferThickness = .009;
  const raisedWaferY = raisedHeadY - waferOffset;
  const contactHeadY = .9525 + waferOffset + waferThickness / 2;
  const motor = cylinder(.235, .47, h.dark, [headX, 2.88, headZ]);
  motor.name = "polishing-spindle-motor";
  for (const y of [2.72, 2.83, 2.94, 3.06]) ring(.232, .016, h.steel, [headX, y, headZ]);
  cylinder(.164, .24, h.steel, [headX, 2.60, headZ]);
  const driveShaft = cylinder(.106, 1, pale, [headX, 0, headZ]);
  driveShaft.name = "polishing-telescoping-drive-shaft";
  const carrier = new THREE.Group(); carrier.name = "polishing-head"; root.add(carrier);
  const headShell = h.dark.clone(), headCap = h.steel.clone();
  const headRim = h.gold.clone(), headBolts = pale.clone();
  const cutawayMaterials = [
    { material: headShell, opacity: .2 },
    { material: headCap, opacity: .28 },
    { material: headRim, opacity: .46 },
    { material: headBolts, opacity: .5 },
  ];
  cylinder(waferRadius + .048, .24, headShell, [0, 0, 0], carrier);
  cylinder(waferRadius * .77, .19, headCap, [0, .19, 0], carrier);
  const backingThickness = .034;
  cylinder(waferRadius - .005, backingThickness, headShell, [0, -waferOffset + (waferThickness + backingThickness) / 2, 0], carrier);
  ring(waferRadius + .028, .032, headRim, [0, -.092, 0], carrier);
  const boltRadius = waferRadius - .045;
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2;
    cylinder(.027, .025, headBolts, [Math.cos(angle) * boltRadius, .13, Math.sin(angle) * boltRadius], carrier);
  }
  const cutawayParts = [...carrier.children];
  const spindleCollar = cylinder(.18, .066, h.dark, [0, .313, 0], carrier);
  spindleCollar.name = "polishing-head-spindle-collar";
  const waferGeometry = siliconWaferGeometry(waferRadius, waferThickness);
  const rawWafer = mesh(waferGeometry, waferMaterial);
  rawWafer.name = "wafer-on-polishing-carrier";
  const edgeMaterial = new THREE.MeshBasicMaterial({
    color: 0x65ffdf, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
  });
  const contactMarker = ring(waferRadius - .015, .013, edgeMaterial, [0, waferThickness / 2 + .002, 0], rawWafer);
  contactMarker.name = "wafer-contact-highlight";
  contactMarker.renderOrder = 3;
  contactMarker.castShadow = contactMarker.receiveShadow = false;

  const rackX = -3.68, rackZ = .76, forkY = raisedWaferY - (waferThickness + .055) / 2;
  const forkReturnX = rackX - .42, forkReturnZ = .65;
  const forkParkX = rackX - .34, forkParkZ = -.5, forkBackZ = -.98;
  const waferDiameter = waferRadius * 2, rackSide = waferRadius + .048;
  box(1.24, .55, 1.24, h.dark, [rackX, .86, rackZ]);
  box(waferDiameter + .20, .08, waferDiameter + .08, h.steel, [rackX, 1.17, rackZ]);
  for (const x of [rackX - rackSide, rackX + rackSide]) {
    box(.07, .56, waferDiameter - .08, h.dark, [x, 1.48, rackZ]);
    for (let i = 0; i < 5; i++) box(.16, .036, waferDiameter - .18, h.steel, [x, 1.27 + i * .11, rackZ]);
  }
  for (let i = 0; i < 5; i++) {
    const wafer = mesh(waferGeometry, waferMaterial);
    wafer.position.set(rackX, 1.288 + waferThickness / 2 + i * .11, rackZ);
  }
  const fork = new THREE.Group(); fork.name = "wafer-transfer-fork"; root.add(fork);
  for (const x of [-.45, .45]) box(.11, .055, 1.84, h.steel, [x, 0, -.04], fork);
  box(1.02, .066, .12, h.dark, [0, 0, forkBackZ], fork);
  const transferPivotX = rackX, transferPivotZ = -.69;
  cylinder(.18, .94, h.dark, [transferPivotX, 1.06, transferPivotZ]);
  cylinder(.135, .31, h.steel, [transferPivotX, 1.675, transferPivotZ]);
  const transferArm = box(.15, .062, 1, h.steel, [0, forkY, 0]);
  transferArm.name = "wafer-transfer-arm";

  // An example dispense location on the exposed pad, clear of the offset carrier.
  const dispenseX = padX, dispenseZ = padRadius - .185, nozzleBottom = 1.48, padSurface = .966;
  const pumpX = .13, pumpZ = 1.14;
  const pump = box(.58, .57, .62, h.dark, [pumpX, .875, pumpZ]);
  pump.name = "slurry-supply-pump";
  box(.46, .13, .04, h.steel, [pumpX, .99, pumpZ + .325]);
  cylinder(.155, .34, h.steel, [pumpX, 1.305, pumpZ]);
  ring(.155, .021, h.gold, [pumpX, 1.375, pumpZ]);
  const slurryLine = tube([[pumpX, 1.46, pumpZ], [pumpX, 1.72, pumpZ], [-.30, 1.75, 1.26], [-.77, 1.75, 1.23], [dispenseX, 1.63, dispenseZ]], .043, h.cyan);
  slurryLine.name = "slurry-supply-line";
  cylinder(.073, .18, h.gold, [dispenseX, nozzleBottom + .09, dispenseZ]);
  cylinder(.039, .05, h.dark, [dispenseX, nozzleBottom + .009, dispenseZ]);
  const slurryStream = mesh(new THREE.CylinderGeometry(.016, .027, nozzleBottom - padSurface, 12), wetMat);
  slurryStream.name = "slurry-stream-to-exposed-pad";
  slurryStream.position.set(dispenseX, (nozzleBottom + padSurface) / 2, dispenseZ); slurryStream.castShadow = false;
  const slurryDrops: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) slurryDrops.push(ball(.028, slurryMat, [dispenseX, nozzleBottom, dispenseZ]));
  const wetSpot = cylinder(.13, .009, wetMat, [dispenseX, padSurface + .006, dispenseZ]); wetSpot.castShadow = false;
  const slurryTraces = Array.from({ length: 18 }, () => ball(.046, wetMat, [dispenseX, padSurface, dispenseZ]));
  bolts(-1.15, .61, 0, 1.48, 10);

  // A small cross-section of the surface, with a continuous height profile.
  stand(2.0, .2, 2.7, 2.55);
  box(2.42, .325, 2.11, h.dark, [2, .7525, .2]);
  const surfaceX = 2, surfaceY = .75, surfaceZ = .2, sampleBase = .358, sampleHalfThickness = .023;
  const surface = new THREE.Group(); surface.position.set(surfaceX, surfaceY, surfaceZ); root.add(surface);
  const macroBase = box(2.25, .17, 1.94, silicon, [0, .25, 0], surface);
  macroBase.name = "magnified-surface-cross-section";
  const sampleGeometry = new THREE.BoxGeometry(2.25, .046, 1.94, 46, 1, 40);
  const samplePositions = sampleGeometry.getAttribute("position") as THREE.BufferAttribute;
  const asperity = (x: number, z: number, cx: number, cz: number, width: number, height: number) =>
    height * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / width);
  const surfaceRelief = (x: number, z: number) => .01 +
    asperity(x, z, -.76, -.32, .052, .044) +
    asperity(x, z, -.22, .43, .096, .056) +
    asperity(x, z, .09, -.53, .073, .049) +
    asperity(x, z, .66, .07, .14, .055) +
    asperity(x, z, .84, -.65, .034, .028);
  const reliefAmount = (progress: number) => 1 - progress * .96;
  const heightAt = (x: number, z: number, progress: number) =>
    surfaceY + sampleBase + sampleHalfThickness + surfaceRelief(x - surfaceX, z - surfaceZ) * reliefAmount(progress);
  const surfaceOffsets: { index: number; height: number }[] = [];
  for (let index = 0; index < samplePositions.count; index++) {
    if (samplePositions.getY(index) < 0) continue;
    const x = samplePositions.getX(index), z = samplePositions.getZ(index);
    surfaceOffsets.push({ index, height: surfaceRelief(x, z) });
  }
  const sample = mesh(sampleGeometry, sampleMaterial, surface);
  sample.name = "continuous-surface-height-profile"; sample.position.y = sampleBase;
  sample.castShadow = false;
  box(2.22, .013, .013, pale, [0, .337, .975], surface);
  const scanZ = .54, lensBottom = 1.368;
  for (const x of [.72, 3.28]) box(.11, 1.09, .13, h.steel, [x, 1.11, scanZ]);
  box(2.67, .085, .14, h.steel, [2, 1.68, scanZ]);
  const scanner = new THREE.Group(); scanner.name = "surface-inspection-carriage"; root.add(scanner);
  box(.31, .10, .22, h.steel, [0, 1.68, 0], scanner);
  box(.34, .20, .32, h.dark, [0, 1.54, 0], scanner);
  const scanLens = cylinder(.082, .072, h.glass, [0, lensBottom + .036, 0], scanner);
  scanLens.name = "surface-inspection-lens"; scanLens.castShadow = false;
  const beamMaterial = scannerLight.clone(); beamMaterial.opacity = .32;
  const beam = mesh(new THREE.CylinderGeometry(.071, .009, 1, 16, 1, true), beamMaterial, scanner);
  beam.name = "surface-inspection-beam"; beam.castShadow = false;
  const scanStripe = h.line(Array.from({ length: 41 }, (_, i) => [0, 0, surfaceZ - scanZ + (i / 40 - .5) * 1.84]), 0x8ee8c3, scanner);
  scanStripe.name = "surface-inspection-line";
  const target = ball(.029, new THREE.MeshBasicMaterial({ color: 0xffcc74 }), [0, 0, 0], scanner);
  target.name = "surface-inspection-target";
  const dicingTape = createDicingExample(h, root);
  let load = 0, headY = raisedHeadY, lastSurfaceProgress = -1, lastScanX = NaN, lastScanProgress = -1;
  let targetLoad = load, targetHeadY = headY, cutawayVisible = false;
  return {
    root,
    get settling() {
      return load !== targetLoad || headY !== targetHeadY;
    },
    hotspots: [
      { id: "load", object: rawWafer, label: ["웨이퍼 이송과 연마 헤드", "Wafer transfer and polishing head", "ウェーハ搬送と研磨ヘッド"] },
      { id: "process", object: padFace, label: ["회전 연마 패드", "Rotating polishing pad", "回転研磨パッド"] },
      { id: "inspect", object: macroBase, label: ["표면 확대와 광학 검사", "Surface close-up and optical inspection", "表面拡大と光学検査"] },
      { id: "dicing", object: dicingTape, label: ["후공정 예시 · 절단한 다이", "Later example · separated dies", "後工程の例・分割したダイ"] },
    ],
    views: {
      overview: { position: [5.95, 5.5, 9.4], target: [-.50, 1.48, .4] },
      detail: { position: [4.95, 3.85, 4.02], target: [headX, 1.40, headZ] },
      inspection: { position: [2.68, 3.82, 5.02], target: [2.02, 1.48, .20] },
      dicing: { position: [2.65, 3.55, 5.69], target: [2, .57, 2.43] },
    },
    update(state, seconds, time) {
      targetLoad = loadingTarget(state);
      load = lerp(load, targetLoad, seconds, state.reducedMotion);
      if (Math.abs(load - targetLoad) < .001) load = targetLoad;
      const prepared = state.setup >= 2;
      const lowerAfterTransfer = prepared ? unit((load - .94) / .06) : 0;
      targetHeadY = THREE.MathUtils.lerp(raisedHeadY, contactHeadY, lowerAfterTransfer);
      headY = lerp(headY, targetHeadY, seconds, state.reducedMotion || state.phase !== "prepare");
      if (Math.abs(headY - targetHeadY) < .001) headY = targetHeadY;
      carrier.position.set(headX, headY, headZ);
      // Make the contact readable without changing the wafer or pad geometry.
      const contactView = state.phase === "prepare" || state.phase === "react";
      const reveal = contactView ? THREE.MathUtils.smoothstep(raisedHeadY - headY, .025, .58) : 0;
      const showCutaway = reveal > 0;
      if (showCutaway !== cutawayVisible) {
        cutawayVisible = showCutaway;
        for (const { material } of cutawayMaterials) {
          material.transparent = showCutaway;
          material.depthWrite = !showCutaway;
          material.needsUpdate = true;
        }
        for (const part of cutawayParts) part.castShadow = !showCutaway;
      }
      for (const { material, opacity } of cutawayMaterials) {
        material.opacity = THREE.MathUtils.lerp(1, opacity, reveal);
      }
      contactMarker.visible = showCutaway;
      edgeMaterial.opacity = .92 * reveal;
      const shaftBottom = headY + .333;
      driveShaft.position.y = (shaftTop + shaftBottom) / 2;
      driveShaft.scale.y = shaftTop - shaftBottom;
      const handoff = .84, travel = unit(load / handoff), retract = unit((load - handoff) / (1 - handoff));
      const returnPoint = unit(retract / .65), parkPoint = unit((retract - .65) / .35);
      const forkX = THREE.MathUtils.lerp(THREE.MathUtils.lerp(rackX, headX, travel), forkReturnX, returnPoint);
      const forkZ = THREE.MathUtils.lerp(THREE.MathUtils.lerp(rackZ, headZ, travel), forkReturnZ, returnPoint);
      fork.position.set(THREE.MathUtils.lerp(forkX, forkParkX, parkPoint), forkY, THREE.MathUtils.lerp(forkZ, forkParkZ, parkPoint));
      const armX = fork.position.x - transferPivotX, armZ = fork.position.z + forkBackZ - transferPivotZ;
      transferArm.position.set(transferPivotX + armX / 2, forkY, transferPivotZ + armZ / 2);
      transferArm.rotation.y = Math.atan2(armX, armZ);
      transferArm.scale.z = Math.hypot(armX, armZ);
      rawWafer.position.set(THREE.MathUtils.lerp(rackX, headX, travel), travel === 1 ? headY - waferOffset : raisedWaferY, THREE.MathUtils.lerp(rackZ, headZ, travel));
      const p = unit(state.progress), t = motion(state, time);
      const reactionVisible = state.phase === "react" && p > 0 && p < 1;
      pad.rotation.y = t * 1.25;
      carrier.rotation.y = -t * .6;
      rawWafer.rotation.y = travel === 1 ? carrier.rotation.y : 0;
      if (p !== lastSurfaceProgress) {
        for (const { index, height } of surfaceOffsets) samplePositions.setY(index, sampleHalfThickness + height * reliefAmount(p));
        samplePositions.needsUpdate = true;
        sampleGeometry.computeVertexNormals();
        sampleGeometry.computeBoundingSphere();
        sampleMaterial.roughness = .66 - p * .22;
        lastSurfaceProgress = p;
      }
      slurryStream.visible = wetSpot.visible = reactionVisible && prepared && headY <= contactHeadY + .018;
      slurryDrops.forEach((drop, i) => {
        drop.visible = slurryStream.visible;
        const fall = (t * 2 + i / slurryDrops.length) % 1;
        drop.position.y = nozzleBottom - fall * (nozzleBottom - padSurface);
      });
      slurryTraces.forEach((trace, i) => {
        const spread = (t * .75 + i / slurryTraces.length) % 1;
        const angle = spread * 1.6;
        const radius = dispenseZ + spread * .07 + (i % 3 - 1) * .035;
        trace.visible = slurryStream.visible;
        trace.position.set(padX + Math.sin(angle) * radius, padSurface + .006, Math.cos(angle) * radius);
        trace.rotation.y = angle;
        trace.scale.set(1.55 + spread * 2, .18, .7 + spread);
      });
      const scanX = THREE.MathUtils.lerp(1.01, 2.99, unit(state.parameter));
      const spotHeight = heightAt(scanX, scanZ, p);
      scanner.position.set(scanX, 0, scanZ);
      beam.scale.y = lensBottom - spotHeight;
      beam.position.y = (lensBottom + spotHeight) / 2;
      beam.visible = state.setup >= 3;
      if (scanX !== lastScanX || p !== lastScanProgress) {
        const points = scanStripe.geometry.getAttribute("position");
        for (let i = 0; i < points.count; i++) points.setY(i, heightAt(scanX, scanZ + points.getZ(i), p) + .004);
        points.needsUpdate = true;
        scanStripe.geometry.computeBoundingSphere();
        lastScanX = scanX; lastScanProgress = p;
      }
      target.position.y = spotHeight + .01;
      scanStripe.visible = target.visible = state.setup >= 3 || state.focus === "inspection";
    },
  };
}

function photoScene(h: SceneHelpers): SceneModel {
  const root = new THREE.Group(); root.name = "projection-lithography-and-positive-resist-development";
  const { mesh, box, cylinder, ring, tube, ball, stand } = geometry(root, h);
  const ceramic = h.material(0xd2d6ca, .08, .53), maskMat = h.material(0x44534e, .6, .29);
  const purple = h.material(0x715198, .12, .36), exposed = h.material(0xbb88bd, .05, .45);
  const silicon = h.material(0x38586f, .45, .36);
  const targetFilm = h.material(0x5a9590, .26, .47);
  const uv = new THREE.MeshBasicMaterial({ color: 0xad9eff, transparent: true, opacity: .17, depthWrite: false, side: THREE.DoubleSide });
  const uvLine = new THREE.MeshBasicMaterial({ color: 0xc6b5ff, transparent: true, opacity: .65, depthWrite: false });
  const alignmentMat = new THREE.MeshBasicMaterial({ color: 0x8de8be, depthWrite: false });
  const lensMat = h.glass.clone(); lensMat.color.set(0x95bdc8); lensMat.opacity = .3;

  stand(-1.05, -.1, 3.6, 3.1);
  box(2.7, .15, 2.45, ceramic, [-1.05, .7, -.1]);
  for (const x of [-2.5, .42]) for (const z of [-1.25, 1.0]) cylinder(.1, 3.65, h.steel, [x, 2.48, z]);
  box(3.3, .26, 2.65, h.dark, [-1.05, 4.35, -.1]);
  for (const z of [-.62, .62]) box(2.65, .07, .1, h.steel, [-1.05, .86, z]);
  const stage = new THREE.Group(); root.add(stage);
  box(2.4, .2, 2.0, h.dark, [0, 0, 0], stage);
  cylinder(1.04, .1, ceramic, [0, .144, 0], stage);
  const waferCarrier = new THREE.Group(); stage.add(waferCarrier);
  waferCarrier.name = "wafer-transfer-between-exposure-and-development";
  const wafer = mesh(siliconWaferGeometry(.96, .024), siliconWaferMaterial(h.wafer), waferCarrier);
  wafer.position.y = .206;
  cylinder(.93, .012, targetFilm, [0, .226, 0], waferCarrier);
  const transferFork = new THREE.Group(); waferCarrier.add(transferFork);
  box(2.27, .055, .11, h.steel, [0, .143, -.67], transferFork);
  for (const x of [-.53, .53]) box(.18, .06, 1.45, h.steel, [x, .164, 0], transferFork);
  cylinder(.46, .18, h.dark, [-1.05, 4.6, -.1]);
  const lens = new THREE.Group(); lens.position.set(-1.05, 2.65, -.1); root.add(lens);
  for (let i = 0; i < 5; i++) {
    ring(.32 + i * .038, .052, h.dark, [0, .52 - i * .23, 0], lens);
    const glass = cylinder(.3 + i * .03, .025, lensMat, [0, .45 - i * .23, 0], lens); glass.castShadow = false;
    ring(.33 + i * .038, .018, h.steel, [0, .55 - i * .23, 0], lens);
  }
  const projection = mesh(new THREE.CylinderGeometry(.22, .91, .94, 40, 1, true), uv); projection.position.set(-1.05, 1.735, -.1); projection.castShadow = false;
  projection.name = "projected-exposure-light";
  const illumination = mesh(new THREE.CylinderGeometry(.19, .61, .81, 40, 1, true), uv);
  illumination.position.set(-1.05, 4.04, -.1); illumination.castShadow = false;
  const incoming = mesh(new THREE.CylinderGeometry(.61, .28, .39, 40, 1, true), uv);
  incoming.position.set(-1.05, 3.37, -.1); incoming.castShadow = false;
  const sourceGlow = cylinder(.21, .045, uvLine, [-1.05, 4.48, -.1]); sourceGlow.castShadow = false;
  const mask = new THREE.Group(); root.add(mask);
  mask.name = "reticle-on-alignment-rails";
  for (const z of [-1.03, .83]) {
    box(4.43, .06, .09, h.dark, [-.35, 3.56, z]);
    for (const x of [-2.5, .42]) box(.13, .08, .47, h.steel, [x, 3.55, z]);
  }
  for (const z of [-.91, .91]) box(1.68, .06, .24, h.steel, [0, -.025, z], mask);
  for (const z of [-.76, .76]) box(2.23, .068, .12, maskMat, [0, 0, z], mask);
  for (const x of [-1.06, 1.06]) box(.12, .068, 1.41, maskMat, [x, 0, 0], mask);
  const reticleGlass = box(2.01, .035, 1.41, lensMat, [0, 0, 0], mask);
  reticleGlass.castShadow = false;
  for (let i = 0; i < 5; i++) box(.20, .026, 1.37, h.gold, [-.80 + i * .4, .022, 0], mask);
  box(.3, .12, .42, h.steel, [1.18, 0, 0], mask);
  const developedStripes: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const stripe = mesh(waferStripGeometry(i, .013), i % 2 ? exposed : purple, waferCarrier);
    stripe.userData.exposed = i % 2 === 1;
    stripe.name = stripe.userData.exposed ? "exposed-positive-resist" : "unexposed-positive-resist";
    developedStripes.push(stripe);
  }
  const waferTarget = new THREE.Group(); waferCarrier.add(waferTarget);
  box(.35, .014, .024, h.gold, [.6, .263, .56], waferTarget);
  box(.024, .014, .35, h.gold, [.6, .263, .56], waferTarget);
  const projectedTarget = new THREE.Group(); waferCarrier.add(projectedTarget);
  box(.3, .014, .018, alignmentMat, [.6, .278, .56], projectedTarget);
  box(.018, .014, .3, alignmentMat, [.6, .278, .56], projectedTarget);

  // This teaching sequence moves the wafer from the scanner to a separate
  // wet-development cup. The cup's rim sits below the transfer path.
  const developZ = 2.03, developerOutlet = 1.94;
  stand(-1.05, developZ, 2.47, 2.06);
  cylinder(.91, .105, h.steel, [-1.05, .639, developZ]);
  cylinder(1.06, .21, h.dark, [-1.05, .79, developZ]);
  cylinder(.92, .09, h.steel, [-1.05, .93, developZ]);
  ring(1.02, .042, h.steel, [-1.05, 1.065, developZ]);
  cylinder(.18, .204, h.steel, [-1.05, 1.077, developZ]);
  const developerChuck = cylinder(.375, .035, h.dark, [-1.05, 1.1965, developZ]);
  developerChuck.name = "development-cup-wafer-chuck";
  for (const x of [-2.18, .08]) {
    box(.082, .062, 3.08, h.steel, [x, 1.105, .59]);
    for (const z of [-.71, .79, 1.93]) box(.105, .50, .12, h.dark, [x, .841, z]);
  }
  tube([[-2.25, .83, developZ], [-2.25, 1.84, developZ], [-1.81, 2.05, developZ], [-1.05, 2.03, developZ]], .052, h.steel);
  cylinder(.065, .15, h.gold, [-1.05, developerOutlet + .065, developZ]);
  const solvent = new THREE.MeshStandardMaterial({color:0x93ddc5,transparent:true,opacity:.67,depthWrite:false,roughness:.27});
  const cupDrops = Array.from({ length: 9 }, () => {
    const drop = ball(.032, solvent, [-1.05, developerOutlet, developZ]);
    drop.name = "developer-drop-in-separate-cup";
    return drop;
  });

  // Enlarged positive-resist example. Development removes the exposed resist,
  // while the silicon underneath keeps exactly the same dimensions.
  stand(2.3, .35, 2.75, 2.8);
  const section = new THREE.Group(); section.position.set(2.3, .8, .35); root.add(section);
  const siliconBase = box(2.7, .33, 2, silicon, [0, .2, 0], section);
  box(2.67, .14, 1.98, targetFilm, [0, .435, 0], section);
  const filmTop = .505, resistHeight = .26;
  for (let x = 0; x < 9; x++) for (let y = 0; y < 2; y++) ball(.026, ceramic, [-1.03 + x * .255, .12 + y * .12, 1.02], section);
  const removed: THREE.Mesh[] = [];
  for (let x = 0; x < 9; x++) {
    const m = box(.26, resistHeight, 1.94, x % 2 ? exposed : purple, [-1.04 + x * .26, filmTop + resistHeight / 2, 0], section);
    if (x % 2) removed.push(m);
  }
  const miniMask = new THREE.Group(); section.add(miniMask);
  for (let i = 0; i < 5; i++) box(.25, .065, 2.0, maskMat, [-1.04 + i * .52, 1.7, 0], miniMask);
  for (const z of [-1.06, 1.06]) box(2.62, .075, .1, h.steel, [0, 1.7, z], miniMask);
  for (const x of [-1.3, 1.3]) box(.1, .075, 2.13, h.steel, [x, 1.7, 0], miniMask);
  const rays: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const m = box(.103, .91, 1.9, uv, [-.78 + i * .52, 1.222, 0], section); m.castShadow = false; rays.push(m);
  }
  const solventDrops: THREE.Mesh[] = [];
  for (let i = 0; i < 20; i++) solventDrops.push(ball(.024, solvent, [0, 1.6, 0], section));
  const resistColor = purple.color.clone(), exposedColor = exposed.color.clone();
  let load = 0;
  return {
    root,
    hotspots: [
      { id: "load", object: wafer, label: ["웨이퍼 스테이지", "Wafer stage", "ウェーハステージ"] },
      { id: "process", object: mask, label: ["마스크와 투영 광학계", "Mask and projection optics", "マスクと投影光学系"] },
      { id: "inspect", object: siliconBase, label: ["감광막 패턴 확대", "Photoresist pattern close-up", "レジストパターンの拡大"] },
    ],
    views: {
      overview: { position: [6.9, 5.3, 9.3], target: [.15, 1.9, .56] },
      detail: { position: [6.1, 4.8, 8.3], target: [.39, 1.7, .68] },
      inspection: { position: [4.14, 3.12, 4.83], target: [2.3, 1.61, .35] },
    },
    update(state, seconds, time) {
      load = lerp(load, loadingTarget(state), seconds, state.reducedMotion);
      // Offset the reference marks during setup. The exposure example uses a
      // centered pattern so its developed resist matches the etch example.
      const previewAlignment = state.phase === "prepare";
      const shift = previewAlignment ? (unit(state.parameter) - .5) * .65 : 0;
      stage.position.set(-2.9 + load * 1.85, 1.02, -.1);
      mask.position.set(-1.05 + shift + (state.setup >= 2 ? 0 : 1.5), 3.6, -.1);
      const p = unit(state.progress), exposedAt = .46, developAt = .60;
      const lit = state.phase === "react" && p > 0 && p < exposedAt && state.setup >= 3;
      const developing = state.phase === "react" && p >= developAt && p < 1;
      const exposure = unit(p / exposedAt), developed = unit((p - developAt) / (1 - developAt));
      const transit = unit((p - exposedAt) / (developAt - exposedAt));
      waferCarrier.position.z = (developZ + .1) * transit;
      transferFork.visible = transit > 0 && transit < 1;
      projection.visible = illumination.visible = incoming.visible = sourceGlow.visible = lit;
      exposed.color.copy(resistColor).lerp(exposedColor, exposure);
      developedStripes.forEach(stripe => {
        const remaining = stripe.userData.exposed ? 1 - developed : 1;
        stripe.visible = remaining > 0;
        stripe.scale.y = remaining;
        stripe.position.y = .232 + .0065 * remaining;
      });
      projectedTarget.position.x = shift * .45;
      projectedTarget.visible = previewAlignment;
      miniMask.position.x = shift * .45;
      miniMask.visible = p < exposedAt;
      removed.forEach((stripe) => {
        const remaining = 1 - developed;
        stripe.visible = remaining > 0;
        stripe.scale.y = remaining;
        stripe.position.y = filmTop + resistHeight * remaining / 2;
      });
      rays.forEach(ray => { ray.visible = lit; });
      const clock = motion(state, time);
      cupDrops.forEach((drop, i) => {
        drop.visible = developing;
        drop.position.y = developerOutlet - ((clock * 1.65 + i / cupDrops.length) % 1) * (developerOutlet - 1.27);
      });
      solventDrops.forEach((drop, i) => {
        drop.visible = developing;
        const fall = (clock * .7 + i / solventDrops.length) % 1;
        drop.position.set(-1.03 + (i % 8) * .285, 1.6 - fall * .81, -.7 + Math.floor(i / 8) * .7);
      });
    },
  };
}

function etchScene(h: SceneHelpers): SceneModel {
  const root = new THREE.Group(); root.name = "directional-plasma-etch-cutaway";
  const { mesh, box, cylinder, ring, tube, ball, bolts, stand } = geometry(root, h);
  const ceramic = h.material(0xbbc5bb, .06, .61), silicon = h.material(0x38586f, .45, .36);
  const maskMat = h.material(0x715198, .12, .36), targetFilm = h.material(0x5a9590, .26, .47);
  const chamberMat = h.material(0x566961, .5, .38);
  const gasMat = new THREE.MeshBasicMaterial({color:0x92dfbd,transparent:true,opacity:.8,depthWrite:false});
  const ionMat = new THREE.MeshBasicMaterial({color:0xe6bf7f,transparent:true,opacity:.86,depthWrite:false});
  const plasmaMat = new THREE.MeshBasicMaterial({color:0x9c87c6,transparent:true,opacity:.14,depthWrite:false,side:THREE.DoubleSide});
  const shellMat = h.glass.clone(); shellMat.color.set(0x7ea79b); shellMat.opacity = .08; shellMat.depthWrite = false;
  const rfMat = h.material(0xab7954, .6, .28); rfMat.emissive.set(0xdca166);

  stand(-1.05, 0, 3.15, 3.15);
  cylinder(1.24, .3, h.steel, [-1.05, .78, 0]);
  cylinder(1.13, .14, ceramic, [-1.05, 1.0, 0]);
  const chuckTop = 1.074, transferWaferY = 1.191, waferHalfThickness = .012;
  const chuck = cylinder(.94, .01, h.dark, [-1.05, chuckTop - .005, 0]);
  chuck.name = "etch-wafer-chuck";
  const liftPins = [[-.24, .13], [.24, .13], [0, -.25]].map(([x, z]) => {
    const pin = cylinder(.027, 1, h.steel, [-1.05 + x, chuckTop, z]);
    pin.name = "etch-wafer-lift-pin";
    return pin;
  });
  const waferGroup = new THREE.Group(); root.add(waferGroup);
  const wafer = mesh(siliconWaferGeometry(.96, .024), siliconWaferMaterial(h.wafer), waferGroup);
  const waferFilm: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const stripe = mesh(waferStripGeometry(i, .026), targetFilm, waferGroup);
    stripe.position.y = .025;
    stripe.name = i % 2 === 0 ? "mask-protected-target-film" : "exposed-target-film";
    if (i % 2 === 0) {
      const resist = mesh(waferStripGeometry(i, .014), maskMat, waferGroup);
      resist.position.y = .045;
      resist.name = "positive-resist-mask-from-lithography";
    } else waferFilm.push(stripe);
  }
  const backShell = mesh(new THREE.CylinderGeometry(1.27,1.27,1.50,48,1,true,Math.PI/2,Math.PI),chamberMat);
  backShell.position.set(-1.05,2.175,0);
  // The entry slot extends into the lower rear lip on the transfer side.
  const lowerBackShell = mesh(new THREE.CylinderGeometry(1.27,1.27,.35,48,1,true,Math.PI/2,Math.PI-.56),chamberMat);
  lowerBackShell.name = "etch-lower-chamber-wall-beside-entry";
  lowerBackShell.position.set(-1.05,1.25,0);
  const frontShell = mesh(new THREE.CylinderGeometry(1.27,1.27,1.50,48,1,true,-Math.PI/2,Math.PI),shellMat);
  frontShell.position.set(-1.05,2.175,0);frontShell.castShadow=false;
  ring(1.3,.055,h.steel,[-1.05,1.05,0]);ring(1.3,.055,h.steel,[-1.05,2.96,0]);
  const loadX = -3, loadZ = .9, travelX = 1.95, travelZ = -.9;
  const approachLength = Math.hypot(travelX, travelZ);
  const directionX = travelX / approachLength, directionZ = travelZ / approachLength;
  const port = new THREE.Group(); root.add(port);
  port.name = "etch-wafer-entry-slot";
  port.position.set(-1.05 - directionX * 1.28, 0, -directionZ * 1.28);
  port.rotation.y = Math.atan2(-directionX, -directionZ);
  for (const y of [1.048, 1.361]) box(2.22, .065, .14, h.steel, [0, y, 0], port);
  for (const x of [-1.063, 1.063]) box(.094, .31, .14, h.dark, [x, 1.205, 0], port);

  stand(-3.10, .9, 1.42, 1.52);
  box(1.42, .11, 1.44, h.steel, [-3.10, .94, .9]);
  for (const x of [-3.63, -2.57]) for (const z of [.34, 1.46]) box(.14, .322, .16, h.dark, [x, .741, z]);
  const pivotX = -3.65, pivotZ = 1.31, forkY = transferWaferY - .038;
  cylinder(.137, .17, h.dark, [pivotX, 1.08, pivotZ]);
  const fork = new THREE.Group(); root.add(fork);
  fork.name = "etch-wafer-transfer-fork";
  fork.rotation.y = Math.atan2(directionX, directionZ);
  for (const x of [-.51, .51]) box(.11, .052, 1.48, h.steel, [x, 0, -.05], fork);
  box(1.16, .048, .12, h.dark, [0, 0, -.79], fork);
  const forkArm = box(.14, .052, 1, h.steel, [pivotX, forkY, pivotZ]);
  forkArm.name = "etch-fork-drive-arm";
  cylinder(1.3,.15,h.steel,[-1.05,3.07,0]);
  cylinder(.78,.12,ceramic,[-1.05,2.88,0]);
  for (let i = 0; i < 10; i++) {
    const angle = i / 10 * Math.PI * 2;
    cylinder(.025,.018,h.dark,[-1.05 + Math.cos(angle) * .53,2.811,Math.sin(angle) * .53]);
  }
  for(let i=0;i<4;i++)ring(.89+i*.09,.028,rfMat,[-1.05,3.19+i*.06,0]);
  bolts(-1.05,3.16,0,1.14,12);
  const plasma=cylinder(.94,.56,plasmaMat,[-1.05,2.13,0]);plasma.castShadow=false;
  const gasStation=new THREE.Group();gasStation.position.set(-2.9,.8,-.25);root.add(gasStation);
  cylinder(.23,1.24,h.cyan,[0,.62,0],gasStation);cylinder(.25,.07,h.steel,[0,1.27,0],gasStation);
  const valve=box(.48,.06,.09,h.gold,[0,1.42,0],gasStation);
  tube([[-2.9,2.1,-.25],[-2.9,3.6,-.25],[-1.05,3.6,0],[-1.05,3.22,0]],.052,h.steel);
  const pump=cylinder(.38,.7,h.dark,[-2.5,.5,1.22]);pump.rotation.z=Math.PI/2;
  tube([[-1.15,.85,1.1],[-1.4,.62,1.3],[-2.45,.5,1.22]],.13,h.steel);
  for(let i=0;i<6;i++)ring(.19,.018,h.dark,[-2.1+i*.075,.5,1.22]).rotation.z=Math.PI/2;
  const gasParticles:THREE.Mesh[]=[];
  for(let i=0;i<22;i++)gasParticles.push(ball(.032,gasMat,[-1.05,2.2,0]));
  const chamberIons:THREE.Mesh[]=[];
  for(let i=0;i<27;i++) {
    const arrow=mesh(new THREE.ConeGeometry(.033,.13,7),ionMat);
    arrow.rotation.z=Math.PI;arrow.castShadow=false;
    arrow.name=i%9%2===0?"etch-chamber-ion-to-mask":"etch-chamber-ion-to-film";
    chamberIons.push(arrow);
  }

  // Magnified section: only unmasked columns recede. No time/pressure/RF recipe.
  stand(2.18,.3,2.7,2.9);
  const section=new THREE.Group();section.position.set(2.18,.8,.3);root.add(section);
  const base=box(2.7,.33,2,silicon,[0,.2,0],section);
  const filmBottom = .365, filmHeight = .58, openColumns:THREE.Mesh[]=[];
  for(let x=0;x<9;x++){
    const column=box(.26,filmHeight,1.98,targetFilm,[-1.04+x*.26,filmBottom + filmHeight / 2,0],section);
    if(x%2===0) box(.26,.12,1.94,maskMat,[-1.04+x*.26,filmBottom + filmHeight + .06,0],section);
    else openColumns.push(column);
  }
  for(let x=0;x<9;x++)ball(.025,ceramic,[-1.04+x*.26,.15,1.04],section);
  const detailIons:THREE.Object3D[]=[];
  for(let x=0;x<9;x++)for(let z=0;z<2;z++){
    const arrow=new THREE.Group();section.add(arrow);
    arrow.name=x%2===0?"etch-section-ion-to-mask":"etch-section-ion-to-film";
    const line=box(.015,.19,.015,ionMat,[0,.1,0],arrow);line.castShadow=false;
    const tip=mesh(new THREE.ConeGeometry(.04,.1,7),ionMat,arrow);tip.rotation.z=Math.PI;tip.position.y=-.04;tip.castShadow=false;
    arrow.position.set(-1.04+x*.26,1.6,-.58+z*1.12);
    detailIons.push(arrow);
  }
  const products:THREE.Mesh[]=[];
  for(let i=0;i<14;i++)products.push(ball(.025,gasMat,[0,1.2,0],section));
  const inspectLine=box(2.3,.012,.025,h.cyan,[0,1.02,0],section);inspectLine.castShadow=false;
  const observerFrame=box(.025,.8,.025,h.gold,[-1.23,.64,0],section);
  let load=0;
  return {
    root,
    hotspots:[
      {id:"load",object:wafer,label:["마스크가 있는 웨이퍼","Masked wafer","マスク付きウェーハ"]},
      {id:"process",object:valve,label:["가스 공급과 RF 역할","Gas supply and RF roles","ガス供給とRFの役割"]},
      {id:"inspect",object:base,label:["마스크 아래의 식각 단면","Etch section beneath the mask","マスク下のエッチング断面"]},
    ],
    views:{
      overview:{position:[6.8,5.0,9.0],target:[.1,1.55,.08]},
      detail:{position:[5.8,4.2,7.5],target:[.37,1.4,.24]},
      inspection:{position:[4.15,3.55,5.2],target:[2.18,1.8,.3]},
    },
    update(state,seconds,time){
      load=lerp(load,loadingTarget(state),seconds,state.reducedMotion);
      const handoff = .79, loweringStart = .91;
      const travel = unit(load / handoff), returnTravel = unit((load - handoff) / (loweringStart - handoff));
      const lowering = unit((load - loweringStart) / (1 - loweringStart));
      const waferY = THREE.MathUtils.lerp(transferWaferY, chuckTop + waferHalfThickness, lowering);
      waferGroup.position.set(loadX + travelX * travel, waferY, loadZ + travelZ * travel);
      const forkTravel = travel * (1 - returnTravel);
      fork.position.set(loadX + travelX * forkTravel, forkY, loadZ + travelZ * forkTravel);
      const armX = fork.position.x - .79 * directionX - pivotX;
      const armZ = fork.position.z - .79 * directionZ - pivotZ;
      forkArm.position.set(pivotX + armX / 2, forkY, pivotZ + armZ / 2);
      forkArm.rotation.y = Math.atan2(armX, armZ);
      forkArm.scale.z = Math.hypot(armX, armZ);
      const pinHeight = (transferWaferY - waferHalfThickness - chuckTop) * unit((load - .70) / (handoff - .70)) * (1 - lowering);
      liftPins.forEach(pin => {
        pin.visible = pinHeight > 0;
        pin.scale.y = Math.max(.001, pinHeight);
        pin.position.y = chuckTop + pinHeight / 2;
      });
      frontShell.visible=state.setup<2;
      const p=unit(state.progress),reactionVisible=state.phase==="react"&&state.setup>=3&&p>0&&p<1,t=motion(state,time);
      plasma.visible=reactionVisible;
      plasmaMat.opacity=reactionVisible?.19:.08;rfMat.emissiveIntensity=reactionVisible?1.4:.1;
      gasParticles.forEach((m,i)=>{
        m.visible=reactionVisible;
        const theta=i*2.399,tau=(t*.2+i/22)%1, r=.3+(i%5)*.12;
        m.position.set(-1.05+Math.cos(theta+tau*1.6)*r,2.7-tau*1.4,Math.sin(theta+tau*1.6)*r);
      });
      const remaining=1-p, exposedSurface=filmBottom + filmHeight * remaining;
      chamberIons.forEach((ion, i) => {
        const stripe = i % 9;
        const surfaceY = waferY + (stripe % 2 === 0 ? .052 : .012 + .026 * remaining);
        const flight = (t * .55 + i / chamberIons.length) % 1;
        ion.visible = reactionVisible;
        ion.position.set(-1.05 + .91 * (2 * (stripe + .5) / 9 - 1), THREE.MathUtils.lerp(2.4, surfaceY + .066, flight), -.35 + Math.floor(i / 9) * .35);
      });
      waferFilm.forEach(stripe=>{stripe.visible=remaining>0;stripe.scale.y=remaining;stripe.position.y=.012+.013*remaining;});
      openColumns.forEach(column=>{column.visible=remaining>0;column.scale.y=remaining;column.position.y=filmBottom+filmHeight*remaining/2;});
      detailIons.forEach((ion, i) => {
        const masked = Math.floor(i / 2) % 2 === 0;
        const surfaceY = masked ? filmBottom + filmHeight + .12 : exposedSurface;
        const flight = (t * .65 + i / detailIons.length) % 1;
        ion.visible = reactionVisible;
        ion.position.y = THREE.MathUtils.lerp(1.9, surfaceY + .091, flight);
      });
      products.forEach((m,i)=>{m.visible=reactionVisible&&p>.08;const tau=(t*.34+i/14)%1;const x=-.78+(i%4)*.52;m.position.set(x+Math.sin(i+tau*2)*tau*.15,exposedSurface+tau*.95,-.65+Math.floor(i/4)*.42);});
      inspectLine.position.z=(unit(state.parameter)-.5)*1.8;
      observerFrame.position.z=inspectLine.position.z;
      inspectLine.visible=state.focus!=="overview";observerFrame.visible=inspectLine.visible;
    },
  };
}

export function createFrontScene(process:"wafer"|"photo"|"etch",helpers:SceneHelpers):SceneModel {
  return process==="wafer"?waferScene(helpers):process==="photo"?photoScene(helpers):etchScene(helpers);
}
