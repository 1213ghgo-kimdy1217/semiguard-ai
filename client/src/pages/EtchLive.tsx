import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  Download,
  Link2,
  Play,
  Radio,
  RotateCcw,
  Unplug,
  Usb,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import AccountLogout from "../components/AccountSession";
import KiyoEquipmentView, {
  type KiyoSignal,
} from "../components/KiyoEquipmentView";
import PrototypeCameraView from "../components/PrototypeCameraView";
import ProductLanguageSelect from "../components/ProductLanguageSelect";
import { usePrototypeLink } from "../hooks/usePrototypeLink";
import { tr, useProductLanguage } from "../lib/productLanguage";
import "./prototype-dashboard.css";

type Channel = "pressure" | "flow" | "rf" | "temperature";
type ModelSignal = KiyoSignal;
type Point = {
  elapsed: number;
  seq: number;
  source: "usb" | "demo";
  pressure: number;
  flow: number;
  rf: number;
  temperature: number;
  faultActive: boolean;
};
type EventKind =
  | "connected"
  | "demo"
  | "fault"
  | "normal"
  | "stale"
  | "disconnected"
  | "reset"
  | "note";
type EventItem = { id: number; at: number; kind: EventKind; source: string };
type Observation = {
  id: number;
  at: number;
  source: string;
  fact: string;
  cause: string;
  next: string;
  frameSeq: number;
  process: Omit<Point, "seq" | "elapsed" | "faultActive" | "source">;
};
const MAX_POINTS = 120;
const CHANNELS: {
  id: Channel;
  code: string;
  name: [string, string, string];
  unit: string;
  baseline: number;
  domain: [number, number];
}[] = [
  {
    id: "pressure",
    code: "PT-01",
    name: ["챔버 압력", "Chamber pressure", "チャンバー圧力"],
    unit: "mTorr",
    baseline: 20,
    domain: [0, 45],
  },
  {
    id: "flow",
    code: "MFC-01",
    name: ["가스 유량", "Gas flow", "ガス流量"],
    unit: "sccm",
    baseline: 100,
    domain: [90, 110],
  },
  {
    id: "rf",
    code: "RF-01",
    name: ["RF 전력", "RF power", "RF電力"],
    unit: "W",
    baseline: 500,
    domain: [0, 550],
  },
  {
    id: "temperature",
    code: "TC-01",
    name: ["챔버 주변 온도", "Chamber-area temperature", "チャンバー周辺温度"],
    unit: "°C",
    baseline: 35,
    domain: [30, 40],
  },
];

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
const displayValue = (value: number, channel: Channel) =>
  value.toFixed(channel === "rf" ? 0 : 1);

/** Educational process illustration, derived from a button. These are never sensor measurements. */
function illustrativeProcess(frame: {
  faultActive: boolean;
  uptimeMs: number;
}) {
  const t = frame.uptimeMs / 1000;
  return {
    pressure: frame.faultActive
      ? 36 + Math.sin(t * 0.24) * 0.6
      : 20 + Math.sin(t * 0.31) * 0.25,
    flow: 100 + Math.sin(t * 0.18) * 0.4,
    rf: frame.faultActive ? 0 : 500 + Math.sin(t * 0.23) * 1.5,
    temperature: 35 + Math.sin(t * 0.09) * 0.12 + (frame.faultActive ? 0.2 : 0),
  };
}

