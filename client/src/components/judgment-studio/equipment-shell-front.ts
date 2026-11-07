import * as THREE from "three";
import type {EquipmentShell} from "./equipment-shell-types";
import type {SceneHelpers} from "./studio-types";
import {siliconWaferGeometry,siliconWaferMaterial} from "./stage-front";

// Original equipment-class teaching exteriors. They are not OEM replicas or
// maintenance instructions; opening the enclosure reveals a separate model.
const clamp = (value:number) => Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
const ease = (value:number) => {const p=clamp(value);return p*p*(3-2*p);};
type Position=[number,number,number];

function workshop(h:SceneHelpers,name:string){
 const root=new THREE.Group();root.name=name;
 // Every material belongs to this shell, so the host can fade it independently.
 const paint=h.material(0xc7d2c8,.23,.46),light=h.material(0xe0e5db,.16,.38);
 const dark=h.material(0x21332d,.42,.4),steel=h.material(0x8fa59d,.76,.29);
 const black=h.material(0x101d1a,.2,.56),cyan=h.material(0x75c5b8,.35,.32);
 const gold=h.material(0xc69d55,.64,.3),blue=h.material(0x31516a,.52,.28);
 const silicon=siliconWaferMaterial(h.wafer);
 const glass=h.material(0x32695f,.2,.2);glass.transparent=true;glass.opacity=.36;glass.depthWrite=false;
 const amber=h.material(0xb79855,.3,.36);amber.transparent=true;amber.opacity=.7;
 const screen=h.material(0x102e29,.12,.35);screen.emissive.set(0x123d32);screen.emissiveIntensity=.35;
 const led=h.material(0x8be0c3,.08,.4);led.emissive.set(0x3c9d77);led.emissiveIntensity=.8;
 const add=(geometry:THREE.BufferGeometry,material:THREE.Material,p:Position,parent:THREE.Object3D=root)=>{
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...p);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
 };
 const box=(w:number,height:number,d:number,material:THREE.Material,p:Position,parent:THREE.Object3D=root)=>add(new THREE.BoxGeometry(w,height,d),material,p,parent);
 const cyl=(r:number,height:number,material:THREE.Material,p:Position,parent:THREE.Object3D=root,segments=40)=>add(new THREE.CylinderGeometry(r,r,height,segments),material,p,parent);
 const wafer=(radius:number,thickness:number,p:Position,parent:THREE.Object3D=root)=>add(siliconWaferGeometry(radius,thickness),silicon,p,parent);
 const ring=(r:number,tube:number,material:THREE.Material,p:Position,parent:THREE.Object3D=root)=>{
  const mesh=add(new THREE.TorusGeometry(r,tube,8,48),material,p,parent);mesh.rotation.x=Math.PI/2;return mesh;
 };
 const pipe=(points:Position[],r:number,material:THREE.Material,parent:THREE.Object3D=root)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),20,r,8,false),material,[0,0,0],parent);
 const group=(p:Position,parent:THREE.Object3D=root)=>{const g=new THREE.Group();g.position.set(...p);parent.add(g);return g;};
 const rounded=(w:number,height:number,d:number,r:number,material:THREE.Material,p:Position,parent:THREE.Object3D=root)=>{
  const a=w/2,b=height/2,s=new THREE.Shape();r=Math.min(r,a,b);
  s.moveTo(-a+r,-b);s.lineTo(a-r,-b);s.quadraticCurveTo(a,-b,a,-b+r);s.lineTo(a,b-r);s.quadraticCurveTo(a,b,a-r,b);s.lineTo(-a+r,b);s.quadraticCurveTo(-a,b,-a,b-r);s.lineTo(-a,-b+r);s.quadraticCurveTo(-a,-b,-a+r,-b);
  const geometry=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,curveSegments:4});geometry.translate(0,0,-d/2);return add(geometry,material,p,parent);
 };
 const feet=(width:number,depth:number)=>{for(const x of[-1,1])for(const z of[-1,1]){const px=x*(width/2-.3),pz=z*(depth/2-.25);cyl(.105,.2,steel,[px,.16,pz]);cyl(.17,.07,dark,[px,.055,pz]);}};
 const bolts=(x:number,y:number,z:number,w:number,height:number,parent:THREE.Object3D=root)=>{
  for(const sx of[-1,1])for(const sy of[-1,1]){const bolt=cyl(.027,.016,steel,[x+sx*w/2,y+sy*height/2,z],parent,6);bolt.rotation.x=Math.PI/2;}
 };
 const panel=(w:number,height:number,x:number,y:number,z:number,parent:THREE.Object3D=root)=>{
  rounded(w,height,.055,.045,dark,[x,y,z-.013],parent);rounded(w-.032,height-.032,.055,.035,paint,[x,y,z+.012],parent);bolts(x,y,z+.043,w-.16,height-.16,parent);
 };
 const vent=(x:number,y:number,z:number,w:number,height:number,parent:THREE.Object3D=root)=>{
  rounded(w,height,.05,.04,black,[x,y,z],parent);
  const rows=Math.max(3,Math.round(height/.095));for(let i=0;i<rows;i++)box(w-.09,.027,.04,steel,[x,y-height/2+.07+i*(height-.14)/(rows-1),z+.03],parent);
 };
 const display=(x:number,y:number,z:number,w=.85,height=.59,parent:THREE.Object3D=root)=>{
  rounded(w+.1,height+.1,.12,.06,dark,[x,y,z],parent);rounded(w,height,.014,.025,screen,[x,y,z+.067],parent);
  // Universal schematic: three channels, a miniature chamber, and status dots.
  for(let row=0;row<3;row++){
   box(w*.48,.018,.008,cyan,[x-w*.13,y+height*.25-row*height*.25,z+.079],parent);
   box(w*(.12+row*.07),.045,.009,led,[x-w*.25,y+height*.25-row*height*.25,z+.086],parent);
   const dot=cyl(.022,.014,row===2?gold:led,[x+w*.36,y+height*.25-row*height*.25,z+.079],parent);dot.rotation.x=Math.PI/2;
  }
 };
 const handle=(x:number,y:number,z:number,height=.45,parent:THREE.Object3D=root)=>{
  box(.065,height,.075,steel,[x,y,z+.06],parent);for(const sy of[-1,1])box(.09,.055,.12,dark,[x,y+sy*(height/2-.025),z],parent);
 };
 const status=(x:number,y:number,z:number)=>{
  cyl(.035,.43,steel,[x,y+.22,z]);for(let i=0;i<3;i++){cyl(.085,.13,[light,cyan,gold][i],[x,y+.48+i*.14,z]);ring(.086,.012,dark,[x,y+.414+i*.14,z]);}cyl(.09,.045,dark,[x,y+.85,z]);
 };
 const foup=(x:number,y:number,z:number,scale=1,parent:THREE.Object3D=root)=>{
  const g=group([x,y,z],parent);g.scale.setScalar(scale);
  rounded(.97,1.12,.78,.12,amber,[0,.56,0],g);rounded(.8,.95,.05,.09,dark,[0,.55,.417],g);
  rounded(.67,.83,.025,.07,black,[0,.55,.453],g);
  for(let i=0;i<9;i++)box(.59,.02,.035,steel,[0,.21+i*.079,.477],g);
  for(const sx of[-1,1]){box(.07,.48,.17,steel,[sx*.55,.63,.05],g);box(.07,.07,.3,dark,[sx*.55,.86,.05],g);}
  box(.43,.07,.26,dark,[0,1.18,0],g);box(.31,.11,.08,steel,[0,1.23,-.06],g);box(1.05,.08,.89,steel,[0,.01,0],g);return g;
 };
 const rail=(x:number,y:number,z:number,length:number,parent:THREE.Object3D=root)=>{
  box(length,.07,.07,steel,[x,y,z],parent);for(let i=0;i<Math.ceil(length/.45);i++)box(.08,.13,.12,dark,[x-length/2+.2+i*.45,y-.04,z],parent);
 };
 return {root,paint,light,dark,steel,black,cyan,gold,blue,glass,amber,screen,led,add,box,cyl,wafer,ring,pipe,group,rounded,feet,bolts,panel,vent,display,handle,status,foup,rail};
}

