import React, { useId } from "react";
import { tr } from "../lib/productLanguage";
import type { SceneProps } from "./ProcessScenePrimitives";
import { DetailedEtchScene, DetailedOxidationScene, DetailedPhotoScene } from "./ProcessSceneEquipment";
import { DetailedWaferScene, DetailedEdsScene } from "./ProcessSceneInspection";
import { DetailedDepositionScene, DetailedMetalScene, DetailedPackagingScene } from "./ProcessSceneLayers";
export default function ProcessSceneDiagram({ scene, language }: SceneProps) {
  const id = useId();
  const names = {
    wafer: ["웨이퍼 표면·두께 검사", "Wafer surface and thickness inspection", "ウェーハ表面・厚さ検査"],
    oxidation: ["산화막 검사", "Oxide-film inspection", "酸化膜検査"],
    photo: ["패턴 위치·형상 검사", "Pattern position and shape inspection", "パターン位置・形状検査"],
    etch: ["식각 챔버 관측", "Etch chamber observation", "エッチングチャンバー観測"],
    deposition: ["증착·이온 주입의 별도 검사", "Separate deposition and implantation inspections", "成膜・イオン注入の別々の検査"],
    metal: ["금속 배선 연결·외관 검사", "Interconnect connection and appearance inspection", "金属配線の接続・外観検査"],
    eds: ["웨이퍼 칩 검사", "Wafer die inspection", "ウェーハチップ検査"],
    packaging: ["패키지 연결·외관 검사", "Package connection and appearance inspection", "パッケージ接続・外観検査"],
  } as const;
  const copy = names[scene.processId];
  const title = tr(language, copy[0], copy[1], copy[2]);
  return <svg viewBox="0 0 800 440" className="pv-diagram" role="img" aria-labelledby={`${id}-title ${id}-description`} data-process-scene={scene.processId} data-detail="cutaway">
    <title id={`${id}-title`}>{title}</title>
    <desc id={`${id}-description`}>{tr(language,
      "관련 위치 옆의 움직이는 점과 바늘은 선택 시점의 교육용 상대지수를 나타냅니다. 물리 치수·실제 장비 상태·고장 위치를 그린 것이 아닙니다.",
      "Moving dots and needles beside related locations encode the selected teaching-only relative indices. They are not physical dimensions, actual equipment conditions or fault locations.",
      "関連位置の横の点と針は選択時点の教育用相対指数を表します。物理寸法・実際の装置状態・故障位置を描いたものではありません。")}</desc>
    <g fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M188 355H612M188 92H612" stroke="#2b4538" strokeDasharray="3 9" opacity=".65" />
      {scene.processId === "wafer" ? <DetailedWaferScene scene={scene} language={language} /> : null}
      {scene.processId === "oxidation" ? <DetailedOxidationScene scene={scene} language={language} /> : null}
      {scene.processId === "photo" ? <DetailedPhotoScene scene={scene} language={language} /> : null}
      {scene.processId === "etch" ? <DetailedEtchScene scene={scene} language={language} /> : null}
      {scene.processId === "deposition" ? <DetailedDepositionScene scene={scene} language={language} /> : null}
      {scene.processId === "metal" ? <DetailedMetalScene scene={scene} language={language} /> : null}
      {scene.processId === "eds" ? <DetailedEdsScene scene={scene} language={language} /> : null}
      {scene.processId === "packaging" ? <DetailedPackagingScene scene={scene} language={language} /> : null}
    </g>
  </svg>;
}
