import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Download,
  Link2,
  Play,
  RotateCcw,
  Unplug,
  Usb,
  Zap,
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
import ProductLanguageSelect from "../components/ProductLanguageSelect";
import { useBoothDevice } from "../hooks/useBoothDevice";
import {
  applyBoothAction,
  BOOTH_CONTROL_LIMITS,
  BOOTH_SIGNALS,
  createBoothState,
  getBoothSnapshot,
  stepBoothState,
  type BoothAction,
  type BoothControlKey,
  type BoothEvent,
  type SignalKey,
} from "@shared/boothExperience";
import { tr, useProductLanguage } from "../lib/productLanguage";
import "./prototype-dashboard.css";

type PlotPoint = Record<SignalKey, number> & { elapsed: number };
const ADVANCED_CONTROLS: BoothControlKey[] = [
  "rfSetpoint",
  "gasSetpoint",
  "exhaustValve",
];
const CONTROL_LABELS: Record<BoothControlKey, [string, string, string]> = {
  matching: ["RF 매칭", "RF matching", "RFマッチング"],
  rfSetpoint: ["RF 설정", "RF setpoint", "RF設定"],
  gasSetpoint: ["가스 유량", "Gas flow", "ガス流量"],
  exhaustValve: ["배기 밸브", "Exhaust valve", "排気バルブ"],
};
const SIGNAL_LABELS: Record<SignalKey, [string, string, string]> = {
  pressure: ["챔버 압력", "Pressure", "チャンバー圧力"],
  gasFlow: ["가스 유량", "Gas flow", "ガス流量"],
  rfPower: ["RF 전력", "RF power", "RF電力"],
  chamberAmbientTemp: ["주변 온도", "Ambient temperature", "周囲温度"],
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

/** One existing page and one scenario drive the model, camera labels and USB lamp. */
export default function EtchLive() {
  const [language, setLanguage] = useProductLanguage();
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const device = useBoothDevice();
  const [engine, setEngine] = useState(() => createBoothState());
  const snapshot = useMemo(() => getBoothSnapshot(engine), [engine]);
  const act = (action: BoothAction) => {
    setNotice("");
    setEngine(previous => applyBoothAction(previous, action));
  };
  const [equipmentView, setEquipmentView] = useState<
    "exterior" | "cutaway" | "camera"
  >("cutaway");
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === "undefined" || !document.hidden
  );
  const [points, setPoints] = useState<PlotPoint[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const lastTick = useRef(0);
  const lastSample = useRef(-500);
  const cameraAllowed = pageVisible;
  const activeView =
    equipmentView === "camera" && !cameraAllowed ? "cutaway" : equipmentView;
  const cameraActive = activeView === "camera" && cameraAllowed;
  const modelProcessValues = snapshot.values;
  const missionActive =
    snapshot.mode === "mission" && snapshot.mission.status === "active";
  const missionFinished =
    snapshot.mode === "mission" &&
    ["won", "failed"].includes(snapshot.mission.status);
  const devicePending =
    device.status === "connecting" || device.status === "waiting";
  const advancedChanged = ADVANCED_CONTROLS.some(
    key => snapshot.controls[key] !== BOOTH_CONTROL_LIMITS[key].initial
  );
  const anyAlarm = Object.values(snapshot.alarms).some(Boolean);
  const statusLabel =
    snapshot.phase === "success"
      ? l("미션 완료", "Mission complete", "ミッション完了")
      : snapshot.phase === "failed"
        ? l("시간 종료", "Time is up", "時間終了")
        : snapshot.phase === "cancelled"
          ? l("미션 중단", "Mission cancelled", "ミッション中断")
          : anyAlarm
            ? l("조정 필요", "Adjustment needed", "調整が必要")
            : missionActive
              ? l("안정화 확인 중", "Checking stability", "安定状態を確認中")
              : l("정상", "Normal", "正常");

  useEffect(() => {
    lastTick.current = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = now - lastTick.current;
      lastTick.current = now;
      if (!document.hidden) setEngine(previous => stepBoothState(previous, dt));
    }, 100);
    const visibility = () => {
      lastTick.current = performance.now();
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
  useEffect(() => {
    if (!document.hidden)
      device.sendState({
        lampBrightness: snapshot.lampBrightness,
        faultActive: snapshot.faultActive,
      });
    if (snapshot.elapsedMs < lastSample.current) {
      lastSample.current = -500;
      setPoints([]);
    }
    if (snapshot.elapsedMs - lastSample.current < 500) return;
    lastSample.current = snapshot.elapsedMs;
    setPoints(previous =>
      [
        ...previous,
        { elapsed: snapshot.elapsedMs / 1000, ...snapshot.values },
      ].slice(-120)
    );
  }, [
    snapshot.elapsedMs,
    snapshot.values,
    snapshot.lampBrightness,
    snapshot.faultActive,
    device.sendState,
  ]);
  useEffect(() => {
    document.title = l(
      "식각 챔버 체험 | SemiGuard",
      "Etch chamber experience | SemiGuard",
      "エッチング体験 | SemiGuard"
    );
  }, [language]);

  function restartExperience() {
    setEngine(createBoothState());
    setPoints([]);
    lastSample.current = -500;
    setNotice(
      l(
        "새 체험을 시작했어요.",
        "New experience started.",
        "新しい体験を開始しました。"
      )
    );
  }
  function applyRecommendedSetpoints() {
    setEngine(previous =>
      ADVANCED_CONTROLS.reduce(
        (state, control) =>
          applyBoothAction(state, {
            type: "set-control",
            control,
            value: BOOTH_CONTROL_LIMITS[control].initial,
          }),
        previous
      )
    );
    setNotice(
      l(
        "기본값으로 돌아왔어요. RF 매칭을 조절해보세요.",
        "Starting settings restored. Adjust RF matching.",
        "基本値に戻しました。RFマッチングを調整してください。"
      )
    );
  }
  function exportRecord() {
    const record = {
      kind: "semiguard-booth-experience",
      version: 3,
      exportedAt: new Date().toISOString(),
      processValues: "educational-simulation-not-physical-measurements",
      physicalLampConnected: device.connected,
      mission: snapshot.mission,
      controls: snapshot.controls,
      points,
      events: snapshot.events,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(record, null, 2)], { type: "application/json" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "semiguard-experience-record.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      l("기록을 내려받았어요.", "Record downloaded.", "記録を書き出しました。")
    );
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

  return (
    <div className="kp-app kp-simple">
      <a className="kp-skip" href="#prototype-main">
        {l("체험으로 바로가기", "Skip to experience", "体験へ移動")}
      </a>
      <header className="kp-header">
        <a className="kp-brand" href="/training">
          <b>SG</b>
          <span>SemiGuard</span>
        </a>
        <nav aria-label={l("사이트 메뉴", "Site navigation", "サイトメニュー")}>
          <a href="/training">{l("훈련 목록", "Training", "訓練一覧")}</a>
          <ProductLanguageSelect language={language} onChange={setLanguage} />
          <AccountLogout language={language} />
        </nav>
      </header>
      <main className="kp-main" id="prototype-main">
        <div className="kp-intro">
          <div>
            <h1>
              {l(
                "식각 챔버 체험",
                "Etch chamber experience",
                "エッチングチャンバー体験"
              )}
            </h1>
            <p>
              {l(
                "이상을 넣고, 직접 조절해 정상으로 되돌려보세요.",
                "Inject a fault and adjust the chamber back to normal.",
                "異常を注入し、調整して正常に戻しましょう。"
              )}
            </p>
          </div>
          <span
            className={"kp-state " + (anyAlarm ? "is-alarm" : "")}
            role="status"
          >
            <i />
            {statusLabel}
          </span>
        </div>

        <BoothMissionFeedback
          snapshot={snapshot}
          language={language}
          onRetry={() => act({ type: "start-mission" })}
          onFreePlay={() => act({ type: "set-mode", mode: "free" })}
        />

        <div className="kp-workspace">
          <section
            className="kp-view-card"
            aria-label={l(
              "챔버와 현재값",
              "Chamber and current values",
              "チャンバーと現在値"
            )}
          >
            <div
              className="kp-view-tabs"
              role="group"
              aria-label={l("보기 선택", "Choose view", "表示を選択")}
            >
              <button
                id="model-exterior-view"
                type="button"
                aria-pressed={activeView === "exterior"}
                aria-controls="model-illustration"
                onClick={() => setEquipmentView("exterior")}
              >
                {l("외형", "Exterior", "外観")}
              </button>
              <button
                id="model-interior-view"
                type="button"
                aria-pressed={activeView === "cutaway"}
                aria-controls="model-illustration"
                onClick={() => setEquipmentView("cutaway")}
              >
                {l("내부 구조", "Interior", "内部構造")}
              </button>
              <button
                id="model-camera-view"
                type="button"
                aria-pressed={cameraActive}
                aria-controls="model-illustration"
                onClick={() => {
                  if (cameraAllowed) setEquipmentView("camera");
                }}
              >
                {l("모듈 카메라", "Module camera", "モジュールカメラ")}
              </button>
            </div>
            <div
              id="model-illustration"
              className={"kp-visual " + (cameraActive ? "is-camera" : "")}
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
                  values={snapshot.values}
                  alarms={snapshot.alarms}
                  onClose={() => setEquipmentView("cutaway")}
                />
              ) : (
                <KiyoEquipmentView
                  compact
                  view={activeView === "exterior" ? "exterior" : "cutaway"}
                  active={true}
                  ledOn={snapshot.lampBrightness > 0}
                  lampBrightness={snapshot.lampBrightness}
                  signalAlarms={snapshot.alarms}
                  language={language}
                  demo={true}
                  processValues={modelProcessValues}
                  selectedSignal="rfPower"
                />
              )}
            </div>
            <div
              className="kp-readouts"
              aria-label={l(
                "현재값과 정상 기준",
                "Current values and normal references",
                "現在値と正常基準"
              )}
            >
              {BOOTH_SIGNALS.map(signal => (
                <article
                  key={signal.key}
                  data-signal={signal.key}
                  data-alarm={String(snapshot.alarms[signal.key])}
                  aria-label={
                    l(...SIGNAL_LABELS[signal.key]) +
                    " · " +
                    (snapshot.alarms[signal.key]
                      ? l("복구 필요", "Recovery needed", "復旧が必要")
                      : l("정상", "Normal", "正常"))
                  }
                >
                  <h2>
                    <span>{signal.number}</span>
                    {l(...SIGNAL_LABELS[signal.key])}
                  </h2>
                  <p className="kp-readout-value">
                    {valueText(signal.key, snapshot.values[signal.key])}
                    <small>{signal.unit}</small>
                  </p>
                  <p className="kp-reference">
                    {l("목표", "Target", "目標")} {signal.target} {signal.unit}
                  </p>
                  <p className="kp-normal-range">
                    {l("정상", "Normal", "正常")} {signal.normal[0]}–
                    {signal.normal[1]} {signal.unit}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <aside
            className="kp-controls"
            aria-label={l("직접 조절", "Hands-on controls", "操作パネル")}
          >
            <div
              className="kp-mode"
              role="group"
              aria-label={l("체험 모드", "Experience mode", "体験モード")}
            >
              <button
                type="button"
                aria-pressed={snapshot.mode === "free"}
                onClick={() => act({ type: "set-mode", mode: "free" })}
              >
                {l("자유 체험", "Free play", "自由体験")}
              </button>
              <button
                type="button"
                aria-pressed={snapshot.mode === "mission"}
                onClick={() => act({ type: "set-mode", mode: "mission" })}
              >
                {l("복구 미션", "Recovery mission", "復旧ミッション")}
              </button>
            </div>
            <h2>
              {snapshot.mode === "free"
                ? l(
                    "빛과 값의 변화를 살펴보세요",
                    "Watch the light and values",
                    "光と数値の変化を見ましょう"
                  )
                : l(
                    "90초 안에 정상으로 복구하기",
                    "Recover within 90 seconds",
                    "90秒以内に正常に復旧"
                  )}
            </h2>
            <p className="kp-step">
              {snapshot.mode === "free"
                ? l(
                    "이상 주입 → RF 매칭 조절",
                    "Inject fault → adjust RF matching",
                    "異常注入 → RFマッチング調整"
                  )
                : l(
                    "네 값과 매칭을 안정화하고 5초 유지하세요.",
                    "Keep all values and matching stable for 5 seconds.",
                    "4つの値とマッチングを5秒安定させましょう。"
                  )}
            </p>
            {snapshot.mode === "free" ? (
              <div className="kp-actions">
                <button
                  type="button"
                  className="kp-button kp-primary"
                  onClick={() => act({ type: "inject-fault" })}
                >
                  <Zap size={16} aria-hidden="true" />
                  {l("이상 주입", "Inject fault", "異常を注入")}
                </button>
                <button
                  type="button"
                  className="kp-button"
                  disabled={!snapshot.faultActive}
                  onClick={() => act({ type: "clear-fault" })}
                >
                  {l("이상 해제", "Clear fault", "異常を解除")}
                </button>
              </div>
            ) : (
              <>
                <div className="kp-mission-meter">
                  <div>
                    <strong>
                      {Math.ceil(snapshot.mission.remainingMs / 1000)}
                      <small>{l("초 남음", "s left", "秒残り")}</small>
                    </strong>
                    <span>
                      {l("정상 유지", "Stable hold", "正常維持")}{" "}
                      {(snapshot.mission.stableMs / 1000).toFixed(1)} / 5
                      {l("초", "s", "秒")}
                    </span>
                  </div>
                  <progress
                    aria-label={l(
                      "정상 유지 진행",
                      "Stable hold progress",
                      "正常維持の進捗"
                    )}
                    value={snapshot.mission.stableMs}
                    max={snapshot.mission.goalMs}
                  />
                </div>
                <button
                  type="button"
                  className="kp-button kp-primary kp-wide"
                  disabled={missionActive}
                  onClick={() => act({ type: "start-mission" })}
                >
                  <Play size={16} aria-hidden="true" />
                  {missionActive
                    ? l("복구 진행 중", "Recovery in progress", "復旧中")
                    : snapshot.mission.status === "idle"
                      ? l("미션 시작", "Start mission", "ミッション開始")
                      : l("다시 도전", "Try again", "再挑戦")}
                </button>
                {snapshot.mission.status === "failed" && (
                  <p className="kp-inline-result" role="status">
                    {l(
                      "시간이 끝났어요. 다시 도전할 수 있어요.",
                      "Time is up. You can try again.",
                      "時間終了です。再挑戦できます。"
                    )}
                  </p>
                )}
              </>
            )}
            <BoothNormalGuide
              compact
              snapshot={snapshot}
              language={language}
              onRecommended={applyRecommendedSetpoints}
              disabled={missionFinished}
            />
            <div className="kp-main-control">
              <div>
                <label htmlFor="live-control-matching">
                  {l("RF 매칭 조절", "RF matching", "RFマッチング調整")}
                </label>
                <output htmlFor="live-control-matching">
                  {snapshot.controls.matching}
                  <small>%</small>
                </output>
              </div>
              <input
                id="live-control-matching"
                type="range"
                min={BOOTH_CONTROL_LIMITS.matching.min}
                max={BOOTH_CONTROL_LIMITS.matching.max}
                step={BOOTH_CONTROL_LIMITS.matching.step}
                value={snapshot.controls.matching}
                disabled={missionFinished}
                onChange={event =>
                  act({
                    type: "set-control",
                    control: "matching",
                    value: Number(event.target.value),
                  })
                }
              />
              <p>
                {l(
                  "빛이 안정되고 ③ RF가 목표에 가까워지는 쪽으로 움직이세요.",
                  "Adjust toward a steady light and RF near its target.",
                  "光が安定し③RFが目標に近づく方向へ調整します。"
                )}
              </p>
            </div>
            <details className="kp-advanced">
              <summary>
                {l("추가 조절", "More controls", "追加調整")}
                {advancedChanged && (
                  <span>{l("변경됨", "Changed", "変更あり")}</span>
                )}
                <ChevronDown size={15} aria-hidden="true" />
              </summary>
              <div className="kp-advanced-controls">
                {ADVANCED_CONTROLS.map(control => {
                  const rule = BOOTH_CONTROL_LIMITS[control];
                  return (
                    <label key={control} htmlFor={"live-control-" + control}>
                      <span>
                        {l(...CONTROL_LABELS[control])}
                        <output htmlFor={"live-control-" + control}>
                          {snapshot.controls[control]} {rule.unit}
                        </output>
                      </span>
                      <input
                        id={"live-control-" + control}
                        type="range"
                        min={rule.min}
                        max={rule.max}
                        step={rule.step}
                        value={snapshot.controls[control]}
                        disabled={missionFinished}
                        onChange={event =>
                          act({
                            type: "set-control",
                            control,
                            value: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                  );
                })}
              </div>
            </details>
            <div className="kp-reset-row">
              {advancedChanged && (
                <button
                  type="button"
                  onClick={applyRecommendedSetpoints}
                  disabled={missionFinished}
                >
                  {l("기본값으로", "Starting settings", "基本値へ")}
                </button>
              )}
              <button type="button" onClick={restartExperience}>
                <RotateCcw size={13} aria-hidden="true" />
                {l("처음부터", "Start over", "最初から")}
              </button>
            </div>
          </aside>
        </div>

        <div className="kp-secondary-sections">
          <details
            className="kp-extra"
            onToggle={event => setDetailsOpen(event.currentTarget.open)}
          >
            <summary>
              <span>
                {l(
                  "그래프 · 체험 기록",
                  "Trends and activity",
                  "グラフ・体験記録"
                )}
              </span>
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            {detailsOpen && (
              <div className="kp-detail-content">
                <div className="kp-trend-grid">
                  {BOOTH_SIGNALS.map(signal => (
                    <section key={signal.key} className="kp-trend">
                      <h2>
                        {l(...SIGNAL_LABELS[signal.key])}
                        <small>{signal.unit}</small>
                      </h2>
                      <div className="kp-chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={points}
                            margin={{
                              top: 10,
                              right: 12,
                              bottom: 0,
                              left: -15,
                            }}
                          >
                            <CartesianGrid
                              stroke="#33453a"
                              strokeDasharray="3 5"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="elapsed"
                              type="number"
                              domain={["dataMin", "dataMax"]}
                              tickFormatter={clock}
                              tick={{ fill: "#a5b5a6", fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              domain={PLOT_DOMAINS[signal.key]}
                              tick={{ fill: "#a5b5a6", fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                              width={45}
                            />
                            <ReferenceArea
                              y1={signal.normal[0]}
                              y2={signal.normal[1]}
                              fill="#718f62"
                              fillOpacity={0.12}
                            />
                            <Tooltip
                              labelFormatter={value => clock(Number(value))}
                              formatter={value => [
                                Number(value).toFixed(
                                  signal.key === "rfPower" ? 0 : 1
                                ) +
                                  " " +
                                  signal.unit,
                                l(...SIGNAL_LABELS[signal.key]),
                              ]}
                              contentStyle={{
                                background: "#17241b",
                                border: "1px solid #586b50",
                                color: "#e5eddf",
                                fontSize: 12,
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey={signal.key}
                              stroke={SIGNAL_COLORS[signal.key]}
                              dot={false}
                              strokeWidth={2}
                              isAnimationActive={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </section>
                  ))}
                </div>
                <div className="kp-log">
                  <div>
                    <h2>{l("조작 기록", "Activity", "操作記録")}</h2>
                    <button
                      type="button"
                      className="kp-button kp-small"
                      onClick={exportRecord}
                    >
                      <Download size={14} aria-hidden="true" />
                      {l("내려받기", "Download", "保存")}
                    </button>
                  </div>
                  {snapshot.events.length ? (
                    <ol>
                      {snapshot.events
                        .slice(-8)
                        .reverse()
                        .map(event => (
                          <li key={event.id}>
                            <time>{clock(event.atMs / 1000)}</time>
                            <span>{eventText(event)}</span>
                          </li>
                        ))}
                    </ol>
                  ) : (
                    <p className="kp-empty">
                      {l(
                        "조작하면 기록이 여기에 남아요.",
                        "Your actions will appear here.",
                        "操作するとここに記録されます。"
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}
          </details>
          <details className="kp-connection">
            <summary>
              <span>
                <Link2 size={16} aria-hidden="true" />
                {l("실물 램프 연결", "Connect model lamp", "模型ランプ接続")}
              </span>
              <span
                className={
                  "kp-connection-state " +
                  (device.connected ? "is-connected" : "")
                }
              >
                {device.connected
                  ? l("연결됨", "Connected", "接続済み")
                  : devicePending
                    ? l("확인 중", "Checking", "確認中")
                    : l("미연결", "Not connected", "未接続")}
                <ChevronDown size={15} aria-hidden="true" />
              </span>
            </summary>
            <div className="kp-connection-body">
              <p>
                {l(
                  "모형의 제어 보드를 PC에 USB로 연결한 뒤 선택하세요. 보라색 램프만 화면 상태를 따라 움직입니다.",
                  "Connect the model controller to this PC by USB. Only the purple lamp follows the scenario.",
                  "模型の制御ボードをUSBでPCに接続します。紫ランプだけが画面の状態に連動します。"
                )}
              </p>
              <button
                type="button"
                className="kp-button"
                disabled={
                  !device.supported && !device.connected && !devicePending
                }
                onClick={() => {
                  if (device.connected || devicePending)
                    void device.disconnect();
                  else void device.connect();
                }}
              >
                {device.connected || devicePending ? (
                  <Unplug size={15} aria-hidden="true" />
                ) : (
                  <Usb size={15} aria-hidden="true" />
                )}
                {device.connected
                  ? l("연결 해제", "Disconnect", "切断")
                  : devicePending
                    ? l("연결 취소", "Cancel", "接続を取消")
                    : l(
                        "USB 보드 선택",
                        "Choose USB controller",
                        "USBボードを選択"
                      )}
              </button>
              {!device.supported && (
                <p>
                  {l(
                    "USB 연결은 HTTPS의 데스크톱 Chrome·Edge에서 지원해요.",
                    "USB requires desktop Chrome or Edge over HTTPS.",
                    "USB接続にはHTTPSのPC版Chrome・Edgeが必要です。"
                  )}
                </p>
              )}
            </div>
          </details>
        </div>
        {device.error && (
          <p className="kp-error" role="alert">
            {device.error}
          </p>
        )}
        <p className="kp-notice" role="status">
          {notice}
        </p>
        <footer className="kp-footer">
          {l(
            "수치와 기준은 교육용 모의값입니다. 보라색 빛은 플라즈마 상태를 표현합니다.",
            "Values and references are educational simulations. Purple light represents plasma state.",
            "数値と基準は教育用の模擬値です。紫の光はプラズマ状態を表します。"
          )}
        </footer>
      </main>
    </div>
  );
}
