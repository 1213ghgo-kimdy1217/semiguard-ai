import * as THREE from "three";
import type { SceneHelpers } from "./studio-types";

function dieFaceMaterial() {
  const material = new THREE.MeshStandardMaterial({ color: 0x527580, metalness: .2, roughness: .6 });
  const canvas = typeof document === "undefined" ? undefined : document.createElement("canvas");
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return material;
  canvas.width = canvas.height = 128;
  context.fillStyle = "#102732";
  context.fillRect(0, 0, 128, 128);
  context.fillStyle = "#356170";
  context.fillRect(11, 11, 106, 106);
  const blocks = [[18,18,34,40],[61,18,47,24],[61,50,47,26],[18,69,35,37],[65,86,42,21]];
  for (const [x,y,width,height] of blocks) {
    context.fillStyle = "#173a4c";
    context.fillRect(x,y,width,height);
    context.fillStyle = "#5294a1";
    for (let row = y + 4; row < y + height - 3; row += 4) context.fillRect(x + 4,row,width - 8,1.5);
  }
  context.strokeStyle = "#bf9563";
  context.lineWidth = 2;
  for (const [x,y,endX,endY] of [[11,28,56,48],[11,56,58,64],[117,32,58,22],[116,60,61,71],[117,98,58,78],[12,96,61,108]]) {
    context.beginPath();context.moveTo(x,y);context.lineTo(endX,y);context.lineTo(endX,endY);context.stroke();
  }
  context.fillStyle = "#e0ba79";
  for (let i = 0; i < 8; i++) {
    const p = 18 + i * 13;
    context.fillRect(p,5,5,5);context.fillRect(p,118,5,5);
    context.fillRect(5,p,5,5);context.fillRect(118,p,5,5);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  material.color.set(0xffffff);
  material.map = texture;
  return material;
}

/** A finished-wafer example on a separate dicing frame beside the CMP sample. */
export function createDicingExample(h: SceneHelpers, parent: THREE.Object3D) {
  const tray = new THREE.Group();
  tray.name = "later-stage-dicing-tape-frame";
  tray.position.set(2, 0, 2.43);
  parent.add(tray);
  h.box(2.02,.33,1.88,h.dark,[0,.265,0],tray);
  h.box(1.95,.08,1.84,h.steel,[0,.47,0],tray);
  for (const x of [-.81,.81]) for (const z of [-.65,.65]) h.cylinder(.075,.19,h.dark,[x,.08,z],tray);
  const tapeRadius = .78, dieEdge = .706;
  const tape = h.cylinder(tapeRadius,.022,h.material(0x3e637b,.05,.68),[0,.53,0],tray);
  tape.name = "dicing-tape-support";
  const rim = new THREE.Shape();
  rim.absarc(0,0,.90,0,Math.PI*2,false);
  const hole = new THREE.Path();
  hole.absarc(0,0,.771,0,Math.PI*2,true);
  rim.holes.push(hole);
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(rim,{depth:.035,bevelEnabled:false,curveSegments:56}),h.steel);
  frame.rotation.x = -Math.PI/2;
  frame.position.y = .51;
  frame.castShadow = frame.receiveShadow = true;
  tray.add(frame);

  const pitchX = .201, pitchZ = .166, width = .174, depth = .139, thickness = .014;
  const points: [number,number][] = [];
  for (let row = -5; row <= 5; row++) for (let column = -4; column <= 4; column++) {
    const x = column * pitchX, z = row * pitchZ;
    if (Math.hypot(Math.abs(x)+width/2,Math.abs(z)+depth/2) <= dieEdge) points.push([x,z]);
  }
  const silicon = h.material(0x344655,.3,.45), face = dieFaceMaterial();
  const dies = new THREE.InstancedMesh(new THREE.BoxGeometry(width,thickness,depth),
    [silicon,silicon,face,silicon,silicon,silicon],points.length);
  dies.name = "separated-dies-with-scribe-gaps";
  dies.castShadow = dies.receiveShadow = true;
  const transform = new THREE.Matrix4();
  points.forEach(([x,z],i) => dies.setMatrixAt(i,transform.makeTranslation(x,.541+thickness/2,z)));
  dies.instanceMatrix.needsUpdate = true;
  tray.add(dies);
  return tape;
}
