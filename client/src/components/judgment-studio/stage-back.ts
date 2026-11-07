import * as THREE from "three";
import type { SceneHelpers, SceneModel } from "./studio-types";
import { siliconWaferGeometry, siliconWaferMaterial } from "./stage-front";
import { depositionStages, metalStages } from "./studio-process-guide";

type BackProcess = "deposition" | "metal" | "eds" | "packaging";
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const mix = THREE.MathUtils.lerp;
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
type Point = [number, number, number];

/** Original teaching geometries. Formation progress is independent of scored records. */
export function createBackScene(process: BackProcess, h: SceneHelpers): SceneModel {
  if (process === "deposition") return deposition(h);
  if (process === "metal") return metal(h);
  if (process === "eds") return eds(h);
  return packaging(h);
}

function kit(h: SceneHelpers) {
  const root = new THREE.Group();
  const box = (w: number, y: number, d: number, mat: THREE.Material, p: Point, parent: THREE.Object3D = root) => h.box(w, y, d, mat, p, parent);
  const cyl = (r: number, height: number, mat: THREE.Material, p: Point, parent: THREE.Object3D = root) => h.cylinder(r, height, mat, p, parent);
  const ring = (r: number, tube: number, mat: THREE.Material, p: Point, parent: THREE.Object3D = root) => h.ring(r, tube, mat, p, parent);
  const line = (points: Point[], color: number, parent: THREE.Object3D = root) => h.line(points, color, parent);
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, p: Point, parent: THREE.Object3D = root) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m; };
  const tube = (points: Point[], radius: number, mat: THREE.Material, parent: THREE.Object3D = root) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),32,radius,7,false),mat,[0,0,0],parent);
  const bolts = (cx: number, y: number, cz: number, radius: number, count: number, parent: THREE.Object3D = root) => { for(let i=0;i<count;i++){const a=i/count*Math.PI*2;cyl(.035,.045,h.steel,[cx+Math.sin(a)*radius,y,cz+Math.cos(a)*radius],parent);} };
  const cabinet = (x:number,z:number,w=3.1,d=2.8) => {
    box(w,.3,d,h.dark,[x,.22,z]);box(w-.08,.065,d-.08,h.steel,[x,.405,z]);
    for(const sx of [-1,1])for(const sz of [-1,1])cyl(.095,.2,h.dark,[x+sx*(w/2-.22),.06,z+sz*(d/2-.22)]);
    box(w-.42,.24,.035,h.dark,[x,.24,z+d/2+.02]);
    for(let i=0;i<9;i++)box(.13,.018,.02,h.steel,[x+(i-4)*.23,.2,z+d/2+.047]);
  };
  const screen = (position:Point,parent:THREE.Object3D=root) => {
    box(.87,.56,.12,h.dark,position,parent);box(.75,.43,.014,h.material(0x0d2529,.1,.65),[position[0],position[1],position[2]+.067],parent);
    const bars:THREE.Mesh[]=[];
    for(let i=0;i<4;i++)bars.push(box(.11,.06+.04*i,.018,h.cyan,[position[0]-.26+i*.175,position[1]-.08+.02*i,position[2]+.08],parent));
    return bars;
  };
  const cursor = (position:Point,parent:THREE.Object3D=root) => {
    const group=new THREE.Group();group.position.set(...position);parent.add(group);
    const mat=new THREE.MeshBasicMaterial({color:0xf0b66b,transparent:true,opacity:.85,depthWrite:false});
    ring(.13,.014,mat,[0,0,0],group);box(.02,.4,.02,mat,[0,.2,0],group);return group;
  };
  const shell = (x:number,y:number,z:number,r:number,height:number,parent:THREE.Object3D=root) => {
    // The rear half is retained as a cutaway, so the active chamber remains visible.
    const wall=mesh(new THREE.CylinderGeometry(r,r,height,64,1,true,Math.PI/2,Math.PI),h.steel,[x,y,z],parent);
    ring(r,.075,h.steel,[x,y-height/2,z],parent);ring(r,.075,h.steel,[x,y+height/2,z],parent);
    for(const xx of [-1,1])box(.095,height+.35,.095,h.steel,[x+xx*r,y,z],parent);
    return wall;
  };
  const glowMat = (color:number,opacity=.16)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
  return {root,box,cyl,ring,line,mesh,tube,bolts,cabinet,screen,cursor,shell,glowMat};
}