function cmpShell(h:SceneHelpers):EquipmentShell{
 const k=workshop(h,"enclosed-cmp-polisher-with-cleaning-stations"),{root,box,cyl,ring,pipe,group,rounded,paint,light,dark,steel,black,cyan,gold,glass}=k;
 k.feet(7,3.6);rounded(7.05,1.12,3.6,.15,dark,[0,.8,0]);box(7.12,.12,3.69,steel,[0,1.42,0]);
 // The low, wide work deck deliberately differs from the vertical furnace.
 for(const x of[-2.55,-.85,.85,2.55])k.panel(1.59,.87,x,.85,1.83);
 k.vent(-2.55,.86,1.88,1.15,.48);k.vent(2.55,.86,1.88,1.15,.48);
 const polishingPad=h.material(0x364540,.14,.78);
 for(const x of[-1.65,.45]){
  cyl(.81,.14,steel,[x,1.57,-.15]);cyl(.73,.06,polishingPad,[x,1.67,-.15]);
  for(const r of[.29,.49,.65])ring(r,.013,steel,[x,1.711,-.15]);
  const arm=group([x,2.6,-.95]);cyl(.14,.73,steel,[0,-.3,0],arm);box(.18,.16,.6,paint,[0,-.01,.29],arm);cyl(.39,.24,dark,[0,-.2,.49],arm);cyl(.35,.055,steel,[0,-.35,.49],arm);
  k.wafer(.324,.017,[0,-.391,.49],arm);
  pipe([[x-.61,1.5,-.65],[x-.62,2.08,-.65],[x-.34,2.12,.02],[x,2.02,.03]],.035,cyan);
  cyl(.05,.12,gold,[x,1.96,.03]);
 }
 // Brush-cleaning modules have separate translucent cylindrical bowls.
 for(const z of[-.67,.58]){
  cyl(.44,.64,steel,[2.25,1.85,z]);cyl(.4,.49,glass,[2.25,2.05,z]);ring(.43,.045,light,[2.25,2.28,z]);
  const brush=cyl(.16,.62,cyan,[2.25,2.0,z]);brush.rotation.z=Math.PI/2;
  for(let i=0;i<7;i++)ring(.17,.015,dark,[2.25-.26+i*.085,2,z]).rotation.z=Math.PI/2;
 }
 box(.14,1.25,2.99,paint,[-3.4,2.06,0]);box(.14,1.25,2.99,paint,[3.4,2.06,0]);box(6.76,1.25,.16,paint,[0,2.06,-1.5]);
 for(const x of[-2.5,-1.5,-.5,.5,1.5,2.5])box(.48,.025,.03,black,[x,2.45,-1.403]);
 const lid=group([0,2.17,-1.49]);lid.name="CMP upward hinged process hood";
 rounded(6.72,.13,3.05,.07,light,[0,1.22,1.49],lid);box(6.72,.12,.1,steel,[0,.02,2.98],lid);
 for(const x of[-3.29,3.29]){
  for(const z of[.04,2.95])box(.1,1.22,.1,light,[x,.62,z],lid);
  box(.1,.1,2.97,light,[x,.06,1.49],lid);box(.016,1.04,2.7,glass,[x,.61,1.48],lid);
 }
 rounded(6.47,1.04,.04,.035,glass,[0,.62,2.995],lid);
 for(const x of[-3.23,-1.07,1.07,3.23])box(.065,1.14,.075,steel,[x,.62,3.01],lid);
 for(const x of[-2.65,2.65]){const hinge=cyl(.09,.5,steel,[x,0,0],lid);hinge.rotation.z=Math.PI/2;k.handle(x,.25,3.025,.28,lid);}
 // Load port, roller approach, touch panel, supply service tower.
 box(1.35,.16,1.15,steel,[-2.6,1.34,2.19]);k.foup(-2.6,1.43,2.24,.91);
 for(let i=0;i<4;i++){const roller=cyl(.045,1.06,steel,[-2.6,1.45,1.72+i*.14]);roller.rotation.z=Math.PI/2;}
 k.display(.68,2.13,1.95,.99,.64);pipe([[.68,1.44,1.78],[.68,1.9,1.82]],.055,dark);
 rounded(.54,2.2,.78,.09,paint,[3.13,2.48,-1.16]);k.vent(3.13,2.68,-.75,.35,.66);
 k.status(3.1,3.57,-1.18);
 const struts=[-3.1,3.1].map(x=>{const g=group([x,2.13,-.5]);cyl(.035,1.1,steel,[0,.55,0],g);return g;});
 const update=(progress:number)=>{const p=ease(progress);lid.rotation.x=-1.14*p;struts.forEach(g=>g.rotation.x=-.55*p);};update(0);
 return {root,view:{position:[9.6,6.3,12.8],target:[0,1.85,.3]},opening:["커버를 올려 연마·세정 모형으로 들어가요.","Lift the hood to explore polishing and cleaning.","カバーを上げ、研磨・洗浄の模型へ進みます。"],mechanism:"hood",doorParts:[lid],update};
}

