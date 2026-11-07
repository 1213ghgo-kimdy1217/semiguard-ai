import type * as THREE from "three";
import type {ProcessId,LocalizedText} from "@shared/processScenarios";
import type {SceneHelpers,SceneView} from "./studio-types";

/** Educational equipment-class exterior, not a manufacturer replica.
 * Front is +Z, floor is Y=0. Mechanical opening completes before the
 * transition to the separate enlarged principle scene.
 */
export type EquipmentShell={
 root:THREE.Group;
 view:SceneView;
 opening:LocalizedText;
 mechanism:"hinged"|"sliding"|"lifting"|"cluster-lid"|"hood";
 doorParts:THREE.Object3D[];
 update:(progress:number)=>void;
};
export type ShellFactory=(process:ProcessId,helpers:SceneHelpers)=>EquipmentShell;
