import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Link2,
  Play,
  RotateCcw,
  Unplug,
  Usb,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AccountLogout from "../components/AccountSession";
import KiyoEquipmentView from "../components/KiyoEquipmentView";
import BoothCameraOverlay from "../components/BoothCameraOverlay";
import BoothMissionFeedback, {
  BoothNormalGuide,
} from "../components/BoothMissionFeedback";
import BoothReflection from "../components/BoothReflection";
import { BoothLearningAssistant } from "../components/LearningAssistant";
import ProductLanguageSelect from "../components/ProductLanguageSelect";
import { useBoothDevice } from "../hooks/useBoothDevice";
import {
  applyBoothAction,
  BOOTH_CONTROL_LIMITS,
  BOOTH_SCENARIOS,
  BOOTH_SIGNALS,
  createBoothState,
  getBoothSnapshot,
  stepBoothState,
  type BoothAction,
  type BoothControlKey,
  type BoothEvent,
  type BoothMode,
  type BoothScenarioId,
  type BoothSnapshot,
  type SignalKey,
} from "@shared/boothExperience";
import {
  captureBoothAttempt,
  loadBoothReflections,
  type BoothAttempt,
  type BoothAttemptSample,
  type BoothOutcome,
} from "@shared/boothReflection";
import { tr, useProductLanguage } from "../lib/productLanguage";
import "./prototype-dashboard.css";

type Stage = "brief" | "experience" | "review";
const CONTROLS: BoothControlKey[] = [
  "gasSetpoint",
  "exhaustValve",
  "matching",
  "rfSetpoint",
];
const CONTROL_LABELS: Record<BoothControlKey, [string, string, string]> = {
  matching: ["RF 매칭", "RF matching", "RFマッチング"],
  rfSetpoint: ["RF 설정", "RF setpoint", "RF設定"],
  gasSetpoint: ["가스 공급 설정", "Gas supply setting", "ガス供給設定"],
  exhaustValve: ["배기 밸브", "Exhaust valve", "排気バルブ"],
};
const CONTROL_HELP: Record<BoothControlKey, [string, string, string]> = {
  gasSetpoint: [
    "공급량을 바꾸고 유량·압력을 비교해요.",
    "Compare flow and pressure as supply changes.",
    "供給量を変え、流量と圧力を比較します。",
  ],
  exhaustValve: [
    "더 열면 배기가 늘고 압력이 내려가요.",
    "Opening increases exhaust and lowers pressure.",
    "開くと排気が増え、圧力が下がります。",
  ],
  matching: [
    "조금씩 조절하며 RF 흔들림이 줄어드는 쪽을 찾아요.",
    "Adjust gradually to reduce RF fluctuations.",
    "少しずつ調整し、RFの揺れが減る方向を探します。",
  ],
  rfSetpoint: [
    "RF 목표를 바꿔 다른 값과 빛의 반응을 확인해요.",
    "Compare light and other values as RF demand changes.",
    "RF目標を変え、光と他の値の反応を確認します。",
  ],
};
const SIGNAL_LABELS: Record<SignalKey, [string, string, string]> = {
  pressure: ["챔버 압력", "Chamber pressure", "チャンバー圧力"],
  gasFlow: ["가스 유량", "Gas flow", "ガス流量"],
  rfPower: ["RF 전력", "RF power", "RF電力"],
  chamberAmbientTemp: ["주변 온도", "Ambient temperature", "周囲温度"],
};
const SCENARIO_NAMES: Record<BoothScenarioId, [string, string, string]> = {
  combined: ["복합 공정 이상", "Combined process fault", "複合プロセス異常"],
  "gas-delivery": [
    "가스·압력 불균형",
    "Gas / pressure imbalance",
    "ガス・圧力の不均衡",
  ],
  "exhaust-restriction": ["압력 상승", "Rising pressure", "圧力上昇"],
  "rf-matching": ["RF 출력 불안정", "Unstable RF output", "RF出力の不安定"],
};
const SCENARIO_BRIEFS: Record<BoothScenarioId, [string, string, string]> = {
  combined: [
    "유량·압력·RF가 함께 흔들려요. 공급과 배기의 균형을 찾은 뒤 매칭을 안정화하세요.",
    "Flow, pressure and RF are disturbed. Balance gas supply and exhaust, then stabilize matching.",
    "流量・圧力・RFが乱れています。供給と排気のバランスを取り、マッチングを安定させます。",
  ],
  "gas-delivery": [
    "공급 명령보다 유량이 작고 압력도 낮아요. 가스 공급과 배기를 함께 비교하세요.",
    "Delivered flow and pressure are low. Compare gas supply with exhaust.",
    "設定より流量が少なく、圧力も低い状態です。ガス供給と排気を比較します。",
  ],
  "exhaust-restriction": [
    "가스 유량은 정상인데 압력이 올라가요. 배기 경로를 중심으로 관찰하세요.",
    "Flow is normal but pressure rises. Observe the exhaust response.",
    "流量は正常ですが圧力が上昇します。排気の反応を観察します。",
  ],
  "rf-matching": [
    "유량·압력은 유지되는데 빛과 RF가 흔들려요. 매칭을 조금씩 조절해보세요.",
    "Flow and pressure hold while RF and light fluctuate. Adjust matching gradually.",
    "流量・圧力は維持されていますが、RFと光が揺れます。少しずつマッチングを調整します。",
  ],
};
const SIGNAL_COLORS: Record<SignalKey, string> = {
  pressure: "#9cc8eb",
  gasFlow: "#a8d0a5",
  rfPower: "#c6a1ed",
  chamberAmbientTemp: "#e8bf7e",
};
const PLOT_DOMAINS: Record<SignalKey, [number, number]> = {
  pressure: [0, 70],
  gasFlow: [65, 135],
  rfPower: [0, 800],
  chamberAmbientTemp: [25, 45],
};
const clock = (seconds: number) =>
  Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0") +
  ":" +
  Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