function furnaceShell(h:SceneHelpers):EquipmentShell{
 const k=workshop(h,"enclosed-vertical-batch-oxidation-furnace"),{root,box,cyl,ring,pipe,group,rounded,paint,light,dark,steel,cyan,gold,glass}=k;
 k.feet(4.8,3.6);rounded(4.8,.47,3.65,.12,dark,[0,.45,0]);
 // Two service towers frame a real lower loading bay and vertical hot zone.
 for(const x of[-1.96,1.96]){
  rounded(.83,5.25,3.2,.12,paint,[x,3.18,-.1]);k.panel(.65,1.72,x,1.67,1.53);k.panel(.65,1.67,x,3.48,1.53);k.vent(x,5.05,1.56,.54,.71);
 }
 box(3.95,.23,3.1,light,[0,5.9,-.1]);box(3.12,5.17,.17,paint,[0,3.18,-1.65]);
 const hot=group([0,3.97,-.25]);
 cyl(1.06,3.13,light,[0,0,0],hot);ring(1.07,.055,steel,[0,-1.47,0],hot);ring(1.07,.055,steel,[0,1.46,0],hot);
 for(const y of[-1.09,-.52,.05,.62,1.19])ring(1.068,.018,dark,[0,y,0],hot);
 cyl(.66,.16,steel,[0,1.67,0],hot);cyl(.44,.16,dark,[0,1.82,0],hot);
 // Front temperature-zone strips are schematic and carry no recipe values.
 for(let i=0;i<4;i++){rounded(.14,.45,.03,.025,dark,[1.065,3.03+i*.61,.02]);box(.055,.32,.02,cyan,[1.145,3.03+i*.61,.02]);}
 const loader=group([0,.71,.42]);
 cyl(.79,.19,steel,[0,.25,0],loader);cyl(.65,.12,dark,[0,.4,0],loader);
 for(const x of[-.47,.47])cyl(.035,1.44,steel,[x,1.13,0],loader);
 for(let i=0;i<11;i++)k.wafer(.5,.016,[0,.61+i*.105,0],loader);
 ring(.54,.026,light,[0,1.77,0],loader);
 for(const x of[-.89,.89]){box(.08,2.05,.14,steel,[x,1.75,-.42]);cyl(.06,2.1,dark,[x,1.75,-.42]);}
 box(1.95,.09,.5,dark,[0,.78,.3]);k.rail(0,.78,1.04,2.44);
 const left=group([-1.38,.66,1.61]),right=group([1.38,.66,1.61]);left.name="Furnace left loading door";right.name="Furnace right loading door";
 for(const [door,side] of[[left,1],[right,-1]] as const){
  rounded(1.36,.4,.1,.06,light,[side*.68,.2,0],door);box(1.36,.23,.1,light,[side*.68,1.91,0],door);
  for(const edge of[-.605,.605])box(.15,1.41,.1,light,[side*.68+edge,1.105,0],door);
  rounded(1.05,1.37,.025,.04,glass,[side*.68,1.1,.04],door);
  k.handle(side*1.14,.91,.1,.49,door);k.bolts(side*.68,1,.08,1.14,1.8,door);
  for(const y of[.23,1.75]){const hinge=cyl(.065,.18,steel,[0,y,0],door);hinge.rotation.x=0;}
 }
 box(2.9,.15,.26,steel,[0,2.78,1.57]);k.display(-1.94,3.57,1.65,.57,.71);
 const gas=group([2.52,1.18,-.55]);
 for(let i=0;i<3;i++){cyl(.12,.57,cyan,[0,i*.7,0],gas);pipe([[0,i*.7+.3,0],[0,i*.7+.4,-.3],[-.5,i*.7+.4,-.3]],.028,steel,gas);box(.18,.055,.08,gold,[.14,i*.7+.31,0],gas);}
 k.status(1.96,5.97,-.15);
 const update=(progress:number)=>{const p=ease(progress);left.rotation.y=-1.36*p;right.rotation.y=1.36*p;loader.position.z=.42+.45*p;};update(0);
 return {root,view:{position:[7.7,6.9,11.4],target:[0,2.8,.1]},opening:["하부 도어를 열어 보트와 열산화 모형으로 들어가요.","Open the lower doors to explore the wafer boat and thermal-oxidation model.","下部の扉を開き、ウェーハボートと熱酸化の模型へ進みます。"],mechanism:"hinged",doorParts:[left,right],update};
}

