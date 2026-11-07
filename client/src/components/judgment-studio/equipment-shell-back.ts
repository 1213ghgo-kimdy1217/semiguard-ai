import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { SceneHelpers } from "./studio-types";
import type { EquipmentShell } from "./equipment-shell-types";

type BackProcess = "deposition" | "metal" | "eds" | "packaging";
type Point = [number, number, number];
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const ease = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };

/** Original equipment-class teaching exteriors, not OEM replicas or opening SOPs.
 * References establish roles, not the dimensions or maintenance mechanisms:
 * https://www.appliedmaterials.com/il/en/product-library/producer-cvd.html
 * https://www.appliedmaterials.com/in/en/product-library/endura-pvd.html
 * https://www.tel.com/product/precio.html
 * https://semi.asmpt.com/en/news-center/press-releases/2024-08-21/
 */
export function createBackShell(process: BackProcess, helpers: SceneHelpers): EquipmentShell {
  if (process === "deposition") return depositionShell(helpers);
  if (process === "metal") return metalShell(helpers);
  if (process === "eds") return edsShell(helpers);
  return packagingShell(helpers);
}

function tools(h: SceneHelpers) {
  const root = new THREE.Group();
  const paint = h.material(0xc2cbc5, .22, .42), light = h.material(0xe0e5dc, .13, .4);
  const frame = h.material(0x34463f, .68, .32), trim = h.material(0x718980, .6, .32);
  const black = h.material(0x14221e, .3, .46), steel = h.material(0x9bada8, .85, .25);
  const amber = new THREE.MeshPhysicalMaterial({ color: 0xd2a961, metalness: .12, roughness: .15, transparent: true, opacity: .4, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x7ebeb0, metalness: .05, roughness: .12, transparent: true, opacity: .16, clearcoat: .8, side: THREE.DoubleSide, depthWrite: false });
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x163b33 });
  const screenLine = new THREE.MeshBasicMaterial({ color: 0x6da99a });
  const led = new THREE.MeshStandardMaterial({ color: 0x8cd5b5, emissive: 0x37624d, emissiveIntensity: .45, roughness: .3 });
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, position: Point, parent: THREE.Object3D = root) => {
    const object = new THREE.Mesh(geometry, material); object.position.set(...position); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  };
  const box = (w: number, height: number, d: number, material: THREE.Material, position: Point, parent: THREE.Object3D = root) => h.box(w, height, d, material, position, parent);
  const rounded = (w: number, height: number, d: number, material: THREE.Material, position: Point, parent: THREE.Object3D = root, radius = .055) => mesh(new RoundedBoxGeometry(w, height, d, 2, Math.min(radius, w / 4, height / 4, d / 4)), material, position, parent);
  const cyl = (radius: number, height: number, material: THREE.Material, position: Point, parent: THREE.Object3D = root, segments = 48) => mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material, position, parent);
  const flange = (outer: number, inner: number, height: number, material: THREE.Material, [x,y,z]: Point) => {
    const shape = new THREE.Shape(); shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const opening = new THREE.Path(); opening.absarc(0, 0, inner, 0, Math.PI * 2, true); shape.holes.push(opening);
    const part = mesh(new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 24 }), material, [x,y-height/2,z]);
    part.rotation.x = -Math.PI / 2; return part;
  };
  const innerWall = black.clone(); innerWall.side = THREE.BackSide;
  const chamberWall = (outer: number, inner: number, height: number, position: Point) => {
    mesh(new THREE.CylinderGeometry(outer,outer,height,48,1,true), steel, position);
    mesh(new THREE.CylinderGeometry(inner,inner,height,48,1,true), innerWall, position);
  };
  const ring = (radius: number, thickness: number, material: THREE.Material, position: Point, parent: THREE.Object3D = root, horizontal = true) => {
    const object = mesh(new THREE.TorusGeometry(radius, thickness, 8, 48), material, position, parent); object.rotation.x = horizontal ? Math.PI / 2 : 0; return object;
  };
  const tube = (points: Point[], radius: number, material: THREE.Material, parent: THREE.Object3D = root) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 32, radius, 8, false), material, [0, 0, 0], parent);
  const rod = (from: Point, to: Point, radius: number, material: THREE.Material, parent: THREE.Object3D = root) => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), direction = b.clone().sub(a);
    const object = cyl(radius, direction.length(), material, [...a.add(b).multiplyScalar(.5).toArray()] as Point, parent, 16);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); return object;
  };
  const instances = (geometry: THREE.BufferGeometry, material: THREE.Material, positions: Point[], parent: THREE.Object3D = root, rotation?: THREE.Euler) => {
    const object = new THREE.InstancedMesh(geometry, material, positions.length), transform = new THREE.Object3D();
    if (rotation) transform.rotation.copy(rotation);
    positions.forEach((p, index) => { transform.position.set(...p); transform.updateMatrix(); object.setMatrixAt(index, transform.matrix); });
    object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  };
  const bolts = (radius: number, height: number, center: Point, parent: THREE.Object3D = root, count = 16) => {
    const positions: Point[] = Array.from({ length: count }, (_, i) => { const a = i / count * Math.PI * 2; return [center[0] + Math.sin(a) * radius, height, center[2] + Math.cos(a) * radius]; });
    return instances(new THREE.CylinderGeometry(.035, .035, .045, 6), steel, positions, parent);
  };
  const vents = (position: Point, width: number, rows: number, parent: THREE.Object3D = root) => {
    box(width + .16, rows * .082 + .14, .016, trim, position, parent);
    const p: Point[] = Array.from({ length: rows }, (_, i) => [position[0], position[1] + (i - (rows - 1) / 2) * .082, position[2] + .015]);
    instances(new THREE.BoxGeometry(width, .029, .025), black, p, parent);
  };
  const handle = (position: Point, width = .5, parent: THREE.Object3D = root) => {
    for (const side of [-1, 1]) box(.055, .07, .12, frame, [position[0] + side * width / 2, position[1], position[2]], parent);
    rounded(width + .055, .055, .065, steel, [position[0], position[1], position[2] + .065], parent);
  };
  const monitor = (position: Point, width = 1.15, parent: THREE.Object3D = root) => {
    const group = new THREE.Group(); group.position.set(...position); parent.add(group);
    rounded(width, width * .72, .12, frame, [0, 0, 0], group);
    box(width * .86, width * .56, .014, screenMat, [0, .02, .069], group);
    // Abstract chamber/wafer diagram and buttons; no fabricated operating values.
    ring(width * .12, .008, screenLine, [-width * .19, .03, .082], group, false);
    box(width * .21, .012, .01, screenLine, [-width * .19, -.01, .084], group);
    for (let i = 0; i < 3; i++) box(width * .22, .023, .01, screenLine, [width * .2, width * (.13 - i * .105), .084], group);
    for (let i = 0; i < 3; i++) box(width * .17, .06, .011, i === 0 ? screenLine : trim, [(i - 1) * width * .24, -width * .2, .084], group);
    return group;
  };
  const feet = (width: number, depth: number, center: Point = [0, 0, 0], parent: THREE.Object3D = root) => {
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      cyl(.115, .17, black, [center[0] + x * (width / 2 - .2), .1, center[2] + z * (depth / 2 - .2)], parent);
      cyl(.085, .1, steel, [center[0] + x * (width / 2 - .2), .23, center[2] + z * (depth / 2 - .2)], parent);
    }
  };
  const towerLamp = (position: Point, parent: THREE.Object3D = root) => {
    cyl(.065, .33, steel, position, parent);
    for (let i = 0; i < 3; i++) cyl(.09, .12, i === 0 ? led : i === 1 ? h.gold : frame, [position[0], position[1] + .22 + i * .135, position[2]], parent, 20);
    cyl(.095, .025, black, [position[0], position[1] + .565, position[2]], parent);
  };
  return { root, paint, light, frame, trim, black, steel, glass, amber, led, box, rounded, cyl, flange, chamberWall, ring, tube, rod, instances, bolts, vents, handle, monitor, feet, towerLamp };
}

