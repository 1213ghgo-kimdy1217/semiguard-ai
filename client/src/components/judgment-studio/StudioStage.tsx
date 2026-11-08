import {useEffect,useRef,useState} from "react";
import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {RoomEnvironment} from "three/addons/environments/RoomEnvironment.js";
import {createFrontScene} from "./stage-front";
import {createBackScene} from "./stage-back";
import {createOxidationScene} from "./stage-oxidation";
import {createFrontShell} from "./equipment-shell-front";
import {createBackShell} from "./equipment-shell-back";
import {createEntryReveal} from "./entry-reveal";
import {createInspectionMonitor} from "./scene-inspection-monitor";
import {local,translate} from "./studio-i18n";
import {studioContent} from "./studio-content";
import type {SceneHelpers,StageState} from "./studio-types";
import "./studio-stage.css";

export default function StudioStage({state,onPart,onReady,onLoadProgress,entered=false,onInteriorReady}:{state:StageState;onPart:(id:string)=>void;onReady:(ready:boolean)=>void;onLoadProgress?:(progress:number)=>void;entered?:boolean;onInteriorReady?:(ready:boolean)=>void}){
 const host=useRef<HTMLDivElement>(null),latest=useRef({state,onPart,onReady,onLoadProgress,entered,onInteriorReady});latest.current={state,onPart,onReady,onLoadProgress,entered,onInteriorReady};
 const label=useRef<HTMLDivElement>(null);
 const[status,setStatus]=useState<"loading"|"ready"|"failed">("loading");
 useEffect(()=>{host.current?.querySelector("canvas")?.setAttribute("aria-label",translate(state.language,"modelNote")+". "+translate(state.language,"rotate"));},[state.language]);
 useEffect(()=>{
  const element=host.current;if(!element)return;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});}catch{setStatus("failed");latest.current.onReady(false);return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.domElement.tabIndex=0;renderer.domElement.setAttribute("aria-label",translate(latest.current.state.language,"modelNote")+". "+translate(latest.current.state.language,"rotate"));element.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x101918);scene.fog=new THREE.FogExp2(0x101918,.025);
  const camera=new THREE.PerspectiveCamera(36,1,.1,80);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.enablePan=false;controls.minDistance=2.2;controls.maxDistance=28;controls.minPolarAngle=.3;controls.maxPolarAngle=1.52;
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.08);scene.environment=environment.texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe4efe8,0x15251d,1));
  const key=new THREE.DirectionalLight(0xf9f0df,3);key.position.set(4,9,6);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-8,right:8,top:8,bottom:-7});key.shadow.normalBias=.035;scene.add(key);
  const rim=new THREE.DirectionalLight(0x81b9be,2);rim.position.set(-5,5,-3);scene.add(rim);
  const mat=(color:number,metalness=.4,roughness=.4)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
  const helpers:SceneHelpers={
   material:mat,steel:mat(0x9caeaa,.75,.28),dark:mat(0x22322e,.5,.4),gold:mat(0xbd944e,.7,.3),cyan:mat(0x71c4bb,.4,.35),
   wafer:new THREE.MeshPhysicalMaterial({color:0x304b66,metalness:.65,roughness:.2,iridescence:.8,iridescenceIOR:1.5,iridescenceThicknessRange:[180,410],clearcoat:1}),
   glass:new THREE.MeshPhysicalMaterial({color:0x9cc9bd,transparent:true,opacity:.13,roughness:.06,side:THREE.DoubleSide,depthWrite:false}),
   box(w,h,d,material,p,parent=scene){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(...p);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;},
   cylinder(r,h,material,p,parent=scene){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,48),material);mesh.position.set(...p);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;},
   ring(r,tube,material,p,parent=scene){const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,tube,8,64),material);mesh.rotation.x=Math.PI/2;mesh.position.set(...p);parent.add(mesh);return mesh;},
   line(points,color,parent=scene){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color}));parent.add(line);return line;},
  };
  const process=latest.current.state.process;
  const model=process==="oxidation"?createOxidationScene(helpers):["wafer","photo","etch"].includes(process)?createFrontScene(process as "wafer"|"photo"|"etch",helpers):createBackScene(process as "deposition"|"metal"|"eds"|"packaging",helpers);
  const monitor = process === "oxidation" ? undefined : createInspectionMonitor(process);
  if (monitor) model.root.add(monitor.root);
  scene.add(model.root);
  const shell=["wafer","oxidation","photo","etch"].includes(process)?createFrontShell(process as "wafer"|"oxidation"|"photo"|"etch",helpers):createBackShell(process as "deposition"|"metal"|"eds"|"packaging",helpers);
  scene.add(shell.root);
  const entryReveal = createEntryReveal(renderer);
  const shellPoints=()=>{const points:THREE.Vector3[]=[];shell.root.updateMatrixWorld(true);shell.root.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.geometry||!mesh.visible)return;if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox;if(b)for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z])points.push(new THREE.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld));});return points;};
  shell.update(0);const closedShellPoints=shellPoints(),closedShellBounds=new THREE.Box3().setFromPoints(closedShellPoints);
  shell.update(1);const openShellPoints=shellPoints(),openShellBounds=new THREE.Box3().setFromPoints(openShellPoints);shell.update(0);
  const fitShellView=(opened=false)=>{const bounds=opened?openShellBounds:closedShellBounds,points=opened?openShellPoints:closedShellPoints,center=bounds.getCenter(new THREE.Vector3()),direction=new THREE.Vector3(...shell.view.position).sub(new THREE.Vector3(...shell.view.target)).normalize();const testCamera=new THREE.PerspectiveCamera(camera.fov,camera.aspect,.1,80),v=new THREE.Vector3();let near=3,far=32;for(let iteration=0;iteration<20;iteration++){const distance=(near+far)/2;testCamera.position.copy(center).addScaledVector(direction,distance);testCamera.lookAt(center);testCamera.updateMatrixWorld(true);let fits=true;for(const point of points){v.copy(point).project(testCamera);if(Math.abs(v.x)>.9||v.y>.82||v.y<-.88){fits=false;break;}}if(fits)far=distance;else near=distance;}return{position:center.clone().addScaledVector(direction,far),target:center};};
  let closedView: ReturnType<typeof fitShellView>;
  let openView: ReturnType<typeof fitShellView>;
  let entryProgress=latest.current.entered?1:0,entryTarget=entryProgress,entryFrom=entryProgress,entryStarted=performance.now(),entryMoving=false,reportedInterior:boolean|null=null;
  let entryDuration = 2600;
  let entryMidpoint = 0;
  const entryFromP=new THREE.Vector3(),entryFromT=new THREE.Vector3(),entryToP=new THREE.Vector3(),entryToT=new THREE.Vector3(),entryMiddleP=new THREE.Vector3(),entryMiddleT=new THREE.Vector3();
  const smooth=(p:number)=>p<.5?4*p*p*p:1-(-2*p+2)**3/2;
  const reveal=(a:number,b:number,value:number)=>{const p=Math.max(0,Math.min(1,(value-a)/(b-a)));return p*p*(3-2*p);};
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshBasicMaterial({color:0x101918}));ground.rotation.x=-Math.PI/2;ground.position.y=-.15;scene.add(ground);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.ShadowMaterial({opacity:.3}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.145;shadow.receiveShadow=true;scene.add(shadow);
  const floorRing=new THREE.Mesh(new THREE.RingGeometry(4.6,4.615,100),new THREE.MeshBasicMaterial({color:0x456658,transparent:true,opacity:.35,side:THREE.DoubleSide}));floorRing.rotation.x=-Math.PI/2;floorRing.position.y=-.14;scene.add(floorRing);
  model.hotspots.forEach(h=>{h.object.userData.studioPart=h.id;});
  const loadObject=model.hotspots.find(h=>h.id==="load");
  const loadHit=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));loadHit.userData.studioPart="load";scene.add(loadHit);
  const hitBounds=new THREE.Box3(),hitSize=new THREE.Vector3();
  const selection=new THREE.Box3Helper(new THREE.Box3(),0xe4aa55);selection.visible=false;scene.add(selection);
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down:{id:number;x:number;y:number;drag:boolean;progress:number}|null=null;let hover:string|null=null;
  const pickAt=(x:number,y:number)=>{if(entryProgress<.999)return null;pointer.set(x*2-1,-y*2+1);ray.setFromCamera(pointer,camera);for(const hit of ray.intersectObjects([...model.hotspots.map(h=>h.object),loadHit],true)){let o:THREE.Object3D|null=hit.object;let visible=true,part:string|null=null;while(o){if(!o.visible)visible=false;if(o.userData.studioPart&&!part)part=String(o.userData.studioPart);o=o.parent;}if(part&&visible)return part;}return null;};
  const pick=(event:PointerEvent)=>{const r=renderer.domElement.getBoundingClientRect();return pickAt((event.clientX-r.left)/r.width,(event.clientY-r.top)/r.height);};
  const onDown=(e:PointerEvent)=>{if(!e.isPrimary||down)return;const current=latest.current.state;const drag=pick(e)==="load"&&current.phase==="prepare"&&current.setup===0;down={id:e.pointerId,x:e.clientX,y:e.clientY,drag,progress:current.loadProgress??0};if(drag){controls.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);e.preventDefault();e.stopPropagation();}};
  const onMove=(e:PointerEvent)=>{if(down&&e.pointerId!==down.id)return;if(down?.drag){const distance=latest.current.state.process==="oxidation"?down.y-e.clientY:latest.current.state.process==="packaging"?e.clientY-down.y:e.clientX-down.x;latest.current.onLoadProgress?.(Math.max(0,Math.min(1,down.progress+distance/145)));invalid=true;e.preventDefault();return;}const next=pick(e);if(next!==hover)invalid=true;hover=next;renderer.domElement.style.cursor=hover?latest.current.state.setup===0&&hover==="load"?"grab":"pointer":"grab";};
  const onLeave=()=>{if(hover!==null){hover=null;invalid=true;}};
  const cancelGesture=(event?:Event)=>{if(event instanceof PointerEvent&&down&&event.pointerId!==down.id)return;const active=down;down=null;controls.enabled=true;if(active&&renderer.domElement.hasPointerCapture(active.id))renderer.domElement.releasePointerCapture(active.id);};
  const onUp=(e:PointerEvent)=>{if(!down||e.pointerId!==down.id)return;if(Math.hypot(e.clientX-down.x,e.clientY-down.y)<6){const id=pick(e);if(id)latest.current.onPart(id);}cancelGesture(e);};
  let tween=true,lastFocus=latest.current.state.focus,lastRevision=latest.current.state.viewRevision??0,started=performance.now();const fromP=new THREE.Vector3(),fromT=new THREE.Vector3(),toP=new THREE.Vector3(),toT=new THREE.Vector3();
  const setView=(instant=false)=>{if(entryProgress>=.999){const view=model.views[latest.current.state.focus]??model.views.overview;toP.set(...view.position);toT.set(...view.target);if(camera.aspect<1.05)toP.sub(toT).multiplyScalar(1.06).add(toT);}else{toP.copy(closedView.position);toT.copy(closedView.target);}fromP.copy(camera.position);fromT.copy(controls.target);started=performance.now();tween=true;if(instant){camera.position.copy(toP);controls.target.copy(toT);controls.update();tween=false;}};
  function beginEntry(desired: number, now: number) {
    cancelGesture();
    entryFrom = entryProgress;
    entryTarget = desired;
    entryStarted = now;
    const distance = Math.abs(entryTarget - entryFrom);
    entryDuration = Math.max(180, distance * 2600);
    const crossesOpenPose = (entryFrom < .5 && desired === 1) ||
      (entryFrom > .5 && desired === 0);
    entryMidpoint = crossesOpenPose ? Math.abs(.5 - entryFrom) / distance : 0;
    entryMoving = true;
    tween = false;
    entryFromP.copy(camera.position);
    entryFromT.copy(controls.target);
    entryMiddleP.copy(openView.position);
    entryMiddleT.copy(openView.target);
    if (desired) {
      const view = model.views[latest.current.state.focus]??model.views.overview;
      entryToP.set(...view.position);
      entryToT.set(...view.target);
      if (camera.aspect < 1.05) entryToP.sub(entryToT).multiplyScalar(1.06).add(entryToT);
    } else {
      entryToP.copy(closedView.position);
      entryToT.copy(closedView.target);
    }
    controls.enabled = false;
  }
  const orbit=()=>{tween=false;};controls.addEventListener("start",orbit);
  const onKey=(e:KeyboardEvent)=>{const s=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));if(e.key==="ArrowLeft")s.theta-=.1;else if(e.key==="ArrowRight")s.theta+=.1;else if(e.key==="ArrowUp")s.phi=Math.max(.3,s.phi-.08);else if(e.key==="ArrowDown")s.phi=Math.min(1.52,s.phi+.08);else if(e.key==="+"||e.key==="=")s.radius=Math.max(2.2,s.radius-.4);else if(e.key==="-")s.radius=Math.min(18,s.radius+.4);else return;e.preventDefault();tween=false;camera.position.copy(new THREE.Vector3().setFromSpherical(s).add(controls.target));controls.update();};
  window.addEventListener("blur",cancelGesture);renderer.domElement.addEventListener("lostpointercapture",cancelGesture);renderer.domElement.addEventListener("pointerdown",onDown,true);renderer.domElement.addEventListener("pointermove",onMove);renderer.domElement.addEventListener("pointerleave",onLeave);renderer.domElement.addEventListener("pointerup",onUp);renderer.domElement.addEventListener("pointercancel",cancelGesture);renderer.domElement.addEventListener("keydown",onKey);
  let invalid=true,visible=true,destroyed=false,rendered=false,failed=false,request=0,last=0,motionTime=latest.current.state.progress*6;
  let lastState: StageState | undefined;
  let settleUntil = 0;
  let warmed = false;
  let lastDrawWasInterior = false;
  let viewportWidth = 0, viewportHeight = 0;
  const resize = () => {
    const { width, height } = element.getBoundingClientRect();
    if (!width || !height || width === viewportWidth && height === viewportHeight) return;
    viewportWidth = width;
    viewportHeight = height;
    renderer.setSize(width, height, false);
    entryReveal.resize();
    camera.aspect = width / height;
    camera.fov = camera.aspect < 1.05 ? 53 : 36;
    camera.updateProjectionMatrix();
    closedView = fitShellView();
    openView = fitShellView(true);
    invalid = true;
    if (entryMoving) beginEntry(entryTarget, performance.now());
    else setView(!rendered);
  };
  const observer=new ResizeObserver(resize);observer.observe(element);resize();
  const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;invalid=true;});intersection.observe(element);
  const lost=(e:Event)=>{e.preventDefault();failed=true;setStatus("failed");latest.current.onReady(false);};renderer.domElement.addEventListener("webglcontextlost",lost);
  const project=new THREE.Vector3();
  const labelBounds = new THREE.Box3();
  function visiblePart(id: string | null) {
    const part = model.hotspots.find(item => item.id === id);
    for (let object: THREE.Object3D | null = part?.object ?? null; object; object = object.parent) {
      if (!object.visible) return undefined;
    }
    return part;
  }
  const renderCamera = new THREE.PerspectiveCamera();
  function renderWarmInterior(current: StageState) {
    model.root.visible = true;
    shell.root.visible = false;
    // Direct entry into observation or saved review starts with equipment loaded.
    const initial = current.phase === "prepare" ? current : { ...current, reducedMotion: true };
    model.update(initial, 0, motionTime);
    monitor?.update(current);
    renderCamera.copy(camera);
    const { position, target } = model.views.overview;
    renderCamera.position.set(...position);
    renderCamera.lookAt(...target);
    renderer.setScissor(0, 0, 2, 2);
    renderer.setScissorTest(true);
    try {
      renderer.render(scene, renderCamera);
      entryReveal.warm();
    } finally {
      renderer.setScissorTest(false);
    }
    lastDrawWasInterior = true;
  }

  function drawStage(showInterior: boolean, blend: number) {
    const dissolving = showInterior && blend < 1;
    if (dissolving && !entryReveal.captured) {
      model.root.visible = false;
      shell.root.visible = true;
      shell.update(1);
      renderCamera.copy(camera);
      renderCamera.position.copy(openView.position);
      renderCamera.lookAt(openView.target);
      renderer.shadowMap.autoUpdate = true;
      renderer.render(scene, renderCamera);
      entryReveal.capture();
      lastDrawWasInterior = false;
    }
    shell.root.visible = !showInterior;
    model.root.visible = showInterior;
    renderer.shadowMap.autoUpdate = !dissolving;
    if (showInterior !== lastDrawWasInterior) renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    if (dissolving) entryReveal.draw(blend);
    lastDrawWasInterior = showInterior;
  }
  function animate(now:number){
   if(destroyed)return;request=requestAnimationFrame(animate);
   // A requested entry/exit must settle even while scrolling brings the scene
   // back into view. Otherwise an offscreen review link can leave the UI waiting
   // for IntersectionObserver before it acknowledges the user's action.
   if(failed||document.hidden||!viewportWidth||!visible&&rendered&&!entryMoving&&(latest.current.entered?1:0)===entryTarget)return;
   const dt=Math.min(.1,(now-last)/1000||.016);last=now;const current=latest.current.state;
   const desiredEntry=latest.current.entered?1:0;
   if(desiredEntry!==entryTarget)beginEntry(desiredEntry,now);
   const wasMoving = entryMoving;
   if (entryMoving) {
     const p = current.reducedMotion ? 1 : THREE.MathUtils.clamp((now - entryStarted) / entryDuration, 0, 1);
     if (entryMidpoint && p < entryMidpoint) {
       const step = smooth(p / entryMidpoint);
       entryProgress = THREE.MathUtils.lerp(entryFrom, .5, step);
       camera.position.lerpVectors(entryFromP, entryMiddleP, step);
       controls.target.lerpVectors(entryFromT, entryMiddleT, step);
     } else {
       const step = smooth((p - entryMidpoint) / (1 - entryMidpoint));
       entryProgress = THREE.MathUtils.lerp(entryMidpoint ? .5 : entryFrom, entryTarget, step);
       camera.position.lerpVectors(entryMidpoint ? entryMiddleP : entryFromP, entryToP, step);
       controls.target.lerpVectors(entryMidpoint ? entryMiddleT : entryFromT, entryToT, step);
     }
     if (p === 1) {
       entryProgress = entryTarget;
       entryMoving = false;
       controls.enabled = true;
     }
   }
   const interiorReady=entryProgress>=.999&&entryTarget===1&&!entryMoving;if(reportedInterior!==interiorReady){reportedInterior=interiorReady;latest.current.onInteriorReady?.(interiorReady);}
   element?.setAttribute("data-entry",entryMoving?"opening":interiorReady?"interior":"exterior");element?.setAttribute("data-opening",entryProgress.toFixed(3));element?.setAttribute("data-door-mechanism",shell.mechanism);
   if(lastFocus!==current.focus||lastRevision!==(current.viewRevision??0)){lastFocus=current.focus;lastRevision=current.viewRevision??0;if(!entryMoving)setView();}
   if(tween&&!entryMoving){const t=current.reducedMotion?1:Math.min(1,(now-started)/650),e=1-(1-t)**3;camera.position.copy(fromP).lerp(toP,e);controls.target.copy(fromT).lerp(toT,e);if(t===1)tween=false;}
   controls.enableDamping=!current.reducedMotion&&!entryMoving;const changed=controls.update();camera.updateMatrixWorld(true);
   if (current !== lastState && process === "oxidation" && current.phase === "prepare") {
     settleUntil = now + 650;
   }
   if (rendered && current === lastState && !invalid && !tween && !entryMoving && !wasMoving &&
       !changed && !down && !current.running && !model.settling && now >= settleUntil &&
       lastDrawWasInterior === (entryProgress > .5)) return;
   lastState = current;
   invalid = false;
   const showInterior = entryProgress > .5;
   const blend = reveal(.5, .985, entryProgress);
   element?.setAttribute("data-reveal", blend.toFixed(3));
   if (showInterior) {
     if (current.running && !current.reducedMotion) motionTime += dt;
     model.update(current, dt, current.reducedMotion ? 0 : motionTime);
     monitor?.update(current);
     model.root.updateMatrixWorld(true);
   } else {
     shell.update(Math.min(1, entryProgress * 2));
   }
   model.root.visible = showInterior;
   loadHit.visible=interiorReady&&current.phase==="prepare"&&current.setup===0;
   if(loadObject&&loadHit.visible){hitBounds.setFromObject(loadObject.object);hitBounds.getCenter(loadHit.position);hitBounds.getSize(hitSize);loadHit.scale.set(Math.max(.16,hitSize.x+.12),Math.max(.16,hitSize.y+.12),Math.max(.16,hitSize.z+.12));loadHit.updateMatrixWorld(true);
    // Choose a screen-visible point on the actual loading object. The inset
    // can occlude its center; it must not become a see-through click target.
    let found=false;for(const y of[0,.35,-.35]){for(const x of[0,-.35,.35]){for(const z of[0,.35,-.35]){project.set(loadHit.position.x+hitSize.x*x,loadHit.position.y+hitSize.y*y,loadHit.position.z+hitSize.z*z).project(camera);const px=(project.x+1)/2,py=(1-project.y)/2;if(px>.04&&px<.96&&py>.12&&py<.88&&pickAt(px,py)==="load"){host.current?.setAttribute("data-load-x",(px*renderer.domElement.clientWidth).toFixed(1));host.current?.setAttribute("data-load-y",(py*renderer.domElement.clientHeight).toFixed(1));found=true;break;}}if(found)break;}if(found)break;}host.current?.setAttribute("data-load-visible",String(found));}
   const selected=visiblePart(hover??current.selected);selection.visible=interiorReady&&!!selected;if(selected)selection.box.setFromObject(selected.object);
   const contactFocus = process === "wafer" && current.setup === 2 && current.focus === "detail";
   const target=visiblePart(hover??(current.phase==="prepare"?current.setup===0?"load":current.setup===1?"process":contactFocus?null:"inspect":null));
   if(label.current){if(target&&interiorReady){labelBounds.setFromObject(target.object).getCenter(project);project.project(camera);const w=renderer.domElement.clientWidth,hh=renderer.domElement.clientHeight,x=(project.x+1)*w/2,y=(1-project.y)*hh/2;label.current.textContent=local(studioContent[current.process].parts.find(p=>p.id===target.id)?.name??target.label,current.language);label.current.style.left=`${Math.max(12,Math.min(w-155,x+12))}px`;label.current.style.top=`${Math.max(65,Math.min(hh-75,y-26))}px`;label.current.style.display="block";host.current?.setAttribute("data-part-x",x.toFixed(1));host.current?.setAttribute("data-part-y",y.toFixed(1));host.current?.setAttribute("data-part",target.id);}else label.current.style.display="none";}
   try {
     if (!warmed) {
       renderWarmInterior(current);
       warmed = true;
     }
     drawStage(showInterior, blend);
     if (!rendered) {
       rendered = true;
       setStatus("ready");
       latest.current.onReady(true);
     }
   } catch {
     failed = true;
     setStatus("failed");
     latest.current.onReady(false);
   }
  }
  request=requestAnimationFrame(animate);
  return()=>{destroyed=true;cancelAnimationFrame(request);observer.disconnect();intersection.disconnect();controls.removeEventListener("start",orbit);controls.dispose();window.removeEventListener("blur",cancelGesture);renderer.domElement.removeEventListener("lostpointercapture",cancelGesture);renderer.domElement.removeEventListener("pointerdown",onDown,true);renderer.domElement.removeEventListener("pointermove",onMove);renderer.domElement.removeEventListener("pointerleave",onLeave);renderer.domElement.removeEventListener("pointerup",onUp);renderer.domElement.removeEventListener("pointercancel",cancelGesture);renderer.domElement.removeEventListener("keydown",onKey);renderer.domElement.removeEventListener("webglcontextlost",lost);entryReveal.dispose();model.dispose?.();const materials=new Set<THREE.Material>(),geometries=new Set<THREE.BufferGeometry>();scene.traverse(obj=>{const mesh=obj as THREE.Mesh;if(mesh.geometry)geometries.add(mesh.geometry);if(mesh.material)for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(mat);});geometries.forEach(g=>g.dispose());materials.forEach(mat=>{for(const value of Object.values(mat))if(value instanceof THREE.Texture)value.dispose();mat.dispose();});environment.texture.dispose();environment.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
 },[state.process]);
 const showPartLabel = state.process !== "wafer" || (state.focus !== "inspection" && state.focus !== "dicing");
 return <div className="st-stage-canvas" ref={host} data-renderer={status} data-process={state.process} data-setup={state.setup} data-load={(state.loadProgress??0).toFixed(3)} data-progress={state.progress.toFixed(3)} data-phase={state.phase} data-focus={state.focus} data-view-revision={state.viewRevision??0}>{showPartLabel&&<div className="st-part-label" ref={label} />}{status!=="ready"&&<div className="st-stage-status" role="status">{translate(state.language,status==="failed"?"failed":"loading")}</div>}</div>;
}
