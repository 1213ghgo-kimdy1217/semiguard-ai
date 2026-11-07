import * as THREE from "three";
import type {SceneHelpers,SceneModel,StageState,Language} from "./studio-types";

const clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:a));
const tr=(l:Language,ko:string,en:string,ja:string)=>l==="ko"?ko:l==="ja"?ja:en;

/** Enlarged educational cutaway. Inspection indices never drive the Si/SiO₂ geometry. */
export function createOxidationScene(h:SceneHelpers):SceneModel {
 const root=new THREE.Group();root.name="Oxidation teaching interior";
 const process=new THREE.Group();process.name="Oxygen and thermal mechanism";root.add(process);
 const furnace=new THREE.Group();furnace.position.x=-.8;root.add(furnace);
 const heater=new THREE.Group();heater.position.x=-.8;process.add(heater);
 const textures:THREE.Texture[]=[];
 const metal=h.material(0x718792,.72,.3),dark=h.material(0x132635,.5,.35),black=h.material(0x081722,.35,.44),edge=h.material(0x9ab6c5,.8,.23),ceramic=h.material(0x617785,.04,.72);
 const waferMat=new THREE.MeshPhysicalMaterial({color:0x102c56,metalness:.5,roughness:.25,iridescence:.8,iridescenceIOR:1.7,clearcoat:.8,envMapIntensity:.4});
 const quartz=new THREE.MeshPhysicalMaterial({color:0x75bfd0,metalness:0,roughness:.09,forceSinglePass:true,transparent:true,opacity:.075,side:THREE.DoubleSide,depthWrite:false});
 const coilMat=new THREE.MeshStandardMaterial({color:0xa56733,metalness:.57,roughness:.35,emissive:0xf57f2a,emissiveIntensity:0});
 const oxideMat=new THREE.MeshPhysicalMaterial({color:0x3cc5d0,metalness:.08,roughness:.23,transparent:true,opacity:.82,emissive:0x095861,emissiveIntensity:.18,clearcoat:.8,envMapIntensity:.35});
 const mesh=(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D=root)=>{const o=new THREE.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 const box=(w:number,t:number,d:number,m:THREE.Material,p:[number,number,number],parent:THREE.Object3D=root)=>h.box(w,t,d,m,p,parent);
 const cylinder=(r:number,t:number,m:THREE.Material,p:[number,number,number],parent:THREE.Object3D=root,n=48)=>{const o=mesh(new THREE.CylinderGeometry(r,r,t,n),m,parent);o.position.set(...p);return o;};
 const ring=(r:number,t:number,m:THREE.Material,y:number,parent:THREE.Object3D=root,x=0,z=0)=>h.ring(r,t,m,[x,y,z],parent);

 // Separate metal decks, fasteners and four support posts preserve the original furnace silhouette.
 box(3.05,.23,2.75,dark,[0,.12,0],furnace);box(2.9,.08,2.62,metal,[0,.27,0],furnace);
 for(const x of[-1.28,1.28])for(const z of[-1.1,1.1]){
  cylinder(.075,4.8,metal,[x,2.72,z],furnace,16);
  for(const y of[.41,5.04])cylinder(.12,.1,edge,[x,y,z],furnace,20);
  for(const y of[.32,5.12])cylinder(.08,.065,black,[x,y,z],furnace,6);
 }
 for(const y of[2.35,5]){box(2.94,.14,.18,dark,[0,y,-1.11],furnace);for(const x of[-1.28,1.28])box(.18,.14,2.28,dark,[x,y,0],furnace);}
 const shellMat=metal.clone();shellMat.side=THREE.DoubleSide;
 const insulationMat=ceramic.clone();insulationMat.side=THREE.DoubleSide;
 const rearShell=mesh(new THREE.CylinderGeometry(1.23,1.23,2.63,64,1,true,Math.PI*.45,Math.PI*1.1),shellMat,heater);rearShell.position.y=3.72;
 // The outer equipment door already reveals the interior: keep this teaching cutaway open from entry.
 const frontShell=mesh(new THREE.CylinderGeometry(1.23,1.23,2.63,48,1,true,Math.PI*1.55,Math.PI*.9),shellMat,heater);frontShell.position.y=3.72;frontShell.visible=false;
 for(let i=0;i<5;i++){const wall=mesh(new THREE.CylinderGeometry(1.16,1.16,.475,48,1,true,Math.PI*.49,Math.PI*1.02),insulationMat,heater);wall.position.y=2.71+i*.5;}
 for(const a of[Math.PI*.45,Math.PI*1.55])cylinder(.035,2.68,edge,[Math.sin(a)*1.23,3.72,Math.cos(a)*1.23],heater,12);
 cylinder(1.3,.16,dark,[0,5.08,0],heater);cylinder(1.32,.055,edge,[0,5.18,0],heater);
 for(const y of[2.39,5.04])ring(1.18,.036,edge,y,heater);
 for(let i=0;i<11;i++)ring(1.05,.03,coilMat,2.5+i*.235,heater);
 const quartzTube=mesh(new THREE.CylinderGeometry(.94,.94,2.5,64,1,true),quartz,heater);quartzTube.position.y=3.73;quartzTube.castShadow=false;
 for(const y of[2.47,4.98])ring(.95,.018,edge,y,heater);
 for(const a of[.4,2.1,4])h.line([[Math.sin(a)*.95,2.47,Math.cos(a)*.95],[Math.sin(a)*.95,4.98,Math.cos(a)*.95]],0x7caab9,heater);

 const boat=new THREE.Group();boat.name="Movable wafer boat";furnace.add(boat);
 cylinder(.94,.1,metal,[0,.31,0],boat);ring(.93,.022,edge,.37,boat);
 const haloMat=new THREE.MeshBasicMaterial({color:0x6fe6e0,transparent:true,opacity:.65,depthWrite:false});
 const loadHalo=ring(1,.017,haloMat,.41,boat),boatOutline=new THREE.Group();boat.add(boatOutline);
 ring(.82,.008,haloMat,2.04,boatOutline);for(const x of[-.82,.82])cylinder(.008,1.6,haloMat,[x,1.24,.12],boatOutline,8).castShadow=false;
 for(const a of[0,Math.PI*.66,Math.PI*1.33])cylinder(.027,1.73,ceramic,[Math.sin(a)*.7,1.25,Math.cos(a)*.7],boat,12);
 const films:THREE.Mesh[]=[];
 for(let i=0;i<12;i++){
  const y=.55+i*.13;
  cylinder(.76,.025,waferMat,[0,y,0],boat);
  for(const direction of[-1,1]){
   const film=cylinder(.762,.003,oxideMat,[0,y+direction*.015,0],boat);
   film.castShadow=false;
   films.push(film);
  }
  ring(.757,.004,edge,y+.012,boat);
 }
 const lift=new THREE.Group();furnace.add(lift);const shaft=cylinder(.16,1,edge,[0,.34,0],lift,24);
 const bellows:THREE.Mesh[]=[];for(let i=0;i<13;i++)bellows.push(ring(.35,.022,dark,.3,lift));
 box(1.18,.55,.46,dark,[-.8,.61,1.25],furnace);

 // Canvas-backed labels use no DOM during the browser-free geometry audit.
 function panel(w:number,t:number,worldW:number,worldH:number,parent:THREE.Object3D){
  const canvas=typeof document!=="undefined"?document.createElement("canvas"):null;if(canvas){canvas.width=w;canvas.height=t;}
  const texture=canvas?new THREE.CanvasTexture(canvas):null;if(texture){texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);}
  const face=mesh(new THREE.PlaneGeometry(worldW,worldH),new THREE.MeshBasicMaterial({color:texture?0xffffff:0x071824,map:texture,toneMapped:false}),parent);face.castShadow=false;face.receiveShadow=false;
  return{canvas,texture,face,context:canvas?.getContext("2d")??null};
 }
 const mini=panel(512,192,1.02,.38,furnace);mini.face.position.set(-.8,.61,1.489);
 function label(initial:string,width:number,parent:THREE.Object3D,color="#c2dbe7"){
  const p=panel(512,128,width,width/4,parent);const mat=p.face.material as THREE.MeshBasicMaterial;mat.transparent=true;mat.depthWrite=false;mat.side=THREE.DoubleSide;
  const paint=(value:string)=>{if(!p.context||!p.texture)return;const c=p.context;c.clearRect(0,0,512,128);c.fillStyle=color;c.font="600 54px Arial, sans-serif";c.textAlign="center";c.textBaseline="middle";c.fillText(value,256,66,490);p.texture.needsUpdate=true;};paint(initial);return{...p,paint};
 }
 const topLabel=label("산화 / 02",1.2,heater);topLabel.face.position.set(0,5.08,1.055);

 // Molecules first follow the actual pipe, then descend inside the quartz tube.
 const gas=new THREE.Group();gas.position.set(-2.6,0,.3);process.add(gas);
 cylinder(.29,1.18,h.material(0x1a657c,.58,.3),[0,.85,0],gas);cylinder(.22,.17,metal,[0,1.52,0],gas,32);cylinder(.34,.09,dark,[0,.22,0],gas,32);
 const valve=new THREE.Group();valve.position.set(0,1.66,0);gas.add(valve);
 const wheel=mesh(new THREE.TorusGeometry(.19,.025,10,40),h.material(0x40b4c2,.5,.3),valve);wheel.rotation.x=Math.PI/2;
 box(.34,.04,.04,edge,[0,0,0],valve);box(.04,.04,.34,edge,[0,0,0],valve);
 const o2=label("O₂",.38,gas,"#8ceee9");o2.face.position.set(0,.9,.305);
 const gasPath=new THREE.CatmullRomCurve3([new THREE.Vector3(-2.6,1.55,.3),new THREE.Vector3(-2.6,2.1,-.3),new THREE.Vector3(-2.48,4.9,-.5),new THREE.Vector3(-1.9,5.35,-.4),new THREE.Vector3(-.8,5.33,-.2),new THREE.Vector3(-.8,4.85,0)]);
 const pipeMat=new THREE.MeshPhysicalMaterial({color:0x6b98aa,metalness:.3,roughness:.25,transparent:true,opacity:.42,depthWrite:false});
 const pipe=mesh(new THREE.TubeGeometry(gasPath,72,.045,10,false),pipeMat,process);pipe.castShadow=false;
 const liner=mesh(new THREE.TubeGeometry(gasPath,72,.014,8,false),new THREE.MeshBasicMaterial({color:0x4baeb8,transparent:true,opacity:.45}),process);liner.castShadow=false;
 for(const t of[.13,.58,.86]){const p=gasPath.getPointAt(t);const cuff=cylinder(.075,.1,dark,[p.x,p.y,p.z],process,16);cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),gasPath.getTangentAt(t));}
 // A lower outlet is one layout used in vertical batch furnaces.
 const exhaustPath=new THREE.CatmullRomCurve3([
  new THREE.Vector3(.08,2.52,-.24),new THREE.Vector3(.42,2.50,-.27),
  new THREE.Vector3(.59,2.26,-.33),new THREE.Vector3(.59,1.08,-.43),
  new THREE.Vector3(.47,.69,-.43),
 ]);
 const exhaustPipe=mesh(new THREE.TubeGeometry(exhaustPath,44,.065,10,false),pipeMat,process);
 exhaustPipe.name="furnace-lower-exhaust-path";exhaustPipe.castShadow=false;
 box(.36,.51,.42,dark,[.34,.56,-.43],process);
 for(const t of[.17,.73]){
  const point=exhaustPath.getPointAt(t);
  const collar=cylinder(.087,.085,edge,[point.x,point.y,point.z],process,16);
  collar.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),exhaustPath.getTangentAt(t));
 }
 const exhaustDotMaterial=new THREE.MeshBasicMaterial({color:0x98c8cb,transparent:true,opacity:.66});
 const exhaustDots=Array.from({length:9},()=>{
  const dot=mesh(new THREE.SphereGeometry(.021,7,5),exhaustDotMaterial,process);
  dot.name="furnace-exhaust-flow";dot.castShadow=false;return dot;
 });
 const oxygenMat=new THREE.MeshBasicMaterial({color:0x9bf8f3,transparent:true,opacity:.86}),oxygenGeometry=new THREE.SphereGeometry(.025,7,5);
 const oxygen:{group:THREE.Group;phase:number;radius:number;theta:number;inPipe:boolean}[]=[];
 for(let i=0;i<44;i++){const group=new THREE.Group();for(const x of[-.022,.022]){const atom=mesh(oxygenGeometry,oxygenMat,group);atom.position.x=x;atom.castShadow=false;}process.add(group);oxygen.push({group,phase:i/44,radius:.34+(i*.237%.48),theta:i*2.399,inPipe:i<16});}

 // Original enlarged inset: blue silicon is consumed as cyan oxide forms at the moving interface.
 const inspection=new THREE.Group();root.add(inspection);const section=new THREE.Group();section.position.set(2.15,.32,.65);inspection.add(section);
 for(const x of[-1.02,1.02])for(const z of[-.55,.55])box(.11,.6,.11,dark,[x,-.01,z],section);
 box(2.67,.16,1.7,dark,[0,.29,0],section);box(2.45,.05,1.5,metal,[0,.395,0],section);
 const silicon=box(2.2,.55,1.32,new THREE.MeshPhysicalMaterial({color:0x12345f,metalness:.25,roughness:.38,clearcoat:.3,envMapIntensity:.23}),[0,.695,0],section);
 const oxide=box(2.2,.01,1.32,oxideMat,[0,.975,0],section);
 const originalSurface=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.22,.002,1.34)),new THREE.LineBasicMaterial({color:0xa0bacb,transparent:true,opacity:.45}));originalSurface.position.y=.97;section.add(originalSurface);
 const latticeMat=new THREE.MeshStandardMaterial({color:0x94b7dc,metalness:.1,roughness:.4,emissive:0x174d77,emissiveIntensity:.13}),atomGeometry=new THREE.SphereGeometry(.025,8,6);
 const lattice:THREE.Mesh[]=[];for(let row=0;row<4;row++)for(let col=0;col<10;col++){const a=mesh(atomGeometry,latticeMat,section);a.position.set(-.94+col*.21,.5+row*.15,.672);a.castShadow=false;lattice.push(a);}
 const oxideAtomMat=new THREE.MeshBasicMaterial({color:0xaffff0,transparent:true,opacity:.78});
 const oxideAtoms:THREE.Mesh[]=[];for(let i=0;i<22;i++){const a=mesh(new THREE.SphereGeometry(.022,7,5),oxideAtomMat,section);a.position.set(-1+i%11*.2,1,.675);a.castShadow=false;oxideAtoms.push(a);}
 const sectionOxygen:THREE.Group[]=[];
 for(let i=0;i<8;i++){const m=new THREE.Group();for(const x of[-.035,.035]){const a=mesh(new THREE.SphereGeometry(.036,8,6),oxygenMat,m);a.position.x=x;a.castShadow=false;}section.add(m);sectionOxygen.push(m);}
 const formula=label("Si + O₂ → SiO₂",1.55,section);formula.face.position.set(0,.28,.91);
 const cursor=h.line([[-1.13,1.4,.7],[1.13,1.4,.7]],0xe4aa55,section);

 const instrument=new THREE.Group();instrument.position.set(2.2,2.04,-.85);instrument.rotation.y=-.15;inspection.add(instrument);
 box(.13,1.63,.13,metal,[0,-.73,-.1],instrument);box(1.05,.08,.73,dark,[0,-1.51,-.05],instrument);
 box(2.38,1.38,.16,black,[0,0,0],instrument);box(2.4,.035,.19,edge,[0,.69,0],instrument);
 const screen=panel(1024,592,2.25,1.3,instrument);screen.face.position.z=.089;
 let screenKey="",languageKey:Language|null=null;
 function updateScreen(s:StageState,loaded:number){
  if(languageKey!==s.language){languageKey=s.language;topLabel.paint(tr(s.language,"산화 / 02","OXIDATION / 02","酸化 / 02"));}
  const active=s.phase==="observe"||s.phase==="decide"||s.phase==="review";
  const current=active&&s.currentReading?.processId==="oxidation"?s.currentReading:null;
  const reference=s.referenceReading?.processId==="oxidation"?s.referenceReading:null;
  const channel=(id:string)=>current?.channels.find(c=>c.id===id),ref=(id:string)=>reference?.channels.find(c=>c.id===id)?.reference??channel(id)?.reference;
  const format=(v:number|undefined)=>v!==undefined&&Number.isFinite(v)?v.toFixed(1):"—";
  const film=channel("film"),uniformity=channel("uniformity");
  const key=JSON.stringify([s.language,s.phase,Math.round(clamp(s.progress)*100),loaded>.98,current?.time,film?.value,uniformity?.value,ref("film"),ref("uniformity")]);
  if(key===screenKey)return;screenKey=key;
  if(screen.context&&screen.texture){
   const c=screen.context;c.fillStyle="#071824";c.fillRect(0,0,1024,592);c.textAlign="left";c.textBaseline="alphabetic";
   c.fillStyle="#62d6d3";c.font="600 32px Arial, sans-serif";c.fillText(current?tr(s.language,"가상 검사 기록","Virtual inspection record","仮想検査記録"):tr(s.language,"산화 원리 모형","Oxidation concept model","酸化の原理模型"),38,56,948);
   c.fillStyle="#9ab8c8";c.font="500 24px Arial, sans-serif";c.fillText(tr(s.language,"교육용 지수 · 실측 막 두께가 아니에요","Educational indices · not measured film thickness","教育用の指数・実測の膜厚ではありません"),38,100,948);
   if(current&&film&&uniformity){
    const columns=[["film",tr(s.language,"막 검사 지수","Film inspection index","膜検査指数")],["uniformity",tr(s.language,"균일도 검사 지수","Uniformity index","均一性検査指数")]];
    columns.forEach(([id,title],i)=>{const x=38+i*490;c.fillStyle="#173747";c.fillRect(x,132,456,360);c.fillStyle="#c5dce6";c.font="600 27px Arial, sans-serif";c.fillText(title,x+20,176,416);c.fillStyle="#91b6c8";c.font="500 23px Arial, sans-serif";c.fillText(tr(s.language,"관측값","Observed","観測値"),x+20,220);c.fillStyle="#b9fff0";c.font="600 76px Arial, sans-serif";c.fillText(format(channel(id)?.value),x+20,308,416);c.fillStyle="#9ab7c8";c.font="500 23px Arial, sans-serif";c.fillText(tr(s.language,"선택한 참고값","Selected reference","選択した参考値"),x+20,363,416);c.fillStyle="#d8e8ed";c.font="600 48px Arial, sans-serif";c.fillText(format(ref(id)),x+20,434,416);});
    c.fillStyle="#789caf";c.font="500 24px Arial, sans-serif";c.fillText(tr(s.language,"검사 기록과 원리 모형은 서로 다른 자료예요","Inspection records are separate from the concept model","検査記録と原理模型は別の資料です"),38,550,948);
   }else{
    c.fillStyle="#d9edf5";c.font="600 40px Arial, sans-serif";c.fillText(s.phase==="prepare"?tr(s.language,"웨이퍼 보트를 올려 보세요","Raise the wafer boat","ウェーハボートを上げます"):"Si + O₂  →  SiO₂",38,205,948);
    c.fillStyle="#1b3b4b";c.fillRect(38,254,948,38);c.fillStyle=s.phase==="prepare"?"#61d9d2":"#e7ad63";c.fillRect(38,254,Math.max(8,948*(s.phase==="prepare"?loaded:clamp(s.progress))),38);
    c.fillStyle="#9bb9c8";c.font="500 28px Arial, sans-serif";c.fillText(tr(s.language,"실리콘 표면이 반응해 산화막이 생겨요","The silicon surface reacts to form oxide","シリコン表面が反応して酸化膜ができます"),38,376,948);
    c.fillStyle="#789caf";c.font="500 24px Arial, sans-serif";c.fillText(tr(s.language,"검사 단계에서 기록을 따로 비교해요","Compare the records separately in the inspection step","検査の段階で記録を別に比較します"),38,550,948);
   }screen.texture.needsUpdate=true;
  }
  if(mini.context&&mini.texture){const c=mini.context;c.fillStyle="#0a1b27";c.fillRect(0,0,512,192);c.textAlign="left";c.fillStyle="#80ded5";c.font="600 29px Arial, sans-serif";c.fillText(loaded>.98?tr(s.language,"보트 · 장착됨","BOAT / LOADED","ボート・装着済み"):tr(s.language,"보트 · 올려보기","BOAT / RAISE","ボート・上へ"),24,65,464);c.fillStyle="#9ebccc";c.font="500 26px Arial, sans-serif";c.fillText(tr(s.language,"산화 원리 모형","OXIDATION MODEL","酸化の原理模型"),24,127,464);mini.texture.needsUpdate=true;}
 }
 const warm=new THREE.PointLight(0xffa15b,0,6);warm.position.set(-.8,3.6,.2);root.add(warm);
 const insetLight=new THREE.PointLight(0x5dcbd8,1.1,5);insetLight.position.set(2.4,2.5,1.8);root.add(insetLight);
 return{root,
  hotspots:[{id:"load",object:boat,label:["웨이퍼 보트","Wafer boat","ウェーハボート"]},{id:"process",object:process,label:["산소 경로와 히터","Oxygen path and heater","酸素の経路とヒーター"]},{id:"inspect",object:inspection,label:["실리콘·산화막 경계와 검사 기록","Silicon–oxide interface and inspection records","シリコンと酸化膜の界面・検査記録"]}],
  views:{overview:{position:[6.7,4.45,8.1],target:[.1,2.4,.15]},detail:{position:[4.05,2.9,4.45],target:[2.15,1.12,.65]},inspection:{position:[4.5,2.8,4.6],target:[2.15,1.94,-.65]}},
  update(s:StageState,dt,time){
   const loaded=s.setup>=1?1:clamp(s.loadProgress??0),growth=clamp(s.progress),clock=s.reducedMotion?growth*7:Math.max(0,Number.isFinite(time)?time:0);
   // Preparation may ease the lift. Once the learner starts the reaction,
   // loading is complete and must not keep moving during a paused reaction.
   boat.position.y=s.reducedMotion||s.phase!=="prepare"?loaded*2.1:THREE.MathUtils.lerp(boat.position.y,loaded*2.1,1-Math.exp(-8*clamp(dt,0,.1)));
   const shownLoad=clamp(boat.position.y/2.1);shaft.scale.y=.14+shownLoad*2.1;shaft.position.y=.2+shaft.scale.y/2;bellows.forEach((r,i)=>{r.position.y=.27+i*(.14+shownLoad*1.9)/12;});
   frontShell.visible=false;loadHalo.visible=boatOutline.visible=s.phase==="prepare"&&s.setup===0;
   const reactionActive=s.phase==="react"&&growth>0&&growth<1;
   const heat=reactionActive?clamp(growth*5):0;
   coilMat.emissiveIntensity=heat*1.5;warm.intensity=heat*4;
   valve.rotation.y=reactionActive?Math.PI*.52:0;liner.visible=reactionActive;
   exhaustDots.forEach((dot,i)=>{
    dot.visible=reactionActive;
    if(reactionActive)dot.position.copy(exhaustPath.getPointAt((clock*.31+i/exhaustDots.length)%1));
   });
   oxygen.forEach(item=>{
    item.group.visible=reactionActive;
    if(item.inPipe)item.group.position.copy(gasPath.getPointAt((clock*.15+item.phase)%1));
    else{
     const t=(clock*.22+item.phase)%1;
     // Gas descends around the loaded stack, then the inset shows the interface reaction.
     const radius=(.815+(item.radius-.34)*.14)*clamp(t/.21);
     item.group.position.set(-.8+Math.sin(item.theta+t*.6)*radius,4.85-t*2.2,Math.cos(item.theta+t*.6)*radius);
    }
    item.group.rotation.z=item.theta+clock*.18;
   });
   films.forEach(f=>{f.visible=growth>.015;f.scale.y=1+growth*2.6;});
   const oxideHeight=growth*.3,consumed=oxideHeight*.44,siHeight=.55-consumed,interfaceY=.42+siHeight;
   silicon.scale.y=siHeight/.55;silicon.position.y=.42+siHeight/2;
   oxide.visible=growth>0;oxide.scale.y=Math.max(.001,oxideHeight)/.01;oxide.position.y=interfaceY+oxideHeight/2;
   lattice.forEach(a=>{a.visible=a.position.y<=interfaceY;});oxideAtoms.forEach((a,i)=>{a.visible=growth>.08;a.position.y=interfaceY+oxideHeight*(.24+Math.floor(i/11)*.5);});
   sectionOxygen.forEach((m,i)=>{m.visible=reactionActive;const t=(clock*.35+i/8)%1;m.position.set(-.94+i%4*.62,THREE.MathUtils.lerp(1.95,interfaceY+.02,t),i<4?.4:-.3);m.rotation.z=i*.8+clock*.22;const separation=.035+clamp((t-.82)/.18)*.04;m.children[0].position.x=-separation;m.children[1].position.x=separation;});
   cursor.position.y=interfaceY+oxideHeight+.08-1.4;cursor.position.z=(clamp(s.parameter)-.5)*1.18;updateScreen(s,shownLoad);
  },dispose(){textures.forEach(t=>t.dispose());},
 };
}