function scannerShell(h:SceneHelpers):EquipmentShell{
 const k=workshop(h,"enclosed-projection-lithography-scanner"),{root,box,cyl,ring,pipe,group,rounded,paint,light,dark,steel,cyan,gold,glass}=k;
 k.feet(7.35,4.3);rounded(7.38,.93,4.28,.19,dark,[0,.72,0]);box(7.25,.1,4.17,steel,[0,1.23,0]);
 for(const x of[-2.73,-.91,.91,2.73])k.panel(1.69,.64,x,.75,2.17);
 // Tall reticle-handling tower beside a bridge rather than one generic box.
 rounded(1.72,4.04,3.44,.16,paint,[-2.75,3.3,-.17]);rounded(1.43,1.12,.09,.08,dark,[-2.75,4.46,1.59]);
 for(let i=0;i<5;i++){box(1.19,.075,.04,steel,[-2.75,4.13+i*.16,1.65]);box(.13,.027,.012,cyan,[-3.15,4.13+i*.16,1.68]);}
 k.vent(-2.75,2.11,1.61,1.18,.79);k.panel(1.41,.85,-2.75,3.15,1.61);
 rounded(5.57,1.07,3.14,.15,light,[.55,4.73,-.1]);box(5.41,.07,3.07,dark,[.55,4.18,-.1]);
 rounded(1.1,3.05,3.15,.12,paint,[3.08,2.76,-.09]);k.vent(3.08,2.1,1.52,.75,.84);
 box(4.13,2.86,.18,paint,[.47,2.81,-1.64]);
 // Lens barrel, projection bellows, and an independent XY stage in the opening.
 cyl(.64,.86,steel,[.45,3.64,-.12]);cyl(.49,.38,dark,[.45,3.06,-.12]);
 for(let i=0;i<5;i++)ring(.5,.032,steel,[.45,2.94+i*.077,-.12]);
 cyl(.43,.12,glass,[.45,2.78,-.12]);cyl(.66,.14,light,[.45,4.14,-.12]);
 box(3.1,.14,2.43,steel,[.45,1.49,-.03]);box(2.41,.14,1.86,dark,[.45,1.63,-.03]);
 for(const z of[-.67,.63])k.rail(.45,1.77,z,2.67);
 box(1.5,.15,1.44,paint,[.45,1.87,-.03]);cyl(.58,.025,dark,[.45,1.9575,-.03]);k.wafer(.53,.02,[.45,1.982,-.03]);ring(.58,.012,steel,[.45,1.974,-.03]);
 pipe([[-1.23,1.4,-.9],[-1.37,2.0,-.9],[-1.15,2.35,-.9]],.058,dark);
 const doors=[-.55,1.45].map((x,index)=>{
  const door=group([x,2.73,1.77]);door.name=index===0?"Scanner left sliding access panel":"Scanner right sliding access panel";
  rounded(1.98,.47,.09,.06,light,[0,-1.15,0],door);rounded(1.98,.34,.09,.06,light,[0,1.215,0],door);
  for(const x of[-.9,.9])box(.18,1.97,.09,light,[x,.07,0],door);
  rounded(1.62,1.97,.026,.035,glass,[0,.07,.047],door);
  k.handle(index===0?.74:-.74,-.12,.11,.55,door);box(1.76,.045,.025,gold,[0,-1.11,.072],door);k.bolts(0,0,.08,1.77,2.52,door);return door;
 });
 for(const y of[1.3,4.15])k.rail(.45,y,1.72,5.89);
 // Small front reticle-cassette service and separate wafer load port.
 box(1.24,.15,.99,steel,[-2.71,1.24,2.43]);k.foup(-2.71,1.33,2.4,.87);
 const arm=group([3.74,2.7,1.53]);box(.18,.18,.81,dark,[0,0,0],arm);k.display(0,.18,.4,.91,.69,arm);
 k.status(3.08,5.28,-.54);
 const update=(progress:number)=>{const p=ease(progress);doors[0].position.x=-.55-1.69*p;doors[1].position.x=1.45+1.69*p;};update(0);
 return {root,view:{position:[9.9,6.6,13],target:[0,2.46,.25]},opening:["슬라이드 패널을 열어 마스크·광학계·스테이지를 살펴봐요.","Slide the panels apart to explore the mask, optics, and wafer stage.","パネルを左右に開き、マスク・光学系・ウェーハステージを見ます。"],mechanism:"sliding",doorParts:doors,update};
}

