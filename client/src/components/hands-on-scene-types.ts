import type {
  EtchHandsOnState,
  PhotoHandsOnState,
  GenericHandsOnState,
  GenericHandsOnProcess,
} from "../../../shared/processHandsOn";
import type { ProductLanguage } from "../lib/productLanguage";
export type EtchHandsOnSceneProps = {
  state: EtchHandsOnState;
  language: ProductLanguage;
  activeAction: string;
  showGuide: boolean;
};
export type PhotoHandsOnSceneProps = {
  state: PhotoHandsOnState;
  language: ProductLanguage;
  showGuide: boolean;
  onOffsetChange: (value: number) => void;
};
export type GenericHandsOnSceneProps = {
  processId: GenericHandsOnProcess;
  state: GenericHandsOnState;
  language: ProductLanguage;
  showGuide: boolean;
  onSelect: (value: number) => void;
};
