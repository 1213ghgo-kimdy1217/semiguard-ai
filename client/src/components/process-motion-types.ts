import type { ProcessSceneState } from "../../../shared/processScene";
import type { ProductLanguage } from "../lib/productLanguage";

export type MotionSceneProps = {
  scene: ProcessSceneState;
  language: ProductLanguage;
  running: boolean;
  variant: "current" | "reference";
  selectedSignal: string;
  showReference: boolean;
  onSignalChange?: (id: string) => void;
};

export function motionChannel(
  scene: ProcessSceneState,
  id: string,
  variant: MotionSceneProps["variant"]
) {
  const source = scene.channels.find(item => item.id === id);
  const reference = source?.reference ?? 100;
  const value =
    variant === "reference" ? reference : (source?.value ?? reference);
  const delta = Math.max(
    -2,
    Math.min(
      2,
      (value - reference) /
        Math.max(1, (source?.high ?? 104) - (source?.low ?? 96))
    )
  );
  return { value, reference, delta, label: source?.name };
}