function depositionShell(h: SceneHelpers): EquipmentShell {
  const k = tools(h), { root, paint, light, frame, trim, black, steel, box, rounded, cyl, ring, tube, rod, bolts, vents, handle } = k;
  root.name = "class-exterior-single-chamber-cvd";
  k.feet(4.1, 3.65, [-.95, 0, 0]);
  rounded(4.05, 1.28, 3.6, paint, [-.95, .91, 0]);
  box(3.92, .12, 3.5, frame, [-.95, 1.57, 0]);
  for (const x of [-2.02, .13]) {
    rounded(1.86, 1.05, .045, light, [x, .94, 1.83]); handle([x + .55, 1.18, 1.87], .3);
    vents([x, .65, 1.867], 1.37, 5);
  }
  box(3.94, .07, .09, h.gold, [-.95, 1.52, 1.82]);
  // One circular reaction chamber: the separate side cabinet carries gas delivery.
  k.chamberWall(1.35, 1.23, .93, [-1.14, 2.08, -.12]);
  cyl(1.44, .13, trim, [-1.14, 1.66, -.12]); bolts(1.33, 1.74, [-1.14, 0, -.12]);
  k.flange(1.43, 1.22, .14, light, [-1.14, 2.59, -.12]); ring(1.32, .035, black, [-1.14, 2.675, -.12]);
  const viewport = cyl(.29, .16, frame, [-1.14, 2.13, 1.245]); viewport.rotation.x = Math.PI / 2;
  const viewportGlass = cyl(.232, .024, k.glass, [-1.14, 2.13, 1.338]); viewportGlass.rotation.x = Math.PI / 2;
  ring(.247, .022, steel, [-1.14, 2.13, 1.357], root, false);
  for (const x of [-1.43, -.85]) box(.045, .33, .035, black, [x, 2.13, 1.342]);
  rounded(.98, .17, .2, frame, [-1.14, 1.83, 1.35]); handle([-1.14, 1.83, 1.48], .65);
  // Visible chamber lip, pedestal and wafer become legible as the lid lifts.
  cyl(.54, .47, black, [-1.14, 1.94, -.12]); cyl(.91, .11, trim, [-1.14, 2.18, -.12]);
  cyl(.84, .045, h.wafer, [-1.14, 2.2575, -.12]); ring(.91, .022, steel, [-1.14, 2.238, -.12]);
  const lid = new THREE.Group(); lid.name = "lifting-showerhead-lid"; lid.position.set(-1.14, 2.75, -.12); root.add(lid);
  cyl(1.44, .16, light, [0, .02, 0], lid); cyl(1.32, .09, steel, [0, -.095, 0], lid);
  cyl(1.1, .025, trim, [0, -.15, 0], lid); ring(1.19, .018, black, [0, -.138, 0], lid);
  const holes: Point[] = [];
  for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) if (x * x + z * z < 40) holes.push([x * .15, -.166, z * .15]);
  k.instances(new THREE.CylinderGeometry(.018, .018, .009, 6), black, holes, lid);
  rounded(1.0, .42, .83, frame, [0, .31, -.05], lid); rounded(.7, .08, .6, trim, [0, .56, -.05], lid);
  bolts(1.29, .12, [0, 0, 0], lid, 20); handle([0, .17, 1.07], .71, lid);
  for (const x of [-2.25, -.03]) {
    cyl(.073, 3.09, steel, [x, 2.88, -1.12]); cyl(.13, .3, frame, [x, 2.15, -1.12]);
    box(.2, .16, .2, trim, [x, 4.47, -1.12]);
    cyl(.126, .26, trim, [x+1.14, .06, -1], lid);
    box(.21, .14, .65, steel, [x+1.14, .06, -.79], lid);
  }
  rounded(.42, .46, .41, frame, [.58, 3.67, -.95]);
  tube([[.58, 3.44, -.95],[.58, 2.56, -.95],[.16, 2.38, -.8]], .052, steel);
  // Exhaust train has its own large duct and bellows, separate from small gas lines.
  rod([-2.43, 2.0, -.28], [-3.15, 2.0, -.28], .17, steel);
  tube([[-3.15, 2.0, -.28], [-3.3, 1.8, -.6], [-3.3, .74, -1.02], [-2.55, .52, -1.05]], .17, frame);
  for (let i = 0; i < 8; i++) { const b = ring(.185, .014, steel, [-2.62 - i * .055, 2, -.28]); b.rotation.z = Math.PI / 2; }
  cyl(.32, .4, black, [-3.3, 1.03, -1.02]);
  // Full-height gas delivery enclosure with inset manifold, doors and service vents.
  k.feet(1.69, 2.95, [2.36, 0, -.25]);
  rounded(1.7, 3.96, 2.95, paint, [2.36, 2.2, -.25]);
  box(1.71, .15, 2.98, frame, [2.36, 4.22, -.25]);
  rounded(1.48, 1.78, .035, light, [2.36, 1.24, 1.246]); handle([2.86, 1.78, 1.28], .22); vents([2.36, .76, 1.28], 1.13, 6);
  box(1.36, 1.56, .055, black, [2.36, 3.14, 1.26]); box(1.25, 1.44, .02, k.glass, [2.36, 3.14, 1.304]);
  for (let i = 0; i < 3; i++) {
    const x = 1.97 + i * .39; rod([x, 2.58, 1.34], [x, 3.69, 1.34], .028, steel);
    rounded(.19, .17, .1, trim, [x, 3.24, 1.36]); cyl(.075, .08, h.gold, [x, 3.4, 1.36]);
    tube([[x, 3.7, 1.34], [x, 3.93, 1.1], [.97 + i * .12, 4.0, -.55], [.49 + i * .08, 3.67, -.76]], .025, steel);
  }
  rounded(.66, .4, .12, frame, [1.96, 2.43, 1.34]); k.monitor([1.96, 2.43, 1.425], .56);
  k.towerLamp([2.78, 4.44, -.8]);
  const arm = new THREE.Group(); arm.position.set(.73, 2.2, 1.52); root.add(arm);
  box(.13, .17, .85, steel, [0, 0, .2], arm); box(.13, .63, .13, frame, [0, .26, .62], arm); k.monitor([0, .68, .68], 1.1, arm);
  const shell: EquipmentShell = {
    root, view: { position: [8.9, 6.4, 10.7], target: [-.05, 2.2, .15] }, mechanism: "lifting", doorParts: [lid],
    opening: ["샤워헤드 덮개를 들어 반응 공간을 살펴봅니다.", "Lift the showerhead cover to explore the reaction space.", "シャワーヘッドのカバーを上げ、反応空間を見てみましょう。"],
    update(progress) { lid.position.y = 2.75 + ease(progress) * 1.38; },
  };
  shell.update(0); return shell;
}

