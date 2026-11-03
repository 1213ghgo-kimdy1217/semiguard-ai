import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";
import type { ProductLanguage } from "../lib/productLanguage";
import { tr } from "../lib/productLanguage";
import "./kiyo-equipment-view.css";

type EquipmentView = "exterior" | "cutaway";
export type KiyoSignal =
  | "pressure"
  | "gasFlow"
  | "rfPower"
  | "chamberAmbientTemp";
export type KiyoProcessValues = Record<KiyoSignal, number>;
type Point3 = readonly [number, number, number];
type Point2 = readonly [number, number];
type EquipmentPose = { camera: number; door: number };

const SIGNALS = [
  {
    id: "pressure",
    number: 1,
    color: "#8dc9ec",
    unit: "mTorr",
    name: ["챔버 압력", "Chamber pressure", "チャンバー圧力"],
    meaning: [
      "챔버 내부 공간의 기체 압력입니다. 특정 부품을 뜻하지 않습니다. 가스 공급과 하부 배기가 이루어지는 동안 압력이 어떻게 변하는지, 변화가 언제 시작됐는지 관찰하세요.",
      "Gas pressure in the chamber volume, not a component. Observe how pressure changes while gas enters and is exhausted below, and when the change begins.",
      "特定の部品ではなく、チャンバー内部空間の気体圧力です。ガス供給と下部排気の間に圧力がどう変化するか、変化の開始時点を観察します。",
    ],
    position: [111, 113] as const,
  },
  {
    id: "gasFlow",
    number: 2,
    color: "#9ad6ae",
    unit: "sccm",
    name: ["가스 유량", "Gas flow", "ガス流量"],
    meaning: [
      "상부 유입관과 분배 구멍을 통해 공급되는 가스의 양을 나타냅니다. 유량과 챔버 압력은 서로 다른 값입니다. 압력이 바뀔 때 가스 공급량도 함께 변했는지 비교하세요.",
      "Gas delivery through the upper inlet and distribution holes. Flow and pressure are different quantities. Compare whether gas delivery changes when the chamber pressure changes.",
      "上部流入管と分配穴から供給するガス量です。流量と圧力は異なります。圧力が変化したときにガス供給量も変わったかを比較します。",
    ],
    position: [120, 17] as const,
  },
  {
    id: "rfPower",
    number: 3,
    color: "#cbb3ed",
    unit: "W",
    name: ["RF 전력", "RF power", "RF電力"],
    meaning: [
      "RF 공급 경로와 플라즈마에 에너지가 전달되는 영역의 개념 표시입니다. RF 전력이 유지되는지, 중단됐는지와 그 시점을 관찰하세요. LED 밝기는 RF 전력 측정값이 아닙니다.",
      "A conceptual RF supply path and energy-delivery region for the plasma. Observe whether RF power continues or stops and when it changes. LED brightness is not an RF power measurement.",
      "RF供給経路とプラズマへのエネルギー供給領域の概念表示です。RF電力の継続・停止と変化の時点を観察します。LEDの明るさはRF電力測定ではありません。",
    ],
    position: [22, 104] as const,
  },
  {
    id: "chamberAmbientTemp",
    number: 4,
    color: "#e7c183",
    unit: "°C",
    name: ["챔버 주변 온도", "Chamber-area temperature", "チャンバー周辺温度"],
    meaning: [
      "챔버 외벽 주변 영역의 온도입니다. 웨이퍼 온도나 내부 공정 온도가 아닙니다. 주변 온도가 천천히 올라가거나 유지되는지, 다른 값의 변화와 같은 시점에 움직이는지 살펴보세요.",
      "Temperature around the chamber exterior, not the wafer or internal process temperature. Observe gradual rises or stability, and compare its timing with changes in the other quantities.",
      "チャンバー外壁周辺の温度で、ウェーハや内部プロセスの温度ではありません。緩やかな上昇・安定と、他の値が変化する時点との関係を観察します。",
    ],
    position: [170, 124] as const,
  },
] as const;

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Reprojects model coordinates as the camera moves around the cabinet. */
function camera(progress: number) {
  const yaw = (mix(-28, -90, progress) * Math.PI) / 180;
  const pitch = mix(0.18, 0, progress);
  const zoom = mix(1, 1.82, progress);
  const focus: Point3 = [170 * progress, 8 * progress, 0];
  const project = ([x, y, z]: Point3): Point2 => {
    const dx = x - focus[0],
      dy = y - focus[1],
      dz = z - focus[2];
    const horizontal = dx * Math.cos(yaw) + dz * Math.sin(yaw);
    const depth = -dx * Math.sin(yaw) + dz * Math.cos(yaw);
    return [
      310 + horizontal * zoom,
      230 + (dy * Math.cos(pitch) + depth * Math.sin(pitch)) * zoom,
    ];
  };
  return { project, zoom, yaw: mix(-28, -90, progress), pitch };
}