export default function EtchLive() {
  const [language, setLanguage] = useProductLanguage();
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const link = usePrototypeLink();
  const [equipmentView, setEquipmentView] = useState<
    "exterior" | "cutaway" | "camera"
  >("exterior");
  const [selectedModelSignal, setSelectedModelSignal] =
    useState<ModelSignal | null>(null);
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === "undefined" || !document.hidden
  );
  const [points, setPoints] = useState<Point[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [notes, setNotes] = useState<Observation[]>([]);
  const [fact, setFact] = useState("");
  const [cause, setCause] = useState("");
  const [next, setNext] = useState("");
  const [notice, setNotice] = useState("");
  const [restartPending, setRestartPending] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [now, setNow] = useState(Date.now);
  const previous = useRef<{
    mode: string;
    seq: number;
    uptimeMs: number;
    fault: boolean;
  } | null>(null);
  const origin = useRef(0);
  const lastStatus = useRef(link.status);
  const eventId = useRef(0);
  const noteId = useRef(0);
  const fresh =
    link.status === "live" &&
    link.mode !== "disconnected" &&
    link.frame !== null;
  const demo = link.mode === "demo";
  const current = useMemo(
    () => (fresh && link.frame ? illustrativeProcess(link.frame) : null),
    [fresh, link.frame]
  );
  const usbFresh = link.mode === "usb" && fresh;
  const cameraAllowed = usbFresh && pageVisible;
  // A freshness change hides/unmounts the camera immediately, before effects run.
  const activeView =
    equipmentView === "camera" && !cameraAllowed ? "exterior" : equipmentView;
  const cameraActive = activeView === "camera" && cameraAllowed;
  const modelProcessValues =
    demo && fresh && activeView === "cutaway" && current
      ? {
          pressure: current.pressure,
          gasFlow: current.flow,
          rfPower: current.rf,
          chamberAmbientTemp: current.temperature,
        }
      : null;
  const elapsed = points.at(-1)?.elapsed ?? 0;
  const lastAge =
    link.lastReceivedAt === null
      ? null
      : Math.max(0, Math.floor((now - link.lastReceivedAt) / 1000));
  const sourceLabel = demo
    ? l("모형 없이 체험", "Model-free demo", "模型なしの体験")
    : link.mode === "usb"
      ? l("USB 모형 입력", "USB model input", "USB模型入力")
      : l("입력 없음", "No input", "入力なし");
  const statusLabel =
    link.status === "connecting"
      ? l("USB 연결 중", "Connecting USB", "USB接続中")
      : link.status === "waiting"
        ? l("모형 데이터 대기", "Waiting for model data", "模型データを待機")
        : fresh
          ? demo
            ? l("모의 체험 중", "Demo running", "模擬体験中")
            : l(
                "모형 입력 수신 중",
                "Receiving model input",
                "模型入力を受信中"
              )
          : link.status === "stale"
            ? l(
                "수신 지연 · 값 확인 불가",
                "Data delayed · values unavailable",
                "受信遅延・値を確認できません"
              )
            : link.status === "disconnected"
              ? l("연결 끊김", "Connection lost", "接続が切れました")
              : link.status === "error"
                ? l(
                    "연결 확인 필요",
                    "Check connection",
                    "接続を確認してください"
                  )
                : l("모형 미연결", "Model disconnected", "模型未接続");

  useEffect(() => {
    const onVisibilityChange = () => {
      const visible = !document.hidden;
      setPageVisible(visible);
      if (!visible)
        setEquipmentView(view => (view === "camera" ? "exterior" : view));
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);
  useEffect(() => {
    if (!cameraAllowed)
      setEquipmentView(view => (view === "camera" ? "exterior" : view));
  }, [cameraAllowed]);
  useEffect(() => {
    if (!demo) setSelectedModelSignal(null);
  }, [demo]);
  useEffect(() => {
    document.title = tr(
      language,
      "Kiyo 참고 모형 관찰 | SemiGuard",
      "Kiyo-inspired model observation | SemiGuard",
      "Kiyo参考模型の観察 | SemiGuard"
    );
  }, [language]);
  useEffect(() => {
    if (link.lastReceivedAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [link.lastReceivedAt === null]);
  useEffect(() => {
    if (!fresh || !link.frame) return;
    const frame = link.frame;
    const before = previous.current;
    if (
      before?.mode === link.mode &&
      before.seq === frame.seq &&
      before.uptimeMs === frame.uptimeMs
    )
      return;
    const newRun =
      !before || before.mode !== link.mode || frame.uptimeMs < before.uptimeMs;
    if (newRun) origin.current = frame.uptimeMs;
    const point: Point = {
      elapsed: Math.max(0, (frame.uptimeMs - origin.current) / 1000),
      seq: frame.seq,
      source: link.mode === "usb" ? "usb" : "demo",
      ...illustrativeProcess(frame),
      faultActive: frame.faultActive,
    };
    setPoints(list => (newRun ? [point] : [...list, point].slice(-MAX_POINTS)));
    const kind: EventKind | null = newRun
      ? link.mode === "demo"
        ? "demo"
        : "connected"
      : before.fault !== frame.faultActive
        ? frame.faultActive
          ? "fault"
          : "normal"
        : null;
    if (kind) {
      const item: EventItem = {
        id: ++eventId.current,
        at: Date.now(),
        kind,
        source: link.mode,
      };
      setEvents(list => [item, ...list].slice(0, 20));
    }
    previous.current = {
      mode: link.mode,
      seq: frame.seq,
      uptimeMs: frame.uptimeMs,
      fault: frame.faultActive,
    };
    setNow(Date.now());
  }, [fresh, link.frame, link.mode]);
  useEffect(() => {
    if (lastStatus.current === link.status) return;
    const kind: EventKind | null =
      link.status === "stale"
        ? "stale"
        : link.status === "disconnected"
          ? "disconnected"
          : null;
    if (kind) {
      const item: EventItem = {
        id: ++eventId.current,
        at: Date.now(),
        kind,
        source: link.mode,
      };
      setEvents(list => [item, ...list].slice(0, 20));
    }
    lastStatus.current = link.status;
  }, [link.status, link.mode]);

  const eventName = (kind: EventKind) =>
    ({
      connected: l(
        "USB 모형 입력 수신 시작",
        "USB model input received",
        "USB模型入力の受信開始"
      ),
      demo: l(
        "모형 없는 체험 시작",
        "Model-free demo started",
        "模型なしの体験を開始"
      ),
      fault: l(
        "이상 버튼 입력 · 모의 압력 상승 / RF 정지",
        "Fault input · simulated pressure rises / RF stops",
        "異常ボタン入力・模擬圧力上昇／RF停止"
      ),
      normal: l(
        "이상 입력 해제 · 모의 정상 상태",
        "Fault input cleared · normal illustration",
        "異常入力解除・模擬正常状態"
      ),
      stale: l(
        "새 입력 없음 · 현재 값 표시 중단",
        "No new input · current values hidden",
        "新しい入力なし・現在値の表示を中断"
      ),
      disconnected: l(
        "모형 연결 끊김",
        "Model connection lost",
        "模型の接続が切れました"
      ),
      reset: l("초기화 요청", "Reset requested", "初期化を要求"),
      note: l("관찰 근거 기록", "Observation recorded", "観察根拠を記録"),
    })[kind];

  async function restartExperience() {
    if (restarting) return;
    setRestarting(true);
    setEquipmentView("exterior");
    let boardReset = true;
    try {
      if (usbFresh) await link.reset();
    } catch {
      boardReset = false;
    }
    lastStatus.current = "disconnected";
    await link.disconnect();
    previous.current = null;
    origin.current = 0;
    eventId.current = 0;
    noteId.current = 0;
    setPoints([]);
    setEvents([]);
    setNotes([]);
    setFact("");
    setCause("");
    setNext("");
    setSelectedModelSignal(null);
    setRestartPending(false);
    setRestarting(false);
    setNotice(boardReset
      ? l("체험을 초기화했습니다. USB 연결 또는 모형 없이 체험을 선택하세요.", "Experience cleared. Connect USB or start a model-free demo.", "体験を初期化しました。USB接続またはデモを選んでください。")
      : l("화면과 기록을 초기화했습니다. 보드 초기화는 확인되지 않았으니 실물 버튼과 LED를 확인하고 다시 연결하세요.", "Screen and records cleared. Board reset was not confirmed; check the physical button and LED before reconnecting.", "画面と記録を初期化しました。ボードの初期化は未確認です。ボタンとLEDを確認して再接続してください。"));
  }

  async function resetModel() {
    if (!fresh) return;
    try {
      await link.reset();
      const item: EventItem = {
        id: ++eventId.current,
        at: Date.now(),
        kind: "reset",
        source: link.mode,
      };
      setEvents(list => [item, ...list].slice(0, 20));
      setNotice(
        l(
          "초기화 입력을 확인했습니다.",
          "Reset input confirmed.",
          "初期化入力を確認しました。"
        )
      );
    } catch {
      setNotice(
        l(
          "초기화를 확인하지 못했습니다. 연결과 모형 입력을 확인하세요.",
          "Reset was not confirmed. Check the connection and model input.",
          "初期化を確認できませんでした。接続と模型入力を確認してください。"
        )
      );
    }
  }
  function recordObservation(event: FormEvent) {
    event.preventDefault();
    if (!fresh || !link.frame || !current || !fact.trim()) return;
    const note = {
      id: ++noteId.current,
      at: Date.now(),
      source: link.mode,
      fact: fact.trim(),
      cause: cause.trim(),
      next: next.trim(),
      frameSeq: link.frame.seq,
      process: current,
    };
    setNotes(list => [note, ...list].slice(0, 30));
    const item: EventItem = {
      id: ++eventId.current,
      at: note.at,
      kind: "note",
      source: link.mode,
    };
    setEvents(list => [item, ...list].slice(0, 20));
    setFact("");
    setCause("");
    setNext("");
    setNotice(
      l(
        "관찰 근거를 이 화면에 기록했습니다.",
        "Observation recorded in this page.",
        "観察根拠をこの画面に記録しました。"
      )
    );
  }
  function exportRecord() {
    const record = {
      kind: "semiguard-prototype-observation",
      version: 1,
      exportedAt: new Date().toISOString(),
      currentConnectionMode: link.mode,
      streamSource: points.at(-1)?.source ?? null,
      processValues: "educational-simulation-not-physical-measurements",
      points,
      events,
      observations: notes,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(record, null, 2)], { type: "application/json" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "semiguard-model-observation.json";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      l(
        "입력 출처와 모의 공정값을 구분한 기록을 내려받았습니다.",
        "Downloaded the record with its input source and simulated process labels.",
        "入力元と模擬プロセス値を区別した記録をダウンロードしました。"
      )
    );
  }

  return (
    <div className="kp-app">
      <a className="kp-skip" href="#prototype-main">
        {l("대시보드로 이동", "Skip to dashboard", "ダッシュボードへ移動")}
      </a>
      <header className="kp-header">
        <a className="kp-brand" href="/training">
          <b>SG</b>
          <span>
            SemiGuard<small>ENGINEER WORKSPACE</small>
          </span>
        </a>
        <nav aria-label={l("제품 메뉴", "Product navigation", "製品メニュー")}>
          <a href="/training">
            {l("시나리오 훈련", "Scenario training", "シナリオ訓練")}
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
                "모형의 변화를 보고, 판단의 근거를 남기세요.",
                "Observe the model. Leave evidence for your reasoning.",
                "模型の変化を観察し、判断の根拠を残しましょう。"
              )}
            </p>
          </div>
          <div
            className={`kp-link-status ${fresh ? (demo ? "is-demo" : "is-live") : ""}`}
            role="status"
          >
            <span className="kp-status-dot" />
            <span>{statusLabel}</span>
          </div>
        </div>

        <section className="kp-session-bar" aria-label={l("체험 상태와 초기화", "Experience status and reset", "体験の状態と初期化")}>
          <div>
            <strong>{sourceLabel} · {statusLabel}</strong>
            <p>{l("압력·가스 유량·RF 전력·온도는 항상 교육용 모의값입니다. 카메라는 실제 영상만 보여줍니다.", "Pressure, gas flow, RF and temperature are always educational simulations. The camera shows live video only.", "圧力・流量・RF・温度は常に教育用の模擬値です。カメラは実際の映像のみを表示します。")}</p>
          </div>
          <Button variant="outline" className="kp-button kp-secondary" disabled={restarting} onClick={() => setRestartPending(true)}>
            <RotateCcw size={16} aria-hidden="true" />
            {l("체험 처음부터", "Restart experience", "体験を最初から")}
          </Button>
          {restartPending ? <div className="kp-restart-confirm" role="group" aria-label={l("초기화 확인", "Confirm restart", "初期化の確認")}>
            <p>{l("현재 기록과 입력 내용을 지우고 카메라·USB 연결을 종료합니다. 필요한 기록은 먼저 내려받으세요.", "Clear records and drafts, and stop camera and USB. Download any records you need first.", "記録と入力を消去し、カメラとUSBを終了します。必要な記録は先に保存してください。")}</p>
            <Button className="kp-button kp-primary" disabled={restarting} onClick={() => void restartExperience()}>{restarting ? l("초기화 중…", "Clearing…", "初期化中…") : l("초기화하기", "Clear experience", "初期化する")}</Button>
            <Button variant="outline" disabled={restarting} onClick={() => setRestartPending(false)}>{l("취소", "Cancel", "キャンセル")}</Button>
          </div> : null}
        </section>
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
                    "Equipment model observation",
                    "装置模型の観察"
                  )}
                </h2>
              </div>
              <span className="kp-outline-tag">
                {cameraActive
                  ? l("카메라 관찰", "Camera observation", "カメラ観察")
                  : l("측면 관찰창", "Side observation window", "側面観察窓")}
              </span>
            </div>
            <div
              className="kp-model-view-controls"
              role="group"
              aria-label={l(
                "장비 모형 보기 방식",
                "Equipment model view",
                "装置模型の表示方法"
              )}
            >
              <button
                id="model-exterior-view"
                type="button"
                aria-pressed={activeView === "exterior"}
                aria-controls="model-illustration"
                onClick={() => setEquipmentView("exterior")}
              >
                {l("외관 보기", "Exterior view", "外観表示")}
              </button>
              <button
                id="model-interior-view"
                type="button"
                aria-pressed={activeView === "cutaway"}
                aria-controls="model-illustration"
                onClick={() => setEquipmentView("cutaway")}
              >
                {l("교육용 내부 보기", "Teaching interior", "教育用内部表示")}
              </button>
              {usbFresh ? (
                <button
                  id="model-camera-view"
                  className="kp-camera-view-button"
                  type="button"
                  aria-pressed={cameraActive}
                  aria-controls="model-illustration"
                  onClick={() => {
                    if (cameraAllowed) setEquipmentView("camera");
                  }}
                >
                  {l(
                    "현재 상태 보기",
                    "View current state",
                    "現在の状態を見る"
                  )}
                </button>
              ) : null}
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
                activeView === "camera"
                  ? "model-camera-view"
                  : activeView === "exterior"
                    ? "model-exterior-view"
                    : "model-interior-view"
              }
            >
              {cameraActive ? (
                <PrototypeCameraView language={language} onClose={() => setEquipmentView("exterior")} />
              ) : (
                <>
                  <div className="kp-stage-heading">
                    <span className="kp-stage-note">
                      {activeView === "cutaway"
                        ? l(
                            "교육용 내부 확대 관찰",
                            "Teaching interior · close observation",
                            "教育用内部の拡大観察"
                          )
                        : l(
                            "Kiyo 참고 외관 모형",
                            "Kiyo-inspired exterior model",
                            "Kiyo参考外観模型"
                          )}
                    </span>
                  </div>
                  <KiyoEquipmentView
                    view={activeView === "cutaway" ? "cutaway" : "exterior"}
                    active={fresh}
                    ledOn={fresh && link.frame?.ledCommand === "on"}
                    language={language}
                    demo={demo}
                    processValues={modelProcessValues}
                    selectedSignal={selectedModelSignal}
                    onSelectSignal={setSelectedModelSignal}
                  />
                </>
              )}
            </div>
            {activeView === "cutaway" ? (
              <div className="kp-model-observation-caption">
                <p>{l("문 열림은 내부 이해를 위한 교육용 연출입니다.", "Door opening is an educational reveal of the interior.", "扉の開閉は内部理解のための教育用演出です。")}</p>
                <span className="kp-window-led-state">
                  <span
                    className={`kp-status-dot ${fresh && link.frame?.ledCommand === "on" ? "is-amber" : ""}`}
                  />
                  {l("관찰창 LED 명령", "Window LED command", "観察窓LED命令")}{" "}
                  {fresh
                    ? link.frame?.ledCommand === "on"
                      ? "ON"
                      : "OFF"
                    : "—"}
                  {demo ? l(" · 모의", " · DEMO", "・模擬") : ""}
                </span>
                {demo ? (
                  <span className="kp-callout-hint">
                    {l(
                      "번호를 눌러 4개 모의 값의 위치와 의미를 확인하세요.",
                      "Select a number to explore the four simulated values and their locations.",
                      "番号を選び、4つの模擬値の位置と意味を確認しましょう。"
                    )}
                  </span>
                ) : null}
              </div>
            ) : null}
            <p className="kp-model-scope">
              {cameraActive
                ? l(
                    "카메라 영상과 아래의 교육용 모의 공정값은 별도의 정보입니다. 영상으로 압력·유량·RF·온도를 측정하지 않습니다.",
                    "The camera image and educational process simulations below are separate information. The image does not measure pressure, flow, RF or temperature.",
                    "カメラ映像と下の教育用模擬プロセス値は別の情報です。映像から圧力・流量・RF・温度を測定しません。"
                  )
                : l(
                    "하나의 캐비닛 안에 교육용 챔버와 관찰창을 넣은 구성입니다. 내부 배치는 공정 설명용으로 단순화했으며 실제 Kiyo의 내부 구조·위치를 재현하지 않습니다.",
                    "One cabinet contains the teaching chamber and observation window. Its internal layout is simplified for explanation, not a reproduction of Kiyo's actual structure or positions.",
                    "1台のキャビネット内に教育用チャンバーと観察窓を設けた構成です。内部配置は説明用に簡略化しており、実際のKiyo内部構造や位置の再現ではありません。"
                  )}
            </p>
            <div className="kp-model-explanation" id="model-view-description">
              <div>
                <h3>
                  {cameraActive
                    ? l(
                        "현재 상태 · 카메라 관찰",
                        "Current state · camera observation",
                        "現在の状態・カメラ観察"
                      )
                    : activeView === "exterior"
                      ? l(
                          "Kiyo 참고 외관 · 로드포트",
                          "Kiyo-inspired exterior · load ports",
                          "Kiyo参考外観・ロードポート"
                        )
                      : l(
                          "측면 관찰창 · 교육용 내부 배치",
                          "Side observation window · teaching layout",
                          "側面観察窓・教育用内部配置"
                        )}
                </h3>
                <p>
                  {cameraActive
                    ? l(
                        "USB 제어보드와 카메라는 별도 장치입니다. 모형을 비추는 카메라를 컴퓨터에 연결한 뒤, 패널의 ‘카메라 켜기’를 눌러 촬영 권한을 허용하고 사용할 카메라를 선택하세요.",
                        "The USB controller and camera are separate devices. Connect a camera aimed at the model, then use ‘Turn on camera’ in the panel to grant permission and choose the device.",
                        "USB制御ボードとカメラは別の機器です。模型を映すカメラをパソコンに接続し、パネルの「カメラをオン」で撮影を許可して使用するカメラを選んでください。"
                      )
                    : activeView === "exterior"
                      ? l(
                          "왼쪽 조작부와 세 개의 전면 로드포트를 살펴보세요. 로드포트는 웨이퍼를 넣고 꺼내는 입구입니다. 외관 표시등과 빨간 버튼은 장식 표현이며 실제 USB 입력 상태와 연동하지 않습니다.",
                          "Explore the left control area and three front load ports, the wafer-loading interfaces. Exterior lights and the red button are decorative and do not represent live USB input state.",
                          "左側操作部と前面ロードポート3基を確認しましょう。ロードポートはウェーハ搬入出の入口です。外観表示灯と赤いボタンは装飾表現で、実際のUSB入力状態とは連動しません。"
                        )
                      : l(
                          "내부 보기로 전환하면 모형이 회전하고 확대됩니다. 가스 공급·웨이퍼 받침·배기 경로를 살펴보세요. 창 안의 빛은 수신한 LED 명령을 표현하며, 데모의 온도는 웨이퍼 실측 온도가 아닌 ‘챔버 주변 온도’ 모의 값입니다.",
                          "The model rotates and zooms when you switch to the interior. Explore the gas supply, wafer support and exhaust path. The window light represents the received LED command. Demo temperature is simulated chamber-area temperature, not a wafer measurement.",
                          "内部表示に切り替えると模型が回転・拡大します。ガス供給・ウェーハ支持部・排気経路を確認しましょう。窓内の光は受信したLED命令の表現で、デモ温度はウェーハ実測値ではなく「チャンバー周辺温度」の模擬値です。"
                        )}
                </p>
              </div>
              {!cameraActive ? (
                <a
                  href={
                    activeView === "exterior"
                      ? "https://www.lamresearch.com/product/kiyo-product-family/"
                      : "https://newsroom.lamresearch.com/etch-essentials-semiconductor-manufacturing"
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  {activeView === "exterior"
                    ? l(
                        "Kiyo 제품 자료",
                        "Kiyo product information",
                        "Kiyo製品資料"
                      )
                    : l(
                        "식각 원리 자료",
                        "Etch principles",
                        "エッチング原理の資料"
                      )}
                  <ArrowUpRight size={13} aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </section>
          <aside
            className="kp-connection-panel"
            aria-labelledby="connection-heading"
          >
            <div className="kp-section-head">
              <div>
                <p className="kp-eyebrow">MODEL CONNECTION</p>
                <h2 id="connection-heading">
                  {l("모형과 연결하기", "Connect your model", "模型と接続")}
                </h2>
              </div>
              <Link2 size={20} aria-hidden="true" />
            </div>
            <p className="kp-connection-copy">
              {l(
                "모형의 버튼 입력을 화면으로 가져옵니다. 압력·유량·RF·온도는 입력에 반응하는 교육용 모의 값입니다.",
                "Bring the model's button input to this screen. Pressure, flow, RF and temperature are educational illustrations driven by that input.",
                "模型のボタン入力を画面に取り込みます。圧力・流量・RF・温度は、その入力に反応する教育用の模擬値です。"
              )}
            </p>
            <div className="kp-connect-actions">
              <Button
                className="kp-button kp-primary"
                onClick={() => {
                  void link.connectUsb();
                }}
                disabled={
                  !link.canSerial ||
                  link.status === "connecting" ||
                  (link.mode === "usb" && (fresh || link.status === "waiting"))
                }
                aria-busy={link.status === "connecting" || undefined}
              >
                <Usb size={17} aria-hidden="true" />
                {link.status === "connecting"
                  ? l("연결 중…", "Connecting…", "接続中…")
                  : l("USB 모형 연결", "Connect USB model", "USB模型を接続")}
              </Button>
              {link.mode !== "disconnected" ? (
                <Button
                  className="kp-button kp-secondary"
                  variant="outline"
                  onClick={() => {
                    void link.disconnect();
                  }}
                >
                  <Unplug size={16} aria-hidden="true" />
                  {l("연결 종료", "Disconnect", "接続を終了")}
                </Button>
              ) : null}
              <button
                type="button"
                className="kp-demo-link"
                onClick={link.startDemo}
                disabled={demo && fresh}
              >
                <Play size={14} aria-hidden="true" />
                {l("모형 없이 체험", "Try without a model", "模型なしで体験")}
                {demo && fresh ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  <ArrowUpRight size={14} aria-hidden="true" />
                )}
              </button>
            </div>
            {!link.canSerial ? (
              <p className="kp-hint">
                {l(
                  "USB 연결은 컴퓨터의 Chrome·Edge에서 사용할 수 있습니다.",
                  "Use desktop Chrome or Edge for USB connection.",
                  "USB接続はパソコンのChrome・Edgeで利用できます。"
                )}
              </p>
            ) : null}
            {demo ? (
              <p className="kp-demo-notice">
                <Radio size={15} aria-hidden="true" />
                {l(
                  "모의 체험입니다. 실제 모형은 연결되어 있지 않습니다.",
                  "Demo mode. No physical model is connected.",
                  "模擬体験です。実際の模型は接続されていません。"
                )}
              </p>
            ) : null}
            {link.error ? (
              <p className="kp-error" role="alert">
                {link.error}
              </p>
            ) : null}
            {link.error || link.status === "disconnected" || link.status === "stale" ? (
              <div className="kp-recovery">
                <h3>{l("연결 복구", "Restore connection", "接続の復旧")}</h3>
                <ol>
                  <li>{l("보드 USB 케이블과 전원을 확인하세요.", "Check the board USB cable and power.", "ボードのUSBケーブルと電源を確認してください。")}</li>
                  <li>{l("아두이노 시리얼 모니터 등 포트를 쓰는 앱을 닫으세요.", "Close apps using the port, including Serial Monitor.", "シリアルモニターなどポートを使うアプリを閉じてください。")}</li>
                  <li>{l("다시 연결하거나 모형 없이 체험을 시작하세요.", "Reconnect, or continue with a model-free demo.", "再接続するか、デモを開始してください。")}</li>
                </ol>
                <Button variant="outline" className="kp-button kp-secondary" disabled={!link.canSerial || link.status === "connecting"} onClick={() => void link.connectUsb()}>{l("USB 다시 연결", "Reconnect USB", "USB再接続")}</Button>
                <Button variant="outline" className="kp-button kp-secondary" onClick={link.startDemo}>{l("모형 없이 체험", "Start demo", "デモを開始")}</Button>
              </div>
            ) : null}
            <div className="kp-input-heading">
              <h3>
                {l("모형 입력 상태", "Model input state", "模型入力の状態")}
              </h3>
              <span>
                {demo
                  ? l("모의 입력", "Demo input", "模擬入力")
                  : l("USB 입력", "USB input", "USB入力")}
              </span>
            </div>
            <dl className="kp-input-list">
              <div>
                <dt>
                  {l("이상 버튼 입력", "Fault button input", "異常ボタン入力")}
                </dt>
                <dd>
                  {fresh ? (
                    link.frame?.faultActive ? (
                      <span className="kp-amber">ON</span>
                    ) : (
                      "OFF"
                    )
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt>
                  {l("LED 제어 상태", "LED command state", "LED制御状態")}
                </dt>
                <dd>
                  {fresh
                    ? link.frame?.ledCommand === "on"
                      ? "ON"
                      : "OFF"
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>{l("수신 번호", "Received sequence", "受信番号")}</dt>
                <dd>
                  {fresh ? String(link.frame?.seq).padStart(4, "0") : "—"}
                </dd>
              </div>
              <div>
                <dt>{l("마지막 수신", "Last received", "最終受信")}</dt>
                <dd>
                  {lastAge === null
                    ? "—"
                    : lastAge < 1
                      ? l("방금", "Just now", "たった今")
                      : l(
                          `${lastAge}초 전`,
                          `${lastAge}s ago`,
                          `${lastAge}秒前`
                        )}
                </dd>
              </div>
            </dl>
            <details className="kp-connection-help">
              <summary>
                <CircleHelp size={14} aria-hidden="true" />
                {l("연결 전 확인", "Before connecting", "接続前の確認")}
              </summary>
              <p>
                {l(
                  "모형을 USB로 연결한 뒤 포트를 선택하세요. 입력 데이터가 도착해야 수신 상태가 표시됩니다. 실제 압력·유량·RF·온도 센서를 읽는 연결은 아닙니다.",
                  "Connect the model by USB, then choose its port. The receiving state appears only after input arrives. This does not read physical pressure, flow, RF or temperature sensors.",
                  "模型をUSBで接続し、ポートを選んでください。入力データが届くと受信状態が表示されます。実際の圧力・流量・RF・温度センサーを読み取る接続ではありません。"
                )}
              </p>
            </details>
          </aside>
        </div>

        <section
          className="kp-process-section"
          aria-labelledby="process-heading"
        >
          <div className="kp-section-head">
            <div>
              <p className="kp-eyebrow">PROCESS ILLUSTRATION</p>
              <h2 id="process-heading">
                {l(
                  "입력에 반응하는 공정 변화",
                  "Process response illustration",
                  "入力に反応するプロセスの変化"
                )}
              </h2>
            </div>
            <span className="kp-source-label">
              {l(
                "4개 항목 모두 교육용 모의 공정값",
                "All four channels are educational simulations",
                "4項目すべて教育用の模擬プロセス値"
              )}
            </span>
          </div>
          <p className="kp-scope-note">
            {l(
              "이 수치와 기준은 시연을 위해 정한 값입니다. 모형 센서 실측값이나 실제 Kiyo 운전 조건이 아닙니다.",
              "Values and references are chosen for demonstration. They are neither model sensor measurements nor real Kiyo operating conditions.",
              "数値と基準は実演用に設定しています。模型センサーの実測値や実際のKiyo運転条件ではありません。"
            )}
          </p>
          <div className="kp-metric-grid">
            {CHANNELS.map(channel => {
              const value = current?.[channel.id];
              const changed =
                fresh &&
                link.frame?.faultActive &&
                (channel.id === "pressure" || channel.id === "rf");
              return (
                <article
                  className={`kp-metric ${changed ? "is-changed" : ""}`}
                  key={channel.id}
                >
                  <div className="kp-metric-top">
                    <span>{l(...channel.name)}</span>
                    <small>{channel.code}</small>
                  </div>
                  <p className="kp-metric-value">
                    {value === undefined
                      ? "—"
                      : displayValue(value, channel.id)}
                    <span>{channel.unit}</span>
                  </p>
                  <div className="kp-metric-foot">
                    <span>
                      {l(
                        "교육용 모의 값",
                        "Educational simulation",
                        "教育用模擬値"
                      )}
                    </span>
                    <span>
                      {changed
                        ? l("변화", "Changed", "変化")
                        : value === undefined
                          ? l("입력 대기", "Awaiting input", "入力待機")
                          : l("기준 부근", "Near reference", "基準付近")}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="kp-control-strip">
            <div>
              <Activity size={16} aria-hidden="true" />
              <p>
                {fresh
                  ? demo
                    ? l(
                        "이상 상황을 눌러 모의 압력과 RF의 변화를 비교해 보세요.",
                        "Trigger a demo fault and compare simulated pressure and RF.",
                        "模擬異常を発生させ、模擬圧力とRFの変化を比べてみましょう。"
                      )
                    : l(
                        "실물 모형의 이상 버튼을 눌러 화면의 변화를 확인하세요.",
                        "Press the physical model's fault button to observe the change.",
                        "実際の模型の異常ボタンを押して、画面の変化を確認してください。"
                      )
                  : l(
                      "입력이 연결되면 공정 변화와 관찰 기능이 활성화됩니다.",
                      "Process illustration and observation become available after input arrives.",
                      "入力が接続されると、プロセス変化と観察機能を利用できます。"
                    )}
              </p>
            </div>
            <div className="kp-process-actions">
              {demo ? (
                <Button
                  className="kp-button kp-secondary"
                  variant="outline"
                  onClick={link.toggleDemoFault}
                  disabled={!fresh}
                >
                  {link.frame?.faultActive
                    ? l("모의 이상 해제", "Clear demo fault", "模擬異常を解除")
                    : l(
                        "모의 이상 발생",
                        "Trigger demo fault",
                        "模擬異常を発生"
                      )}
                </Button>
              ) : null}
              <Button
                className="kp-button kp-quiet"
                variant="ghost"
                onClick={() => {
                  void resetModel();
                }}
                disabled={!fresh}
              >
                <RotateCcw size={14} aria-hidden="true" />
                {l("모형 초기화", "Reset model", "模型を初期化")}
              </Button>
            </div>
          </div>
        </section>

        <div className="kp-analysis-grid">
          <section
            className="kp-trends-section"
            aria-labelledby="trends-heading"
          >
            <div className="kp-section-head">
              <div>
                <p className="kp-eyebrow">LIVE TREND</p>
                <h2 id="trends-heading">
                  {l("변화의 흐름", "Signal trends", "変化の流れ")}
                </h2>
              </div>
              <span className="kp-timing">
                {clock(elapsed)} · {sourceLabel}
              </span>
            </div>
            <div className="kp-trend-grid">
              {CHANNELS.map(channel => (
                <article
                  className={`kp-trend ${!fresh && points.length ? "is-historical" : ""}`}
                  key={channel.id}
                >
                  <div className="kp-trend-title">
                    <h3>
                      {l(...channel.name)} <span>({channel.unit})</span>
                    </h3>
                    <span>{l("모의", "SIM", "模擬")}</span>
                  </div>
                  {points.length ? (
                    <div
                      className="kp-chart"
                      role="img"
                      aria-label={l(
                        `${channel.name[0]} 교육용 모의 값의 경과 시간 그래프`,
                        `Elapsed-time chart of simulated ${channel.name[1].toLowerCase()}`,
                        `${channel.name[2]}の教育用模擬値の経過時間グラフ`
                      )}
                    >
                      <ResponsiveContainer width="100%" height={155}>
                        <LineChart
                          data={points}
                          margin={{ top: 10, right: 12, left: -19, bottom: 5 }}
                        >
                          <CartesianGrid
                            stroke="#35413c"
                            strokeDasharray="2 5"
                            vertical={false}
                          />
                          <XAxis
                            type="number"
                            dataKey="elapsed"
                            domain={[
                              points[0]?.elapsed ?? 0,
                              Math.max(elapsed, 1),
                            ]}
                            tickFormatter={clock}
                            minTickGap={35}
                            tick={{ fill: "#a2b2a8", fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            domain={channel.domain}
                            tick={{ fill: "#a2b2a8", fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            width={52}
                          />
                          <Tooltip
                            labelFormatter={value =>
                              `${l("경과", "Elapsed", "経過")} ${clock(Number(value))}`
                            }
                            formatter={(value: number) => [
                              `${displayValue(value, channel.id)} ${channel.unit}`,
                              l(
                                "교육용 모의 값",
                                "Simulated value",
                                "教育用模擬値"
                              ),
                            ]}
                            contentStyle={{
                              background: "#19221e",
                              border: "1px solid #61715e",
                              borderRadius: "4px",
                              color: "#edf0eb",
                              fontSize: "12px",
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey={channel.id}
                            stroke={
                              channel.id === "pressure" || channel.id === "rf"
                                ? "#e4aa55"
                                : "#8cb4a0"
                            }
                            strokeWidth={1.8}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="kp-chart-empty">
                      <span />
                      <span />
                      <span />
                      <p>
                        {l(
                          "연결 후 기록이 나타납니다",
                          "Trends appear after connection",
                          "接続後に記録が表示されます"
                        )}
                      </p>
                    </div>
                  )}
                  <p className="kp-chart-caption">
                    {!fresh && points.length
                      ? l(
                          "지난 수신 기록 · 현재 값 아님",
                          "Historical input · not current values",
                          "過去の受信記録・現在値ではありません"
                        )
                      : l(
                          "시간(분:초) · 교육용 모의 공정값",
                          "Time (min:sec) · educational process simulation",
                          "時間(分:秒)・教育用模擬プロセス値"
                        )}
                  </p>
                </article>
              ))}
            </div>
          </section>
          <section className="kp-events-panel" aria-labelledby="events-heading">
            <div className="kp-section-head">
              <div>
                <p className="kp-eyebrow">EVENT TIMELINE</p>
                <h2 id="events-heading">
                  {l("최근 변화 기록", "Recent events", "最近の変化の記録")}
                </h2>
              </div>
              <span className="kp-count">
                {String(events.length).padStart(2, "0")}
              </span>
            </div>
            {events.length ? (
              <ol className="kp-events">
                {events.slice(0, 8).map(event => (
                  <li key={event.id}>
                    <span
                      className={`kp-event-mark ${event.kind === "fault" ? "is-fault" : ""}`}
                    />
                    <div>
                      <span className="kp-event-time">
                        {new Date(event.at).toLocaleTimeString(
                          language === "ko"
                            ? "ko-KR"
                            : language === "ja"
                              ? "ja-JP"
                              : "en-US",
                          { hour12: false }
                        )}
                        <small>
                          {event.source === "demo"
                            ? l("모의 체험", "DEMO", "模擬体験")
                            : "USB"}
                        </small>
                      </span>
                      <p>{eventName(event.kind)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="kp-events-empty">
                <Activity size={24} aria-hidden="true" />
                <p>
                  {l(
                    "첫 입력을 기다리고 있어요.",
                    "Waiting for the first input.",
                    "最初の入力を待っています。"
                  )}
                </p>
                <span>
                  {l(
                    "연결과 상태 변화가 시간순으로 남습니다.",
                    "Connections and state changes appear here.",
                    "接続と状態の変化が時系列で残ります。"
                  )}
                </span>
              </div>
            )}
          </section>
        </div>

        <section
          className="kp-observation-section"
          aria-labelledby="notes-heading"
        >
          <div className="kp-section-head">
            <div>
              <p className="kp-eyebrow">OBSERVE / REASON / CHECK</p>
              <h2 id="notes-heading">
                {l("내 판단의 근거", "Evidence for my reasoning", "判断の根拠")}
              </h2>
            </div>
            <Button
              className="kp-button kp-quiet"
              variant="ghost"
              disabled={!points.length && !notes.length}
              onClick={exportRecord}
            >
              <Download size={15} aria-hidden="true" />
              {l(
                "관찰 기록 내보내기",
                "Export observations",
                "観察記録を書き出す"
              )}
            </Button>
          </div>
          <form className="kp-observation-form" onSubmit={recordObservation}>
            <label>
              {l("관찰한 사실", "Observed fact", "観察した事実")}
              <span>
                {l(
                  "화면에서 확인한 변화",
                  "The change you observed",
                  "画面で確認した変化"
                )}
              </span>
              <textarea
                rows={3}
                maxLength={800}
                required
                value={fact}
                onChange={event => setFact(event.target.value)}
                placeholder={l(
                  "예: 이상 버튼 입력 후 모의 압력이 상승하고 RF가 0이 되었다.",
                  "e.g. After fault input, simulated pressure rose and RF dropped to zero.",
                  "例：異常ボタン入力後、模擬圧力が上昇しRFが0になった。"
                )}
              />
            </label>
            <label>
              {l("가능한 원인", "Possible explanation", "考えられる原因")}
              <span>
                {l(
                  "사실과 추정을 나누기",
                  "Separate facts from inference",
                  "事実と推測を分ける"
                )}
              </span>
              <textarea
                rows={3}
                maxLength={800}
                value={cause}
                onChange={event => setCause(event.target.value)}
                placeholder={l(
                  "아직 확인하지 않은 가설을 적어보세요.",
                  "Write a hypothesis that still needs checking.",
                  "まだ確認していない仮説を書きましょう。"
                )}
              />
            </label>
            <label>
              {l("다음 확인 순서", "Next checks", "次に確認する順序")}
              <span>
                {l(
                  "무엇을 먼저 확인할까?",
                  "What would you check first?",
                  "何を先に確認しますか？"
                )}
              </span>
              <textarea
                rows={3}
                maxLength={800}
                value={next}
                onChange={event => setNext(event.target.value)}
                placeholder={l(
                  "다른 신호, 연결 상태, 이전 정상 기록 등",
                  "Other signals, connection state, previous references…",
                  "他の信号、接続状態、以前の正常記録など"
                )}
              />
            </label>
            <div className="kp-observation-submit">
              <p>
                {l(
                  "기록은 현재 화면에만 남습니다. 필요한 내용은 내보내기로 보관하세요.",
                  "Notes remain in this page only. Export anything you need to keep.",
                  "記録は現在の画面にのみ残ります。必要な内容は書き出して保存してください。"
                )}
              </p>
              <Button
                className="kp-button kp-primary"
                type="submit"
                disabled={!fresh || !fact.trim()}
              >
                {l("근거 기록하기", "Record evidence", "根拠を記録")}
                <ChevronRight size={15} aria-hidden="true" />
              </Button>
            </div>
          </form>
          {notes.length ? (
            <ol className="kp-notes-list">
              {notes.slice(0, 4).map(note => (
                <li key={note.id}>
                  <span className="kp-note-meta">
                    #{String(note.id).padStart(2, "0")} ·{" "}
                    {note.source === "demo"
                      ? l("모의 체험", "Demo", "模擬体験")
                      : "USB"}{" "}
                    ·{" "}
                    {new Date(note.at).toLocaleTimeString(
                      language === "ko"
                        ? "ko-KR"
                        : language === "ja"
                          ? "ja-JP"
                          : "en-US",
                      { hour12: false }
                    )}
                  </span>
                  <p>{note.fact}</p>
                  {note.cause ? (
                    <p className="kp-note-secondary">
                      {l("가설", "Hypothesis", "仮説")} — {note.cause}
                    </p>
                  ) : null}
                  {note.next ? (
                    <p className="kp-note-secondary">
                      {l("다음 확인", "Next check", "次の確認")} — {note.next}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}
          <p className="kp-notice" role="status" aria-live="polite">
            {notice}
          </p>
        </section>
        <footer className="kp-footer">
          <p>
            {l(
              "Kiyo 참고 외관 캐비닛에 교육용 측면 관찰창을 통합한 모형입니다. 창 안의 챔버 배치는 공정 원리 설명용 설계이며 실제 Kiyo의 내부 구조·위치를 재현하지 않습니다. 공정 수치는 교육용 모의 값입니다.",
              "A Kiyo-inspired model cabinet with an integrated teaching observation window. The chamber layout explains process principles, not Kiyo's actual internal structure or positions. Process values are educational simulations.",
              "Kiyo参考外観キャビネットに教育用の側面観察窓を組み込んだ模型です。窓内のチャンバー配置はプロセス原理の説明用設計で、実際のKiyo内部構造や位置の再現ではありません。プロセス値は教育用の模擬値です。"
            )}
          </p>
          <a
            href="https://www.lamresearch.com/product/kiyo-product-family/"
            target="_blank"
            rel="noreferrer"
          >
            {l(
              "Kiyo 공식 제품 자료",
              "Official Kiyo information",
              "Kiyo公式製品資料"
            )}
            <ArrowUpRight size={13} aria-hidden="true" />
          </a>
          <span>SemiGuard · MODEL LAB</span>
        </footer>
      </main>
    </div>
  );
}
