import { useEffect, useState } from "react";
import type { ProcessId } from "@shared/processScenarios";
import StudioStage from "./StudioStage";
import { equipmentEntry, entryText } from "./equipment-entry-content";
import { studioContent } from "./studio-content";
import { local, translate } from "./studio-i18n";
import { guideHeading, processGuides } from "./studio-process-guide";
import type { Focus, Language } from "./studio-types";
import "./judgment-studio-preparation.css";

type Props = {
  processId: ProcessId;
  language: Language;
  onObserve: () => void;
};

export default function StudioPreparation({ processId, language, onObserve }: Props) {
  const [ready, setReady] = useState<boolean | null>(null);
  const [entered, setEntered] = useState(false);
  const [interiorReady, setInteriorReady] = useState(false);
  const [setup, setSetup] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [parameter, setParameter] = useState(.5);
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [focus, setFocus] = useState<Focus>("overview");
  const [viewRevision, setViewRevision] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);

  const entry = equipmentEntry[processId];
  const content = studioContent[processId];
  const inside = entered && interiorReady;
  const phase = setup < 3 ? "prepare" : progress < 1 ? "react" : "observe";
  const guideStep = processGuides[processId]?.findLast(step => progress >= step.start);
  const l = (value: readonly [string, string, string]) => local(value, language);
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const et = (key: Parameters<typeof entryText>[1]) => entryText(language, key);
  const part = content.parts.find(item => item.id === selected);

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!holding || !inside || phase !== "react") return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.min(.2, (now - previous) / 1000);
      previous = now;
      if (!document.hidden) setProgress(value => Math.min(1, value + delta / 6));
    }, 50);
    const stop = () => setHolding(false);
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", stop);
    return () => {
      clearInterval(timer);
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", stop);
    };
  }, [holding, inside, phase]);

  function view(next: Focus) {
    setFocus(next);
    setViewRevision(value => value + 1);
  }

  function selectPart(id: string) {
    setSelected(id);
    if (id === "inspect") view("inspection");
    if (id === "process") view("detail");
    if (id === "dicing") view("dicing");
  }

  function advanceSetup() {
    setSetup(setup + 1);
    setLoadProgress(1);
    selectPart(setup === 0 ? "load" : setup === 1 ? "process" : "inspect");
    if (setup === 2) view("detail");
  }

  return (
    <div className="js-preparation">
      <div>
        <div className="js-preparation-viewport">
          <StudioStage
            entered={entered}
            onInteriorReady={setInteriorReady}
            onReady={setReady}
            onPart={selectPart}
            onLoadProgress={value => {
              setLoadProgress(value);
              if (value >= .98) setSetup(1);
            }}
            state={{
              process: processId, phase, setup, loadProgress, progress, parameter,
              running: holding && phase === "react", language, focus, viewRevision,
              reducedMotion: reduced, recordTime: 0, selected,
            }}
          />
        </div>
        <p className="et-caption">{inside && focus === "dicing" ? t("dicingNote") : inside ? et("innerNote") : et("hint")}</p>
        {inside && (
          <div className="js-preparation-controls" aria-label={et("inner")}>
            {(["overview", "detail", "inspection", "dicing"] as const)
              .filter(item => item !== "dicing" || processId === "wafer")
              .map(item => (
                <button type="button" key={item} aria-pressed={focus === item} onClick={() => view(item)}>
                  {t(item)}
                </button>
              ))}
            <button type="button" onClick={() => {
              setHolding(false);
              setEntered(false);
              setSelected(null);
              view("overview");
            }}>{et("back")}</button>
          </div>
        )}
        {inside && (
          <ul className="js-preparation-legend" aria-label={et("layers")}>
            {entry.legend.map(item => <li key={item.color}><i style={{ background: item.color }} />{l(item.text)}</li>)}
          </ul>
        )}
      </div>
      <section className="js-preparation-mission">
        <p className="et-eyebrow">{inside ? et("inner") : et("exterior")}</p>
        <h3>{inside ? l(content.headline) : l(entry.kind)}</h3>
        {!inside && (
          <>
            <p>{l(entry.shape)}</p>
            <p>{l(entry.focus)}</p>
            <p className="et-caption">{et("note")}</p>
            <button type="button" className="js-preparation-primary" disabled={!ready || entered} onClick={() => setEntered(true)}>
              {entered ? et("opening") : et("enter")}
            </button>
          </>
        )}
        {inside && (
          <>
            <p>{l(entry.caution)}</p>
            {phase === "prepare" && (
              <>
                {setup === 0 && <p className="et-caption">{t(processId === "oxidation" ? "dragUp" : processId === "packaging" ? "dragDown" : "dragRight")}</p>}
                <button type="button" className="js-preparation-primary" onClick={advanceSetup}>{l(content.steps[setup])}</button>
              </>
            )}
            {phase === "react" && (
              <>
                <p>{l(content.reaction)}</p>
                <button
                  type="button"
                  className="js-preparation-primary"
                  onPointerDown={event => {
                    if (!event.isPrimary) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setHolding(true);
                  }}
                  onPointerUp={() => setHolding(false)}
                  onPointerCancel={() => setHolding(false)}
                  onLostPointerCapture={() => setHolding(false)}
                  onBlur={() => setHolding(false)}
                  onKeyDown={event => {
                    if (event.key === " " || event.key === "Enter") {
                      event.preventDefault();
                      setHolding(true);
                    }
                  }}
                  onKeyUp={event => {
                    if (event.key === " " || event.key === "Enter") setHolding(false);
                  }}
                >{t("hold")} · {Math.round(progress * 100)}%</button>
                <p className="et-caption">{t("holdHelp")}</p>
              </>
            )}
            {setup > 0 && phase !== "observe" && (processId !== "photo" || phase !== "react") && (
              <label className="js-preparation-parameter">
                {l(content.parameterLabel)}
                <input type="range" min={0} max={100} value={Math.round(parameter * 100)} onChange={event => setParameter(Number(event.target.value) / 100)} />
                <small>{l(content.parameterHint)}</small>
              </label>
            )}
            {guideStep && phase !== "prepare" && (
              <div className="js-preparation-detail">
                <span>{l(guideHeading)}</span>
                <strong>{l(guideStep.title)}</strong>
                <p>{l(guideStep.detail)}</p>
              </div>
            )}
            {phase === "observe" && <p>{l(content.lesson)}</p>}
            <div className="js-preparation-controls">
              {content.parts.map(item => (
                <button type="button" key={item.id} aria-pressed={selected === item.id} onClick={() => selectPart(item.id)}>{l(item.name)}</button>
              ))}
            </div>
            {part && <p className="et-caption">{l(part.description)}</p>}
          </>
        )}
        <button type="button" className={phase === "observe" ? "js-preparation-primary" : undefined} onClick={onObserve}>
          {translate(language, "startRecord")}
        </button>
      </section>
    </div>
  );
}