function etcherShell(h:SceneHelpers):EquipmentShell{
 const k=workshop(h,"radial-plasma-etch-cluster-with-load-locks"),{root,box,cyl,ring,pipe,group,rounded,paint,light,dark,steel,black,cyan,gold,glass}=k;
 k.feet(6.9,5.6);rounded(6.85,.47,5.42,.15,dark,[0,.45,-.27]);
 // Hexagonal vacuum-transfer hub; modules connect radially, not as a cabinet.
 cyl(1.53,1.15,light,[0,1.27,-.54],root,6);cyl(1.43,.16,steel,[0,1.94,-.54],root,6);cyl(1.29,.05,dark,[0,2.05,-.54],root,6);
 ring(.69,.045,steel,[0,2.085,-.54]);cyl(.65,.026,glass,[0,2.091,-.54]);
 const robot=group([0,2.13,-.54]);box(1.29,.07,.13,steel,[.24,0,0],robot);box(.14,.09,.82,cyan,[.84,0,.34],robot);cyl(.15,.1,dark,[0,0,0],robot);
 const doors:THREE.Group[]=[];
 const stations:Position[]=[[-2.13,1.4,-.62],[2.13,1.4,-.62],[0,1.4,-2.83]];
 for(let i=0;i<stations.length;i++){
  const p=stations[i];
  const chamber=group(p);cyl(.97,1.18,steel,[0,0,0],chamber);cyl(.98,.14,dark,[0,-.52,0],chamber);ring(.98,.045,light,[0,.52,0],chamber);
  cyl(.79,.025,black,[0,.595,0],chamber);k.wafer(.68,.019,[0,.618,0],chamber);
  ring(.915,.025,dark,[0,.61,0],chamber);
  for(let b=0;b<12;b++){const a=b/12*Math.PI*2;cyl(.028,.025,gold,[Math.cos(a)*.87,.59,Math.sin(a)*.87],chamber,6);}
  // The axis sits behind the disk rim so the disk rises clear of the seal.
  const hingeDepth=1.04;
  const lid=group([0,.666,-hingeDepth],chamber);lid.name=`Etch process chamber ${i+1} hinged lid`;
  const lidDisk=cyl(.98,.16,light,[0,.05,hingeDepth],lid);lidDisk.name="etch-solid-chamber-cover";
  ring(.88,.026,steel,[0,.145,hingeDepth],lid);cyl(.36,.06,dark,[0,.16,hingeDepth],lid);
  box(.48,.09,.11,steel,[0,.23,hingeDepth+.66],lid);
  for(const x of[-.21,.21])box(.06,.1,.1,dark,[x,.18,hingeDepth+.66],lid);
  for(const x of[-.38,.38]){
   box(.16,.17,.21,steel,[x,.54,-.99],chamber);
   const hinge=cyl(.085,.28,steel,[x,0,0],lid);hinge.rotation.z=Math.PI/2;
  }
  // Fixed RF service boxes sit below the hinge sweep on the outer sides.
  const rf=group([i===0?-1.24:i===1?1.24:0,-.27,i<2?-.28:-1.18],chamber);
  rf.name="etch-fixed-rf-service";
  rounded(.81,.9,.54,.08,paint,[0,.28,0],rf);k.vent(0,.3,.295,.58,.48,rf);cyl(.07,.25,cyan,[0,-.34,0],rf);
  pipe([[.68,-.12,.35],[1.0,-.26,.35],[1.0,-.63,.35]],.11,dark,chamber);
  doors.push(lid);
 }
 // Short vacuum connectors between chamber modules and the transfer hub.
 for(const x of[-1.45,1.45]){const connection=cyl(.28,.67,steel,[x,1.52,-.6]);connection.rotation.z=Math.PI/2;for(const d of[-.19,.19]){const flange=ring(.3,.045,dark,[x+d,1.52,-.6]);flange.rotation.z=Math.PI/2;}}
 const rearConnection=cyl(.3,.75,steel,[0,1.52,-1.94]);rearConnection.rotation.x=Math.PI/2;
 // Two load locks feed the transfer hub from a front atmospheric interface.
 for(const x of[-.67,.67]){
  rounded(1.16,.81,1.12,.08,steel,[x,1.4,1.2]);box(1.01,.09,.96,dark,[x,1.84,1.2]);k.panel(.94,.58,x,1.4,1.8);
  box(.77,.06,.08,cyan,[x,1.7,1.84]);
 }
 rounded(6.4,1.13,1.0,.14,paint,[0,1.03,2.4]);box(6.48,.09,1.1,steel,[0,1.63,2.4]);
 for(const x of[-2.05,0,2.05]){
  box(1.4,.13,1.1,steel,[x,1.65,2.77]);k.foup(x,1.73,2.83,.96);k.panel(1.7,.81,x,1.03,2.94);
  for(const sx of[-.56,.56])box(.055,.35,.14,dark,[x+sx,1.87,2.32]);
 }
 k.display(3.24,2.43,2.34,.88,.66);box(.13,1.36,.16,steel,[3.24,1.8,2.16]);
 for(const x of[-3.15,3.15]){cyl(.26,.53,dark,[x,.72,-.68]);ring(.27,.032,steel,[x,.96,-.68]);}
 const statusX=3.27,statusZ=.04;
 cyl(.15,.075,dark,[statusX,.72,statusZ]);
 const statusMast=box(.136,2.44,.136,steel,[statusX,1.94,statusZ]);
 statusMast.name="etch-chassis-mounted-status-mast";
 k.status(statusX,3.11,statusZ);
 const update=(progress:number)=>{const p=ease(progress);doors.forEach((door,i)=>{door.rotation.x=-(1.18+i*.035)*p;});};update(0);
 return {root,view:{position:[9.4,7.2,13.3],target:[0,1.85,.0]},opening:["챔버 덮개를 열어 플라즈마 식각 모형으로 들어가요.","Open the chamber lids to explore the plasma-etching model.","チャンバーの蓋を開き、プラズマエッチングの模型へ進みます。"],mechanism:"cluster-lid",doorParts:doors,update};
}

export function createFrontShell(process:"wafer"|"oxidation"|"photo"|"etch",h:SceneHelpers):EquipmentShell{
 return process==="wafer"?cmpShell(h):process==="oxidation"?furnaceShell(h):process==="photo"?scannerShell(h):etcherShell(h);
}
