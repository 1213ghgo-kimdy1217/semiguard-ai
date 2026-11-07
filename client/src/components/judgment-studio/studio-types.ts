import type * as THREE from "three";
import type {ProcessId,LocalizedText} from "@shared/processScenarios";
import type {ProcessSceneState} from "@shared/processScene";
export type Language="ko"|"en"|"ja";
export type Focus="overview"|"detail"|"inspection"|"dicing";
export type StageState={process:ProcessId;phase:"prepare"|"react"|"observe"|"decide"|"review";setup:number;loadProgress?:number;progress:number;parameter:number;running:boolean;language:Language;focus:Focus;viewRevision?:number;reducedMotion:boolean;recordTime:number;selected:string|null;currentReading?:ProcessSceneState;referenceReading?:ProcessSceneState};
export type SceneView={position:[number,number,number];target:[number,number,number]};
export type SceneModel={root:THREE.Group;hotspots:{id:string;object:THREE.Object3D;label:LocalizedText}[];views:Record<Exclude<Focus,"dicing">,SceneView>&{dicing?:SceneView};update:(state:StageState,seconds:number,time:number)=>void;dispose?:()=>void};
export type SceneHelpers={
 box:(w:number,h:number,d:number,mat:THREE.Material,position:[number,number,number],parent?:THREE.Object3D)=>THREE.Mesh;
 cylinder:(r:number,h:number,mat:THREE.Material,position:[number,number,number],parent?:THREE.Object3D)=>THREE.Mesh;
 ring:(r:number,tube:number,mat:THREE.Material,position:[number,number,number],parent?:THREE.Object3D)=>THREE.Mesh;
 line:(points:[number,number,number][],color:number,parent?:THREE.Object3D)=>THREE.Line;
 material:(color:number,metalness?:number,roughness?:number)=>THREE.MeshStandardMaterial;
 steel:THREE.MeshStandardMaterial;dark:THREE.MeshStandardMaterial;gold:THREE.MeshStandardMaterial;wafer:THREE.MeshPhysicalMaterial;glass:THREE.MeshPhysicalMaterial;cyan:THREE.MeshStandardMaterial;
};
export type ProcessContent={
 id:ProcessId;name:LocalizedText;headline:LocalizedText;question:LocalizedText;objective:LocalizedText;
 steps:readonly LocalizedText[];parameterLabel:LocalizedText;parameterHint:LocalizedText;reaction:LocalizedText;
 observe:LocalizedText;lesson:LocalizedText;review:LocalizedText;
 parts:readonly {id:string;name:LocalizedText;description:LocalizedText}[];
 equipment:readonly {name:string;role:LocalizedText;question:LocalizedText;sourceTitle:string;url:string}[];
};