function metalShell(h: SceneHelpers): EquipmentShell {
  const k = tools(h), { root, paint, light, frame, trim, black, steel, box, rounded, cyl, ring, tube, rod, bolts } = k;
  root.name = "class-exterior-multi-module-pvd-cluster";
  k.feet(7.15, 5.5, [0, 0, .1]);
  rounded(7.05, .69, 5.38, frame, [0, .61, .1]);
  rounded(6.87, .54, 5.22, paint, [0, .91, .1]);
  // An octagonal central vacuum-transfer drum distinguishes this from one CVD chamber.
  cyl(1.39, 1.22, light, [0, 1.86, -.15], root, 8); cyl(1.42, .16, steel, [0, 2.51, -.15], root, 8);
  cyl(1.21, .1, trim, [0, 2.63, -.15], root, 8); ring(.81, .025, black, [0, 2.7, -.15]);
  rounded(.58, .17, .6, frame, [0, 2.75, -.15]); bolts(1.3, 2.63, [0, 0, -.15]);
  const locations: Point[] = [[-2.2, 0, -.1], [0, 0, -2.13], [2.2, 0, -.1]];
  const tungsten = h.material(0xa0a3a6, .82, .31);
  let selectedLid: THREE.Group | null = null;
  locations.forEach(([x, , z], i) => {
    const direction = new THREE.Vector3(x, 0, z + .15).normalize();
    rod([direction.x * 1.02, 1.95, -.15 + direction.z * 1.02], [x, 1.95, z], .39, steel);
    const valve = rounded(.68, .85, .16, frame, [direction.x * 1.49, 1.95, -.15 + direction.z * 1.49]); valve.rotation.y = Math.atan2(direction.x, direction.z);
    k.chamberWall(1.02, .89, 1.03, [x, 1.92, z]); k.flange(1.13, .88, .15, light, [x, 2.47, z]); cyl(1.12, .1, trim, [x, 1.4, z]);
    bolts(1.02, 2.56, [x, 0, z]); ring(.91, .025, black, [x, 2.573, z]);
    cyl(.51, .55, black, [x, 1.71, z]); cyl(.75, .095, trim, [x, 2.0, z]); cyl(.63, .04, h.wafer, [x, 2.0675, z]);
    // Each module has a vacuum exhaust flange, cooling line and target drive.
    const side = x === 0 ? 1 : Math.sign(x);
    rod([x + side * .77, 1.86, z], [x + side * 1.13, 1.86, z], .19, frame);
    const flange = ring(.25, .037, steel, [x + side * 1.12, 1.86, z]); flange.rotation.z = Math.PI / 2;
    tube([[x + side * .85, 1.75, z - .45], [x + side * 1.08, 1.5, z - .48], [x + side * 1.08, 1.0, z - .38]], .07, black);
    tube([[x - .4, 2.47, z - .6], [x - .48, 2.78, z - .75], [x - .85, 2.9, z - .62]], .036, h.cyan);
    const lid = new THREE.Group(); lid.position.set(x, 2.68, z - .78); root.add(lid);
    lid.name = i === 0 ? "hinged-pvd-target-lid" : "fixed-pvd-target-lid";
    cyl(1.11, .14, light, [0, 0, .78], lid); cyl(.96, .065, trim, [0, -.105, .78], lid);
    cyl(.8, .025, tungsten, [0, -.147, .78], lid); ring(.69, .013, steel, [0, -.163, .78], lid);
    rounded(.75, .4, .78, frame, [0, .25, .78], lid); cyl(.23, .25, steel, [0, .58, .78], lid);
    for (let f = 0; f < 5; f++) rounded(.84, .025, .83, trim, [0, .11 + f * .06, .78], lid);
    for (const sx of [-.64, .64]) { box(.13, .2, .23, steel, [sx, -.01, .02], lid); cyl(.095, .2, black, [sx, .06, .03], lid); }
    if (i === 0) selectedLid = lid;
  });
  // The front EFEM and paired wafer carriers form a separate load interface.
  rounded(3.26, 2.26, 1.0, light, [0, 2.11, 1.9]); box(3.31, .15, 1.08, frame, [0, 3.3, 1.9]);
  rounded(3.2, .66, 1.5, paint, [0, 1.2, 2.2]);
  for (const x of [-.82, .82]) {
    box(1.25, 1.24, .04, black, [x, 2.19, 2.43]); box(1.14, 1.1, .025, trim, [x, 2.19, 2.46]);
    rounded(1.23, 1.34, .98, k.amber, [x, 1.97, 2.97], root, .1);
    rounded(1.18, 1.22, .06, frame, [x, 1.95, 3.485]);
    for (let j = 0; j < 6; j++) box(.05, .025, .8, steel, [x + .61, 1.55 + j * .13, 2.99]);
    for (const sx of [-.34, .34]) rounded(.08, .51, .06, trim, [x + sx, 1.98, 3.525]);
    box(.65, .12, .05, black, [x, 2.49, 3.525]);
    box(1.33, .1, 1.2, steel, [x, 1.28, 2.98]);
  }
  k.monitor([1.91, 3.17, 2.47], 1.04); box(.1, 1.24, .12, frame, [1.91, 2.37, 2.3]);
  k.vents([-2.83, .92, 2.73], .83, 5); k.vents([2.83, .92, 2.73], .83, 5);
  k.towerLamp([-1.37, 3.63, 1.9]);
  const lid = selectedLid!;
  const shell: EquipmentShell = {
    root, view: { position: [5.4, 7.5, 12.4], target: [0, 1.95, .2] }, mechanism: "cluster-lid", doorParts: [lid],
    opening: ["타깃 모듈 덮개를 열어 클러스터와 증착부를 살펴봅니다.", "Open a target-module cover to explore the cluster and deposition chamber.", "ターゲットモジュールのカバーを開き、クラスターと成膜室を見てみましょう。"],
    update(progress) { const p = ease(progress); lid.position.set(-2.2, 2.68 + p * .16, -.88); lid.rotation.set(-p * 1.25, 0, 0); },
  };
  shell.update(0); return shell;
}