function deposition(h:SceneHelpers):SceneModel {
  const k=kit(h), {root,box,cyl,ring,mesh,tube,bolts}=k;
  root.name="teaching-vapor-deposition";
  k.cabinet(-1.35,-.15,3.35,2.9);
  k.shell(-1.35,1.95,-.15,1.33,2.35);
  cyl(1.2,.16,h.dark,[-1.35,.76,-.15]);cyl(.7,.27,h.steel,[-1.35,.64,-.15]);
  // The wafer sits on the heated lower electrode beneath the showerhead.
  cyl(1.13,.15,h.dark,[-1.35,.97,-.15]);bolts(-1.35,1.045,-.15,1.03,10);
  const waferGroup=new THREE.Group();root.add(waferGroup);
  const waferTop=1.069;
  const siliconDisc=siliconWaferMaterial(h.wafer);
  const wafer=mesh(siliconWaferGeometry(.96,.024),siliconDisc,[0,1.057,-.15],waferGroup);
  const filmMat=h.material(0xa2e2ca,.12,.38);
  const transferArm=new THREE.Group();root.add(transferArm);
  box(.31,.055,.68,h.steel,[-.82,.989,-.15],transferArm);
  for(const z of [-.38,.08])box(1.48,.045,.1,h.steel,[-.16,1.023,z],transferArm);

  const head=new THREE.Group();head.position.set(-1.35,2.82,-.15);root.add(head);
  const distributor=cyl(1.09,.2,h.steel,[0,0,0],head);cyl(.78,.2,h.dark,[0,.17,0],head);
  cyl(.16,.35,h.steel,[0,.44,0],head);ring(1.11,.045,h.gold,[0,-.12,0],head);
  const holeMat=h.material(0x152a28,.2,.55);
  const gasPorts:Point[]=[];
  for(let row=-4;row<=4;row++)for(let col=-4;col<=4;col++){
    if(row*row+col*col>=18)continue;
    const port:Point=[col*.21,-.109,row*.21];gasPorts.push(port);cyl(.033,.015,holeMat,port,head);
  }
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;cyl(.043,.05,h.steel,[Math.sin(a)*.93,.13,Math.cos(a)*.93],head);}
  tube([[-1.35,3.4,-.15],[-1.35,3.75,-.15],[-2.6,3.75,-.7],[-2.8,2.15,-.8]],.065,h.steel);
  cyl(.22,1.1,h.cyan,[-2.85,1.02,-1.04]);cyl(.12,.2,h.steel,[-2.85,1.67,-1.04]);
  cyl(.22,1.1,h.gold,[-2.3,1.02,-1.14]);cyl(.12,.2,h.steel,[-2.3,1.67,-1.14]);
  tube([[-2.3,1.8,-1.14],[-2.3,2.1,-1.14],[-2.8,2.1,-.8]],.035,h.steel);
  tube([[-1.4,.9,-1.3],[-1.4,.7,-1.85],[-.6,.7,-1.85],[-.3,.5,-1.85]],.09,h.dark);
  for(let i=0;i<6;i++)ring(.11,.018,h.steel,[-.45-i*.11,.7,-1.85]).rotation.z=Math.PI/2;
  const display=k.screen([-2.7,.76,1.34]);

  const particles: THREE.Mesh[]=[];
  const sphere=new THREE.SphereGeometry(.034,8,6);
  const particleA=new THREE.MeshStandardMaterial({color:0x7ee1c7,emissive:0x214b3b,emissiveIntensity:.8,roughness:.3});
  const particleB=new THREE.MeshStandardMaterial({color:0xe4aa55,emissive:0x57411e,emissiveIntensity:.5,roughness:.3});
  for(let i=0;i<42;i++)particles.push(mesh(sphere,i%3===0?particleB:particleA,[0,0,0]));

  // The magnified profile repeats the etch example after the resist is stripped:
  // five retained stripes of the etched film with openings down to silicon.
  const detail=new THREE.Group();detail.position.set(2.12,.52,.45);root.add(detail);
  const silicon=h.material(0x38586f,.38,.45);
  const etchedFilm=h.material(0x5a9590,.26,.47);
  const substrate=box(2.7,.33,2,silicon,[0,.2,0],detail);
  substrate.name="unchanged-silicon-under-etched-film";
  const ridgeWidth=.26, ridgeHeight=.58, ridgeDepth=1.98;
  const substrateTop=.365, ridgeTop=substrateTop+ridgeHeight, coatMax=.068;
  const ridgeCenters=[-1.04,-.52,0,.52,1.04];
  const waferProfile=new THREE.Group();
  waferProfile.position.set(0,waferTop-substrateTop*.075,-.15);
  waferProfile.scale.set(.58,.075,.52);
  waferGroup.add(waferProfile);
  const waferFieldThickness=coatMax*waferProfile.scale.y;
  const waferFieldFilm=mesh(siliconWaferGeometry(.96,waferFieldThickness),filmMat,[0,waferTop,-.15],waferGroup);
  waferFieldFilm.name="cvd-film-on-exposed-wafer";

  const makeProfile=(parent:THREE.Group, includeFloor:boolean)=>{
    const ridges=ridgeCenters.map(x=>{
      box(ridgeWidth,ridgeHeight,ridgeDepth,etchedFilm,[x,substrateTop+ridgeHeight/2,0],parent).name="retained-etched-film";
      const top=box(ridgeWidth+2*coatMax,coatMax,ridgeDepth,filmMat,[x,ridgeTop,0],parent);
      const left=box(coatMax,ridgeHeight,ridgeDepth,filmMat,[x-ridgeWidth/2,substrateTop+ridgeHeight/2,0],parent);
      const right=box(coatMax,ridgeHeight,ridgeDepth,filmMat,[x+ridgeWidth/2,substrateTop+ridgeHeight/2,0],parent);
      top.name="cvd-new-film-top";left.name=right.name="cvd-new-film-sidewall";
      return {x,top,left,right};
    });
    const floorSpans:[number,number][]=[[-.78,.26],[-.26,.26],[.26,.26],[.78,.26],[-1.26,.18],[1.26,.18]];
    const floors=(includeFloor?floorSpans:[]).map(([x,width])=>{
      const floor=box(width,coatMax,ridgeDepth,filmMat,[x,substrateTop,0],parent);
      floor.name="cvd-new-film-floor";return floor;
    });
    return {ridges,floors};
  };
  const profiles=[makeProfile(detail,true),makeProfile(waferProfile,false)];
  const detailMolecules:THREE.Mesh[]=[];
  for(let i=0;i<15;i++)detailMolecules.push(mesh(sphere,i%3?particleA:particleB,[-1+i%5*.5,1.2,Math.floor(i/5)*.47-.47],detail));
  const readyRing=ring(1.1,.02,h.cyan,[-1.35,1.08,-.15]);
  const cvd=new THREE.Group();cvd.name="cvd-etched-sample-and-reactor";
  cvd.add(...root.children.slice());root.add(cvd);

  // Separate masked sample and beamline. Dots on the cut face represent
  // the distribution inside opaque silicon under the exposed opening.
  const implant=new THREE.Group();implant.name="ion-implantation-separate-example";root.add(implant);
  const implantDetail=new THREE.Group();implantDetail.position.copy(detail.position);implant.add(implantDetail);
  const mask=h.material(0xc29159,.12,.46);
  const dopant=new THREE.MeshBasicMaterial({color:0xbb97ff});
  const beamMat=new THREE.MeshBasicMaterial({color:0xb58cf6,transparent:true,opacity:.16,depthWrite:false});
  const implantSurface=.74, maskHeight=.16, windowHalfWidth=.57;
  const implantBase=box(2.7,implantSurface-.06,2,silicon,[0,(implantSurface+.06)/2,0],implantDetail);
  implantBase.name="implant-silicon-cutaway";
  k.line([[-windowHalfWidth,implantSurface,1.003],[windowHalfWidth,implantSurface,1.003]],0x9dd0e8,implantDetail);
  for(const side of [-1,1]){
    const width=1.35-windowHalfWidth;
    box(width,maskHeight,1.98,mask,[side*(windowHalfWidth+width/2),implantSurface+maskHeight/2,0],implantDetail).name="implant-blocking-mask";
  }
  // More markers fall near the peak depth. Interleave bands as dose builds
  // so increasing the count does not imply the beam energy has changed.
  const depthBands=[[.075,3],[.115,6],[.155,8],[.195,7],[.238,5],[.287,3]];
  const cutFaceSamples=depthBands.flatMap(([depth,count],band)=>
    Array.from({length:count},(_,i)=>[
      (i/(count-1)-.5)*.94+Math.sin(band*2+i*1.7)*.025,
      implantSurface-depth+Math.sin(i*2.1+band)*.011,
    ]),
  );
  const dopantGeometry=new THREE.SphereGeometry(.022,8,6);
  const markers=cutFaceSamples.map((_,i)=>{
    const [x,y]=cutFaceSamples[(i*13)%cutFaceSamples.length];
    const marker=mesh(dopantGeometry,dopant,[x,y,1.004],implantDetail);
    marker.name="dopant-within-exposed-silicon";marker.castShadow=false;return marker;
  });

  // A compact beamline cutaway illustrates the accelerator and narrow outlet.
  const implanterCenter=-1.35, beamExit=2.52, sampleY=1.1;
  box(3.46,.32,2.82,h.dark,[implanterCenter,.24,-.15],implant);
  box(3.29,.07,2.72,h.steel,[implanterCenter,.43,-.15],implant);
  box(2.9,.15,2.5,h.steel,[implanterCenter,.81,-.15],implant);
  for(const x of [-2.73,.03])box(.17,2.58,.17,h.steel,[x,2.14,-1.13],implant);
  box(2.94,.22,.48,h.dark,[implanterCenter,3.51,-.98],implant);
  box(.31,.16,1.12,h.steel,[implanterCenter,3.35,-.61],implant);
  cyl(.43,.63,h.steel,[implanterCenter,3.18,-.15],implant);
  box(.47,.46,.46,h.dark,[-2.66,3.56,-.91],implant).name="implant-ion-source-housing";
  tube([[-2.43,3.56,-.91],[-2.1,3.56,-.91],[-1.63,3.56,-.71],[implanterCenter,3.54,-.15]],.071,h.steel,implant);
  const analyzerMaterial=h.material(0x385a66,.58,.42);
  for(const y of [3.43,3.69]){
    box(.55,.12,.39,analyzerMaterial,[-2.09,y,-.87],implant).name="implant-mass-selection-magnet";
  }
  box(.1,.39,.39,analyzerMaterial,[-2.34,3.56,-.87],implant);
  for(let i=0;i<3;i++)ring(.48,.034,h.dark,[implanterCenter,2.99+i*.16,-.15],implant);
  const ionSource=cyl(.36,.25,h.dark,[implanterCenter,2.73,-.15],implant);
  ionSource.name="implant-beamline-outlet";
  cyl(.24,.12,h.steel,[implanterCenter,2.56,-.15],implant);
  ring(.21,.026,dopant,[implanterCenter,beamExit,-.15],implant);
  const scanChuck=new THREE.Group();
  scanChuck.name="implant-wafer-scan-stage";implant.add(scanChuck);
  for(const z of [-.8,.52])box(2.65,.085,.105,h.dark,[implanterCenter,.9,z],implant);
  cyl(1.13,.17,h.dark,[implanterCenter,.976,-.15],scanChuck);
  mesh(siliconWaferGeometry(.96,.024),siliconDisc,[implanterCenter,sampleY-.012,-.15],scanChuck);
  const carrierMaskHeight=.038, carrierOpening=.265;
  for(const side of [-1,1]){
    box(.47,carrierMaskHeight,1.11,mask,[implanterCenter+side*.5,sampleY+carrierMaskHeight/2,-.15],scanChuck);
  }
  tube([[-1.35,3.55,-.15],[-1.35,3.73,-.64],[-2.6,3.62,-1.12],[-2.72,1.01,-1.12]],.052,h.dark,implant);
  const beam=mesh(new THREE.CylinderGeometry(.13,.21,beamExit-sampleY,24,1,true),beamMat,[implanterCenter,(beamExit+sampleY)/2,-.15],implant);
  beam.castShadow=false;
  const beamParticles=Array.from({length:12},(_,i)=>mesh(sphere,dopant,[implanterCenter+(i%3-1)*.092,beamExit,-.15],implant));
  const cutawayIons=[-.9,-.42,-.21,0,.21,.42,.9].map(x=>{
    const ion=mesh(new THREE.ConeGeometry(.037,.13,8),dopant,[x,1.8,1.026],implantDetail);
    ion.rotation.z=Math.PI;ion.castShadow=false;return ion;
  });
  const observation=k.cursor([0,0,0]);
  let motion=0;
  return {root,hotspots:[
    {id:"load",object:wafer,label:["웨이퍼","Wafer","ウェーハ"]},
    {id:"process",object:distributor,label:["가스 분배부","Gas distributor","ガス分配部"]},
    {id:"inspect",object:substrate,label:["식각 단차와 새 막","Etched steps and new film","エッチング段差と新しい膜"]},
    {id:"implant-source",object:ionSource,label:["이온 빔 출구","Ion beam outlet","イオンビームの出口"]},
    {id:"implant-section",object:implantBase,label:["이온 주입 단면","Implantation cross-section","イオン注入の断面"]},
  ],views:{overview:{position:[6.03,4.38,7.6],target:[.15,1.7,0]},detail:{position:[5.1,3.3,5.5],target:[2.05,1.05,.55]},inspection:{position:[4.9,4.1,6.6],target:[1.25,1.05,.25]}},
  update(s,dt){const p=clamp(s.progress);if(s.running&&!s.reducedMotion)motion+=Math.min(dt,.1);
    const implantMode=p>=depositionStages.mask;
    cvd.visible=!implantMode;implant.visible=implantMode;
    const growing=clamp((p-depositionStages.cvd)/(.55-depositionStages.cvd));
    const implanted=clamp((p-depositionStages.implant)/(1-depositionStages.implant));
    const reacting=s.setup>=3&&s.phase==="react";
    const load=clamp(s.setup>=1?1:(s.loadProgress??0));waferGroup.position.x=mix(-3.45,-1.35,load);
    transferArm.visible=s.setup<2;transferArm.position.x=waferGroup.position.x;
    head.position.y=s.setup>=2?2.82:3.2;
    readyRing.visible=s.phase==="prepare"&&s.setup<1;readyRing.position.x=waferGroup.position.x;
    const reaction=reacting&&p>=depositionStages.cvd&&p<depositionStages.mask;
    const coating=coatMax*growing;
    const heightAt=(x:number,z:number)=>{
      const onRidge=Math.abs(z)<ridgeDepth/2&&ridgeCenters.some(center=>Math.abs(x-center)<ridgeWidth/2+coating);
      return (onRidge?ridgeTop:substrateTop)+coating;
    };
    waferFieldFilm.visible=growing>0;
    waferFieldFilm.scale.y=Math.max(.001,growing);
    waferFieldFilm.position.y=waferTop+waferFieldThickness*growing/2;
    particles.forEach((particle,i)=>{
      const [x,y,z]=gasPorts[(i*17)%gasPorts.length];const q=(motion*.5+i/particles.length)%1;
      const landX=x*(1+.08*q),landZ=z*(1+.08*q);
      const landingHeight=waferTop+(heightAt(landX/waferProfile.scale.x,landZ/waferProfile.scale.z)-substrateTop)*waferProfile.scale.y;
      particle.visible=reaction;
      particle.position.set(head.position.x+landX,mix(head.position.y+y-.025,landingHeight+.035,q),head.position.z+landZ);
      particle.scale.setScalar(.7+(i%3)*.15);
    });
    for(const {ridges,floors} of profiles){
      for(const {top,left,right,x} of ridges){
        top.visible=left.visible=right.visible=growing>0;
        top.scale.set((ridgeWidth+2*coating)/(ridgeWidth+2*coatMax),growing,1);
        top.position.y=ridgeTop+coating/2;
        left.scale.set(growing,(ridgeHeight-coating)/ridgeHeight,1);
        right.scale.copy(left.scale);
        left.position.set(x-(ridgeWidth+coating)/2,substrateTop+(ridgeHeight+coating)/2,0);
        right.position.set(x+(ridgeWidth+coating)/2,left.position.y,0);
      }
      for(const floor of floors){floor.visible=growing>0;floor.scale.y=growing;floor.position.y=substrateTop+coating/2;}
    }
    observation.position.set(detail.position.x-1.12+clamp(s.parameter)*2.24,detail.position.y+(implantMode?implantSurface:ridgeTop+coating)+.075,detail.position.z+1.06);
    detailMolecules.forEach((m,i)=>{
      const q=(motion*.42+i/detailMolecules.length)%1;
      m.visible=reaction;m.position.y=mix(1.82,heightAt(m.position.x,m.position.z)+.034,q);
    });
    display.forEach((bar,i)=>bar.scale.y=.7+growing*(i+1)*.24);

    const beamOn=reacting&&p>=depositionStages.implant;
    beam.visible=beamOn;
    scanChuck.position.x=beamOn?Math.sin(motion*2.15)*.34:0;
    const beamBottom=sampleY+(Math.abs(scanChuck.position.x)>carrierOpening?carrierMaskHeight:0);
    beam.position.y=(beamExit+beamBottom)/2;
    beam.scale.y=(beamExit-beamBottom)/(beamExit-sampleY);
    beamParticles.forEach((particle,i)=>{
      const hitMask=Math.abs(particle.position.x-implanterCenter-scanChuck.position.x)>carrierOpening;
      const end=sampleY+(hitMask?carrierMaskHeight:0)+.035;
      particle.visible=beamOn;particle.position.y=mix(beamExit,end,(motion*1.6+i/beamParticles.length)%1);
    });
    cutawayIons.forEach((ion,i)=>{
      const blocked=Math.abs(ion.position.x)>windowHalfWidth;
      const end=blocked?implantSurface+maskHeight+.068:implantSurface-.13;
      ion.visible=beamOn;ion.position.y=mix(1.8,end,(motion*1.4+i/cutawayIons.length)%1);
    });
    const count=Math.floor(implanted*markers.length+1e-9);
    markers.forEach((marker,i)=>{marker.visible=i<count;});
  }};
}

