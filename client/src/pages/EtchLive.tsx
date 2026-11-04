import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  CircleHelp,
  Download,
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
import BoothCameraOverlay from "../components/BoothCameraOverlay";
import BoothMissionFeedback, { BoothNormalGuide } from "../components/BoothMissionFeedback";
import ProductLanguageSelect from "../components/ProductLanguageSelect";
import { useBoothDevice } from "../hooks/useBoothDevice";
import {
  applyBoothAction, BOOTH_CONTROL_LIMITS, BOOTH_SIGNALS, createBoothState,
  getBoothSnapshot, stepBoothState, type BoothAction, type BoothControlKey, type SignalKey,
} from "@shared/boothExperience";
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
type EventItem = { id: number; at: number; kind: EventKind; source: string; message?: string };
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
    domain: [65, 135],
  },
  {
    id: "rf",
    code: "RF-01",
    name: ["RF 전력", "RF power", "RF電力"],
    unit: "W",
    baseline: 500,
    domain: [0, 750],
  },
  {
    id: "temperature",
    code: "TC-01",
    name: ["챔버 주변 온도", "Chamber-area temperature", "チャンバー周辺温度"],
    unit: "°C",
    baseline: 35,
    domain: [25, 45],
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

const SIGNAL_FOR_CHANNEL: Record<Channel, SignalKey> = {
  pressure: "pressure", flow: "gasFlow", rf: "rfPower", temperature: "chamberAmbientTemp",
};
const CONTROL_ORDER: BoothControlKey[] = ["matching", "rfSetpoint", "gasSetpoint", "exhaustValve"];

/** The existing /live screen owns one scenario for the model, webcam values, charts and USB lamp. */
export default function EtchLive() {
  const [language, setLanguage] = useProductLanguage();
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const device = useBoothDevice();
  const [engine, setEngine] = useState(() => createBoothState());
  const snapshot = useMemo(() => getBoothSnapshot(engine), [engine]);
  const act = (action: BoothAction) => setEngine(previous => applyBoothAction(previous, action));
  const [equipmentView, setEquipmentView] = useState<"exterior" | "cutaway" | "camera">("exterior");
  const [selectedModelSignal, setSelectedModelSignal] = useState<ModelSignal | null>(null);
  const [pageVisible, setPageVisible] = useState(() => typeof document === "undefined" || !document.hidden);
  const [points, setPoints] = useState<Point[]>([]);
  const [notes, setNotes] = useState<Observation[]>([]);
  const [fact, setFact] = useState("");
  const [cause, setCause] = useState("");
  const [next, setNext] = useState("");
  const [notice, setNotice] = useState("");
  const [restartPending, setRestartPending] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [now, setNow] = useState(Date.now);
  const noteId = useRef(0);
  const lastTick = useRef(0);
  const lastSample = useRef(-500);
  const fresh = true; // These are local educational values, independent of USB availability.
  const demo = !device.connected;
  const usbFresh = device.connected;
  const devicePending = device.status === "connecting" || device.status === "waiting";
  const cameraAllowed = pageVisible;
  const activeView = equipmentView === "camera" && !cameraAllowed ? "exterior" : equipmentView;
  const cameraActive = activeView === "camera" && cameraAllowed;
  const modelProcessValues = snapshot.values;
  const current = useMemo(() => ({
    pressure: snapshot.values.pressure, flow: snapshot.values.gasFlow,
    rf: snapshot.values.rfPower, temperature: snapshot.values.chamberAmbientTemp,
  }), [snapshot.values]);
  const elapsed = snapshot.elapsedMs / 1000;
  const missionActive = snapshot.mission.status === "active";
  const missionFinished = snapshot.mode === "mission" && ["won", "failed"].includes(snapshot.mission.status);
  const anyAlarm = Object.values(snapshot.alarms).some(Boolean);
  const sourceLabel = usbFresh
    ? l("실물 램프 연동 · 모의 공정값", "Lamp linked · simulated process", "模型ランプ連動・模擬プロセス値")
    : l("화면 모의 체험", "Screen simulation", "画面での模擬体験");
  const statusLabel = snapshot.mode === "mission" && snapshot.mission.status === "won"
    ? l("복구 미션 성공", "Recovery mission completed", "復旧ミッション成功")
    : snapshot.mode === "mission" && snapshot.mission.status === "failed"
      ? l("미션 시간 종료 · 다시 도전해요", "Time is up · try again", "時間終了・再挑戦しましょう")
      : snapshot.phase === "cancelled"
        ? l("미션 중단 · 다시 시작할 수 있어요", "Mission cancelled · ready to restart", "ミッション中断・再開できます")
        : snapshot.phase === "stabilizing"
        ? l("정상 상태 유지 확인 중", "Confirming stable operation", "正常状態の維持を確認中")
        : snapshot.alarms.rfPower
          ? l("RF가 불안정해요", "RF is unstable", "RFが不安定です")
          : anyAlarm
            ? l("정상 범위를 벗어났어요", "Outside the normal range", "正常範囲を外れています")
            : l("정상 상태", "Normal operation", "正常状態");
  const lastAge = device.lastReceivedAt === null ? null : Math.max(0, Math.floor((now - device.lastReceivedAt) / 1000));
  const events: EventItem[] = snapshot.events.slice(-20).reverse().map(event => ({
    id: event.id, at: event.atMs,
    kind: event.type === "fault" ? "fault" : event.type === "clear" || event.type === "success" ? "normal" : event.type === "reset" ? "reset" : "note",
    source: "demo", message: language === "ko" ? event.message : event.type === "control"
      ? l(event.message, `${event.control}: ${event.value}`, `${event.control}: ${event.value}`)
      : ({
          fault: l(event.message, "Fault injected · RF matching disturbed", "異常注入・RFマッチングの変動"),
          clear: l(event.message, "Fault cleared", "異常解除"),
          mission: l(event.message, "Recovery mission started", "復旧ミッション開始"),
          success: l(event.message, "Recovery mission completed", "復旧ミッション成功"),
          timeout: l(event.message, "Mission time expired", "ミッション時間終了"),
          reset: l(event.message, "Controls reset", "設定を初期化"),
          mode: l(event.message, "Experience mode changed", "体験モード変更"),
        } as Record<string, string>)[event.type] ?? event.message,
  }));

  useEffect(() => {
    lastTick.current = performance.now();
    const timer = window.setInterval(() => {
      const time = performance.now();
      const dt = time - lastTick.current;
      lastTick.current = time;
      if (!document.hidden) setEngine(previous => stepBoothState(previous, dt));
      if (!document.hidden) setNow(Date.now());
    }, 100);
    const onVisibilityChange = () => {
      const visible = !document.hidden;
      lastTick.current = performance.now();
      setPageVisible(visible);
      if (!visible) setEquipmentView(view => view === "camera" ? "exterior" : view);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisibilityChange); };
  }, []);
  useEffect(() => {
    if (!document.hidden) device.sendState({ lampBrightness: snapshot.lampBrightness, faultActive: snapshot.faultActive });
    if (snapshot.elapsedMs < lastSample.current) {
      lastSample.current = -500;
      setPoints([]);
    }
    if (snapshot.elapsedMs - lastSample.current < 500) return;
    lastSample.current = snapshot.elapsedMs;
    const point: Point = {
      elapsed: snapshot.elapsedMs / 1000, seq: Math.floor(snapshot.elapsedMs / 100), source: "demo",
      pressure: snapshot.values.pressure, flow: snapshot.values.gasFlow,
      rf: snapshot.values.rfPower, temperature: snapshot.values.chamberAmbientTemp,
      faultActive: snapshot.faultActive,
    };
    setPoints(previous => [...previous, point].slice(-MAX_POINTS));
  }, [snapshot.elapsedMs, snapshot.lampBrightness, snapshot.faultActive, snapshot.values, device.sendState]);
  useEffect(() => {
    document.title = tr(language, "식각 모형 체험 | SemiGuard", "Etch model experience | SemiGuard", "エッチング模型体験 | SemiGuard");
  }, [language]);

  async function restartExperience() {
    if (restarting) return;
    setRestarting(true);
    setEquipmentView("exterior");
    await device.disconnect();
    setEngine(createBoothState());
    setPoints([]); setNotes([]); setFact(""); setCause(""); setNext("");
    noteId.current = 0; lastSample.current = -500;
    setSelectedModelSignal(null); setRestartPending(false); setRestarting(false);
    setNotice(l("체험 기록과 조절값을 초기화했어요. 모의 체험을 바로 계속할 수 있어요.", "Records and controls cleared. You can continue the simulation.", "記録と設定を初期化しました。模擬体験を続けられます。"));
  }
  function resetModel() {
    act({ type: "reset" });
    setNotice(l("조절값을 초기화했어요. 진행 중인 미션은 중단돼요.", "Controls reset. An active mission is cancelled.", "設定を初期化しました。進行中のミッションは中断されます。"));
  }
  function applyRecommendedSetpoints() {
    setEngine(previous => (["rfSetpoint", "gasSetpoint", "exhaustValve"] as const).reduce(
      (state, control) => applyBoothAction(state, { type: "set-control", control, value: BOOTH_CONTROL_LIMITS[control].initial }),
      previous
    ));
    setNotice(l("RF·유량·배기를 기본 운전값에 맞췄어요. 이제 RF 매칭을 조절해 빛과 ③ RF를 안정화하세요.", "RF, flow and exhaust are at their starting settings. Now adjust RF matching to stabilize the light and RF value.", "RF・流量・排気を基本設定に合わせました。RFマッチングを調整し、光と③RFを安定化してください。"));
  }
  function recordObservation(event: FormEvent) {
    event.preventDefault();
    if (!fact.trim()) return;
    const note: Observation = {
      id: ++noteId.current, at: Date.now(), source: "demo",
      fact: fact.trim(), cause: cause.trim(), next: next.trim(),
      frameSeq: Math.floor(snapshot.elapsedMs / 100), process: current,
    };
    setNotes(previous => [note, ...previous].slice(0, 30));
    setFact(""); setCause(""); setNext("");
    setNotice(l("선택한 관찰 메모를 기록했어요.", "Optional observation recorded.", "観察メモを記録しました。"));
  }
  function exportRecord() {
    const record = {
      kind: "semiguard-booth-experience", version: 2, exportedAt: new Date().toISOString(),
      processValues: "educational-simulation-not-physical-measurements",
      physicalLampConnected: device.connected, mission: snapshot.mission,
      controls: snapshot.controls, points, events: snapshot.events, observations: notes,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "semiguard-experience-record.json"; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(l("체험 기록을 내려받았어요.", "Experience record downloaded.", "体験記録をダウンロードしました。"));
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
                "이상을 주입하고 직접 조절하며 정상 상태를 되찾아보세요.",
                "Inject a fault, adjust the controls, and restore normal operation.",
                "異常を注入し、設定を調整して正常状態に戻しましょう。"
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
            <p>{l("①압력·②가스 유량·③RF 전력·④챔버 주변 온도는 교육용 모의값입니다. 카메라는 실제 영상 위에 같은 모의값을 표시합니다.", "Pressure, gas flow, RF and temperature are always educational simulations. The camera overlays the same simulated values on live video.", "圧力・流量・RF・温度は常に教育用の模擬値です。カメラは実際の映像に同じ模擬値を表示します。")}</p>
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
        <BoothMissionFeedback snapshot={snapshot} language={language} onRetry={() => act({ type: "start-mission" })} onFreePlay={() => act({ type: "set-mode", mode: "free" })} />
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
                {l("내부 구조 그림", "Interior diagram", "内部構造図")}
              </button>
              {pageVisible ? (
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
                    "내부 보기 · 카메라",
                    "Look inside · camera",
                    "内部を見る・カメラ"
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
                <BoothCameraOverlay values={snapshot.values} alarms={snapshot.alarms} onClose={() => setEquipmentView("exterior")} />
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
                    ledOn={snapshot.lampBrightness > 0}
                    lampBrightness={snapshot.lampBrightness}
                    signalAlarms={snapshot.alarms}
                    language={language}
                    demo={true}
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
                  <span className={`kp-status-dot ${snapshot.lampBrightness > 0 ? "is-amber" : ""}`} />
                  {l("보라색 램프 모의 밝기", "Purple lamp simulation", "紫ランプの模擬明るさ")} {Math.round(snapshot.lampBrightness / 255 * 100)}%
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
                    "실제 카메라 영상 위에 같은 체험의 모의값을 표시합니다. 번호와 값 상자는 촬영 구도에 맞춰 옮길 수 있어요. 영상으로 압력·유량·RF·온도를 측정하지 않습니다.",
                    "The live camera shows simulated values from this same experience. Move the numbers and value cards to match the view. The image does not measure pressure, flow, RF or temperature.",
                    "実際のカメラ映像に同じ体験の模擬値を表示します。番号と値の位置を映像に合わせて移動できます。映像から圧力・流量・RF・温度を測定するものではありません。"
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
                        "USB 제어보드와 카메라는 별도 장치입니다. 모형을 비추는 카메라를 컴퓨터에 연결한 뒤, 패널의 카메라 연결 버튼을 눌러 촬영 권한을 허용하고 사용할 카메라를 선택하세요.",
                        "The USB controller and camera are separate devices. Connect a camera aimed at the model, then use the camera connection button in the panel to grant permission and choose the device.",
                        "USB制御ボードとカメラは別の機器です。模型を映すカメラをパソコンに接続し、パネルのカメラ接続ボタンで撮影を許可して使用するカメラを選んでください。"
                      )
                    : activeView === "exterior"
                      ? l(
                          "왼쪽 조작부와 세 개의 전면 로드포트를 살펴보세요. 로드포트는 웨이퍼를 넣고 꺼내는 입구입니다. 외관 표시등과 빨간 버튼은 장식 표현이며 실제 USB 입력 상태와 연동하지 않습니다.",
                          "Explore the left control area and three front load ports, the wafer-loading interfaces. Exterior lights and the red button are decorative and do not represent live USB input state.",
                          "左側操作部と前面ロードポート3基を確認しましょう。ロードポートはウェーハ搬入出の入口です。外観表示灯と赤いボタンは装飾表現で、実際のUSB入力状態とは連動しません。"
                        )
                      : l(
                          "내부 보기로 전환하면 모형이 회전하고 확대됩니다. 가스 공급·웨이퍼 받침·배기 경로를 살펴보세요. 창 안의 보라색 빛은 RF 모의 상태와 함께 변하며, 온도는 웨이퍼 실측 온도가 아닌 ‘챔버 주변 온도’ 모의 값입니다.",
                          "The model rotates and zooms when you switch to the interior. Explore the gas supply, wafer support and exhaust path. The purple window light follows the simulated RF state. Temperature is simulated chamber-area temperature, not a wafer measurement.",
                          "内部表示に切り替えると模型が回転・拡大します。ガス供給・ウェーハ支持部・排気経路を確認しましょう。窓内の紫色の光は模擬RF状態と連動し、温度はウェーハ実測値ではなく「チャンバー周辺温度」の模擬値です。"
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
          <aside className="kp-connection-panel kp-experience-panel" aria-labelledby="connection-heading">
            <div className="kp-section-head">
              <div><p className="kp-eyebrow">HANDS-ON EXPERIENCE</p><h2 id="connection-heading">{l("직접 조작하고 복구하기", "Adjust and recover", "操作して復旧する")}</h2></div>
              <Link2 size={20} aria-hidden="true" />
            </div>
            <div className="kp-experience-mode" role="group" aria-label={l("체험 모드", "Experience mode", "体験モード")}>
              <button type="button" aria-pressed={snapshot.mode === "free"} onClick={() => act({ type: "set-mode", mode: "free" })}>{l("자유 체험", "Free play", "自由体験")}</button>
              <button type="button" aria-pressed={snapshot.mode === "mission"} onClick={() => act({ type: "set-mode", mode: "mission" })}>{l("복구 미션", "Recovery mission", "復旧ミッション")}</button>
            </div>
            <p className="kp-connection-copy">{snapshot.mode === "free"
              ? l("이상을 주입한 뒤 빛과 수치를 보며 조절해요. 조작 과정은 자동으로 기록돼요.", "Inject a fault and adjust while observing the light and values. Actions are recorded automatically.", "異常を注入し、光と数値を見ながら調整しましょう。操作は自動記録されます。")
              : l("90초 안에 정상 상태를 5초 유지하세요. RF 매칭부터 조절해보세요.", "Keep all values normal for five seconds within 90 seconds. Start with RF matching.", "90秒以内に正常状態を5秒維持しましょう。RFマッチングから調整してください。")}</p>
            <BoothNormalGuide snapshot={snapshot} language={language} onRecommended={applyRecommendedSetpoints} disabled={missionFinished} />
            {snapshot.mode === "mission" ? <div className="kp-experience-mission">
              <div><strong>{Math.ceil(snapshot.mission.remainingMs / 1000)}{l("초", "s", "秒")}</strong><span>{l("정상 유지", "Stable", "正常維持")} {(snapshot.mission.stableMs / 1000).toFixed(1)} / 5{l("초", "s", "秒")}</span></div>
              <progress aria-label={l("정상 상태 유지 시간", "Stable operation duration", "正常状態の維持時間")} value={snapshot.mission.stableMs} max={snapshot.mission.goalMs} />
              {snapshot.mission.status === "won" ? <p className="kp-success">{l(`복구 미션 완료 · ${snapshot.mission.score}점`, `Recovery mission complete · ${snapshot.mission.score} points`, `復旧ミッション完了・${snapshot.mission.score}点`)}</p> : null}
              {snapshot.mission.status === "failed" ? <p className="kp-error" role="status">{l("시간이 끝났어요. 기록을 보고 다시 도전해요.", "Time is up. Review the record and try again.", "時間終了です。記録を見て再挑戦しましょう。")}</p> : null}
              {snapshot.mission.status === "cancelled" ? <p>{l("미션이 중단됐어요. 다시 시작할 수 있어요.", "Mission cancelled. You can start again.", "ミッションは中断されました。再開できます。")}</p> : null}
              <Button className="kp-button kp-primary" disabled={missionActive} onClick={() => act({ type: "start-mission" })}><Play size={15} aria-hidden="true" />{missionActive ? l("정상 상태를 찾아보세요", "Find normal operation", "正常状態を探しましょう") : l("복구 미션 시작", "Start recovery mission", "復旧ミッション開始")}</Button>
            </div> : <div className="kp-process-actions">
              <Button className="kp-button kp-primary" onClick={() => act({ type: "inject-fault" })}>{l("이상 주입", "Inject fault", "異常を注入")}</Button>
              <Button className="kp-button kp-secondary" variant="outline" disabled={!snapshot.faultActive} onClick={() => act({ type: "clear-fault" })}>{l("이상 해제", "Clear fault", "異常を解除")}</Button>
            </div>}
            <button className="kp-demo-link" type="button" aria-expanded={showHint} onClick={() => setShowHint(value => !value)}><CircleHelp size={14} aria-hidden="true" />{l("어떻게 복구하나요?", "How do I recover?", "復旧のヒント")}</button>
            {showHint ? <p className="kp-hint">{l("RF 매칭을 조금씩 옮기며 ③ RF 값과 보라색 빛의 흔들림이 줄어드는 위치를 찾아요. 정상 범위로 돌아온 뒤 5초를 기다려요. 밝기를 낮추기만 해서는 미션을 해결할 수 없어요.", "Move RF matching gradually and look for less fluctuation in ③ RF and the purple light. Hold the normal range for five seconds. Dimming alone will not complete the mission.", "RFマッチングを少しずつ動かし、③RFと紫の光の揺れが減る位置を探します。正常範囲で5秒維持しましょう。明るさを下げるだけでは完了しません。")}</p> : null}
            {missionFinished ? <p className="kp-hint">{l("결과를 확인한 뒤 다시 시작하거나 자유 체험으로 계속 조작하세요.", "Review the result, then restart or continue in free play.", "結果を確認して再挑戦するか、自由体験を続けてください。")}</p> : null}
            <div className="kp-experience-controls">
              {CONTROL_ORDER.map(control => {
                const rule = BOOTH_CONTROL_LIMITS[control];
                const labels: Record<BoothControlKey, [string, string, string]> = {
                  matching: ["RF 매칭 조정", "RF matching", "RFマッチング"], rfSetpoint: ["RF 설정", "RF setpoint", "RF設定"],
                  gasSetpoint: ["가스 유량 설정", "Gas flow setpoint", "ガス流量設定"], exhaustValve: ["배기 밸브", "Exhaust valve", "排気バルブ"],
                };
                return <label key={control} htmlFor={`live-control-${control}`}><span>{l(...labels[control])}<output htmlFor={`live-control-${control}`}>{snapshot.controls[control]} {rule.unit}</output></span><input id={`live-control-${control}`} type="range" min={rule.min} max={rule.max} step={rule.step} value={snapshot.controls[control]} disabled={missionFinished} onChange={event => act({ type: "set-control", control, value: Number(event.target.value) })} /></label>;
              })}
            </div>
            <details className="kp-connection-help">
              <summary><Usb size={15} aria-hidden="true" />{l("실물 보라색 램프 연결", "Connect the purple model lamp", "模型の紫ランプを接続")}</summary>
              <p>{l("웹캠 USB와 제어보드 USB는 별도 장치예요. v2 체험 펌웨어가 확인되면 같은 모의 상태를 보라색 램프로 보냅니다. 흰 보조등 두 개는 계속 켜두세요.", "Webcam and controller use separate USB connections. After v2 firmware is confirmed, this scenario drives the purple lamp. Keep both white fill lights on.", "ウェブカメラと制御ボードは別々のUSB機器です。v2ファームウェア確認後、同じ模擬状態で紫ランプを制御します。白い補助灯2つは点灯したままにします。")}</p>
              <div className="kp-connect-actions"><Button className="kp-button kp-primary" disabled={!device.supported && !usbFresh && !devicePending} onClick={() => { if (usbFresh || devicePending) void device.disconnect(); else void device.connect(); }} aria-busy={devicePending || undefined}>{usbFresh || devicePending ? <Unplug size={15} aria-hidden="true" /> : <Usb size={15} aria-hidden="true" />}{usbFresh ? l("램프 연결 해제", "Disconnect lamp", "ランプを切断") : devicePending ? l("연결 취소", "Cancel connection", "接続をキャンセル") : l("USB 램프 연결", "Connect USB lamp", "USBランプ接続")}</Button></div>
              {!device.supported ? <p className="kp-hint">{l("USB 연결은 HTTPS의 데스크톱 Chrome·Edge에서 지원해요.", "Use desktop Chrome or Edge over HTTPS for USB.", "USB接続にはHTTPSのパソコン版Chrome・Edgeを使用してください。")}</p> : null}
              <dl className="kp-input-list"><div><dt>{l("연결 상태", "Connection", "接続状態")}</dt><dd>{usbFresh ? l("v2 응답 확인", "v2 verified", "v2応答確認") : devicePending ? l("응답 확인 중", "Waiting for response", "応答確認中") : l("연결 안 됨", "Not connected", "未接続")}</dd></div><div><dt>{l("보드가 확인한 밝기 명령", "Board-acknowledged command", "ボード確認済み明るさ命令")}</dt><dd>{usbFresh && device.acknowledgedBrightness !== null ? `${Math.round(device.acknowledgedBrightness / 255 * 100)}%` : "—"}</dd></div><div><dt>{l("마지막 보드 수신", "Last board response", "最終ボード応答")}</dt><dd>{lastAge === null ? "—" : `${lastAge}${l("초 전", "s ago", "秒前")}`}</dd></div></dl>
              <p>{l("응답은 명령 처리 확인이며 실제 밝기 측정값은 아니에요. 보드·LED·드라이버의 정격은 선정 후 확인해야 해요.", "An acknowledgement confirms a command, not measured light. Verify board, LED and driver ratings after selection.", "応答は命令処理の確認であり、明るさの実測ではありません。選定後にボード・LED・ドライバーの定格を確認してください。")}</p>
            </details>
            {device.error ? <p className="kp-error" role="alert">{device.error}</p> : null}
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
              const signal = SIGNAL_FOR_CHANNEL[channel.id];
              const changed = snapshot.alarms[signal];
              const normalRange = BOOTH_SIGNALS.find(item => item.key === signal)!.normal;
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
                        `모의 정상 ${normalRange[0]}–${normalRange[1]} ${channel.unit}`,
                        `Sim normal ${normalRange[0]}–${normalRange[1]} ${channel.unit}`,
                        `模擬正常 ${normalRange[0]}–${normalRange[1]} ${channel.unit}`
                      )}
                    </span>
                    <span>
                      {changed
                        ? l("이상", "Abnormal", "異常")
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
            <div><Activity size={16} aria-hidden="true" /><p>{l("이상 주입 → 빛과 값 관찰 → 직접 조절 → 정상 상태 유지. 네 항목은 같은 체험 상태를 보여줘요.", "Inject → observe light and values → adjust → hold normal operation. All four channels share one scenario.", "異常注入→光と値を観察→調整→正常状態維持。4項目は同じ体験状態を表示します。")}</p></div>
            <div className="kp-process-actions">
              {snapshot.mode === "free" ? <Button className="kp-button kp-secondary" variant="outline" onClick={() => act({ type: snapshot.faultActive ? "clear-fault" : "inject-fault" })}>{snapshot.faultActive ? l("이상 해제", "Clear fault", "異常解除") : l("이상 주입", "Inject fault", "異常注入")}</Button> : null}
              <Button className="kp-button kp-quiet" variant="ghost" onClick={resetModel}><RotateCcw size={14} aria-hidden="true" />{l("조절값 초기화", "Reset controls", "設定を初期化")}</Button>
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
                        {l("체험 경과", "Experience elapsed", "体験の経過")} {clock(event.at / 1000)}
                        <small>
                          {event.source === "demo"
                            ? l("모의 체험", "DEMO", "模擬体験")
                            : "USB"}
                        </small>
                      </span>
                      <p>{event.message}</p>
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

        <details className="kp-observation-section kp-optional-notes">
          <summary>{l("선택 활동 · 관찰 메모 남기기", "Optional · write observation notes", "任意・観察メモを書く")}</summary>
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
                  "예: 이상 주입 후 RF 값과 보라색 빛이 흔들렸고, 매칭을 조절하자 정상 범위로 돌아왔다.",
                  "e.g. RF and the purple light fluctuated after injection, then returned to normal after matching adjustment.",
                  "例：異常注入後にRFと紫の光が揺れ、マッチング調整後に正常範囲に戻った。"
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
        </details>
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
