import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Cpu,
  Expand,
  Focus,
  Layers3,
  Microscope,
  Pause,
  Play,
  Plus,
  Rotate3D,
  RotateCcw,
  X,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { tr } from "../../lib/productLanguage";
import ScenarioJudgmentCoach from "../ScenarioJudgmentCoach";
import { TrainingCheckpoint } from "../TrainingCheckpoint";
import { usePracticeMeasurementTracking } from "../PracticeMeasurement";
import {
  useStudioPersistence,
  restoreStudioSession,
  captureStudioCheckpoint,
  restoreStudioCheckpoint,
} from "./useStudioPersistence";
import { getProcessScenario, type ProcessId } from "@shared/processScenarios";
import StudioStage from "./StudioStage";
import InspectionOverlay from "./InspectionOverlay";
import { studioContent } from "./studio-content";
import { equipmentEntry, entryText } from "./equipment-entry-content";
import {
  createStudioState,
  getStudioReview,
  processIds,
  readStudio,
  reduceStudio,
  type StudioPin,
} from "./studio-model";
import { local, translate, type MessageKey } from "./studio-i18n";
import {
  guideHeading,
  guideReplay,
  processGuides,
  type ProcessGuideStep,
} from "./studio-process-guide";
import type { Focus as SceneFocus, Language } from "./studio-types";
import "./studio.css";
import "./equipment-entry.css";

const sceneViews = [
  { id: "overview", key: "overview", Icon: Rotate3D },
  { id: "detail", key: "detail", Icon: Layers3 },
  { id: "inspection", key: "inspection", Icon: Microscope },
  { id: "dicing", key: "dicing", Icon: Cpu },
] as const;

function Hold({
  onHold,
  children,
  disabled = false,
}: {
  onHold: (held: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  const active = useRef(false),
    handler = useRef(onHold);
  handler.current = onHold;
  const release = useCallback(() => {
    if (active.current) {
      active.current = false;
      handler.current(false);
    }
  }, []);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) release();
    };
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", hide);
    return () => {
      release();
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [release]);
  return (
    <button
      className="st-primary st-hold"
      disabled={disabled}
      onPointerDown={e => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        active.current = true;
        handler.current(true);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onBlur={release}
      onKeyDown={e => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          active.current = true;
          handler.current(true);
        }
      }}
      onKeyUp={e => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          release();
        }
      }}
    >
      {children}
    </button>
  );
}