function metal(h:SceneHelpers):SceneModel {
  const k=kit(h),{root,box,cyl,ring,mesh,tube,bolts}=k;
  root.name="teaching-metal-pvd-and-contacts";
  k.cabinet(-1.45,-.1,3.25,2.95);k.shell(-1.45,1.95,-.2,1.3,2.4);
  cyl(1.17,.2,h.steel,[-1.45,.8975,-.2]);cyl(.66,.34,h.dark,[-1.45,.64,-.2]);
  const movingWafer=new THREE.Group();root.add(movingWafer);
  const wafer=cyl(1.06,.045,h.wafer,[0,1.02,-.2],movingWafer);
  const tungsten=h.material(0x626c77,.7,.39);
  const waferTop=1.0425, maximumFilm=.013;
  const coatedWafer=cyl(1.062,maximumFilm,tungsten,[0,waferTop,-.2],movingWafer);
  const targetGroup=new THREE.Group();targetGroup.position.set(-1.45,2.95,-.2);root.add(targetGroup);
  const target=cyl(1.08,.19,h.material(0xa4a9b0,.86,.28),[0,0,0],targetGroup);cyl(.86,.11,h.dark,[0,.17,0],targetGroup);bolts(0,.28,0,.84,12,targetGroup);
  for(let i=0;i<4;i++)ring(.18+i*.2,.009,h.dark,[0,-.102,0],targetGroup);
  tube([[-1.45,3.28,-.2],[-1.45,3.65,-.2],[-2.65,3.65,-.7],[-2.85,2.2,-1.05]],.065,h.steel);
  tube([[-2.55,1.05,-1],[-2.9,1.05,-1.5],[-2.9,.7,-1.9],[-1.9,.7,-1.9]],.095,h.dark);
  cyl(.28,.75,h.dark,[-2.75,.86,-1.56]);ring(.29,.045,h.steel,[-2.75,1.26,-1.56]);
  for(const x of [-2.62,-.28])box(.1,2.55,.11,h.steel,[x,1.95,.65]);
  k.screen([-2.58,.76,1.39]);
  const plasmaMat=new THREE.MeshBasicMaterial({color:0x7694e9,transparent:true,opacity:.08,depthWrite:false});
  const plasma=cyl(1.02,.25,plasmaMat,[-1.45,2.54,-.2]);
  const ionMat=new THREE.MeshStandardMaterial({color:0x96c5ee,emissive:0x3c689c,emissiveIntensity:1});
  const atomMat=new THREE.MeshStandardMaterial({color:0xbdc9d4,emissive:0x415064,emissiveIntensity:.58});
  const sphere=new THREE.SphereGeometry(.037,8,6);
  const ionParticles:THREE.Mesh[]=[],metalParticles:THREE.Mesh[]=[];
  for(let i=0;i<18;i++)ionParticles.push(mesh(sphere,ionMat,[0,0,0]));
  for(let i=0;i<32;i++)metalParticles.push(mesh(sphere,atomMat,[0,0,0]));

  // Two contacts on the front cut share the upper route. A third contact
  // remains separate under the wiring dielectric.
  const detail=new THREE.Group();detail.position.set(2.05,.54,.55);root.add(detail);
  const substrate=box(2.5,.225,1.8,h.material(0x334d61,.45,.4),[0,-.0375,0],detail);
  const layerBottom=.15, layerHeight=.55, fieldTop=layerBottom+layerHeight;
  const halfDepth=.85, holeRadius=.192, wallThickness=.018, fieldThickness=.022, floorThickness=.018;
  const leftContact=-.77, rightContact=.77, segments=56;
  type PlanPoint=[x:number,z:number];
  const shapeFrom=(outline:PlanPoint[])=>{
    const shape=new THREE.Shape();
    shape.moveTo(outline[0][0],-outline[0][1]);
    for(const [x,z] of outline.slice(1))shape.lineTo(x,-z);
    shape.closePath();
    return shape;
  };
  const contactPositions=[
    {x:leftContact,z:halfDepth,cutaway:true},
    {x:rightContact,z:halfDepth,cutaway:true},
    {x:0,z:-.39,cutaway:false},
  ];
  const fieldShape=new THREE.Shape();
  fieldShape.moveTo(-1.2,-halfDepth);
  for(const x of [leftContact,rightContact]){
    fieldShape.lineTo(x-holeRadius,-halfDepth);
    fieldShape.absarc(x,-halfDepth,holeRadius,Math.PI,0,true);
  }
  fieldShape.lineTo(1.2,-halfDepth);
  fieldShape.lineTo(1.2,halfDepth);
  fieldShape.lineTo(-1.2,halfDepth);
  fieldShape.closePath();
  for(const contact of contactPositions.filter(position=>!position.cutaway)){
    const hole=new THREE.Path();
    hole.absarc(contact.x,-contact.z,holeRadius,0,Math.PI*2,true);
    fieldShape.holes.push(hole);
  }
  const shapedLayer=(shape:THREE.Shape,depth:number,material:THREE.Material,height:number)=>{
    const layer=mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:28}),material,[0,height,0],detail);
    layer.rotation.x=-Math.PI/2;return layer;
  };
  // Pre-existing conductive landing pads are embedded in an insulating level.
  // Each W plug reaches one pad. Only the two front pads are linked by this Cu line.
  const landingBottom=.075, landingHeight=layerBottom-landingBottom, landingHalfWidth=.22;
  const leftLandingBack=.35, rightLandingBack=.24, rearLandingBack=-.65, rearLandingFront=-.13;
  const lowerDielectricShape=shapeFrom([
    [-1.2,halfDepth],[leftContact-landingHalfWidth,halfDepth],
    [leftContact-landingHalfWidth,leftLandingBack],[leftContact+landingHalfWidth,leftLandingBack],
    [leftContact+landingHalfWidth,halfDepth],[rightContact-landingHalfWidth,halfDepth],
    [rightContact-landingHalfWidth,rightLandingBack],[rightContact+landingHalfWidth,rightLandingBack],
    [rightContact+landingHalfWidth,halfDepth],[1.2,halfDepth],[1.2,-halfDepth],[-1.2,-halfDepth],
  ]);
  lowerDielectricShape.holes.push(shapeFrom([
    [-landingHalfWidth,rearLandingBack],[landingHalfWidth,rearLandingBack],
    [landingHalfWidth,rearLandingFront],[-landingHalfWidth,rearLandingFront],
  ]));
  const lowerDielectric=h.material(0x82919f,.14,.54);
  shapedLayer(lowerDielectricShape,landingHeight,lowerDielectric,landingBottom).name="isolating-dielectric-below-contacts";
  const landingMetal=h.material(0x98765a,.6,.44);
  for(const [x,back,front] of [[leftContact,leftLandingBack,halfDepth],[rightContact,rightLandingBack,halfDepth],[0,rearLandingBack,rearLandingFront]]){
    box(landingHalfWidth*2,landingHeight,front-back,landingMetal,[x,landingBottom+landingHeight/2,(front+back)/2],detail).name="lower-conductive-landing-pad";
  }
  const dielectric=h.material(0x7c9b9c,.1,.55);
  shapedLayer(fieldShape,layerHeight,dielectric,layerBottom).name="contact-dielectric";
  const fieldFilm=shapedLayer(fieldShape,fieldThickness,tungsten,fieldTop);
  fieldFilm.name="tungsten-field-film";
  const insideTungsten=tungsten.clone();
  insideTungsten.side=THREE.BackSide;
  const liners=contactPositions.map(({x,z,cutaway})=>{
    const start=cutaway?Math.PI/2:0;
    const angle=cutaway?Math.PI:Math.PI*2;
    const wall=mesh(new THREE.CylinderGeometry(holeRadius,holeRadius,layerHeight,segments,1,true,start,angle),insideTungsten,[x,fieldTop-layerHeight/2,z],detail);
    const floor=mesh(new THREE.CylinderGeometry(holeRadius,holeRadius,floorThickness,segments,1,false,start,angle),tungsten,[x,layerBottom,z],detail);
    const rimGeometry=new THREE.RingGeometry(holeRadius-wallThickness,holeRadius,segments,1,0,angle);
    const rim=mesh(rimGeometry,tungsten,[x,fieldTop,z],detail);
    rim.rotation.x=-Math.PI/2;
    wall.name="tungsten-contact-wall";floor.name="tungsten-contact-floor";rim.name="tungsten-contact-rim";
    const cutEdges=cutaway?[-1,1].map(side=>({
      side,edge:box(holeRadius,layerHeight,.006,tungsten,[x,fieldTop-layerHeight/2,z],detail),
    })):[];
    const plug=mesh(new THREE.CylinderGeometry(holeRadius,holeRadius,layerHeight,segments,1,false,start,angle),tungsten,[x,layerBottom+layerHeight/2,z],detail);
    plug.name="tungsten-contact-plug";
    if(cutaway){
      // CylinderGeometry leaves the radial face of a sector open.
      const cutFace=box(holeRadius*2,layerHeight,.004,tungsten,[0,0,.001],plug);
      cutFace.name="tungsten-plug-cut-face";
    }
    return {x,wall,floor,rim,rimGeometry,angle,cutEdges,plug};
  });

  // Separate damascene level: a U-shaped trench opens onto both W plugs.
  const bendZ=.25, traceHalfWidth=.145, wiringHeight=.215;
  const trenchOutline=(width:number):PlanPoint[]=>[
    [leftContact-width,halfDepth],[leftContact-width,bendZ-width],
    [rightContact+width,bendZ-width],[rightContact+width,halfDepth],
    [rightContact-width,halfDepth],[rightContact-width,bendZ+width],
    [leftContact+width,bendZ+width],[leftContact+width,halfDepth],
  ];
  const outline=trenchOutline(traceHalfWidth);
  const outerShape=shapeFrom([[-1.2,halfDepth],...outline.slice(0,4),[1.2,halfDepth],[1.2,-halfDepth],[-1.2,-halfDepth]]);
  const islandShape=shapeFrom(outline.slice(4));
  const trenchShape=shapeFrom(outline);
  const topInsulator=h.material(0x828ca4,.12,.52);
  const insulatingPieces=[outerShape,islandShape].map(shape=>shapedLayer(shape,wiringHeight,topInsulator,fieldTop));
  insulatingPieces.forEach(piece=>piece.name="wiring-dielectric");
  const unetchedTrench=shapedLayer(trenchShape,wiringHeight,topInsulator,fieldTop);
  unetchedTrench.name="unetched-wiring-dielectric";

  const barrier=h.material(0x3e4654,.62,.45);
  const copper=h.material(0xb9653d,.64,.37);
  const barrierThickness=.012, seedThickness=.008, copperOverfill=.062;
  const seedOutline=trenchOutline(traceHalfWidth-barrierThickness);
  const copperShape=shapeFrom(trenchOutline(traceHalfWidth-barrierThickness-seedThickness));
  const barrierFloor=shapedLayer(trenchShape,barrierThickness,barrier,fieldTop);
  const seedFloor=shapedLayer(shapeFrom(seedOutline),seedThickness,copper,fieldTop+barrierThickness);
  const makeTrenchWalls=(points:PlanPoint[],material:THREE.MeshStandardMaterial)=>{
    const vertices:number[]=[];
    for(let i=0;i<points.length;i++){
      const [x0,z0]=points[i], [x1,z1]=points[(i+1)%points.length];
      if(z0===halfDepth&&z1===halfDepth)continue;
      vertices.push(x0,0,z0,x1,0,z1,x1,wiringHeight,z1,x0,0,z0,x1,wiringHeight,z1,x0,wiringHeight,z0);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
    geometry.computeVertexNormals();
    const inside=material.clone();inside.side=THREE.DoubleSide;
    return mesh(geometry,inside,[0,fieldTop,0],detail);
  };
  const barrierWalls=makeTrenchWalls(seedOutline,barrier);
  const seedWalls=makeTrenchWalls(trenchOutline(traceHalfWidth-barrierThickness-seedThickness),copper);
  const wiringTop=fieldTop+wiringHeight;
  const barrierField=[outerShape,islandShape].map(shape=>shapedLayer(shape,barrierThickness,barrier,wiringTop));
  const seedField=[outerShape,islandShape].map(shape=>shapedLayer(shape,seedThickness,copper,wiringTop+barrierThickness));
  const copperLine=shapedLayer(copperShape,wiringHeight,copper,fieldTop+barrierThickness+seedThickness);
  copperLine.name="copper-connection-line";
  const copperOverburden=box(2.4,copperOverfill,halfDepth*2,copper,[0,wiringTop,0],detail);
  copperOverburden.name="copper-field-overburden";
  const observer=k.cursor([0,.94,.95],detail);
  const microscope=new THREE.Group();microscope.position.set(2.7,1.4,-.85);root.add(microscope);
  box(.25,.25,.35,h.dark,[0,.65,0],microscope);cyl(.11,.4,h.steel,[0,.37,.1],microscope);cyl(.13,.13,h.dark,[0,.12,.1],microscope);
  const marker=ring(1.14,.018,h.cyan,[-1.45,1.045,-.2]);
  let motion=0, renderedProgress=-1;
  const stepProgress=(progress:number,start:number,end:number)=>clamp((progress-start)/(end-start));
  return {root,hotspots:[
    {id:"load",object:wafer,label:["웨이퍼","Wafer","ウェーハ"]},
    {id:"process",object:target,label:["스퍼터링 타깃","Sputtering target","スパッタリングターゲット"]},
    {id:"inspect",object:substrate,label:["금속 라이너 단면","Metal liner cross-section","金属ライナーの断面"]},
  ],views:{overview:{position:[6.1,4.5,7.76],target:[.1,1.7,0]},detail:{position:[5.2,3.2,5.4],target:[2.03,1.0,.55]},inspection:{position:[4.8,4.1,6.4],target:[1.65,1.0,.4]}},
  update(s,dt){const p=clamp(s.progress);if(s.running&&!s.reducedMotion)motion+=Math.min(dt,.1);
    const load=clamp(s.setup>=1?1:(s.loadProgress??0));movingWafer.position.x=mix(-3.3,-1.45,load);marker.visible=s.phase==="prepare"&&s.setup<1;marker.position.x=movingWafer.position.x;
    targetGroup.position.y=s.setup>=2?2.95:3.3;
    const linerAmount=stepProgress(p,metalStages.liner,metalStages.fill);
    const reaction=s.setup>=3&&s.phase==="react"&&p<metalStages.fill;plasma.visible=reaction;
    const filmHeight=maximumFilm*linerAmount, targetFace=targetGroup.position.y-.095;
    coatedWafer.visible=linerAmount>0;coatedWafer.scale.y=Math.max(.001,linerAmount);coatedWafer.position.y=waferTop+filmHeight/2;
    // Blue ions approach the target. Gray tungsten markers travel from its
    // surface to the wafer.
    ionParticles.forEach((m,i)=>{
      const q=(motion*.63+i/ionParticles.length)%1,a=i*2.399,r=.55+(i%6)*.063;
      m.visible=reaction;m.position.set(-1.45+Math.sin(a)*r,mix(2.45,targetFace-.025,q*q),-.2+Math.cos(a)*r);
    });
    metalParticles.forEach((m,i)=>{
      const q=(motion*.44+i/metalParticles.length)%1,a=i*2.399;
      const radius=mix(.54+(i%6)*.063,.1+(i%9)*.102,q);
      m.visible=reaction;m.position.set(-1.45+Math.sin(a)*radius,mix(targetFace-.028,waferTop+filmHeight+.035,q),-.2+Math.cos(a)*radius);
    });
    if(p!==renderedProgress){
      renderedProgress=p;
      const fill=stepProgress(p,metalStages.fill,metalStages.planarize);
      const contactPolish=stepProgress(p,metalStages.planarize,metalStages.trench);
      const radius=(holeRadius-wallThickness*linerAmount)*(1-fill);
      const thickness=holeRadius-radius;
      const radialScale=Math.max(.001,radius/holeRadius);
      const bottomHeight=floorThickness*linerAmount+.072*fill;
      const fieldMetalHeight=(fieldThickness*linerAmount+.052*fill)*(1-contactPolish);
      const rimHeight=fieldTop+fieldMetalHeight;
      const wallHeight=rimHeight-layerBottom-bottomHeight;
      fieldFilm.visible=fieldMetalHeight>.0001;fieldFilm.scale.z=Math.max(.001,fieldMetalHeight/fieldThickness);
      for(const {x,wall,floor,rim,rimGeometry,angle,cutEdges,plug} of liners){
        wall.visible=floor.visible=rim.visible=linerAmount>0&&fill<1;
        plug.visible=fill>=1;
        plug.scale.y=(rimHeight-layerBottom)/layerHeight;
        plug.position.y=(rimHeight+layerBottom)/2;
        wall.scale.set(radialScale,wallHeight/layerHeight,radialScale);
        wall.position.y=layerBottom+bottomHeight+wallHeight/2;
        floor.scale.set(radialScale,Math.max(.001,bottomHeight/floorThickness),radialScale);
        floor.position.y=layerBottom+bottomHeight/2;
        rim.position.y=rimHeight+.0006;
        // The opening narrows as the W film grows inward from the sidewalls.
        const position=rimGeometry.getAttribute("position");
        for(let i=0;i<=segments;i++){
          const theta=i/segments*angle;
          position.setXY(i,Math.cos(theta)*radius,Math.sin(theta)*radius);
        }
        position.needsUpdate=true;
        for(const {side,edge} of cutEdges){
          edge.visible=wall.visible;
          edge.scale.set(Math.max(.001,thickness/holeRadius),wallHeight/layerHeight,1);
          edge.position.x=x+side*(holeRadius-thickness/2);
          edge.position.y=wall.position.y;
        }
      }

      const insulator=stepProgress(p,metalStages.trench,.62);
      const etch=stepProgress(p,.62,.69);
      const barrierAmount=stepProgress(p,.69,.73);
      const seedAmount=stepProgress(p,.73,metalStages.route);
      const plating=stepProgress(p,metalStages.route,metalStages.copperPolish);
      const copperPolish=stepProgress(p,metalStages.copperPolish,1);
      const remainingField=1-copperPolish;
      insulatingPieces.forEach(piece=>{piece.visible=insulator>0;piece.scale.z=Math.max(.001,insulator);});
      unetchedTrench.visible=insulator>0&&etch<1;
      unetchedTrench.scale.z=Math.max(.001,insulator*(1-etch));

      barrierFloor.visible=barrierWalls.visible=barrierAmount>0;
      barrierFloor.scale.z=Math.max(.001,barrierAmount);
      barrierWalls.scale.y=Math.max(.001,barrierAmount);
      seedFloor.visible=seedWalls.visible=seedAmount>0;
      seedFloor.scale.z=Math.max(.001,seedAmount);
      seedWalls.scale.y=Math.max(.001,seedAmount);
      const barrierAbove=barrierThickness*barrierAmount*remainingField;
      const seedAbove=seedThickness*seedAmount*remainingField;
      for(const piece of barrierField){
        piece.visible=barrierAbove>.0001;piece.scale.z=Math.max(.001,barrierAbove/barrierThickness);
      }
      for(const piece of seedField){
        piece.visible=seedAbove>.0001;piece.scale.z=Math.max(.001,seedAbove/seedThickness);
        piece.position.y=wiringTop+barrierAbove;
      }
      const platedHeight=(wiringHeight+barrierAbove+seedAbove-barrierThickness-seedThickness)*clamp(plating/.83);
      copperLine.visible=plating>0;
      copperLine.scale.z=Math.max(.001,platedHeight/wiringHeight);
      const overfill=copperOverfill*stepProgress(plating,.83,1)*remainingField;
      copperOverburden.visible=overfill>.0001;
      copperOverburden.scale.y=Math.max(.001,overfill/copperOverfill);
      copperOverburden.position.y=wiringTop+barrierAbove+seedAbove+overfill/2;
    }
    observer.position.x=-1.04+clamp(s.parameter)*2.08;
  }};
}