function edsShell(h: SceneHelpers): EquipmentShell {
  const k = tools(h), { root, paint, light, frame, trim, black, steel, box, rounded, cyl, ring, tube, rod, vents } = k;
  root.name = "class-exterior-prober-bench-with-separate-tester";
  k.feet(4.42, 3.7, [-1.0, 0, 0]);
  rounded(4.39, 1.54, 3.64, paint, [-1.0, 1.05, 0]);
  box(4.51, .22, 3.75, frame, [-1.0, 1.88, 0]);
  for (const x of [-2.07, .07]) {
    rounded(1.98, 1.14, .05, light, [x, 1.06, 1.85]); k.handle([x + .67, 1.36, 1.9], .23); vents([x, .73, 1.9], 1.52, 4);
  }
  box(4.34, .06, .08, h.gold, [-1.0, 1.76, 1.91]);
  // The precision stage and probe support sit inside the lifting hood.
  rounded(2.75, .17, 2.5, steel, [-1.07, 2.08, -.1]);
  for (const z of [-.76, .55]) { rod([-2.28, 2.19, z], [.12, 2.19, z], .055, trim); box(2.56, .035, .07, black, [-1.07, 2.24, z]); }
  cyl(.86, .13, black, [-1.05, 2.3, .01]); cyl(.77, .035, h.wafer, [-1.05, 2.39, .01]); ring(.79, .022, steel, [-1.05, 2.414, .01]);
  const dieGrid: Point[] = [];
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) if (x * x + z * z < 20) dieGrid.push([-1.05 + x * .15, 2.411, .01 + z * .15]);
  k.instances(new THREE.BoxGeometry(.119, .005, .119), trim, dieGrid);
  for (const x of [-2.27, .2]) box(.14, .67, .13, frame, [x, 2.54, -.88]);
  rounded(2.63, .18, .31, light, [-1.035, 2.93, -.88]);
  const optics = new THREE.Group(); optics.position.set(-1.98, 2.94, -.27); root.add(optics);
  rounded(.55, .32, .52, frame, [0, .05, 0], optics); cyl(.17, .21, steel, [0, -.2, .08], optics); cyl(.12, .09, k.glass, [0, -.35, .08], optics);
  box(.19, .14, .65, steel, [-1.98, 2.98, -.58]);
  box(.29, .14, .84, steel, [-1.05, 2.92, -.43]);
  cyl(.16, .16, frame, [-1.05, 2.82, .01]);
  const probeBoard = h.material(0x285847, .25, .5);
  cyl(.49, .084, probeBoard, [-1.05, 2.73, .01]);
  ring(.5, .026, steel, [-1.05, 2.73, .01]);
  for (const x of [-.041, .041]) for (const z of [-.041, .041]) {
    box(.027, .009, .027, h.gold, [-1.05+x, 2.418, .01+z]).name = "prober-example-die-pad";
    const tip: Point = [-1.05+x, 2.505, .01+z];
    tube([[-1.05+x*6,2.692,.01+z*6],[-1.05+x*3,2.606,.01+z*3],tip], .01, steel);
    cyl(.013,.028,h.gold,tip).name = "prober-retracted-needle-tip";
  }
  // Rear linear lift rails are visible outside the enclosure when it is closed.
  for (const x of [-2.94, .94]) {
    box(.14, 2.14, .15, steel, [x, 3.03, -1.5]); box(.24, .23, .29, frame, [x, 3.86, -1.5]);
    cyl(.052, 1.96, trim, [x, 3.07, -1.36]);
  }
  const hood = new THREE.Group(); hood.name = "vertically-lifting-prober-hood"; hood.position.set(-1.0, 0, 0); root.add(hood);
  rounded(4.45, .22, 3.57, light, [0, 3.68, 0], hood);
  // The bench owns the solid worktop. Only the hood's perimeter rises.
  box(4.44, .125, .14, frame, [0, 2.0325, -1.72], hood);
  box(4.44, .13, .14, frame, [0, 2.035, 1.72], hood);
  for (const x of [-2.16, 2.16]) box(.14, .125, 3.3, frame, [x, 2.0325, 0], hood);
  for (const x of [-1.94, 1.94]) {
    box(.25, .28, .26, trim, [x, 2.24, -1.5], hood);
    box(.19, .13, .26, frame, [x, 2.24, -1.63], hood);
  }
  box(.14, 1.55, 3.53, paint, [-2.16, 2.87, 0], hood); box(.14, 1.55, 3.53, paint, [2.16, 2.87, 0], hood);
  box(4.3, 1.55, .13, paint, [0, 2.87, -1.72], hood);
  for (const x of [-1.98, 1.98]) box(.29, 1.54, .17, frame, [x, 2.87, 1.72], hood);
  rounded(3.71, 1.25, .025, k.glass, [0, 2.92, 1.766], hood);
  box(3.72, .12, .1, trim, [0, 3.59, 1.74], hood); box(3.72, .13, .12, frame, [0, 2.23, 1.76], hood);
  k.handle([0, 2.31, 1.88], .72, hood);
  // A raised dark bevel above the window reads as the hood, not a second tester.
  rounded(1.37, .28, .06, frame, [0, 3.69, 1.83], hood);
  // Separate rack supplies electrical test signals; the prober positions contacts.
  k.feet(1.72, 2.5, [2.52, 0, -.05]);
  rounded(1.7, 4.1, 2.45, frame, [2.52, 2.31, -.05]);
  rounded(1.54, .72, .04, light, [2.52, 3.88, 1.196]); k.monitor([2.52, 3.91, 1.24], 1.18);
  for (let i = 0; i < 4; i++) {
    const y = 1.23 + i * .58; rounded(1.51, .49, .08, paint, [2.52, y, 1.2]);
    for (const x of [1.89, 3.15]) box(.035, .29, .08, steel, [x, y, 1.27]);
    vents([2.54, y, 1.25], .89, 3); cyl(.033, .025, k.led, [3.05, y + .12, 1.29]).rotation.x = Math.PI / 2;
  }
  rounded(.39, .63, .45, trim, [1.49, 2.64, -.63]);
  for (let i = 0; i < 5; i++) tube([[1.72, 3.25 - i * .1, -.74], [1.37, 3.32 - i * .1, -.83], [1.12, 2.51 - i * .07, -.6], [.73, 2.42 - i * .07, -.6]], .047, i % 2 ? black : frame);
  box(.27,.19,.18,frame,[.72,2.32,-.6]);
  box(.43,.11,.14,frame,[-1.05,2.79,-.37]);
  for(let i=0;i<3;i++)tube([[.68,2.32+i*.04,-.62],[.18,2.66+i*.06,-.78],[-.66,2.85+i*.035,-.62],[-1.18+i*.13,2.79,-.37]],.025,black);
  k.monitor([-.98, 1.6, 2.07], 1.12); box(1.45, .1, .61, steel, [-.98, 1.21, 2.07]);
  box(.42, .18, .45, frame, [.82, 3.82, -1.33]);
  k.towerLamp([.71, 3.96, -1.2]);
  const shell: EquipmentShell = {
    root, view: { position: [8.8, 6.3, 10.5], target: [.05, 2.15, .1] }, mechanism: "lifting", doorParts: [hood],
    opening: ["프로버 덮개를 올려 접촉부를 살펴봅니다. 옆 타워는 별도 검사 시스템입니다.", "Raise the prober hood to explore the contact area. The adjacent tower is a separate test system.", "プローバーのカバーを上げ、接触部を見てみましょう。隣のタワーは別の検査システムです。"],
    update(progress) { hood.position.y = ease(progress) * 1.5; },
  };
  shell.update(0); return shell;
}