const valueText = (key: SignalKey, value: number) =>
  value.toFixed(key === "rfPower" ? 0 : 1);
function initialEngine(
  scenario: BoothScenarioId = "combined",
  mode: BoothMode = "mission"
) {
  const seed = globalThis.crypto?.getRandomValues
    ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0]
    : (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  return applyBoothAction(
    applyBoothAction(createBoothState(seed), {
      type: "set-scenario",
      scenario,
    }),
    { type: "set-mode", mode }
  );
}
const terminal = (snapshot: BoothSnapshot) =>
  snapshot.mode === "mission" &&
  (snapshot.mission.status === "won" || snapshot.mission.status === "failed");

/** One dashboard follows a run from briefing through an immutable observation record. */
export default function EtchLive() {
  const [language, setLanguage] = useProductLanguage();
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const device = useBoothDevice();
  const [engine, setEngine] = useState(() => initialEngine());
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const liveSnapshot = useMemo(() => getBoothSnapshot(engine), [engine]);
  const [stage, setStage] = useState<Stage>("brief");
  const [completedAttempt, setCompletedAttempt] = useState<BoothAttempt | null>(
    null
  );
  const displaySnapshot =
    stage === "review" && completedAttempt
      ? completedAttempt.finalSnapshot
      : liveSnapshot;
  const [equipmentView, setEquipmentView] = useState<
    "exterior" | "cutaway" | "camera"
  >("exterior");
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === "undefined" || !document.hidden
  );
  const [points, setPoints] = useState<BoothAttemptSample[]>([]);
  const [notice, setNotice] = useState("");
  const [selectedSignal, setSelectedSignal] = useState<SignalKey>("pressure");
  const runningRef = useRef(false);
  const latestSnapshotRef = useRef(liveSnapshot);
  latestSnapshotRef.current = liveSnapshot;
  const samplesRef = useRef<BoothAttemptSample[]>([]);
  const runIdRef = useRef("");
  const runStartMsRef = useRef(0);
  const eventFloorRef = useRef(0);
  const capturedIdRef = useRef<string | null>(null);
  const lastSampleRef = useRef(-500);
  const leaveGuardRef = useRef<(() => boolean) | null>(null);
  const registerLeaveGuard = useCallback((guard: (() => boolean) | null) => {
    leaveGuardRef.current = guard;
  }, []);
  const focusReview = useCallback(() => {
    window.requestAnimationFrame(() => {
      const panel = document.getElementById("booth-reflection");
      panel?.focus({ preventScroll: true });
      panel?.scrollIntoView({ block: "start", behavior: "auto" });
    });
  }, []);

  const captureCompletedRun = useCallback(
    (snapshot: BoothSnapshot, outcome: BoothOutcome) => {
      const id = runIdRef.current;
      if (!id || capturedIdRef.current === id) return;
      runningRef.current = false;
      const finalPoint = {
        elapsed: snapshot.elapsedMs / 1000,
        ...snapshot.values,
      };
      const samples = [...samplesRef.current];
      if (samples.at(-1)?.elapsed === finalPoint.elapsed)
        samples[samples.length - 1] = finalPoint;
      else samples.push(finalPoint);
      const attempt = captureBoothAttempt({
        id,
        scenarioId: snapshot.selectedScenario,
        scenarioTitle: snapshot.scenario.title,
        outcome,
        snapshot,
        samples: samples.slice(-360),
        startedAtMs: runStartMsRef.current,
        afterEventId: eventFloorRef.current,
        durationMs: Math.max(0, snapshot.elapsedMs - runStartMsRef.current),
        completedAt: new Date().toISOString(),
      });
      capturedIdRef.current = id;
      samplesRef.current = samples;
      setCompletedAttempt(attempt);
      setStage("review");
      setNotice("");
    },
    []
  );

  // Physics pauses outside a run and immediately at a terminal mission state.
  useEffect(() => {
    let previousTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = now - previousTick;
      previousTick = now;
      if (document.hidden || !runningRef.current) return;
      setEngine(previous =>
        terminal(getBoothSnapshot(previous))
          ? previous
          : stepBoothState(previous, dt)
      );
    }, 100);
    const visibility = () => {
      previousTick = performance.now();
      setPageVisible(!document.hidden);
      if (document.hidden)
        setEquipmentView(view => (view === "camera" ? "cutaway" : view));
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  // USB keepalive is independent of simulation ticks; review always sends an off state.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const latest = latestSnapshotRef.current;
      device.sendState(
        runningRef.current && !terminal(latest)
          ? {
              lampBrightness: latest.lampBrightness,
              faultActive: latest.faultActive,
            }
          : { lampBrightness: 0, faultActive: false }
      );
    }, 100);
    return () => window.clearInterval(timer);
  }, [device.sendState]);

  useEffect(() => {
    if (
      !runningRef.current ||
      liveSnapshot.elapsedMs - lastSampleRef.current < 500
    )
      return;
    lastSampleRef.current = liveSnapshot.elapsedMs;
    const next = [
      ...samplesRef.current,
      { elapsed: liveSnapshot.elapsedMs / 1000, ...liveSnapshot.values },
    ].slice(-360);
    samplesRef.current = next;
    setPoints(next);
  }, [liveSnapshot]);

  useEffect(() => {
    if (!runningRef.current || !terminal(liveSnapshot)) return;
    captureCompletedRun(
      liveSnapshot,
      liveSnapshot.mission.status === "won" ? "won" : "failed"
    );
  }, [liveSnapshot, captureCompletedRun]);

  useEffect(() => {
    document.title = l(
      "식각 장비 모형 대시보드 | SemiGuard",
      "Etch model dashboard | SemiGuard",
      "エッチング装置模型 | SemiGuard"
    );
  }, [language]);

  function act(action: BoothAction) {
    if (stage === "review") return;
    const current = getBoothSnapshot(engineRef.current);
    if (stage === "experience" && terminal(current)) {
      captureCompletedRun(
        current,
        current.mission.status === "won" ? "won" : "failed"
      );
      return;
    }
    setNotice("");
    const next = applyBoothAction(engineRef.current, action);
    engineRef.current = next;
    setEngine(next);
  }
  function canLeaveReview() {
    if (stage !== "review" || !leaveGuardRef.current || leaveGuardRef.current())
      return true;
    focusReview();
    return false;
  }
  function prepareNewRun(mode: BoothMode = displaySnapshot.mode) {
    if (!canLeaveReview()) return;
    runningRef.current = false;
    const next = initialEngine(displaySnapshot.selectedScenario, mode);
    engineRef.current = next;
    latestSnapshotRef.current = getBoothSnapshot(next);
    setEngine(next);
    setCompletedAttempt(null);
    setPoints([]);
    samplesRef.current = [];
    runIdRef.current = "";
    capturedIdRef.current = null;
    setStage("brief");
    setNotice("");
  }
  function startExperience() {
    if (runningRef.current || !canLeaveReview()) return;
    const previous = engineRef.current;
    eventFloorRef.current = previous.eventSequence;
    const next = applyBoothAction(previous, {
      type: previous.mode === "mission" ? "start-mission" : "inject-fault",
    });
    const snapshot = getBoothSnapshot(next);
    runIdRef.current =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : "run-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    runStartMsRef.current = snapshot.elapsedMs;
    capturedIdRef.current = null;
    const baseline = [
      { elapsed: snapshot.elapsedMs / 1000, ...snapshot.values },
    ];
    samplesRef.current = baseline;
    setPoints(baseline);
    lastSampleRef.current = snapshot.elapsedMs;
    setCompletedAttempt(null);
    engineRef.current = next;
    latestSnapshotRef.current = snapshot;
    setEngine(next);
    runningRef.current = true;
    setStage("experience");
    setEquipmentView(view => (view === "exterior" ? "cutaway" : view));
    setNotice("");
  }
  function finishExperience() {
    if (!runningRef.current) return;
    const snapshot = getBoothSnapshot(engineRef.current);
    captureCompletedRun(
      snapshot,
      terminal(snapshot)
        ? snapshot.mission.status === "won"
          ? "won"
          : "failed"
        : snapshot.mode === "mission"
          ? "cancelled"
          : "ended"
    );
    focusReview();
  }
  function applyStartingSettings() {
    if (stage !== "experience") return;
    const next = CONTROLS.reduce(
      (state, control) =>
        applyBoothAction(state, {
          type: "set-control",
          control,
          value: BOOTH_CONTROL_LIMITS[control].initial,
        }),
      engineRef.current
    );
    engineRef.current = next;
    setEngine(next);
  }
  function loadPreviousReflection() {
    if (runningRef.current || !canLeaveReview()) return;
    try {
      const result = loadBoothReflections(window.localStorage);
      const previous = result.records[0]?.attempt;
      if (!previous) {
        setNotice(
          result.issue
            ? l(
                "이 브라우저의 기록을 불러오지 못했어요.",
                "Could not read this browser's records.",
                "このブラウザーの記録を読み込めませんでした。"
              )
            : l(
                "이 브라우저에 저장한 복기가 아직 없어요.",
                "No saved reflection in this browser yet.",
                "このブラウザーにはまだ復習記録がありません。"
              )
        );
        return;
      }
      runningRef.current = false;
      setCompletedAttempt(previous);
      setStage("review");
      setNotice(
        l(
          "이 브라우저에 저장한 최근 복기예요.",
          "Latest reflection saved in this browser.",
          "このブラウザーに保存した最新の振り返りです。"
        )
      );
      focusReview();
    } catch {
      setNotice(
        l(
          "브라우저 기록 저장소에 접근하지 못했어요.",
          "Browser record storage is unavailable.",
          "ブラウザーの記録保存領域を利用できません。"
        )
      );
    }
  }
  function eventText(event: BoothEvent) {
    if (language === "ko") return event.message;
    if (event.type === "control" && event.control)
      return l(...CONTROL_LABELS[event.control]) + " " + event.value;
    const copy: Record<BoothEvent["type"], [string, string]> = {
      control: ["Setting changed", "設定変更"],
      fault: ["Fault injected", "異常注入"],
      clear: ["Fault cleared", "異常解除"],
      mission: ["Recovery mission", "復旧ミッション"],
      success: ["Recovery complete", "復旧完了"],
      timeout: ["Time is up", "時間終了"],
      reset: ["Controls reset", "設定初期化"],
      mode: ["Experience mode changed", "体験モード変更"],
    };
    return language === "ja" ? copy[event.type][1] : copy[event.type][0];
  }

  const cameraActive = equipmentView === "camera" && pageVisible;
  const activeView =
    equipmentView === "camera" && !pageVisible ? "cutaway" : equipmentView;
  const modelProcessValues = displaySnapshot.values;
  const missionActive =
    stage === "experience" &&
    liveSnapshot.mode === "mission" &&
    liveSnapshot.mission.status === "active";
  const anyAlarm = Object.values(displaySnapshot.alarms).some(Boolean);
  const devicePending =
    device.status === "connecting" || device.status === "waiting";
  const runElapsed =
    stage === "review" && completedAttempt
      ? completedAttempt.durationMs / 1000
      : stage === "experience"
        ? Math.max(0, liveSnapshot.elapsedMs - runStartMsRef.current) / 1000
        : 0;
  const chartPoints =
    stage === "review" && completedAttempt
      ? completedAttempt.samples
      : points.map(point => ({
          ...point,
          elapsed: Math.max(0, point.elapsed - runStartMsRef.current / 1000),
        }));
  const runEvents =
    stage === "review" && completedAttempt
      ? completedAttempt.events
      : stage === "experience"
        ? liveSnapshot.events
            .filter(event => event.id > eventFloorRef.current)
            .map(event => ({
              ...event,
              atMs: Math.max(0, event.atMs - runStartMsRef.current),
            }))
        : [];
  const statusLabel =
    stage === "brief"
      ? l("브리핑 · 시작 대기", "Briefing · ready", "説明・開始待ち")
      : stage === "review"
        ? completedAttempt?.outcome === "won"
          ? l("복구 완료 · 복기", "Recovered · review", "復旧完了・振り返り")
          : l("체험 종료 · 복기", "Run ended · review", "体験終了・振り返り")
        : anyAlarm
          ? l(
              "이상 관찰 · 조정 필요",
              "Fault detected · adjust",
              "異常観察・調整が必要"
            )
          : l(
              "정상 유지 확인 중",
              "Checking stable operation",
              "正常維持を確認中"
            );
  const frozenLabel = l(
    "종료 시점 기록",
    "End-of-run record",
    "終了時点の記録"
  );

  return (
    <div className="kp-app kp-depth">
      <a className="kp-skip" href="#prototype-main">
        {l("대시보드로 바로가기", "Skip to dashboard", "ダッシュボードへ移動")}
      </a>
      <header className="kp-header">
        <a className="kp-brand" href="/training">
          <b>SG</b>
          <span>
            SemiGuard<small>ENGINEER WORKSPACE</small>
          </span>
        </a>
        <nav aria-label={l("사이트 메뉴", "Site navigation", "サイトメニュー")}>
          <a href="/training">
            {l("엔지니어 훈련", "Engineer training", "エンジニア訓練")}
          </a>
          <a href="/learn">
            {l("8대 공정 학습", "Eight processes", "8大工程の学習")}
          </a>
          <a href="/live" aria-current="page">
            {l("실시간 자유 분석", "Free observation", "自由観察")}
          </a>
          <ProductLanguageSelect language={language} onChange={setLanguage} />
          <AccountLogout language={language} />
        </nav>
      </header>
      <main className="kp-main" id="prototype-main">
        <div className="kp-breadcrumb">
          <a href="/training">WORKSPACE</a>
          <ChevronRight size={12} aria-hidden="true" />
          <span>LIVE OBSERVATION</span>
        </div>
        <div className="kp-titlebar">
          <div>
            <p className="kp-eyebrow">PHYSICAL MODEL / ETCH LAB</p>
            <h1>
              {l(
                "식각 장비 모형 대시보드",
                "Etch model dashboard",
                "エッチング装置模型ダッシュボード"
              )}
            </h1>
            <p className="kp-subtitle">
              {l(
                "변화를 관찰하고, 공정을 조절하고, 나의 판단을 돌아보세요.",
                "Observe changes, adjust the process, and reflect on your decisions.",
                "変化を観察し、プロセスを調整して、自分の判断を振り返りましょう。"
              )}
            </p>
          </div>
          <div
            className={
              "kp-link-status " + (stage === "experience" ? "is-demo" : "")
            }
          >
            <span className="kp-status-dot" />
            <span>{statusLabel}</span>
          </div>
        </div>

        <div className="kp-flow-bar">
          <ol aria-label={l("체험 순서", "Experience steps", "体験の順序")}>
            {(["brief", "experience", "review"] as Stage[]).map(
              (step, index) => (
                <li
                  key={step}
                  aria-current={stage === step ? "step" : undefined}
                  data-active={String(stage === step)}
                >
                  <span>{index + 1}</span>
                  {step === "brief"
                    ? l("상황 브리핑", "Briefing", "状況説明")
                    : step === "experience"
                      ? l("관찰·조절", "Observe / adjust", "観察・調整")
                      : l(
                          "관찰·복기",
                          "Observation / review",
                          "観察・振り返り"
                        )}
                </li>
              )
            )}
          </ol>
          <button
            className="kp-text-button"
            type="button"
            onClick={loadPreviousReflection}
            disabled={stage === "experience"}
          >
            {l(
              "저장한 복기 불러오기",
              "Open saved reflection",
              "保存した振り返り"
            )}
          </button>
        </div>
        <p className="kp-depth-notice" role="status" aria-live="polite">
          {notice}
        </p>
        {stage === "review" && completedAttempt && (
          <div className="kp-ended-banner">
            <div>
              <CheckCircle2 size={20} aria-hidden="true" />
              <p>
                <strong>
                  {completedAttempt.outcome === "won"
                    ? l(
                        "복구 미션을 완료했어요.",
                        "Recovery mission complete.",
                        "復旧ミッション完了。"
                      )
                    : completedAttempt.outcome === "failed"
                      ? l(
                          "제한 시간이 끝났어요.",
                          "Time is up.",
                          "制限時間が終了しました。"
                        )
                      : l(
                          "이번 체험을 마쳤어요.",
                          "This run has ended.",
                          "今回の体験が終了しました。"
                        )}
                </strong>
                <span>
                  {l(
                    "값·그래프·조작 기록은 종료 시점으로 고정했어요. 아래에서 관찰과 복기를 작성하세요.",
                    "Values, graphs and actions are frozen at the end of the run. Write your reflection below.",
                    "値・グラフ・操作記録を終了時点で固定しました。下で観察と振り返りを記入します。"
                  )}
                </span>
              </p>
            </div>
            <button
              type="button"
              className="kp-depth-button"
              onClick={focusReview}
            >
              {l("관찰·복기 작성", "Write reflection", "振り返りを書く")}
            </button>
          </div>
        )}

        <div className="kp-overview-grid">
          <section
            className="kp-equipment-panel"
            aria-labelledby="equipment-heading"
          >
            <div className="kp-section-head">
              <div>
                <p className="kp-eyebrow">EQUIPMENT OVERVIEW</p>
                <h2 id="equipment-heading">
                  {l(
                    "장비 모형 관찰",
                    "Equipment observation",
                    "装置模型の観察"
                  )}
                </h2>
              </div>
              <span className="kp-outline-tag">
                {stage === "review"
                  ? frozenLabel
                  : l("교육용 모형", "Teaching model", "教育用模型")}
              </span>
            </div>
            <div
              className="kp-model-view-controls"
              role="group"
              aria-label={l(
                "장비 모형 보기 방식",
                "Equipment model view",
                "模型の表示方法"
              )}
            >
              <button
                id="model-exterior-view"
                type="button"
                aria-pressed={activeView === "exterior"}
                aria-controls="model-illustration"
                onClick={() => setEquipmentView("exterior")}
              >
                {l("외관 보기", "Exterior", "外観")}
              </button>
              <button
                id="model-interior-view"
                type="button"
                aria-pressed={activeView === "cutaway"}
                aria-controls="model-illustration"
                onClick={() => setEquipmentView("cutaway")}
              >
                {l("내부 보기", "Interior", "内部")}
              </button>
              <button
                id="model-camera-view"
                className="kp-camera-view-button"
                type="button"
                aria-pressed={cameraActive}
                aria-controls="model-illustration"
                onClick={() => {
                  if (pageVisible) setEquipmentView("camera");
                }}
              >
                {l("모듈 카메라", "Module camera", "モジュールカメラ")}
              </button>
            </div>
            <div
              className={
                cameraActive
                  ? "kp-camera-stage"
                  : "kp-equipment-stage kp-integrated-stage"
              }
              id="model-illustration"
              role="region"
              aria-labelledby={
                cameraActive
                  ? "model-camera-view"
                  : activeView === "exterior"
                    ? "model-exterior-view"
                    : "model-interior-view"
              }
            >
              {cameraActive ? (
                <BoothCameraOverlay
                  compact
                  values={displaySnapshot.values}
                  alarms={displaySnapshot.alarms}
                  valuesFrozen={stage === "review"}
                  onClose={() => setEquipmentView("cutaway")}
                />
              ) : (
                <KiyoEquipmentView
                  compact
                  language={language}
                  view={activeView === "cutaway" ? "cutaway" : "exterior"}
                  active={true}
                  ledOn={
                    stage === "experience" && displaySnapshot.lampBrightness > 0
                  }
                  lampBrightness={
                    stage === "experience" ? displaySnapshot.lampBrightness : 0
                  }
                  signalAlarms={displaySnapshot.alarms}
                  processValues={modelProcessValues}
                  selectedSignal={selectedSignal}
                  onSelectSignal={setSelectedSignal}
                />
              )}
            </div>
            <div className="kp-depth-model-caption">
              <span className="kp-outline-tag">
                {stage === "experience"
                  ? l("실시간 체험", "Live exercise", "リアルタイム体験")
                  : stage === "review"
                    ? frozenLabel
                    : l(
                        "시작 전 미리보기",
                        "Pre-run preview",
                        "開始前プレビュー"
                      )}
              </span>
              <p>
                {stage === "review"
                  ? l(
                      "램프는 꺼져 있어요. 카메라를 켜면 실제 영상 위에 종료 당시 값이 표시돼요.",
                      "The lamp is off. Live camera video can remain on with recorded final values.",
                      "ランプは消灯中です。カメラには実際の映像と終了時の記録値を表示します。"
                    )
                  : l(
                      "① 압력 ② 가스 유량 ③ RF 전력 ④ 주변 온도 · 번호와 그래프를 함께 비교하세요.",
                      "① Pressure ② Flow ③ RF ④ Ambient temperature · compare labels and trends.",
                      "①圧力 ②流量 ③RF ④周囲温度・番号とグラフを比較します。"
                    )}
              </p>
            </div>
            <div className="kp-depth-hardware">
              <div>
                <Usb size={16} aria-hidden="true" />
                <span>
                  {device.connected
                    ? l(
                        "모형 USB 연결됨",
                        "Model USB connected",
                        "模型USB接続済み"
                      )
                    : devicePending
                      ? l(
                          "모형 응답 확인 중…",
                          "Waiting for model…",
                          "模型の応答待ち…"
                        )
                      : l(
                          "화면으로 체험 중",
                          "Screen exercise",
                          "画面で体験中"
                        )}
                </span>
              </div>
              {device.connected ? (
                <button
                  type="button"
                  className="kp-text-button"
                  onClick={() => void device.disconnect()}
                >
                  <Unplug size={14} aria-hidden="true" />
                  {l("연결 해제", "Disconnect", "切断")}
                </button>
              ) : (
                <button
                  type="button"
                  className="kp-text-button"
                  onClick={() => void device.connect()}
                  disabled={!device.supported || devicePending}
                >
                  <Link2 size={14} aria-hidden="true" />
                  {l("모형 USB 연결", "Connect model USB", "模型USB接続")}
                </button>
              )}
            </div>
            {device.error && (
              <p className="kp-depth-device-error" role="status">
                {device.error}
              </p>
            )}
            {!device.supported && (
              <p className="kp-depth-device-help">
                {l(
                  "USB 모형 연결은 데스크톱 Chrome·Edge에서 지원해요. 화면 체험은 그대로 사용할 수 있어요.",
                  "Use desktop Chrome or Edge for USB hardware. The screen exercise is available here.",
                  "USB模型の接続はPC版Chrome・Edgeを使用します。画面での体験は利用できます。"
                )}
              </p>
            )}
          </section>

          <section
            className="kp-connection-panel kp-exercise-panel"
            aria-labelledby="scenario-heading"
          >
            <div className="kp-section-head">
              <div>
                <p className="kp-eyebrow">PROCESS CHALLENGE</p>
                <h2 id="scenario-heading">
                  {stage === "review"
                    ? l("체험 결과", "Run result", "体験結果")
                    : l("공정 복구 미션", "Process recovery", "プロセス復旧")}
                </h2>
              </div>
              <span className="kp-timing">{clock(runElapsed)}</span>
            </div>
            <label className="kp-scenario-label" htmlFor="booth-scenario">
              {l("상황 선택", "Choose a scenario", "状況を選択")}
            </label>
            <select
              id="booth-scenario"
              className="kp-scenario-select"
              value={displaySnapshot.selectedScenario}
              disabled={stage !== "brief"}
              onChange={event =>
                act({
                  type: "set-scenario",
                  scenario: event.target.value as BoothScenarioId,
                })
              }
            >
              {[...BOOTH_SCENARIOS]
                .sort((a, b) =>
                  a.id === "combined" ? -1 : b.id === "combined" ? 1 : 0
                )
                .map(scenario => (
                  <option key={scenario.id} value={scenario.id}>
                    {l(...SCENARIO_NAMES[scenario.id])}
                  </option>
                ))}
            </select>
            <p className="kp-scenario-brief">
              {l(...SCENARIO_BRIEFS[displaySnapshot.selectedScenario])}
            </p>
            <div
              className="kp-run-modes"
              role="group"
              aria-label={l("체험 방식", "Exercise mode", "体験モード")}
            >
              <button
                type="button"
                disabled={stage !== "brief"}
                aria-pressed={displaySnapshot.mode === "mission"}
                onClick={() => act({ type: "set-mode", mode: "mission" })}
              >
                {l("복구 미션", "Recovery mission", "復旧ミッション")}
              </button>
              <button
                type="button"
                disabled={stage !== "brief"}
                aria-pressed={displaySnapshot.mode === "free"}
                onClick={() => act({ type: "set-mode", mode: "free" })}
              >
                {l("자유 실험", "Free experiment", "自由実験")}
              </button>
            </div>
            {stage === "brief" ? (
              <div className="kp-start-brief">
                <p>
                  {displaySnapshot.mode === "mission"
                    ? l(
                        Math.round(displaySnapshot.scenario.durationMs / 1000) +
                          "초 안에 네 값을 정상으로 맞추고 5초 유지하세요.",
                        "Restore all four values within " +
                          Math.round(
                            displaySnapshot.scenario.durationMs / 1000
                          ) +
                          " seconds and hold for 5 seconds.",
                        Math.round(displaySnapshot.scenario.durationMs / 1000) +
                          "秒以内に4項目を正常に戻し、5秒維持します。"
                      )
                    : l(
                        "시간 제한 없이 설정을 바꾸고, 변화가 생긴 순서를 관찰하세요.",
                        "Explore without a timer and observe the order of changes.",
                        "時間制限なしで設定を変え、変化の順序を観察します。"
                      )}
                </p>
                <button
                  className="kp-depth-button kp-depth-primary"
                  type="button"
                  onClick={startExperience}
                >
                  <Play size={15} aria-hidden="true" />
                  {displaySnapshot.mode === "mission"
                    ? l(
                        "복구 미션 시작",
                        "Start recovery mission",
                        "復旧ミッション開始"
                      )
                    : l(
                        "이상 주입 · 자유 실험 시작",
                        "Inject fault / start experiment",
                        "異常注入・自由実験開始"
                      )}
                </button>
              </div>
            ) : stage === "review" ? (
              <div className="kp-review-result">
                <strong>
                  {l(...SCENARIO_NAMES[displaySnapshot.selectedScenario])}
                </strong>
                <span>
                  {completedAttempt?.score !== null &&
                  completedAttempt?.score !== undefined
                    ? l("결과 ", "Score ", "スコア ") +
                      completedAttempt.score +
                      " / 100"
                    : l(
                        "종료 기록을 아래 복기에 연결했어요.",
                        "Final record linked to the reflection below.",
                        "終了記録を下の振り返りに関連付けました。"
                      )}
                </span>
                <button
                  type="button"
                  className="kp-depth-button"
                  onClick={() => prepareNewRun()}
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  {l("새 상황 준비", "Prepare a new run", "新しい体験を準備")}
                </button>
              </div>
            ) : missionActive ? (
              <div className="kp-mission-progress">
                <div>
                  <strong>
                    {l("남은 시간", "Time remaining", "残り時間")}{" "}
                    {clock(displaySnapshot.mission.remainingMs / 1000)}
                  </strong>
                  <span>
                    {l("정상 유지", "Stable hold", "正常維持")}{" "}
                    {(displaySnapshot.mission.stableMs / 1000).toFixed(1)} /{" "}
                    {displaySnapshot.mission.goalMs / 1000}s
                  </span>
                </div>
                <progress
                  max={displaySnapshot.mission.goalMs}
                  value={displaySnapshot.mission.stableMs}
                  aria-label={l(
                    "정상 유지 진행",
                    "Stable hold progress",
                    "正常維持の進行"
                  )}
                />
              </div>
            ) : null}

            <div
              className="kp-depth-controls"
              aria-label={l("공정 조작", "Process controls", "プロセス操作")}
            >
              {CONTROLS.map(control => {
                const limits = BOOTH_CONTROL_LIMITS[control];
                return (
                  <div className="kp-depth-control" key={control}>
                    <div>
                      <label htmlFor={"control-" + control}>
                        {l(...CONTROL_LABELS[control])}
                      </label>
                      <output htmlFor={"control-" + control}>
                        {displaySnapshot.controls[control]}{" "}
                        <small>{limits.unit}</small>
                      </output>
                    </div>
                    <input
                      id={"control-" + control}
                      type="range"
                      min={limits.min}
                      max={limits.max}
                      step={limits.step}
                      value={displaySnapshot.controls[control]}
                      disabled={stage !== "experience"}
                      aria-describedby={"help-" + control}
                      aria-valuetext={
                        displaySnapshot.controls[control] + " " + limits.unit
                      }
                      onChange={event =>
                        act({
                          type: "set-control",
                          control,
                          value: Number(event.target.value),
                        })
                      }
                    />
                    <p id={"help-" + control}>{l(...CONTROL_HELP[control])}</p>
                  </div>
                );
              })}
            </div>
            <BoothNormalGuide
              compact
              snapshot={displaySnapshot}
              language={language}
              onRecommended={applyStartingSettings}
              disabled={stage !== "experience"}
            />
            <BoothLearningAssistant
              key={`${completedAttempt?.id || runIdRef.current || "brief"}:${displaySnapshot.selectedScenario}:${displaySnapshot.mode}`}
              snapshot={displaySnapshot}
              stage={stage}
            />
            {stage === "experience" && (
              <div className="kp-exercise-actions">
                {displaySnapshot.mode === "free" && (
                  <>
                    <button
                      type="button"
                      className="kp-depth-button"
                      onClick={() => act({ type: "inject-fault" })}
                    >
                      {l("이상 다시 주입", "Reinject fault", "異常を再注入")}
                    </button>
                    <button
                      type="button"
                      className="kp-depth-button"
                      onClick={() => act({ type: "clear-fault" })}
                    >
                      {l("이상 해제", "Clear fault", "異常解除")}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="kp-depth-button"
                  onClick={finishExperience}
                >
                  {l(
                    "체험 마치고 복기",
                    "Finish and reflect",
                    "終了して振り返る"
                  )}
                </button>
              </div>
            )}
            {stage !== "review" && (
              <details className="kp-observation-hint">
                <summary>
                  {l("관찰 힌트", "Observation hints", "観察のヒント")}
                </summary>
                <p>
                  {language === "ko"
                    ? displaySnapshot.scenario.hints.join(" ")
                    : l(
                        "Change one setting at a time. Compare flow and pressure before tuning RF. Temperature responds slowly; watch its trend.",
                        "Change one setting at a time. Compare flow and pressure before tuning RF. Temperature responds slowly; watch its trend.",
                        "設定を1つずつ変えます。RF調整の前に流量と圧力を比較し、温度は遅れて変化する傾向を観察します。"
                      )}
                </p>
              </details>
            )}
          </section>
        </div>

        <section
          className="kp-process-section"
          aria-labelledby="process-heading"
        >
          <div className="kp-section-head">
            <div>
              <p className="kp-eyebrow">PROCESS VALUES</p>
              <h2 id="process-heading">
                {stage === "review"
                  ? frozenLabel
                  : l(
                      "4개 공정값 비교",
                      "Compare four process values",
                      "4つのプロセス値を比較"
                    )}
              </h2>
            </div>
            <span className="kp-outline-tag">
              {l("교육용 모의값", "Simulated values", "教育用模擬値")}
            </span>
          </div>
          <div className="kp-metric-grid">
            {BOOTH_SIGNALS.map(signal => (
              <article
                className={
                  "kp-metric " +
                  (displaySnapshot.alarms[signal.key] ? "is-changed" : "")
                }
                key={signal.key}
                aria-label={
                  l(...SIGNAL_LABELS[signal.key]) +
                  " " +
                  valueText(signal.key, displaySnapshot.values[signal.key]) +
                  " " +
                  signal.unit
                }
              >
                <div className="kp-metric-top">
                  <span>
                    <b
                      className="kp-signal-number"
                      style={{ color: SIGNAL_COLORS[signal.key] }}
                    >
                      {signal.number}
                    </b>
                    {l(...SIGNAL_LABELS[signal.key])}
                  </span>
                  <small>
                    {displaySnapshot.alarms[signal.key]
                      ? l("복구 필요", "RECOVER", "復旧必要")
                      : l("정상", "NORMAL", "正常")}
                  </small>
                </div>
                <p className="kp-metric-value">
                  {valueText(signal.key, displaySnapshot.values[signal.key])}
                  <span>{signal.unit}</span>
                </p>
                <div className="kp-metric-foot">
                  <span>
                    {l("정상", "Normal", "正常")} {signal.normal[0]}–
                    {signal.normal[1]}
                  </span>
                  <span>
                    {l("목표", "Target", "目標")} {signal.target}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="kp-analysis-grid">
          <section
            className="kp-trends-section"
            aria-labelledby="trends-heading"
          >
            <div className="kp-section-head">
              <div>
                <p className="kp-eyebrow">PROCESS TRENDS</p>
                <h2 id="trends-heading">
                  {l(
                    "변화의 순서 관찰",
                    "Observe the sequence of changes",
                    "変化の順序を観察"
                  )}
                </h2>
              </div>
              <span className="kp-timing">
                {stage === "review"
                  ? frozenLabel
                  : l(
                      "시작 후 경과",
                      "Elapsed since start",
                      "開始からの経過"
                    )}{" "}
                · {clock(runElapsed)}
              </span>
            </div>
            <div className="kp-trend-grid">
              {BOOTH_SIGNALS.map(signal => (
                <article className="kp-trend" key={signal.key}>
                  <div className="kp-trend-title">
                    <h3>
                      <span style={{ color: SIGNAL_COLORS[signal.key] }}>
                        {signal.number}
                      </span>{" "}
                      {l(...SIGNAL_LABELS[signal.key])}
                    </h3>
                    <span>{signal.unit}</span>
                  </div>
                  <div
                    className="kp-depth-chart"
                    role="img"
                    aria-label={
                      l(...SIGNAL_LABELS[signal.key]) +
                      " " +
                      l("추이 그래프", "trend graph", "推移グラフ")
                    }
                  >
                    {chartPoints.length > 1 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={[...chartPoints]}
                          margin={{ top: 12, right: 8, bottom: 2, left: -12 }}
                          accessibilityLayer
                        >
                          <CartesianGrid
                            stroke="#344239"
                            strokeDasharray="3 5"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="elapsed"
                            type="number"
                            domain={[0, Math.max(10, Math.ceil(runElapsed))]}
                            tickFormatter={value => clock(Number(value))}
                            tick={{ fontSize: 9, fill: "#a5b4aa" }}
                            minTickGap={35}
                          />
                          <YAxis
                            domain={PLOT_DOMAINS[signal.key]}
                            tick={{ fontSize: 9, fill: "#a5b4aa" }}
                            width={43}
                          />
                          <ReferenceArea
                            y1={signal.normal[0]}
                            y2={signal.normal[1]}
                            fill="#9bc8a5"
                            fillOpacity={0.08}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "#17201c",
                              border: "1px solid #526055",
                              color: "#edf0eb",
                              fontSize: 11,
                            }}
                            labelFormatter={value => clock(Number(value))}
                            formatter={value => [
                              Number(value).toFixed(
                                signal.key === "rfPower" ? 0 : 1
                              ) +
                                " " +
                                signal.unit,
                              l(...SIGNAL_LABELS[signal.key]),
                            ]}
                          />
                          <Line
                            type="monotone"
                            dataKey={signal.key}
                            stroke={SIGNAL_COLORS[signal.key]}
                            strokeWidth={1.7}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="kp-chart-empty">
                        {stage === "brief"
                          ? l(
                              "체험을 시작하면 변화가 기록돼요.",
                              "Trends begin when the exercise starts.",
                              "体験を開始すると変化を記録します。"
                            )
                          : stage === "review"
                            ? l(
                                "짧은 체험으로 추세 자료가 부족해요.",
                                "This short run has too few samples for a trend.",
                                "短い体験のため推移データが不足しています。"
                              )
                            : l(
                                "변화를 기록하고 있어요…",
                                "Recording changes…",
                                "変化を記録しています…"
                              )}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="kp-events-panel" aria-labelledby="events-heading">
            <div className="kp-section-head">
              <div>
                <p className="kp-eyebrow">EVENT TIMELINE</p>
                <h2 id="events-heading">
                  {l(
                    "나의 조작과 공정 반응",
                    "Actions and process response",
                    "操作とプロセスの反応"
                  )}
                </h2>
              </div>
              <span className="kp-outline-tag">{runEvents.length}</span>
            </div>
            <p className="kp-timeline-intro">
              {l(
                "무엇을 바꾼 뒤 어떤 값이 움직였는지 비교하세요.",
                "Compare which values moved after each adjustment.",
                "各調整の後にどの値が動いたか比較します。"
              )}
            </p>
            {runEvents.length ? (
              <ol className="kp-depth-event-list">
                {[...runEvents].reverse().map(event => (
                  <li key={event.id} data-type={event.type}>
                    <time>{clock(event.atMs / 1000)}</time>
                    <p>{eventText(event)}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="kp-event-empty">
                {l(
                  "미션을 시작하면 이상 발생과 조작을 여기에 기록해요.",
                  "Faults and adjustments appear here after you start.",
                  "開始すると異常と操作をここに記録します。"
                )}
              </p>
            )}
          </section>
        </div>

        <div className="kp-reflection-wrapper" hidden={stage !== "review"}>
          <BoothReflection
            attempt={completedAttempt}
            language={language}
            onRetry={() => prepareNewRun()}
            registerLeaveGuard={registerLeaveGuard}
          />
        </div>
        <footer className="kp-footer">
          <p>
            {l(
              "공정값은 교육용 모의값이며, USB는 모형의 보라색 LED를 제어합니다. 실제 플라즈마·RF 측정 장비가 아닙니다.",
              "Process values are educational simulations; USB controls the model's purple LED. This is not physical plasma or RF measurement equipment.",
              "プロセス値は教育用の模擬値です。USBで模型の紫色LEDを制御し、実際のプラズマ・RF測定は行いません。"
            )}
          </p>
          <span>SEMIGUARD / ETCH LAB</span>
        </footer>
      </main>
      <BoothMissionFeedback
        snapshot={liveSnapshot}
        language={language}
        onReview={focusReview}
        onRetry={() => prepareNewRun()}
        onFreePlay={() => prepareNewRun("free")}
      />
    </div>
  );
}