function polygon(points: Point3[], project: (point: Point3) => Point2) {
  return points.map(point => project(point).join(",")).join(" ");
}

function planeMatrix(
  origin: Point3,
  horizontal: Point3,
  vertical: Point3,
  project: (point: Point3) => Point2
) {
  const a = project(origin),
    b = project(horizontal),
    c = project(vertical);
  return `matrix(${b[0] - a[0]} ${b[1] - a[1]} ${c[0] - a[0]} ${c[1] - a[1]} ${a[0]} ${a[1]})`;
}

/** Native 192 × 208 coordinates match the world-space window without stretching. */
function ChamberInterior({
  active,
  ledOn,
  highlighted,
}: {
  active: boolean;
  ledOn: boolean;
  highlighted: KiyoSignal | null;
}) {
  const pressure = highlighted === "pressure";
  const gas = highlighted === "gasFlow";
  const rf = highlighted === "rfPower";
  const temperature = highlighted === "chamberAmbientTemp";
  return (
    <g
      data-chamber-coordinate-space="192x208"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x="38"
        y="41"
        width="116"
        height="137"
        rx="22"
        fill="#8d9c8f"
        stroke="#bbc7b6"
        strokeWidth="1"
      />
      <rect
        x="48"
        y="51"
        width="96"
        height="117"
        rx="14"
        fill="#1a2d25"
        stroke="#637c68"
        strokeWidth=".8"
      />
      <path
        d="M48 163v5h96v-5"
        fill="#6f8775"
        stroke="#a4b49f"
        strokeWidth=".8"
      />
      <g data-concept-part="gas-inlet">
        <path
          d="M151 17H96v47M68 66h56"
          fill="none"
          stroke={gas ? SIGNALS[1].color : "#9dae9f"}
          strokeWidth={gas ? 3.4 : 2.8}
        />
        {[76, 96, 116].map(x => (
          <circle key={x} cx={x} cy="68" r="1.5" fill="#10281c" />
        ))}
        <g
          fill="none"
          stroke={gas ? SIGNALS[1].color : "#719779"}
          strokeWidth="1"
        >
          {[76, 96, 116].map(x => (
            <path key={x} d={`M${x} 76v9m-3-3 3 3 3-3`} />
          ))}
        </g>
      </g>
      <rect
        x="54"
        y="89"
        width="84"
        height="37"
        rx="9"
        fill={SIGNALS[0].color}
        opacity={pressure ? 0.13 : 0}
      />
      <g data-concept-part="rf-energy-supply">
        <path
          d="M13 104h55"
          fill="none"
          stroke={rf ? SIGNALS[2].color : "#958ca5"}
          strokeWidth={rf ? 2.6 : 1.6}
        />
        <ellipse
          cx="96"
          cy="106"
          rx="29"
          ry="14"
          fill={SIGNALS[2].color}
          opacity={rf ? 0.17 : 0.04}
        />
      </g>
      <rect
        x="72"
        y="103"
        width="48"
        height="7"
        rx="3.5"
        fill={SIGNALS[0].color}
        opacity={active && ledOn ? 0.45 : 0.06}
      />
      <g data-concept-part="wafer-support">
        <rect x="62" y="131" width="68" height="3" rx="1" fill="#dbe4d8" />
        <rect x="69" y="135" width="54" height="10" rx="2" fill="#adbcab" />
        <path d="M88 145h16v23H88z" fill="#7f9785" />
      </g>
      <path
        data-concept-part="exhaust-path"
        d="M133 158h35v32"
        fill="none"
        stroke="#a6b7a7"
        strokeWidth="3"
      />
      <path
        d="M162 95v42"
        fill="none"
        stroke={SIGNALS[3].color}
        strokeWidth="3"
        opacity={temperature ? 0.9 : 0.12}
      />
    </g>
  );
}