function packagingShell(h: SceneHelpers): EquipmentShell {
  const k = tools(h), { root, paint, light, frame, trim, black, steel, box, rounded, cyl, ring, tube, rod, vents } = k;
  root.name = "class-exterior-wire-bonder-with-hinged-guard";
  k.feet(7.0, 3.6);
  rounded(6.97, 1.03, 3.52, paint, [0, .85, 0]);
  rounded(6.91, .15, 3.48, frame, [0, 1.41, 0]);
  for (let i = 0; i < 3; i++) {
    const x = -2.23 + i * 2.23; rounded(2.04, .76, .045, light, [x, .88, 1.79]); vents([x, .71, 1.83], 1.52, 4);
    k.handle([x + .63, 1.15, 1.84], .26);
  }
  box(6.78, .045, .05, h.gold, [0, 1.35, 1.8]);
  // Long magazine/lead-frame transport is visibly different from a wafer stage.
  rounded(5.74, .12, 1.2, steel, [0, 1.55, .42]);
  for (const z of [-.04, .88]) { rod([-2.87, 1.65, z], [2.87, 1.65, z], .035, trim); box(5.76, .08, .035, black, [0, 1.67, z]); }
  const substrate = h.material(0x386752,.35,.46);
  const attachLayer = h.material(0x9c9c8f,.15,.62);
  const bondDepths = [.31,.42,.53];
  for (let index = 0; index < 6; index++) {
    const x = -2.15 + index * .86; box(.63, .023, .67, substrate, [x, 1.633, .42]);
    box(.23,.004,.24,attachLayer,[x,1.6465,.42]);
    box(.25, .055, .26, h.wafer, [x, 1.676, .42]);
    for (const side of [-1, 1]) for (const z of bondDepths) {
      box(.12,.012,.031,h.gold,[x+side*.27,1.6505,z]).name="bonder-strip-lead";
      box(.028,.01,.028,h.gold,[x+side*.105,1.7085,z]).name="bonder-die-pad";
    }
  }
  for (const side of [-1, 1]) {
    const x = side * 3.01;
    rounded(.76, .91, 1.26, frame, [x, 1.97, .42]); rounded(.62, .77, .024, k.glass, [x, 1.97, 1.069]);
    for (let slot = 0; slot < 6; slot++) box(.55, .025, 1.05, steel, [x, 1.68 + slot * .105, .41]);
    box(.75, .08, 1.35, light, [x, 2.49, .42]);
  }
  // Rear bridge carries a rail, carriage, optical head and capillary assembly.
  for (const x of [-2.42, 2.42]) rounded(.28, 1.37, .51, light, [x, 2.17, -.7]);
  rounded(5.11, .3, .64, light, [0, 2.91, -.7]);
  rod([-2.5, 2.91, -.34], [2.5, 2.91, -.34], .06, steel);
  rod([-2.5, 2.72, -.34], [2.5, 2.72, -.34], .04, trim);
  const chain: Point[] = Array.from({ length: 18 }, (_, i) => [-1.74 + i * .12, 3.12, -.71]);
  k.instances(new THREE.BoxGeometry(.08, .07, .18), black, chain);
  const headX=.43-.105, headZ=bondDepths[0];
  const ceramic=h.material(0xd7dacb,.04,.45);
  rounded(.73, .61, .58, frame, [headX, 2.6, -.17]); rounded(.45, .37, .25, paint, [headX, 2.41, .21]);
  cyl(.11, .31, steel, [headX, 2.13, headZ]); cyl(.035, .22, ceramic, [headX, 1.87, headZ]);
  rounded(.25, .31, .3, black, [-.23, 2.36, .26]); cyl(.105, .2, steel, [-.23, 2.12, .26]);
  ring(.2, .025, light, [-.23, 1.99, .26]);
  // The front-facing wire reel and feed path remain identifiable through the guard.
  const spool = new THREE.Group(); spool.position.set(-1.83, 2.59, -.18); root.add(spool);
  for (const z of [-.13, .13]) { const disk = cyl(.43, .045, steel, [0, 0, z], spool); disk.rotation.x = Math.PI / 2; }
  const core = cyl(.3, .24, h.gold, [0, 0, 0], spool); core.rotation.x = Math.PI / 2;
  for (let i = 0; i < 6; i++) ring(.31, .012, h.gold, [0, 0, -.09 + i * .036], spool, false);
  const axle = cyl(.095, .33, frame, [0, 0, .04], spool); axle.rotation.x = Math.PI / 2;
  for (let i = 0; i < 6; i++) { const spoke = box(.52, .033, .025, frame, [0, 0, .163], spool); spoke.rotation.z = i * Math.PI / 3; }
  box(.18,.25,.17,steel,[-1.83,2.74,-.67]);
  rod([-1.83,2.59,-.71],[-1.83,2.59,-.30],.08,frame);
  tube([[-1.54, 2.78, -.1], [-1.02, 3.11, -.08], [-.32, 2.92, .02], [headX, 2.48, headZ], [headX, 1.98, headZ]], .009, h.gold);
  for (const side of [-1, 1]) for (const z of bondDepths) {
    const first: Point=[.43+side*.105,1.716,z], second: Point=[.43+side*.27,1.6625,z];
    tube([first,[.43+side*.19,1.86,z],second],.008,h.gold).name="bonder-pad-to-lead-wire";
    cyl(.017,.014,h.gold,[first[0],1.717,z]);
    box(.03,.012,.022,h.gold,[second[0],1.6625,z]);
  }
  // The lid carries the roof and front window. The side shields stay on the bench.
  const hingeHeight = 3.41, hingeDepth = -1.46;
  const guard = new THREE.Group();
  guard.name = "upward-hinged-transparent-bonder-lid";
  guard.position.set(0, hingeHeight, hingeDepth);
  root.add(guard);
  const lidPoint = (x: number, y: number, z: number): Point => [x, y - hingeHeight, z - hingeDepth];
  rounded(6.24, .18, 3.02, light, lidPoint(0, 3.41, -.02), guard);
  for (const x of [-3.04, 3.04]) {
    box(.13, 1.85, .14, trim, lidPoint(x, 2.42, 1.43), guard);
    box(.13, 1.85, .14, trim, [x, 2.42, -1.45]);
    box(.022, 1.61, 2.76, k.glass, [x, 2.43, -.01]);
    box(.15, .11, 2.89, frame, [x, 1.52, -.01]);
    rounded(.25, .18, .28, frame, [x, hingeHeight, hingeDepth]);
  }
  rounded(5.95, 1.61, .024, k.glass, lidPoint(0, 2.43, 1.5), guard);
  box(5.97, .12, .08, frame, lidPoint(0, 1.58, 1.52), guard);
  box(5.97, .11, .08, trim, lidPoint(0, 3.26, 1.49), guard);
  k.handle(lidPoint(0, 1.7, 1.59), .8, guard);
  rod([-3.04, hingeHeight, hingeDepth], [3.04, hingeHeight, hingeDepth], .055, steel);
  box(.13, 1.24, .13, frame, [3.44, 2.21, 1.29]); k.monitor([3.44, 2.91, 1.32], 1.02);
  box(.34, .30, .24, frame, [-3.16, 3.40, -1.45]);
  k.towerLamp([-3.27, 3.68, -1.45]);
  const shell: EquipmentShell = {
    root, view: { position: [9.5, 5.8, 10.5], target: [.05, 1.95, .05] }, mechanism: "hinged", doorParts: [guard],
    opening: ["투명 덮개를 위로 열어 와이어 공급부와 본딩 헤드를 살펴봅니다.", "Lift the transparent lid to explore the wire feed and bonding head.", "透明なカバーを上に開け、ワイヤーの供給部とボンディングヘッドを見てみましょう。"],
    update(progress) { guard.rotation.x = -1.04 * ease(progress); },
  };
  shell.update(0); return shell;
}