export default function StudioApp({
  processId,
  userId,
  language,
}: {
  processId: ProcessId;
  userId: number;
  language: Language;
}) {
  const [, navigate] = useLocation();
  const [state, dispatch] = useReducer(reduceStudio, processId, id => {
    const initial = createStudioState();
    for (const process of processIds)
      initial.attempts[process] = restoreStudioSession(userId, process);
    return { ...initial, active: id };
  });
  const [entered, setEntered] = useState<Partial<Record<ProcessId, boolean>>>(
    () =>
      Object.fromEntries(
        processIds.map(id => [
          id,
          state.attempts[id].phase !== "prepare" ||
            state.attempts[id].setup > 0,
        ])
      )
  );
  const [entryReady, setEntryReady] = useState(false);
  const [focus, setFocus] = useState<SceneFocus>("overview"),
    [selected, setSelected] = useState<string | null>(null),
    [ready, setReady] = useState(false),
    [stageKey, setStageKey] = useState(0),
    [returnReview, setReturnReview] = useState(false),
    [question, setQuestion] = useState(0),
    [reduced, setReduced] = useState(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  const [viewRevision, setViewRevision] = useState(0);
  const [guidePreview, setGuidePreview] = useState<string | null>(null);
  const sceneHeading = useRef<HTMLDivElement>(null),
    reviewHeading = useRef<HTMLHeadingElement>(null);
  const coachReturn = useRef<(() => void) | null>(null);
  const a = state.attempts[state.active],
    scenario = getProcessScenario(state.active)!,
    content = studioContent[state.active],
    reading = readStudio(a),
    review = getStudioReview(a);
  const t = (key: MessageKey, values: Record<string, string | number> = {}) =>
      translate(language, key, values),
    l = (text: readonly [string, string, string]) => local(text, language);
  const { canonicalAttempt, saveStatus, retrySave } = useStudioPersistence({
    a,
    userId,
  });
  usePracticeMeasurementTracking(
    a.playing,
    a.submitted,
    "judgment-studio:" + userId + ":" + state.active + ":" + stageKey
  );
  const copy = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const index = processIds.indexOf(state.active),
    stageIndex = ["prepare", "react", "observe", "decide", "review"].indexOf(
      a.phase
    );
  const guide = processGuides[state.active];
  const selectedGuideStep =
    stageIndex >= 2 ? guide?.find(step => step.id === guidePreview) : undefined;
  const visualProgress = selectedGuideStep?.snapshot ?? a.progress;
  const guideStep =
    selectedGuideStep ?? guide?.findLast(step => a.progress >= step.start);
  const revisitGuide = (step: ProcessGuideStep) => {
    setGuidePreview(step.id);
    setSelected(null);
    setFocus("inspection");
    setViewRevision(n => n + 1);
  };
  useEffect(() => {
    let before = performance.now();
    const timer = setInterval(() => {
      const now = performance.now(),
        seconds = Math.min(0.2, (now - before) / 1000);
      before = now;
      if (!document.hidden) dispatch({ type: "tick", seconds });
    }, 100);
    const hide = () => {
      if (document.hidden) {
        dispatch({ type: "hold", value: false });
        dispatch({ type: "play", value: false });
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  useEffect(() => {
    dispatch({ type: "hold", value: false });
    dispatch({ type: "play", value: false });
  }, [language]);
  useEffect(() => {
    setReady(false);
    setEntryReady(false);
    dispatch({ type: "choose", process: processId });
  }, [processId]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)"),
      change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    setFocus(
      a.phase === "observe" || a.phase === "decide" || a.phase === "review"
        ? "inspection"
        : a.phase === "react"
          ? "detail"
          : "overview"
    );
    setSelected(null);
    setGuidePreview(null);
    setQuestion(0);
    setReturnReview(false);
    coachReturn.current = null;
  }, [state.active, a.phase]);
  useEffect(() => {
    document.title =
      "SemiGuard · " +
      local(content.name, language) +
      " · " +
      translate(language, "practice");
  }, [content, language]);
  const choose = (id: ProcessId) => {
    if (id !== state.active) navigate("/training/process/" + id);
  };
  const inside = entryReady && Boolean(entered[state.active]),
    entry = equipmentEntry[state.active],
    et = (key: Parameters<typeof entryText>[1]) => entryText(language, key);
  const enterEquipment = () => {
    setEntered(previous => ({ ...previous, [state.active]: true }));
    setSelected(null);
  };
  const exterior = () => {
    dispatch({ type: "hold", value: false });
    dispatch({ type: "play", value: false });
    setEntered(previous => ({ ...previous, [state.active]: false }));
  };
  const entryAction = (
    <button
      className="st-primary st-enter"
      disabled={!ready || (Boolean(entered[state.active]) && !entryReady)}
      onClick={enterEquipment}
    >
      <Expand size={16} />
      {entered[state.active] && !entryReady ? et("opening") : et("enter")}
      <ArrowRight size={15} />
    </button>
  );
  const showPin = (pin: StudioPin) => {
    setGuidePreview(null);
    setEntered(previous => ({ ...previous, [state.active]: true }));
    dispatch({ type: "seek", time: pin.time });
    dispatch({ type: "reference", value: pin.reference });
    setFocus("inspection");
    if (a.phase === "review") {
      setReturnReview(true);
      sceneHeading.current?.scrollIntoView({
        block: "center",
        behavior: "auto",
      });
    }
  };
  const showTime = (time: number) => {
    setGuidePreview(null);
    setEntered(previous => ({ ...previous, [state.active]: true }));
    dispatch({ type: "seek", time });
    dispatch({
      type: "reference",
      value:
        state.active === "oxidation"
          ? time < 30
            ? "A"
            : "B"
          : state.active === "etch"
            ? time < 40
              ? "A"
              : "B"
            : "current",
    });
    setFocus("inspection");
    setReturnReview(true);
    sceneHeading.current?.scrollIntoView({ block: "center", behavior: "auto" });
  };
  const reviewCoachPoint = (time: number, returnToQuestion: () => void) => {
    showTime(time);
    coachReturn.current = returnToQuestion;
  };
  const restartAttempt = () => {
    if (saveStatus === "saving" || !window.confirm(t("resetConfirm"))) return;
    dispatch({ type: "reset" });
    setReady(false);
    setEntryReady(false);
    setEntered(previous => ({ ...previous, [state.active]: false }));
    setStageKey(key => key + 1);
    sceneHeading.current?.focus({ preventScroll: true });
    sceneHeading.current?.scrollIntoView({ block: "center", behavior: "auto" });
  };
  const onPart = (id: string) => {
    setSelected(id);
    if (id === "inspect" || id === "process" || id === "dicing") {
      setFocus(
        id === "inspect" ? "inspection" : id === "dicing" ? "dicing" : "detail"
      );
      setViewRevision(n => n + 1);
    }
  };
  const PhaseIcon =
    a.phase === "react"
      ? Focus
      : a.phase === "observe"
        ? Activity
        : a.phase === "review"
          ? BookOpen
          : Layers3;
  const part = content.parts.find(p => p.id === selected);
  const parameter = (
    <label className="st-parameter">
      <span>{l(content.parameterLabel)}</span>
      <input
        type="range"
        min="0"
        max="100"
        value={Math.round(a.parameter * 100)}
        onChange={e =>
          dispatch({ type: "parameter", value: Number(e.target.value) / 100 })
        }
      />
      <small>{l(content.parameterHint)}</small>
    </label>
  );
  const phaseAction =
    a.phase === "prepare" ? (
      <button
        className="st-primary"
        disabled={!ready}
        onClick={() => {
          dispatch({ type: "setup" });
          if (state.active === "wafer" && a.setup === 1) {
            setFocus("detail");
            setViewRevision(n => n + 1);
            setSelected(null);
            return;
          }
          setSelected(
            a.setup === 0 ? "load" : a.setup === 1 ? "process" : "inspect"
          );
        }}
      >
        <Plus size={16} />
        {l(content.steps[Math.min(2, a.setup)])}
        <ArrowRight size={15} />
      </button>
    ) : a.phase === "react" ? (
      <Hold
        disabled={!ready}
        onHold={value => dispatch({ type: "hold", value })}
      >
        <Focus size={17} />
        {t("hold")}
        <span>{Math.round(a.progress * 100)}%</span>
      </Hold>
    ) : a.phase === "observe" ? (
      <div className="st-record-actions">
        <button
          className="st-primary"
          disabled={a.elapsed === scenario.duration}
          onClick={() => {
            setGuidePreview(null);
            dispatch({ type: "play", value: !a.playing });
            setFocus("inspection");
          }}
        >
          {a.playing ? <Pause size={16} /> : <Play size={16} />}{" "}
          {a.elapsed === 0
            ? t("startRecord")
            : a.elapsed === scenario.duration
              ? t("finished")
              : a.playing
                ? t("pause")
                : t("play")}
        </button>
        <button
          className="st-speed"
          aria-label={t("speed")}
          onClick={() =>
            dispatch({ type: "speed", value: a.speed === 6 ? 3 : 6 })
          }
        >
          {a.speed}×
        </button>
      </div>
    ) : null;

  return (
    <div className="st-app">
      <main id="studio-top">
        <div className="st-page-intro">
          <div>
            <span className="st-eyebrow">SEMIGUARD · {t("practice")}</span>
            <h1>{t("title")}</h1>
            <p>{t("intro")}</p>
          </div>
          <span className="st-lab-mark">
            <Layers3 size={26} />
            <strong>08</strong>
          </span>
        </div>
        <nav
          className="st-process-menu"
          id="process-menu"
          aria-label={t("choose")}
        >
          {processIds.map((id, i) => (
            <button
              key={id}
              aria-current={id === state.active ? "page" : undefined}
              onClick={() => choose(id)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              <b>{l(studioContent[id].name)}</b>
              {state.attempts[id].submitted && <Check size={12} />}
            </button>
          ))}
        </nav>
        <p className="st-preserve-note">{t("changePreserved")}</p>
        <section className="st-process-heading">
          <div>
            <span className="st-eyebrow">
              {String(index + 1).padStart(2, "0")} / {l(content.name)}
            </span>
            <h2>{l(content.headline)}</h2>
          </div>
          <div>
            <span>{t("objective")}</span>
            <p>{l(content.question)}</p>
          </div>
        </section>
        <ol className="st-step-rail" aria-label={t("practice")}>
          {(
            [
              "stepPrepare",
              "stepReact",
              "stepObserve",
              "stepDecide",
              "stepReview",
            ] as const
          ).map((key, i) => (
            <li
              key={key}
              aria-current={stageIndex === i ? "step" : undefined}
              className={stageIndex > i ? "is-done" : ""}
            >
              <span>{stageIndex > i ? <Check size={12} /> : i + 1}</span>
              <b>{t(key)}</b>
              {i < 4 && <ChevronRight size={12} />}
            </li>
          ))}
        </ol>
        <div className="st-workspace">
          <section
            className="st-scene"
            ref={sceneHeading}
            aria-label={t("modelNote")}
            tabIndex={-1}
          >
            <div className="st-scene-top">
              <span>
                <i />
                {l(inside ? content.name : entry.kind)}
              </span>
              <small>{inside ? et("inner") : et("exterior")}</small>
            </div>
            <div className="st-viewport">
              <StudioStage
                key={`${state.active}:${stageKey}`}
                entered={Boolean(entered[state.active])}
                onInteriorReady={setEntryReady}
                state={{
                  process: state.active,
                  phase: a.phase,
                  setup: a.setup,
                  loadProgress: a.loadProgress,
                  parameter: a.parameter,
                  progress: visualProgress,
                  running: a.holding,
                  language,
                  focus,
                  reducedMotion: reduced,
                  recordTime: a.viewTime,
                  selected,
                  viewRevision,
                  currentReading: stageIndex >= 2 ? reading.current : undefined,
                  referenceReading:
                    stageIndex >= 2 ? reading.reference : undefined,
                }}
                onPart={onPart}
                onReady={setReady}
                onLoadProgress={value => dispatch({ type: "load", value })}
              />
              <div className="st-view-tools">
                {inside ? (
                  sceneViews
                    .filter(
                      view => view.id !== "dicing" || state.active === "wafer"
                    )
                    .map(v => (
                      <button
                        key={v.id}
                        aria-pressed={focus === v.id}
                        onClick={() => {
                          setFocus(v.id);
                          setViewRevision(n => n + 1);
                        }}
                      >
                        <v.Icon size={15} />
                        <span>{t(v.key)}</span>
                      </button>
                    ))
                ) : (
                  <button
                    aria-pressed="true"
                    onClick={() => setViewRevision(n => n + 1)}
                  >
                    <Rotate3D size={15} />
                    <span>{et("exterior")}</span>
                  </button>
                )}
              </div>
              <div className="st-scene-helper">
                <Rotate3D size={12} />
                {t("rotate")}
              </div>
              <div className="st-mobile-action">
                {inside ? phaseAction : entryAction}
              </div>
              {inside && (
                <button className="st-exterior-return" onClick={exterior}>
                  <ArrowLeft size={13} />
                  {et("back")}
                </button>
              )}
              {inside && a.phase === "react" && (
                <div className="st-reaction-progress">
                  <span>
                    {t("progression", { n: Math.round(a.progress * 100) })}
                  </span>
                  <i>
                    <b style={{ width: `${a.progress * 100}%` }} />
                  </i>
                </div>
              )}
            </div>
            <div className="st-scene-caption">
              <p>
                {inside && focus === "dicing"
                  ? t("dicingNote")
                  : l(
                      inside
                        ? a.phase === "prepare"
                          ? content.objective
                          : a.phase === "react"
                            ? content.reaction
                            : content.observe
                        : entry.shape
                    )}
                {inside &&
                  state.active === "wafer" &&
                  a.setup >= 2 &&
                  (a.phase === "prepare" || a.phase === "react") &&
                  (focus === "overview" || focus === "detail") && (
                    <>
                      <br />
                      {l([
                        "헤드를 투명하게 표시했어요. 청록색 테두리 안의 웨이퍼가 회전 패드에 닿는 위치를 보세요.",
                        "The polishing head is translucent in this view. Follow the teal outline to see where the wafer meets the rotating pad.",
                        "ヘッドを透過表示しています。青緑色の輪郭で示したウェーハが回転パッドに接する位置を確認しましょう。",
                      ])}
                    </>
                  )}
              </p>
              {!ready && (
                <div className="st-footer-actions">
                  <button
                    onClick={() => {
                      setReady(false);
                      setStageKey(k => k + 1);
                    }}
                  >
                    {t("retry")}
                  </button>
                  <Link href={"/training/classic/" + state.active}>
                    {copy(
                      "기존 연습 화면",
                      "Classic practice screen",
                      "従来の練習画面"
                    )}
                  </Link>
                </div>
              )}
            </div>
            {inside && stageIndex >= 1 && guide && guideStep && (
              <section
                className="st-process-guide"
                aria-label={l(guideHeading)}
                data-guide-step={guideStep.id}
              >
                <div>
                  <span>{l(guideHeading)}</span>
                  <strong>{l(guideStep.title)}</strong>
                </div>
                <p>{l(guideStep.detail)}</p>
                {stageIndex >= 2 && (
                  <>
                    <div className="st-process-guide-actions">
                      {guide.map((step, i) => (
                        <button
                          key={step.id}
                          type="button"
                          data-step={step.id}
                          aria-pressed={step.id === guideStep.id}
                          onClick={() => revisitGuide(step)}
                        >
                          <span>{i + 1}</span>
                          {l(step.title)}
                        </button>
                      ))}
                    </div>
                    <small>{l(guideReplay)}</small>
                  </>
                )}
              </section>
            )}
            {inside && (
              <div className="st-principle-guide">
                <div className="st-color-key" aria-label={et("layers")}>
                  {entry.legend.map((item, i) => (
                    <span key={i}>
                      <i style={{ background: item.color }} />
                      {l(item.text)}
                    </span>
                  ))}
                </div>
                <p>{l(entry.caution)}</p>
                <small>{et("innerNote")}</small>
              </div>
            )}
            {returnReview && (
              <button
                className="st-return-review"
                onClick={() => {
                  if (coachReturn.current) {
                    coachReturn.current();
                    coachReturn.current = null;
                  } else {
                    reviewHeading.current?.scrollIntoView({
                      block: "start",
                      behavior: "auto",
                    });
                    reviewHeading.current?.focus({ preventScroll: true });
                  }
                  setReturnReview(false);
                }}
              >
                <ArrowLeft size={14} />
                {t("reviewReturn")}
              </button>
            )}
          </section>
          <aside
            className="st-mission"
            aria-label={t("nextAction")}
            data-interior-ready={String(inside)}
          >
            {!inside ? (
              <div className="st-entry-mission">
                <span className="st-eyebrow">{et("heading")}</span>
                <h3>{l(entry.kind)}</h3>
                <p>{l(entry.shape)}</p>
                <div className="st-desktop-action">{entryAction}</div>
                <div className="st-entry-focus">
                  <BookOpen size={18} />
                  <div>
                    <b>{t("objective")}</b>
                    <p>{l(entry.focus)}</p>
                  </div>
                </div>
                <small>{et("hint")}</small>
                <ol>
                  <li>{et("exterior")}</li>
                  <li>{et("inner")}</li>
                  <li>{t("stepObserve")}</li>
                  <li>
                    {t("stepDecide")} · {t("stepReview")}
                  </li>
                </ol>
                <p className="st-entry-note">
                  {et("note")} {et("reveal")}
                </p>
                <span className="st-entry-status" role="status">
                  {entered[state.active] && !entryReady
                    ? et("opening")
                    : et("sequence")}
                </span>
              </div>
            ) : (
              <>
                <div className="st-mission-top">
                  <span className="st-eyebrow">
                    {t(
                      (
                        [
                          "stepPrepare",
                          "stepReact",
                          "stepObserve",
                          "stepDecide",
                          "stepReview",
                        ] as const
                      )[stageIndex]
                    )}
                  </span>
                  <PhaseIcon size={20} />
                </div>
                {a.phase === "prepare" && (
                  <>
                    <h3>{t("setup", { n: a.setup + 1 })}</h3>
                    <p>{l(content.steps[Math.min(2, a.setup)])}</p>
                    {a.setup === 0 && (
                      <p className="st-load-hint">
                        {t(
                          state.active === "oxidation"
                            ? "dragUp"
                            : state.active === "packaging"
                              ? "dragDown"
                              : "dragRight"
                        )}
                      </p>
                    )}
                    <div className="st-desktop-action">{phaseAction}</div>
                    {a.setup > 0 && parameter}
                    <p className="st-small">{t("parameter")}</p>
                    <div className="st-part-buttons">
                      {content.parts.map(p => (
                        <button
                          key={p.id}
                          aria-pressed={selected === p.id}
                          onClick={() => onPart(p.id)}
                        >
                          {l(p.name)}
                          <ChevronRight size={12} />
                        </button>
                      ))}
                    </div>
                    {part && (
                      <div className="st-part-description">
                        <strong>{l(part.name)}</strong>
                        <p>{l(part.description)}</p>
                      </div>
                    )}
                  </>
                )}
                {a.phase === "react" && (
                  <>
                    <h3>{l(content.reaction)}</h3>
                    <p>{t("holdHelp")}</p>
                    <div className="st-desktop-action">{phaseAction}</div>
                    {state.active !== "photo" && parameter}
                    <div className="st-principle-note">
                      <BookOpen size={18} />
                      <p>{l(content.lesson)}</p>
                    </div>
                    <small>{t("notRecipe")}</small>
                  </>
                )}
                {a.phase === "observe" && (
                  <>
                    <h3>{t("record")}</h3>
                    <p>{l(content.observe)}</p>
                    <div className="st-desktop-action">{phaseAction}</div>
                    <div className="st-observation-progress">
                      <i
                        style={{
                          width: `${(a.elapsed / scenario.duration) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="st-record-meta">
                      <span>
                        {t("recordProgress", {
                          n: Math.floor(a.elapsed),
                          duration: scenario.duration,
                        })}
                      </span>
                      <small>
                        {t(
                          state.active === "eds" ? "regionTime" : "virtualTime"
                        )}
                      </small>
                    </div>
                    {state.active === "oxidation" || state.active === "etch" ? (
                      <div className="st-reference-picker">
                        <span>{t("referenceChoice")}</span>
                        <div>
                          {(["A", "B"] as const).map(group => (
                            <button
                              key={group}
                              aria-pressed={a.reference === group}
                              disabled={group === "B" && !reading.availableB}
                              onClick={() =>
                                dispatch({ type: "reference", value: group })
                              }
                            >
                              {t("referenceGroup", { group })}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="st-reference-static">
                        <Check size={14} />
                        {t("currentReference")}
                      </div>
                    )}
                    <button
                      className="st-pin-action"
                      disabled={!reading.canPin}
                      onClick={() => dispatch({ type: "pin" })}
                    >
                      <Plus size={16} />
                      {t("pin")}
                      <span>{a.pins.length}/4</span>
                    </button>
                    <small>{t("pinHelp")}</small>
                    {reading.canDecide && (
                      <button
                        className="st-primary st-decide-action"
                        onClick={() => dispatch({ type: "decide" })}
                      >
                        {t("judge")}
                        <ArrowRight size={15} />
                      </button>
                    )}
                  </>
                )}
                {a.phase === "decide" && (
                  <>
                    <h3>{t("judge")}</h3>
                    <div className="st-question-progress">
                      {[0, 1, 2].map(i => (
                        <i
                          key={i}
                          className={i <= question ? "is-active" : ""}
                        />
                      ))}
                    </div>
                    {question === 0 ? (
                      <fieldset>
                        <legend>{t("qSignal")}</legend>
                        {[
                          ...(state.active === "etch"
                            ? []
                            : [
                                {
                                  id: "none",
                                  name: [
                                    t("none"),
                                    t("none"),
                                    t("none"),
                                  ] as const,
                                },
                              ]),
                          ...scenario.signals,
                        ].map(s => (
                          <label key={s.id}>
                            <input
                              type="radio"
                              name="signal"
                              checked={a.answer.signal === s.id}
                              onChange={() =>
                                dispatch({
                                  type: "answer",
                                  field: "signal",
                                  value: s.id,
                                })
                              }
                            />
                            {l(s.name)}
                          </label>
                        ))}
                        {a.answer.signal && a.answer.signal !== "none" && (
                          <label className="st-onset">
                            {t("qOnset")}
                            <input
                              type="number"
                              min="0"
                              max={scenario.duration}
                              value={a.answer.onset}
                              onChange={e =>
                                dispatch({
                                  type: "answer",
                                  field: "onset",
                                  value: e.target.value,
                                })
                              }
                            />
                          </label>
                        )}
                      </fieldset>
                    ) : question === 1 ? (
                      <>
                        <fieldset>
                          <legend>{t("qCompare")}</legend>
                          {[
                            [
                              state.active === "etch"
                                ? "same-phase"
                                : "same-condition",
                              t(state.active === "etch" ? "samePhase" : "same"),
                            ],
                            ["whole-run", t("whole")],
                          ].map(([value, label]) => (
                            <label key={value}>
                              <input
                                type="radio"
                                name="comparison"
                                checked={a.answer.comparison === value}
                                onChange={() =>
                                  dispatch({
                                    type: "answer",
                                    field: "comparison",
                                    value,
                                  })
                                }
                              />
                              {label}
                            </label>
                          ))}
                        </fieldset>
                        <fieldset>
                          <legend>{t("qCertainty")}</legend>
                          {(["uncertain", "certain"] as const).map(value => (
                            <label key={value}>
                              <input
                                type="radio"
                                name="certainty"
                                checked={a.answer.certainty === value}
                                onChange={() =>
                                  dispatch({
                                    type: "answer",
                                    field: "certainty",
                                    value,
                                  })
                                }
                              />
                              {t(value)}
                            </label>
                          ))}
                        </fieldset>
                      </>
                    ) : (
                      <div className="st-notes">
                        {(["facts", "checks"] as const).map(field => (
                          <label key={field}>
                            {t(field)}
                            <textarea
                              maxLength={1200}
                              value={a.answer[field]}
                              placeholder={t(
                                field === "facts" ? "factsHint" : "checksHint"
                              )}
                              onChange={e =>
                                dispatch({
                                  type: "answer",
                                  field,
                                  value: e.target.value,
                                })
                              }
                            />
                            <small>
                              {t("minText", {
                                n: a.answer[field].trim().length,
                              })}
                            </small>
                          </label>
                        ))}
                        <small>{t("privateNotes")}</small>
                      </div>
                    )}
                    <div className="st-question-actions">
                      <button
                        className="st-secondary"
                        onClick={() =>
                          question > 0
                            ? setQuestion(q => q - 1)
                            : dispatch({ type: "observe" })
                        }
                      >
                        <ArrowLeft size={14} />
                        {t(question > 0 ? "previous" : "stepObserve")}
                      </button>
                      {question < 2 ? (
                        <button
                          className="st-primary"
                          disabled={
                            question === 0
                              ? !a.answer.signal ||
                                (a.answer.signal !== "none" && !a.answer.onset)
                              : !a.answer.comparison || !a.answer.certainty
                          }
                          aria-label={t("next")}
                          onClick={() => setQuestion(q => q + 1)}
                        >
                          <ArrowRight size={16} />
                        </button>
                      ) : (
                        <button
                          className="st-primary"
                          disabled={!reading.canSubmit}
                          onClick={() =>
                            dispatch({
                              type: "submit",
                              saveKey: crypto.randomUUID(),
                            })
                          }
                        >
                          {t("submit")}
                          <Check size={15} />
                        </button>
                      )}
                    </div>
                  </>
                )}
                {a.phase === "review" && review && (
                  <>
                    <h3>{t("ownJudgment")}</h3>
                    <div className="st-own-choice">
                      {a.answer.signal === "none"
                        ? t("none")
                        : l(
                            scenario.signals.find(
                              s => s.id === a.answer.signal
                            )!.name
                          )}
                    </div>
                    <p>{l(content.review)}</p>
                    <div className="st-criteria-mini">
                      {(
                        [
                          ["signalMatched", "criterionSignal"],
                          ["onsetMatched", "criterionOnset"],
                          ["comparisonMatched", "criterionReference"],
                          ["certaintyMatched", "criterionUncertainty"],
                        ] as const
                      ).map(([key, label]) => (
                        <div key={key}>
                          <span>
                            {review.criteria[key] ? (
                              <Check size={14} />
                            ) : (
                              <Focus size={14} />
                            )}
                          </span>
                          <b>{t(label)}</b>
                          <small>
                            {t(review.criteria[key] ? "matched" : "revisit")}
                          </small>
                        </div>
                      ))}
                    </div>
                    <button
                      className="st-secondary"
                      onClick={() =>
                        reviewHeading.current?.scrollIntoView({
                          block: "start",
                          behavior: "auto",
                        })
                      }
                    >
                      {t("stepReview")}
                      <ArrowRight size={14} />
                    </button>
                  </>
                )}
                <div className="st-mission-footer">
                  <small>{t("modelNote")}</small>
                  <button
                    type="button"
                    aria-label={t("reset")}
                    disabled={saveStatus === "saving"}
                    onClick={restartAttempt}
                  >
                    <RotateCcw size={15} />
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
        {stageIndex >= 2 && (
          <section className="st-evidence">
            <div className="st-inspection-dock">
              <InspectionOverlay
                process={state.active}
                language={language}
                current={reading.current}
                reference={reading.reference}
              />
              <div>
                <h3>{t("record")}</h3>
                <p>{l(content.observe)}</p>
                <small>{t("indexNote")}</small>
                {a.phase === "observe" && (
                  <div className="st-inspection-controls">
                    {phaseAction}
                    <button
                      type="button"
                      className="st-secondary"
                      disabled={saveStatus === "saving"}
                      onClick={restartAttempt}
                    >
                      <RotateCcw size={15} aria-hidden="true" />
                      {t("newAttempt")}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="st-evidence-heading">
              <h3>{t("pins")}</h3>
              <span>{t("pinCount", { n: a.pins.length })}</span>
            </div>
            <div className="st-live-readings" aria-label={t("record")}>
              <header>
                <b>
                  {reading.group === "current"
                    ? t("record")
                    : t(state.active === "etch" ? "phase" : "group", {
                        group: reading.group,
                      })}
                </b>
                <span>{t("time", { n: reading.current.time })}</span>
              </header>
              <div>
                {reading.current.channels.map(channel => {
                  const ref = reading.reference.channels.find(
                    c => c.id === channel.id
                  )!;
                  return (
                    <article key={channel.id}>
                      <span>{l(channel.name)}</span>
                      <strong>{channel.value.toFixed(1)}</strong>
                      <small>
                        {t("reference")} {ref.reference.toFixed(1)}
                      </small>
                      <small>
                        {t("band")} {ref.low.toFixed(1)}–{ref.high.toFixed(1)}
                      </small>
                    </article>
                  );
                })}
              </div>
              <small>{t("indexNote")}</small>
            </div>
            <div className="st-timeline">
              <div>
                <span>0</span>
                <span>{t("time", { n: scenario.duration })}</span>
              </div>
              <div className="st-track">
                <i
                  style={{ width: `${(a.elapsed / scenario.duration) * 100}%` }}
                />
                {a.pins.map(p => (
                  <button
                    key={p.id}
                    style={{ left: `${(p.time / scenario.duration) * 100}%` }}
                    aria-label={t("backTime", { n: p.time })}
                    onClick={() => showPin(p)}
                  >
                    ◆
                  </button>
                ))}
                <input
                  aria-label={t("timeline")}
                  type="range"
                  min="0"
                  max={Math.max(1, Math.floor(a.elapsed))}
                  value={Math.floor(a.viewTime)}
                  style={{
                    width: `${Math.max(1, (a.elapsed / scenario.duration) * 100)}%`,
                  }}
                  onChange={e => {
                    setGuidePreview(null);
                    dispatch({ type: "seek", time: Number(e.target.value) });
                    setFocus("inspection");
                  }}
                />
              </div>
              <small>{t("rewind")}</small>
            </div>
            <div className="st-evidence-cards">
              {a.pins.length === 0 ? (
                <p className="st-empty-evidence">{t("emptyPins")}</p>
              ) : (
                a.pins.map((p, i) => (
                  <article key={p.id}>
                    <button onClick={() => showPin(p)}>
                      <span>0{i + 1}</span>
                      <div>
                        <b>{t("time", { n: p.time })}</b>
                        <small>
                          {p.reference === "current"
                            ? t("currentReference")
                            : `${t(state.active === "etch" ? "phase" : "group", { group: p.group })} / ${t("referenceGroup", { group: p.reference })}`}
                        </small>
                        {p.channels.map(c => (
                          <p key={c.id}>
                            {l(scenario.signals.find(s => s.id === c.id)!.name)}{" "}
                            <strong>{c.value.toFixed(1)}</strong>
                            <em>
                              {t("reference")} {c.reference.toFixed(1)}
                            </em>
                          </p>
                        ))}
                      </div>
                      <ArrowRight size={14} />
                    </button>
                    {a.phase === "observe" && (
                      <button
                        className="st-remove-pin"
                        aria-label={t("remove")}
                        onClick={() => dispatch({ type: "remove", id: p.id })}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </article>
                ))
              )}
            </div>
          </section>
        )}
        {review && (
          <section className="st-review">
            <div className="st-section-heading">
              <span className="st-eyebrow">{t("stepReview")}</span>
              <h2 ref={reviewHeading} tabIndex={-1}>
                {t("criteria")}
              </h2>
              <p>{t("criteriaNote")}</p>
            </div>
            <div className="st-account-save" role="status">
              {saveStatus === "saving" ? (
                copy(
                  "선택형 결과를 저장하는 중…",
                  "Saving your choice-based result…",
                  "選択結果を保存しています…"
                )
              ) : saveStatus === "saved" ? (
                copy(
                  "선택형 결과를 내 학습 기록에 저장했어요.",
                  "Your choice-based result is in My practice history.",
                  "選択結果を練習記録に保存しました。"
                )
              ) : canonicalAttempt ? (
                <>
                  {saveStatus === "failed"
                    ? copy(
                        "저장에 실패했어요. 이 탭에서 다시 시도할 수 있어요.",
                        "Saving failed. You can retry in this tab.",
                        "保存できませんでした。このタブで再試行できます。"
                      )
                    : copy(
                        "계정 저장 여부를 확인하지 못했어요.",
                        "Account save is unconfirmed.",
                        "アカウントへの保存を確認できていません。"
                      )}{" "}
                  <button className="st-secondary" onClick={retrySave}>
                    {saveStatus === "failed"
                      ? copy("저장 다시 시도", "Retry saving", "保存を再試行")
                      : copy(
                          "계정에 저장",
                          "Save to account",
                          "アカウントに保存"
                        )}
                  </button>
                </>
              ) : null}
            </div>
            <div className="st-review-columns">
              <div>
                <h3>{t("timelineReview")}</h3>
                <div className="st-event-list">
                  {review.events.map((e, i) => (
                    <button
                      key={`${e.time}:${i}`}
                      onClick={() => showTime(e.time)}
                    >
                      <time>{t("time", { n: e.time })}</time>
                      <span>{l(e.label)}</span>
                      <ArrowRight size={14} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="st-original-notes">
                <span>{t("facts")}</span>
                <p>{a.answer.facts}</p>
                <span>{t("checks")}</span>
                <p>{a.answer.checks}</p>
                <small>{t("privateNotes")}</small>
              </div>
            </div>
            <div className="st-section-heading">
              <h2>{t("equipment")}</h2>
              <p>{t("equipmentNote")}</p>
            </div>
            <div className="st-equipment-grid">
              {content.equipment.map((e, i) => (
                <article key={`${e.name}:${i}`}>
                  <span>0{i + 1}</span>
                  <h3>{e.name}</h3>
                  <p>{l(e.role)}</p>
                  <a href={e.url} target="_blank" rel="noreferrer">
                    {t("source")}
                    <ArrowUpRight size={14} />
                  </a>
                  <div>
                    <strong>{t("followup")}</strong>
                    <p>{l(e.question)}</p>
                  </div>
                </article>
              ))}
            </div>
            <section className="st-ai-coach">
              {canonicalAttempt &&
                ("scenarioId" in canonicalAttempt ? (
                  <ScenarioJudgmentCoach
                    key={state.active + ":" + a.saveKey + ":" + language}
                    processAttempt={canonicalAttempt}
                    scenario={scenario}
                    language={language}
                    userId={userId}
                    onReviewPoint={reviewCoachPoint}
                  />
                ) : (
                  <ScenarioJudgmentCoach
                    key={state.active + ":" + a.saveKey + ":" + language}
                    attempt={canonicalAttempt}
                    language={language}
                    userId={userId}
                    onReviewPoint={reviewCoachPoint}
                  />
                ))}
            </section>
            <div className="st-review-restart">
              <button
                type="button"
                className="st-primary"
                disabled={saveStatus === "saving"}
                onClick={restartAttempt}
              >
                <RotateCcw size={15} aria-hidden="true" />
                {t("newAttempt")}
              </button>
            </div>
          </section>
        )}
        <TrainingCheckpoint
          key={scenario.id}
          userId={userId}
          language={language}
          scenarioId={scenario.id}
          capture={() => captureStudioCheckpoint(a)}
          restore={draft => {
            const attempt = restoreStudioCheckpoint(state.active, draft);
            dispatch({ type: "restore", attempt });
            setEntered(previous => ({
              ...previous,
              [state.active]: attempt.phase !== "prepare",
            }));
            setReady(false);
            setEntryReady(false);
            setStageKey(key => key + 1);
          }}
          resumeOnly={a.submitted}
          disabled={saveStatus === "saving"}
        />
        <footer className="st-footer">
          <p>{t("footer")}</p>
          <div className="st-footer-actions">
            <Link href="/training">
              {copy("연습 선택", "Practice selection", "練習を選ぶ")}
            </Link>
            <Link href={"/training/classic/" + state.active}>
              {copy(
                "기존 연습 화면",
                "Classic practice screen",
                "従来の練習画面"
              )}
            </Link>
            <Link href="/training/history">
              {copy(
                "내 학습 기록·복기",
                "My practice history",
                "練習記録と振り返り"
              )}
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
