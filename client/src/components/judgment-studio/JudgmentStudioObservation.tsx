import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { ProcessSceneState } from "../../../../shared/processScene";
import { tr, type ProductLanguage } from "../../lib/productLanguage";
import StudioStage from "./StudioStage";
import { studioContent } from "./studio-content";
import { local, translate } from "./studio-i18n";
import { guideHeading, processGuides } from "./studio-process-guide";
import type { Focus, StageState } from "./studio-types";
import "./judgment-studio-observation.css";

type Props = {
  scene: ProcessSceneState;
  language: ProductLanguage;
  running: boolean;
  review: boolean;
  selectedSignal: string;
  onSignalChange: (signal: string) => void;
  fallback: ReactNode;
};

const views = ["overview", "detail", "inspection", "dicing"] as const;

export default function JudgmentStudioObservation({
  scene,
  language,
  running,
  review,
  selectedSignal,
  onSignalChange,
  fallback,
}: Props) {
  const [focus, setFocus] = useState<Focus>("inspection");
  const [viewRevision, setViewRevision] = useState(0);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [diagram, setDiagram] = useState(false);
  const [renderer, setRenderer] = useState<"loading" | "ready" | "failed">("loading");
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const content = studioContent[scene.processId];
  const guide = processGuides[scene.processId];
  const guideStep = guide?.find(step => step.id === selectedStep) ?? guide?.at(-1);
  const part = content.parts.find(item => item.id === selectedPart);
  const current = scene.channels.find(channel => channel.id === selectedSignal) ?? scene.channels[0];
  const ready = renderer === "ready";
  const showDiagram = diagram || !ready;

  const changeView = (view: Focus) => {
    setFocus(view);
    setViewRevision(revision => revision + 1);
  };
  const selectPart = (id: string) => {
    setSelectedPart(id);
    if (id === "dicing" && scene.processId === "wafer") changeView("dicing");
    else if (id === "inspect" || id === "tester") changeView("inspection");
    else if (id === "process" || id === "spool") changeView("detail");
    else if (id === "load") changeView("overview");
  };
  const onReady = useCallback((success: boolean) => {
    setRenderer(success ? "ready" : "failed");
  }, []);

  // Playback updates the supplied readings. The equipment shows a fixed
  // principle snapshot selected independently of the record timestamp.
  const stage: StageState = {
    process: scene.processId,
    phase: review ? "review" : "observe",
    setup: 3,
    loadProgress: 1,
    progress: guideStep?.snapshot ?? 1,
    parameter: .5,
    running: false,
    language,
    focus,
    viewRevision,
    reducedMotion,
    recordTime: scene.time,
    selected: selectedPart,
    currentReading: scene,
    referenceReading: scene,
  };

  return (
    <div className="jso" data-record-playing={running} data-observation-mode={review ? "review" : "observe"}>
      <div className="jso-toolbar">
        <strong>{l("장비와 검사 기록", "Equipment and inspection records", "装置と検査記録")}</strong>
        {ready && !diagram ? (
          <button type="button" onClick={() => setDiagram(true)}>
            {l("비교 도식 보기", "View comparison diagram", "比較図を見る")}
          </button>
        ) : diagram || renderer === "failed" ? (
          <button type="button" onClick={() => { setRenderer("loading"); setDiagram(false); }}>
            {l("3D 장비 보기", "View 3D equipment", "3D装置を見る")}
          </button>
        ) : null}
      </div>
      {renderer === "failed" ? (
        <p className="jso-note" role="status">
          {l("비교 도식으로 관찰을 계속할 수 있어요.", "You can continue with the comparison diagram.", "比較図で観察を続けられます。")}
        </p>
      ) : null}
      <div className="jso-engine" data-loading={!ready && !diagram && renderer !== "failed"}>
        {!diagram && renderer !== "failed" ? (
          <div className="jso-viewport" aria-hidden={!ready} inert={!ready}>
            <StudioStage state={stage} entered onPart={selectPart} onReady={onReady} />
          </div>
        ) : null}
        {showDiagram && fallback}
      </div>
      {!showDiagram ? (
        <>
          <div className="jso-controls" role="group" aria-label={l("장비 시점", "Equipment views", "装置の視点")}>
            {views.filter(view => view !== "dicing" || scene.processId === "wafer").map(view => (
              <button key={view} type="button" aria-pressed={focus === view} onClick={() => {
                setSelectedPart(null);
                changeView(view);
              }}>
                {translate(language, view)}
              </button>
            ))}
          </div>
          <p className="jso-note">
            {focus === "dicing" ? translate(language, "dicingNote") : l(
              "장비는 공정 원리를 보여줘요. 시간을 옮기면 그 시점의 가상 검사 기록이 갱신돼요.",
              "The equipment illustrates the process. Move the timeline to update the synthetic inspection records.",
              "装置は工程の原理を示します。タイムラインを動かすと、その時点の仮想検査記録に切り替わります。"
            )}
            {" "}{translate(language, "rotate")}
          </p>
          {part ? <p className="jso-note"><strong>{local(part.name, language)}</strong> {local(part.description, language)}</p> : null}
          {guide && guideStep ? (
            <section className="jso-guide" aria-label={local(guideHeading, language)}>
              <strong>{local(guideHeading, language)}</strong>
              <div className="jso-controls">
                {guide.map(step => (
                  <button key={step.id} type="button" aria-pressed={step.id === guideStep.id} onClick={() => {
                    setSelectedStep(step.id);
                    setSelectedPart(null);
                    changeView("inspection");
                  }}>
                    {local(step.title, language)}
                  </button>
                ))}
              </div>
              <p className="jso-note">{local(guideStep.detail, language)}</p>
            </section>
          ) : null}
          <details className="jso-details">
            <summary>{l("장비 부위와 제조사 자료", "Equipment parts and manufacturer sources", "装置の部位とメーカー資料")}</summary>
            <div className="jso-controls" role="group" aria-label={l("장비 부위", "Equipment parts", "装置の部位")}>
              {content.parts.map(item => (
                <button type="button" key={item.id} aria-pressed={item.id === selectedPart} onClick={() => selectPart(item.id)}>
                  {local(item.name, language)}
                </button>
              ))}
            </div>
            <ul className="jso-sources">
              {content.equipment.map(source => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer">{source.sourceTitle} ↗</a>
                  <span>{local(source.role, language)}</span>
                </li>
              ))}
            </ul>
          </details>
          <div className="jso-readings" role="group" aria-label={l("같은 조건의 가상 검사 기록", "Same-condition inspection records", "同じ条件の仮想検査記録")}>
            {scene.channels.map(channel => (
              <button type="button" key={channel.id} data-signal={channel.id} data-value={channel.value.toFixed(1)} aria-pressed={current?.id === channel.id} onClick={() => onSignalChange(channel.id)}>
                <strong>{local(channel.name, language)}</strong>
                <span>{l("관측값", "Observed", "観測値")} <b>{channel.value.toFixed(1)}</b></span>
                <span>{l("정상 참고", "Reference", "正常参照")} <b>{channel.reference.toFixed(1)}</b></span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