/** One cabinet; the camera turns left and zooms into its teaching window. */
export default function KiyoEquipmentView({
  view,
  active,
  ledOn,
  language,
  demo = false,
  processValues = null,
  selectedSignal,
  onSelectSignal,
}: {
  view: EquipmentView;
  active: boolean;
  ledOn: boolean;
  language: ProductLanguage;
  demo?: boolean;
  processValues?: KiyoProcessValues | null;
  selectedSignal?: KiyoSignal | null;
  onSelectSignal?: (signal: KiyoSignal) => void;
}) {
  const id = useId().replace(/:/g, "");
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const inside = view === "cutaway";
  const reduceMotion = useReducedMotion();
  const [pose, setPose] = useState<EquipmentPose>({ camera: 0, door: 0 });
  const poseRef = useRef(pose);
  const progress = pose.camera;
  const doorProgress = pose.door;
  const [localSignal, setLocalSignal] = useState<KiyoSignal>("pressure");
  const selected = selectedSignal ?? localSignal;
  const interiorReady = progress === 1 && doorProgress === 1;
  const interiorVisible = doorProgress > 0;
  const showGuide = demo && inside;
  const showSignals = showGuide && interiorReady;
  const viewPhase = inside
    ? progress < 1
      ? "camera-enter"
      : doorProgress < 1
        ? "cover-opening"
        : "interior"
    : doorProgress > 0
      ? "cover-closing"
      : progress > 0
        ? "camera-exit"
        : "exterior";
  const signal = SIGNALS.find(item => item.id === selected) ?? SIGNALS[0];

  useEffect(() => {
    if (reduceMotion) {
      const next = { camera: inside ? 1 : 0, door: inside ? 1 : 0 };
      poseRef.current = next;
      setPose(next);
      return;
    }
    // Reversal starts from the currently rendered pose, without timers or stale frames.
    const stages: {
      key: keyof EquipmentPose;
      target: number;
      duration: number;
    }[] = inside
      ? [
          { key: "camera", target: 1, duration: 1050 },
          { key: "door", target: 1, duration: 700 },
        ]
      : [
          { key: "door", target: 0, duration: 700 },
          { key: "camera", target: 0, duration: 1050 },
        ];
    let frame = 0;
    let cancelled = false;
    const runStage = (index: number) => {
      if (cancelled || index >= stages.length) return;
      const { key, target, duration: fullDuration } = stages[index];
      const start = poseRef.current[key];
      if (start === target) {
        runStage(index + 1);
        return;
      }
      const started = performance.now();
      const duration = Math.max(1, fullDuration * Math.abs(target - start));
      const tick = (time: number) => {
        if (cancelled) return;
        const elapsed = Math.min(1, Math.max(0, (time - started) / duration));
        const eased =
          elapsed < 0.5 ? 4 * elapsed ** 3 : 1 - (-2 * elapsed + 2) ** 3 / 2;
        const next = {
          ...poseRef.current,
          [key]: elapsed === 1 ? target : mix(start, target, eased),
        };
        poseRef.current = next;
        setPose(next);
        if (elapsed < 1) frame = requestAnimationFrame(tick);
        else runStage(index + 1);
      };
      frame = requestAnimationFrame(tick);
    };
    runStage(0);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [inside, reduceMotion]);

  const { project, zoom, yaw, pitch } = camera(progress);
  const windowPoint = (x: number, y: number): Point3 => [170, -96 + y, 96 - x];
  const sideMatrix = planeMatrix(
    windowPoint(0, 0),
    windowPoint(1, 0),
    windowPoint(0, 1),
    project
  );
  const coverAngle = (doorProgress * 104 * Math.PI) / 180;
  const coverPoint = (x: number, y: number): Point3 => [
    170 + x * Math.sin(coverAngle),
    -96 + y,
    96 - x * Math.cos(coverAngle),
  ];
  const coverMatrix = planeMatrix(
    coverPoint(0, 0),
    coverPoint(1, 0),
    coverPoint(0, 1),
    project
  );
  const frontMatrix = planeMatrix(
    [-170, -150, 120],
    [-169, -150, 120],
    [-170, -149, 120],
    project
  );
  const select = (next: KiyoSignal) => {
    setLocalSignal(next);
    onSelectSignal?.(next);
  };
  const valueLabel = (key: KiyoSignal) => {
    const value = processValues?.[key];
    return typeof value === "number" && Number.isFinite(value)
      ? value.toFixed(key === "rfPower" ? 0 : 1)
      : "—";
  };

  return (
    <div
      className="kev-equipment"
      data-equipment-view={view}
      data-view-phase={viewPhase}
      data-door-progress={doorProgress.toFixed(3)}
      data-interior-visible={String(interiorVisible)}
      data-interior-ready={String(interiorReady)}
    >
      <div className="kev-scene">
        <svg
          className={`kp-equipment-svg kev-svg kp-equipment-${view}`}
          viewBox="0 0 620 460"
          role="img"
          aria-labelledby={`${id}-title ${id}-description`}
          data-camera-yaw={yaw.toFixed(1)}
          data-camera-zoom={zoom.toFixed(2)}
          data-camera-progress={progress.toFixed(3)}
          data-camera-pitch={pitch.toFixed(3)}
          data-view-phase={viewPhase}
          data-door-progress={doorProgress.toFixed(3)}
          data-interior-visible={String(interiorVisible)}
          data-interior-ready={String(interiorReady)}
        >
          <title id={`${id}-title`}>
            {inside
              ? l(
                  "교육용 내부 관찰창 확대",
                  "Educational chamber window close-up",
                  "教育用内部観察窓の拡大"
                )
              : l(
                  "Kiyo 기반 장비 모형 외관",
                  "Kiyo-inspired model exterior",
                  "Kiyoを参考にした装置模型の外観"
                )}
          </title>
          <desc id={`${id}-description`}>
            {l(
              "하나의 캐비닛 앞면에는 로드포트 세 개가 있습니다. 내부보기는 장비를 왼쪽으로 돌리며 옆 관찰창을 확대합니다. 내부 배치는 교육용 개념이며 실제 Kiyo 내부 구조와 위치를 복제한 것이 아닙니다. LED는 상태 표현이며 공정값 측정이 아닙니다.",
              "One cabinet has three front load ports. The interior view rotates left and zooms toward the side window. The educational layout does not reproduce actual Kiyo internals. The LED represents state, not a process measurement.",
              "1つのキャビネット前面に3つのロードポートがあります。内部表示は左へ回転し側面窓へズームします。教育用配置であり実際のKiyo内部の再現ではありません。LEDは状態表示で測定ではありません。"
            )}
          </desc>
          <defs>
            <linearGradient id={`${id}-cream`} x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#eeeee1" />
              <stop offset="1" stopColor="#d6d9c8" />
            </linearGradient>
            <linearGradient id={`${id}-side`}>
              <stop stopColor="#9cab95" />
              <stop offset="1" stopColor="#c5cfb8" />
            </linearGradient>
            <clipPath id={`${id}-window`}>
              <rect width="192" height="208" rx="5" />
            </clipPath>
          </defs>
          <ellipse
            cx="310"
            cy="413"
            rx="236"
            ry="18"
            fill="#07130d"
            opacity={mix(0.3, 0.08, progress)}
          />
          <polygon
            points={polygon(
              [
                [-170, -150, 120],
                [170, -150, 120],
                [170, -150, -120],
                [-170, -150, -120],
              ],
              project
            )}
            fill="#e8ecdd"
            stroke="#a8b3a1"
          />
          <polygon
            points={polygon(
              [
                [170, -150, 120],
                [170, -150, -120],
                [170, 150, -120],
                [170, 150, 120],
              ],
              project
            )}
            fill={`url(#${id}-side)`}
            stroke="#8f9f89"
          />
          <g
            transform={sideMatrix}
            data-side-window-plane="true"
            data-native-width="192"
            data-native-height="208"
          >
            <rect
              width="192"
              height="208"
              rx="5"
              fill="#12261b"
              stroke="#b2c5a5"
              strokeWidth="1.5"
            />
            <g
              clipPath={`url(#${id}-window)`}
              visibility={interiorVisible ? "visible" : "hidden"}
            >
              <ChamberInterior
                active={active}
                ledOn={ledOn}
                highlighted={showSignals ? selected : null}
              />
            </g>
            <path d="M0 40v17m0 101v17" stroke="#8ea487" strokeWidth="3" />
          </g>
          <g transform={frontMatrix}>
            <rect
              width="340"
              height="300"
              rx="2"
              fill={`url(#${id}-cream)`}
              stroke="#a6b49f"
            />
            <path
              d="M0 125h340M102 125v175M0 219h102"
              fill="none"
              stroke="#a8b69f"
            />
            <text
              x="180"
              y="56"
              fill="#71846b"
              textAnchor="middle"
              fontSize="19"
              letterSpacing="3"
            >
              SemiGuard
            </text>
            <path d="M119 72h122" stroke="#bbc5b1" />
            <rect
              x="21"
              y="142"
              width="66"
              height="44"
              fill="#223b35"
              stroke="#6d816a"
            />
            <path
              d="M28 152h32m-32 7h48m-48 7h23"
              stroke="#749385"
              opacity=".6"
            />
            <rect x="20" y="130" width="34" height="6" fill="#7c9076" />
            <circle cx="31" cy="203" r="10" fill="#b9a94b" stroke="#8d914d" />
            <circle cx="31" cy="203" r="6.5" fill="#a84433" stroke="#be6a4a" />
            <path d="M50 197h28m-28 6h22m-22 6h28" stroke="#85997c" />
            <rect
              x="14"
              y="232"
              width="74"
              height="53"
              fill="none"
              stroke="#a7b49b"
            />
            <path d="M76 242v9" stroke="#7b8e73" strokeWidth="3" />
            {[0, 1, 2].map(port => (
              <g key={port} transform={`translate(${port * 72} 0)`}>
                <rect
                  x="114"
                  y="142"
                  width="61"
                  height="66"
                  rx="2"
                  fill="#a7b5a2"
                  stroke="#859a7d"
                />
                <rect
                  x="120"
                  y="149"
                  width="49"
                  height="52"
                  rx="4"
                  fill="#e0e3d5"
                  stroke="#91a486"
                />
                <circle cx="129" cy="162" r="3" fill="#426d71" />
                <circle cx="160" cy="189" r="3" fill="#426d71" />
                <rect x="126" y="132" width="12" height="4" fill="#84957b" />
                <path
                  d="m109 217 8-10h59l8 10z"
                  fill="#23322a"
                  stroke="#435b44"
                />
                <rect
                  x="109"
                  y="217"
                  width="75"
                  height="8"
                  fill="#101c16"
                  stroke="#3d523b"
                />
                <rect
                  x="114"
                  y="228"
                  width="65"
                  height="72"
                  fill={`url(#${id}-cream)`}
                  stroke="#91a183"
                />
                <path d="M122 275h48m-48 5h48m-48 5h48" stroke="#bbc7af" />
                <text
                  x="146"
                  y="250"
                  textAnchor="middle"
                  fill="#6a8063"
                  fontSize="9"
                  letterSpacing="1"
                >
                  LP {port + 1}
                </text>
              </g>
            ))}
            <path d="M4 302h332v8H4z" fill="#6b8260" />
            <path d="M17 310v8m305-8v8" stroke="#263a29" strokeWidth="8" />
            <path d="M328 0v-30" stroke="#738369" strokeWidth="3" />
            <rect
              x="323"
              y="-53"
              width="10"
              height="23"
              rx="2"
              fill="#829078"
              stroke="#82967a"
            />
            <path d="M323-46h10m-10 8h10" stroke="#576f50" />
          </g>
          <g
            transform={coverMatrix}
            data-observation-cover="true"
            data-cover-angle={(doorProgress * 104).toFixed(1)}
            aria-hidden="true"
          >
            <rect
              width="192"
              height="208"
              rx="5"
              fill={doorProgress > 90 / 104 ? "#94a58e" : "#afbea6"}
              stroke="#8da481"
              strokeWidth="1.5"
            />
            <path
              d="M18 24h156M18 184h156"
              stroke="#8fa285"
              strokeWidth=".8"
              opacity=".55"
            />
            {doorProgress < 90 / 104 ? (
              <path d="M166 94v20" stroke="#5f7858" strokeWidth="4" />
            ) : null}
          </g>
          {showSignals ? (
            <g className="kev-screen-markers">
              {SIGNALS.map(item => {
                const [x, y] = project(
                  windowPoint(item.position[0], item.position[1])
                );
                return (
                  <g key={item.id} data-signal-marker={item.id}>
                    <circle
                      cx={x}
                      cy={y}
                      r={selected === item.id ? 13 : 10}
                      fill="#14231c"
                      stroke={item.color}
                      strokeWidth={selected === item.id ? 3 : 2}
                    />
                    <text
                      x={x}
                      y={y + 4}
                      textAnchor="middle"
                      fill={item.color}
                      fontSize="12"
                      fontWeight="700"
                    >
                      {item.number}
                    </text>
                  </g>
                );
              })}
            </g>
          ) : null}
        </svg>
      </div>
      {showGuide ? (
        <div
          className="kev-signal-guide"
          data-ready={String(interiorReady)}
          aria-hidden={!interiorReady}
          inert={!interiorReady}
        >
          <div
            className="kev-signal-options"
            aria-label={l(
              "공정값 위치 선택",
              "Choose a process quantity",
              "プロセス値の位置選択"
            )}
          >
            {SIGNALS.map(item => (
              <button
                key={item.id}
                type="button"
                className="kev-signal-option"
                aria-pressed={selected === item.id}
                disabled={!interiorReady}
                onClick={() => select(item.id)}
                style={{ "--kev-signal": item.color } as CSSProperties}
              >
                <span className="kev-signal-number" aria-hidden="true">
                  {item.number}
                </span>
                <span className="kev-signal-name">
                  {l(item.name[0], item.name[1], item.name[2])}
                </span>
                <span className="kev-signal-value">
                  {valueLabel(item.id)} <small>{item.unit}</small>
                </span>
              </button>
            ))}
          </div>
          <div
            className="kev-signal-detail"
            style={{ "--kev-signal": signal.color } as CSSProperties}
            aria-live="polite"
          >
            <p className="kev-signal-detail-title">
              {signal.number}.{" "}
              {l(signal.name[0], signal.name[1], signal.name[2])} ·{" "}
              {l("관찰 포인트", "What to observe", "観察ポイント")}
            </p>
            <p className="kev-signal-meaning">
              {l(signal.meaning[0], signal.meaning[1], signal.meaning[2])}
            </p>
          </div>
          <p className="kev-signal-disclaimer">
            {l(
              "위치와 값은 교육용 모의 표현입니다. 실제 Kiyo 센서의 설치 위치·운전 기준을 뜻하지 않습니다.",
              "Positions and values are educational illustrations, not actual Kiyo sensor locations or operating specifications.",
              "位置と値は教育用の模擬表示であり、実際のKiyoセンサー配置や運転基準ではありません。"
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}