function eds(h:SceneHelpers):SceneModel {
  const k=kit(h),{root,box,cyl,ring,mesh,tube}=k;
  root.name="teaching-wafer-prober-and-tester";
  k.cabinet(-1.25,-.05,3.6,3.15);
  box(3.15,.19,2.75,h.dark,[-1.25,.61,-.1]);
  for(const x of [-2.62,.12]){box(.13,2.6,.14,h.steel,[x,1.92,-1.22]);box(.16,.18,2.7,h.steel,[x,.84,-.05]);}
  box(3.2,.2,.2,h.steel,[-1.25,3.22,-1.22]);
  const xy=new THREE.Group();xy.position.set(-1.25,0,0);root.add(xy);
  box(2.4,.1,2.4,h.steel,[0,.94,0],xy);
  const chuck=new THREE.Group();xy.add(chuck);
  const liftColumn=cyl(.5,1,h.steel,[0,1,0],xy);
  cyl(1.18,.13,h.dark,[0,1.06,0],chuck);
  ring(1.125,.018,h.steel,[0,1.145,0],chuck);
  const waferCarrier=new THREE.Group();waferCarrier.name="loaded-wafer-and-die-map";chuck.add(waferCarrier);
  const waferTop=1.17, dieHeight=.015;
  const wafer=mesh(siliconWaferGeometry(1.1,.045),siliconWaferMaterial(h.wafer),[0,waferTop-.0225,0],waferCarrier);
  const loadFork=new THREE.Group();waferCarrier.add(loadFork);
  box(.22,.05,1.2,h.steel,[-.97,1.098,0],loadFork);
  for(const z of [-.52,.52])box(1.63,.035,.11,h.steel,[-.14,1.1075,z],loadFork);
  const diePositions:Point[]=[];
  for(let row=-4;row<=4;row++)for(let col=-4;col<=4;col++){if(row*row+col*col<19)diePositions.push([col*.235,waferTop+dieHeight/2,row*.235]);}
  const dieGeo=new THREE.BoxGeometry(.208,dieHeight,.208),dieMat=new THREE.MeshStandardMaterial({color:0xffffff,metalness:.45,roughness:.35});
  const dies=new THREE.InstancedMesh(dieGeo,dieMat,diePositions.length);dies.name="wafer-die-region-map";dies.castShadow=true;waferCarrier.add(dies);
  const dummy=new THREE.Object3D(),unknown=new THREE.Color(0x28473e),seen=new THREE.Color(0x548b80),active=new THREE.Color(0xe4aa55);
  diePositions.forEach((p,i)=>{dummy.position.set(...p);dummy.updateMatrix();dies.setMatrixAt(i,dummy.matrix);dies.setColorAt(i,unknown);});dies.instanceMatrix.needsUpdate=true;
  const padOffsets:Point[]=[[-.068,0,-.068],[.068,0,-.068],[-.068,0,.068],[.068,0,.068]];
  const padThickness=.006,padHeight=waferTop+dieHeight+padThickness/2;
  const pads=new THREE.InstancedMesh(new THREE.BoxGeometry(.028,padThickness,.028),h.gold,diePositions.length*padOffsets.length);waferCarrier.add(pads);
  diePositions.forEach((p,i)=>{padOffsets.forEach(([x,,z],j)=>{dummy.position.set(p[0]+x,padHeight,p[2]+z);dummy.updateMatrix();pads.setMatrixAt(i*padOffsets.length+j,dummy.matrix);});});pads.instanceMatrix.needsUpdate=true;
  const probeY=1.96, tipY=-.31, tipRadius=.009;
  const contactRise=probeY+tipY-tipRadius-(padHeight+padThickness/2);
  const probe=new THREE.Group();probe.position.set(-1.25,probeY,0);root.add(probe);
  const card=cyl(.77,.11,h.material(0x2e5c46,.25,.5),[0,0,0],probe);ring(.81,.065,h.steel,[0,0,0],probe);cyl(.4,.19,h.dark,[0,.15,0],probe);
  for(const [x,,z] of padOffsets){
    tube([[x*6,-.045,z*6],[x*3,-.16,z*3],[x,tipY,z]],.008,h.steel,probe);
    mesh(new THREE.SphereGeometry(tipRadius,8,6),h.gold,[x,tipY,z],probe);
  }
  for(let i=0;i<6;i++)box(.06,.015,.13,h.gold,[-.33+i*.13,.07,.43],probe);
  box(.18,1.08,.16,h.steel,[-1.25,2.65,-1.22]);box(.28,.16,1.16,h.steel,[-1.25,2.19,-.58]);
  box(.52,.12,.18,h.dark,[0,.135,-.52],probe);
  const microscope=new THREE.Group();microscope.position.set(-2.15,2.67,-.65);root.add(microscope);box(.34,.23,.32,h.dark,[0,0,0],microscope);cyl(.1,.24,h.steel,[0,-.2,0],microscope);
  const tester=new THREE.Group();tester.position.set(2.04,0,-1.15);root.add(tester);
  const testerBody=box(1.48,2.5,1.08,h.dark,[0,1.47,0],tester);box(1.35,.12,1.02,h.steel,[0,2.77,0],tester);
  for(const x of [-.64,.64])box(.08,2.2,.07,h.steel,[x,1.48,.56],tester);
  for(let i=0;i<8;i++)box(.8,.028,.025,h.steel,[0,.55+i*.105,.555],tester);
  const testBars=k.screen([0,2.0,.59],tester);
  for(let i=0;i<4;i++)tube([[-1.43+i*.12,2.13,-.52],[-.55+i*.15,2.84,-.77],[.9+i*.1,2.89,-.96],[1.39+i*.1,2.55,-1.15]],.045,h.dark);
  for(let i=0;i<4;i++)cyl(.065,.08,h.gold,[1.54+i*.21,2.6,-.52]);

  // Enlarged single-die contact view; it is separate from the full test-system cabinet.
  const detail=new THREE.Group();detail.position.set(1.95,.52,.85);root.add(detail);
  const detailBase=box(2.1,.22,1.65,h.material(0x35504e,.35,.4),[0,0,0],detail);
  const detailChuck=new THREE.Group();detail.add(detailChuck);
  const detailColumn=cyl(.5,1,h.steel,[0,.11,0],detail);
  box(1.8,.07,1.35,h.wafer,[0,.145,0],detailChuck);
  for(const x of [-.61,.61])for(const z of [-.43,.43])box(.2,.035,.2,h.gold,[x,.1975,z],detailChuck);
  for(let row=-2;row<=2;row++)for(let col=-3;col<=3;col++)box(.1,.01,.12,h.dark,[col*.19,.185,row*.2],detailChuck);
  const detailRise=.26, enlargedTipY=.242;
  const probeTips=new THREE.Group();probeTips.position.y=detailRise;detail.add(probeTips);
  const cardMat=h.material(0x285847,.25,.5);
  box(1.85,.13,.2,cardMat,[0,1.02,-.65],probeTips);
  for(const side of [-1,1])box(.18,.13,1.48,cardMat,[side*.76,1.02,0],probeTips);
  for(const x of [-.61,.61])for(const z of [-.43,.43]){
    tube([[x*1.25,.95,z*1.25],[x*.9,.53,z*.9],[x,enlargedTipY,z]],.022,h.steel,probeTips);
    mesh(new THREE.SphereGeometry(.027,8,6),h.gold,[x,enlargedTipY,z],probeTips);
  }
  const scanRing=ring(.13,.014,h.cyan,[0,1.22,0],waferCarrier);
  const contactLight=ring(.42,.016,h.cyan,[0,.218,0],detailChuck);
  const observer=k.cursor([0,.24,.95],detail);
  const totalSteps=18;
  const diesPerRegion=6;
  const regionDuration=30;
  const scanOrder=Array.from({length:totalSteps},(_,i)=>Math.floor(i/(totalSteps-1)*(diePositions.length-1)));
  let lastIndex=-1,lastFinished=-1;
  return {root,hotspots:[
    {id:"load",object:wafer,label:["웨이퍼와 XY 스테이지","Wafer and XY stage","ウェーハとXYステージ"]},
    {id:"process",object:card,label:["프로브 카드","Probe card","プローブカード"]},
    {id:"inspect",object:detailBase,label:["확대 접촉부","Enlarged contact area","拡大した接触部"]},
    {id:"tester",object:testerBody,label:["전기 검사 시스템","Electrical test system","電気検査システム"]},
  ],views:{overview:{position:[5.87,4.75,7.68],target:[.15,1.75,0]},detail:{position:[4.95,3.5,5.2],target:[1.95,1.05,.8]},inspection:{position:[4.05,6.6,6.9],target:[-.15,1.33,.1]}},
  update(s){const p=clamp(s.progress);const selected=Math.floor(clamp(s.parameter)*(diePositions.length-1));
    const scanning=s.phase==="react"&&s.setup>=3;
    const reviewing=s.phase==="observe"||s.phase==="decide"||s.phase==="review";
    const region=reviewing?Math.min(2,Math.floor(s.recordTime/regionDuration)):-1;
    const sequence=Math.min(totalSteps-1,Math.floor(p*totalSteps)), local=p>=1?1:p*totalSteps-sequence;
    const index=scanning?scanOrder[sequence]:selected;
    const position=diePositions[index];
    const previous=diePositions[scanning&&sequence>0?scanOrder[sequence-1]:selected];
    // Move between dies with the chuck lowered, then approach in Z and retract.
    const transit=scanning?smooth(local/.25):1;
    const lift=scanning?smooth((local-.28)/.16)*(1-smooth((local-.66)/.17)):0;
    const contact=lift>=.999;
    const load=clamp(s.setup>=1?1:(s.loadProgress??0));
    const positioning=s.setup>=1&&!reviewing;
    xy.position.x=-1.25-(positioning?mix(previous[0],position[0],transit):0);
    xy.position.z=positioning?-mix(previous[2],position[2],transit):0;
    waferCarrier.position.x=-1.75*(1-load);
    waferCarrier.position.y=.075*(1-smooth((load-.88)/.12));
    loadFork.visible=s.setup<1&&load<.88;
    chuck.position.y=contactRise*lift;
    liftColumn.scale.y=.06+chuck.position.y;liftColumn.position.y=.98+liftColumn.scale.y/2;
    const finished=p>=1?totalSteps:sequence+(local>=.66?1:0);
    const activeMapKey=reviewing?diePositions.length+region:index;
    if(activeMapKey!==lastIndex||finished!==lastFinished){
      diePositions.forEach((_,i)=>{
        const step=scanOrder.indexOf(i);
        const highlighted=reviewing?step>=0&&Math.floor(step/diesPerRegion)===region:i===index;
        dies.setColorAt(i,highlighted?active:step>=0&&step<finished?seen:unknown);
      });
      if(dies.instanceColor)dies.instanceColor.needsUpdate=true;lastIndex=activeMapKey;lastFinished=finished;
    }
    scanRing.position.x=position[0];scanRing.position.z=position[2];scanRing.visible=s.setup>=1&&!reviewing;
    detailChuck.position.y=detailRise*lift;
    detailColumn.scale.y=.012+detailChuck.position.y;detailColumn.position.y=.11+detailColumn.scale.y/2;
    contactLight.visible=contact;observer.position.x=-.78+clamp(s.parameter)*1.56;
    testBars.forEach((bar,i)=>{bar.scale.y=.75+(contact ? .35 : 0)+i*.1;});
  }};
}

