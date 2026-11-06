import { useState } from "react";
import type { ProcessSceneState } from "../../../shared/processScene";
import { processEquipment } from "../../../shared/processEquipment";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import EtchMotionScene from "./EtchMotionScene";
import PhotoMotionScene from "./PhotoMotionScene";
import JudgmentInspectionScenes from "./JudgmentInspectionScenes";
import JudgmentLayerScenes from "./JudgmentLayerScenes";
import ProcessSceneDiagram from "./ProcessSceneDiagram";
import "./judgment-scene-canvas.css";

export default function JudgmentSceneCanvas({
  scene,
  language,
  running,
  selectedSignal,
  onSignalChange,
}: {
  scene: ProcessSceneState;
  language: ProductLanguage;
  running: boolean;
  selectedSignal: string;
  onSignalChange: (id: string) => void;
}) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const [comparison, setComparison] = useState<"overlay" | "split">("overlay");
  const [structure, setStructure] = useState(false);
  const Scene =
    scene.processId === "etch"
      ? EtchMotionScene
      : scene.processId === "photo"
        ? PhotoMotionScene
        : ["wafer", "oxidation", "eds"].includes(scene.processId)
          ? JudgmentInspectionScenes
          : JudgmentLayerScenes;
  const selected =
    scene.channels.find(item => item.id === selectedSignal) ??
    scene.channels[0];
  const equipment = processEquipment[scene.processId];
  return (
    <div className="jd-observation">
      <div className="jd-toolbar">
        <div
          className="jd-observation-picks"
          role="group"
          aria-label={l(
            "관찰할 장비·검사 부위",
            "Equipment or inspection area to explore",
            "観察する装置・検査部分"
          )}
        >
          {scene.channels.map(channel => (
            <button
              type="button"
              key={channel.id}
              data-signal={channel.id}
              data-value={channel.value.toFixed(1)}
              aria-pressed={selected.id === channel.id}
              onClick={() => onSignalChange(channel.id)}
            >
              <span>{l(...channel.name)}</span>
              <strong>{channel.value.toFixed(1)}</strong>
            </button>
          ))}
        </div>
        <div
          className="jd-comparison"
          role="group"
          aria-label={l(
            "정상 참고 비교 방식",
            "Reference comparison view",
            "正常参照の比較表示"
          )}
        >
          <button
            type="button"
            aria-pressed={comparison === "overlay"}
            onClick={() => setComparison("overlay")}
          >
            {l("겹쳐 비교", "Overlay", "重ねて比較")}
          </button>
          <button
            type="button"
            aria-pressed={comparison === "split"}
            onClick={() => setComparison("split")}
          >
            {l("나란히 비교", "Side by side", "並べて比較")}
          </button>
        </div>
      </div>
      <div className={`jd-stages jd-stages--${comparison}`}>
        {comparison === "split" ? (
          <figure className="jd-stage jd-reference">
            <figcaption>
              {l(
                "같은 조건의 정상 참고",
                "Same-condition reference",
                "同じ条件の正常参照"
              )}
            </figcaption>
            <Scene
              scene={scene}
              language={language}
              running={running}
              variant="reference"
              selectedSignal={selected.id}
              showReference={false}
            />
          </figure>
        ) : null}
        <figure className="jd-stage jd-current">
          <figcaption>
            <strong>{l("이번 기록", "Current record", "今回の記録")}</strong>
            {comparison === "overlay" ? (
              <span>
                {l(
                  "금색 윤곽 · 정상 참고",
                  "Gold outline · reference",
                  "金色の輪郭・正常参照"
                )}
              </span>
            ) : null}
          </figcaption>
          <Scene
            scene={scene}
            language={language}
            running={running}
            variant="current"
            selectedSignal={selected.id}
            showReference={comparison === "overlay"}
            onSignalChange={onSignalChange}
          />
        </figure>
      </div>
      <details
        className="jd-structure"
        open={structure}
        onToggle={event => setStructure(event.currentTarget.open)}
      >
        <summary>
          {l(
            "장비 구조·회사 원문 자세히 보기",
            "Explore equipment structure and manufacturer sources",
            "装置構造・メーカー原文を詳しく見る"
          )}
        </summary>
        {structure ? (
          <>
            <div className="jd-structure-diagram">
              <ProcessSceneDiagram scene={scene} language={language} />
            </div>
            <div className="jd-equipment-source">
              <strong>{equipment.name}</strong>
              <p>{l(...equipment.context)}</p>
              {equipment.sources.map(source => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {source.name} ↗
                </a>
              ))}
            </div>
          </>
        ) : null}
      </details>
    </div>
  );
}