function packaging(h:SceneHelpers):SceneModel {
  const k=kit(h),{root,box,cyl,ring,mesh,tube}=k;
  root.name="teaching-wire-bond-packaging";
  k.cabinet(-1.35,-.05,3.55,2.9);
  box(3.15,.17,2.45,h.steel,[-1.35,.68,-.05]);
  for(const x of [-2.65,-.05])box(.14,2.5,.16,h.steel,[x,1.87,-1.05]);
  box(3.05,.19,.25,h.dark,[-1.35,3.06,-1.05]);
  for(const x of [-2.65,-.05]){cyl(.13,.14,h.gold,[x,3.19,-1.05]);}
  const spool=new THREE.Group();spool.position.set(-2.45,2.75,-.64);root.add(spool);
  box(.34,.13,.44,h.steel,[-2.55,2.75,-.87]);
  const spoolCylinder=cyl(.32,.4,h.gold,[0,0,0],spool);spoolCylinder.rotation.x=Math.PI/2;
  for(const z of [-.23,.23]){const side=cyl(.39,.035,h.steel,[0,0,z],spool);side.rotation.x=Math.PI/2;}
  for(let i=0;i<7;i++){const winding=ring(.32,.013,h.gold,[0,0,-.17+i*.055],spool);winding.rotation.x=0;}

  const assembly=new THREE.Group();assembly.position.set(-1.35,.83,.15);root.add(assembly);
  box(2.22,.13,1.72,h.material(0x386752,.35,.46),[0,0,0],assembly);
  const dieAttachMaterial=h.material(0x9c9c8f,.15,.62);
  box(.99,.05,.89,dieAttachMaterial,[0,.09,0],assembly);
  const sites=[-1,1].flatMap(side=>Array.from({length:4},(_,i)=>({side,z:-.33+i*.22})));
  const dieSurface=h.material(0x294a68,.6,.2);
  const makeDie=(parent:THREE.Object3D)=>{
    const die=new THREE.Group();parent.add(die);
    box(1.05,.13,.95,h.wafer,[0,0,0],die);
    box(.92,.016,.82,dieSurface,[0,.075,0],die);
    for(let row=0;row<4;row++)for(let col=0;col<5;col++)box(.095,.008,.1,h.dark,[-.32+col*.16,.088,-.26+row*.17],die);
    for(const {side,z} of sites)box(.09,.018,.09,h.gold,[side*.445,.092,z],die);
    return die;
  };
  const die=makeDie(assembly);
  const curves=sites.map(({side,z})=>new THREE.CubicBezierCurve3(new THREE.Vector3(side*.445,.29,z),new THREE.Vector3(side*.62,.86,z+.02),new THREE.Vector3(side*.92,.81,z-.02),new THREE.Vector3(side*1.02,.139,z)));
  const makeConnections=(parent:THREE.Object3D)=>sites.map(({side,z},i)=>{
    box(.32,.05,.13,h.gold,[side*1.12,.1,z],parent);
    const wire=mesh(new THREE.TubeGeometry(curves[i],36,.014,6,false),h.gold,[0,0,0],parent);
    const ball=mesh(new THREE.SphereGeometry(.034,9,7),h.gold,[side*.445,.29,z],parent);
    const stitch=mesh(new THREE.SphereGeometry(.031,9,7),h.gold,[side*1.02,.132,z],parent);stitch.scale.set(1.3,.35,.85);
    return {wire,ball,stitch};
  });
  const connections=makeConnections(assembly);
  const carriage=new THREE.Group();root.add(carriage);
  box(.48,.42,.35,h.dark,[0,0,0],carriage);box(.25,.14,.32,h.steel,[0,-.28,.03],carriage);
  const ceramic=h.material(0xd7dacb,.04,.45);
  const capillary=cyl(.06,.38,ceramic,[0,-.52,.1],carriage);
  mesh(new THREE.CylinderGeometry(.048,.022,.13,16),ceramic,[0,-.78,.1],carriage);
  const wireGuide=new THREE.Vector3(-1.35,3.15,-.67);
  tube([[-2.24,2.88,-.52],[-1.96,3.04,-.6],[-1.63,3.17,-.65],[-1.35,3.15,-.67]],.009,h.gold);
  const wireFeed=cyl(.009,1,h.gold,[0,0,0]);
  const spindle=cyl(.045,1,h.steel,[0,0,0]);
  box(2.73,.14,.23,h.steel,[-1.35,3.13,-.62]);
  const crossSlide=box(.2,.12,1.42,h.dark,[-1.35,3.10,-.24]);
  const vertical=new THREE.Vector3(0,1,0), linkVector=new THREE.Vector3(), feedEnd=new THREE.Vector3();
  const lens=cyl(.105,.23,h.dark,[-.28,-.5,.05],carriage);lens.rotation.z=-.12;
  k.screen([-2.64,.83,1.37]);
  // The enlarged sample shows the later encapsulation step alongside the bonder.
  const detail=new THREE.Group();detail.position.set(2.04,.54,.45);detail.scale.setScalar(1.12);root.add(detail);
  const detailBase=box(2.3,.14,1.8,h.material(0x325f4c,.3,.5),[0,0,0],detail);
  box(.99,.045,.89,dieAttachMaterial,[0,.0925,0],detail);
  const detailDie=makeDie(detail), detailConnections=makeConnections(detail);
  const moldMat=new THREE.MeshPhysicalMaterial({color:0x3a4545,metalness:.12,roughness:.25,transparent:true,opacity:0,depthWrite:false});
  const detailMold=box(2.2,1.02,1.65,moldMat,[0,.58,0],detail);
  detailMold.castShadow=false;
  const detailTool=new THREE.Group();detail.add(detailTool);
  cyl(.075,.35,ceramic,[0,.32,0],detailTool);
  mesh(new THREE.CylinderGeometry(.061,.024,.13,16),ceramic,[0,.081,0],detailTool);
  const observer=k.cursor([0,.24,1.04],detail);
  const pulseMat=new THREE.MeshBasicMaterial({color:0x82e1c2,transparent:true,opacity:.6});
  const connectionPulse=mesh(new THREE.SphereGeometry(.035,8,6),pulseMat,[0,0,0],detail);
  const bondEnd=.82, travelHeight=1.16, park=new THREE.Vector3(-1.03,travelHeight,-.62);
  const tip=new THREE.Vector3(), travelTarget=new THREE.Vector3();
  const wireAmount=(cycle:number)=>clamp((cycle-.23)/(.72-.23));
  let motion=0;
  return {root,hotspots:[
    {id:"load",object:die,label:["칩과 연결 패드","Die and bond pads","チップとボンディングパッド"]},
    {id:"process",object:capillary,label:["본딩 헤드","Bonding head","ボンディングヘッド"]},
    {id:"inspect",object:detailBase,label:["와이어 연결부","Wire connections","ワイヤ接続部"]},
    {id:"spool",object:spoolCylinder,label:["본딩 와이어","Bonding wire","ボンディングワイヤ"]},
  ],views:{overview:{position:[5.94,4.65,7.36],target:[.1,1.65,0]},detail:{position:[5.3,3.35,5.5],target:[1.99,1.1,.42]},inspection:{position:[4.7,4.7,6.0],target:[1.36,1.06,.44]}},
  update(s,dt){const p=clamp(s.progress);if(s.running&&!s.reducedMotion)motion+=Math.min(dt,.1);
    const load=clamp(s.setup>=1?1:(s.loadProgress??0));die.position.y=mix(1.06,.18,load);detailDie.position.y=die.position.y;
    const sequence=clamp(p/bondEnd)*curves.length;
    const index=Math.min(curves.length-1,Math.floor(sequence)),local=sequence-index;
    connections.forEach((connection,i)=>{
      const cycle=clamp(sequence-i),amount=wireAmount(cycle),segments=Math.floor(amount*36);
      for(const {wire,ball,stitch} of [connection,detailConnections[i]]){
        wire.visible=segments>0&&load>=1;wire.geometry.setDrawRange(0,segments*6*6);
        ball.visible=cycle>=.18&&load>=1;stitch.visible=cycle>=.76&&load>=1;
      }
    });
    const working=s.phase==="react"&&s.setup>=3&&p<bondEnd;
    const curve=curves[index];
    if(!working){tip.copy(p>=bondEnd?park:curves[0].v0);tip.y=travelHeight;}
    else if(local<.18){tip.copy(curve.v0);tip.y=mix(travelHeight,curve.v0.y,smooth(local/.18));}
    else if(local<.76){curve.getPointAt(wireAmount(local),tip);}
    else if(local<.9){tip.copy(curve.v3);tip.y=mix(curve.v3.y,travelHeight,smooth((local-.79)/.11));}
    else{
      tip.copy(curve.v3);tip.y=travelHeight;
      travelTarget.copy(curves[index+1]?.v0??park);travelTarget.y=travelHeight;
      tip.lerp(travelTarget,smooth((local-.9)/.1));
    }
    carriage.position.set(-1.35+tip.x,.83+tip.y+.861,.15+tip.z-.1);carriage.visible=s.setup>=2;
    crossSlide.position.x=carriage.position.x;
    const spindleBottom=carriage.position.y+.18;
    spindle.position.set(carriage.position.x,(3.10+spindleBottom)/2,carriage.position.z);
    spindle.scale.y=Math.max(.02,3.10-spindleBottom);spindle.visible=carriage.visible;
    feedEnd.set(carriage.position.x,carriage.position.y+.18,carriage.position.z+.065);linkVector.subVectors(feedEnd,wireGuide);
    wireFeed.position.copy(wireGuide).lerp(feedEnd,.5);wireFeed.scale.y=linkVector.length();wireFeed.quaternion.setFromUnitVectors(vertical,linkVector.normalize());wireFeed.visible=carriage.visible;
    detailTool.position.copy(tip);detailTool.visible=working&&s.focus!=="overview";
    const protectedStage=clamp((p-.88)/.12);
    detailMold.visible=protectedStage>0;
    moldMat.opacity=.22*protectedStage;
    observer.position.x=-.99+clamp(s.parameter)*1.98;
    const chosen=Math.floor(clamp(s.parameter)*(curves.length-1));
    connectionPulse.visible=p>=1&&s.focus!=="overview";curves[chosen].getPointAt(s.reducedMotion ? .55 : (motion*.4)%1,connectionPulse.position);
  }};
}
