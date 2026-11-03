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
    position: [59, 112] as const,
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
    position: [59, 30] as const,
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
    position: [17, 100] as const,
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
    position: [105, 141] as const,
  },
] as const;

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Reprojects model coordinates as the camera moves around the cabinet. */
function camera(progress: number) {
  const yaw = (mix(-28, -90, progress) * Math.PI) / 180;
  const pitch = mix(0.18, 0, progress);
  const zoom = mix(1, 2, progress);
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
  return { project, zoom, yaw: mix(-28, -90, progress) };
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
  const [progress, setProgress] = useState(inside ? 1 : 0);
  const progressRef = useRef(progress);
  const [localSignal, setLocalSignal] = useState<KiyoSignal>("pressure");
  const selected = selectedSignal ?? localSignal;
  const showSignals = demo && inside;
  const signal = SIGNALS.find(item => item.id === selected) ?? SIGNALS[0];

  useEffect(() => {
    const target = inside ? 1 : 0;
    if (reduceMotion) {
      progressRef.current = target;
      setProgress(target);
      return;
    }
    const start = progressRef.current;
    if (start === target) return;
    const started = performance.now();
    let frame = 0;
    const tick = (time: number) => {
      const elapsed = Math.min(1, (time - started) / 1050);
      const eased =
        elapsed < 0.5 ? 4 * elapsed ** 3 : 1 - (-2 * elapsed + 2) ** 3 / 2;
      const next = mix(start, target, eased);
      progressRef.current = next;
      setProgress(next);
      if (elapsed < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inside, reduceMotion]);

  const { project, zoom, yaw } = camera(progress);
  const windowPoint = (x: number, y: number): Point3 => [
    170,
    -96 + y,
    96 - (192 * x) / 118,
  ];
  const sideMatrix = planeMatrix(
    windowPoint(0, 0),
    windowPoint(1, 0),
    windowPoint(0, 1),
    project
  );
  const frontMatrix = planeMatrix(
    [-170, -150, 120],
    [-169, -150, 120],
    [-170, -149, 120],
    project
  );
  const chosenPoint = project(
    windowPoint(signal.position[0], signal.position[1])
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
    <div className="kev-equipment" data-equipment-view={view}>
      <div className="kev-scene">
        <svg
          className={`kp-equipment-svg kev-svg kp-equipment-${view}`}
          viewBox="0 0 620 460"
          role="img"
          aria-labelledby={`${id}-title ${id}-description`}
          data-camera-yaw={yaw.toFixed(1)}
          data-camera-zoom={zoom.toFixed(2)}
          data-camera-progress={progress.toFixed(3)}
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
            <linearGradient id={`${id}-vessel`}>
              <stop stopColor="#819b86" />
              <stop offset=".4" stopColor="#d2dfcd" />
              <stop offset="1" stopColor="#8da58c" />
            </linearGradient>
            <clipPath id={`${id}-window`}>
              <rect width="118" height="208" rx="3" />
            </clipPath>
            <pattern
              id={`${id}-wall-section`}
              width="5"
              height="5"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M-1 1 1-1m-1 6 6-6m-1 6 2-2"
                stroke="#657d62"
                strokeWidth=".7"
              />
            </pattern>
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
          <g transform={sideMatrix} data-side-window-plane="true">
            <rect
              width="118"
              height="208"
              rx="3"
              fill={inside ? "#12261b" : "#afbea6"}
              stroke="#b2c5a5"
              strokeWidth="2.5"
            />
            {inside ? (
              <g clipPath={`url(#${id}-window)`}>
                <path
                  d="M16 186V58c0-18 21-28 43-28s43 10 43 28v128z"
                  fill={`url(#${id}-vessel)`}
                  stroke="#a0ba96"
                  strokeWidth="2"
                />
                <path
                  d="M25 184V65c0-12 17-21 34-21s34 9 34 21v119z"
                  fill="#203a27"
                  stroke="#8da680"
                />
                <path
                  d="M16 186V58c0-18 21-28 43-28s43 10 43 28v128zM25 178V65c0-12 17-21 34-21s34 9 34 21v113z"
                  fill={`url(#${id}-wall-section)`}
                  fillRule="evenodd"
                  opacity=".85"
                />
                <path
                  d="M25 177h68v7H25z"
                  fill="#a5b49b"
                  stroke="#6b8664"
                  strokeWidth="1"
                />
                <path d="M30 180h58" stroke="#69865e" strokeWidth=".6" />
                {[42, 76].map(x => (
                  <circle
                    key={x}
                    cx={x}
                    cy="38"
                    r="1.9"
                    fill="#5f785d"
                    stroke="#d5dfc8"
                    strokeWidth=".7"
                  />
                ))}
                <path
                  d="M59 59V10h31"
                  fill="none"
                  stroke={
                    showSignals && selected === "gasFlow"
                      ? SIGNALS[1].color
                      : "#bdd0ac"
                  }
                  strokeWidth="7"
                />
                <path
                  d="M59 59V10h31"
                  fill="none"
                  stroke="#466448"
                  strokeWidth="3"
                />
                <path
                  d="M29 61h60"
                  stroke={
                    showSignals && selected === "gasFlow"
                      ? SIGNALS[1].color
                      : "#b6cfa7"
                  }
                  strokeWidth="6"
                />
                {[34, 44, 54, 64, 74, 84].map(x => (
                  <circle key={x} cx={x} cy="64" r="1.4" fill="#132e21" />
                ))}
                <g
                  fill="none"
                  stroke={
                    showSignals && selected === "gasFlow"
                      ? SIGNALS[1].color
                      : "#83a87a"
                  }
                  strokeWidth="1.2"
                  strokeLinecap="round"
                >
                  <path d="M59 16v12m-3-4 3 4 3-4" />
                  {[36, 59, 82].map(x => (
                    <path key={x} d={`M${x} 70v13m-3-4 3 4 3-4`} />
                  ))}
                </g>
                <g data-concept-part="rf-energy-supply">
                  <rect
                    x="2"
                    y="90"
                    width="12"
                    height="22"
                    rx="2"
                    fill="#28332b"
                    stroke={
                      showSignals && selected === "rfPower"
                        ? SIGNALS[2].color
                        : "#a59cba"
                    }
                    strokeWidth="1"
                  />
                  <path
                    d="M4 101q2-8 4 0t4 0"
                    fill="none"
                    stroke="#bba9d3"
                    strokeWidth="1"
                  />
                  <path
                    d="M14 101h14l5-4 5 8 5-8 5 8 5-4h19"
                    fill="none"
                    stroke={
                      showSignals && selected === "rfPower"
                        ? SIGNALS[2].color
                        : "#9a8eaf"
                    }
                    strokeWidth={
                      showSignals && selected === "rfPower" ? 2.6 : 1.4
                    }
                  />
                  <path
                    d="m69 98 5 3-5 3"
                    fill="none"
                    stroke={
                      showSignals && selected === "rfPower"
                        ? SIGNALS[2].color
                        : "#9a8eaf"
                    }
                    strokeWidth="1.2"
                  />
                  <ellipse
                    cx="59"
                    cy="111"
                    rx="31"
                    ry="18"
                    fill="none"
                    stroke={
                      showSignals && selected === "rfPower"
                        ? SIGNALS[2].color
                        : "#7d758e"
                    }
                    strokeWidth={
                      showSignals && selected === "rfPower" ? 1.6 : 0.6
                    }
                    opacity={showSignals && selected === "rfPower" ? 0.9 : 0.35}
                  />
                </g>
                <ellipse
                  cx="59"
                  cy="112"
                  rx="30"
                  ry="25"
                  fill={
                    showSignals && selected === "pressure"
                      ? SIGNALS[0].color
                      : "transparent"
                  }
                  opacity=".18"
                />
                <ellipse
                  cx="59"
                  cy="113"
                  rx="30"
                  ry="15"
                  fill={active && ledOn ? "#79cce2" : "#4c7464"}
                  opacity={active && ledOn ? ".42" : ".08"}
                />
                <path
                  d="M33 111h52m-45-7h38m-31 15h24"
                  stroke={active && ledOn ? "#a7e4ed" : "#648666"}
                  strokeWidth="1.6"
                  opacity={active && ledOn ? ".9" : ".2"}
                />
                <ellipse
                  cx="59"
                  cy="136"
                  rx="31"
                  ry="2.8"
                  fill="#91c6cb"
                  stroke="#d6eff0"
                  strokeWidth=".8"
                />
                <path
                  d="M28 136v2.2c0 3.7 62 3.7 62 0V136"
                  fill="#447981"
                  stroke="#b8d6d4"
                  strokeWidth=".6"
                />
                <path
                  d="M30 143v8c0 8 58 8 58 0v-8z"
                  fill="#9fb59a"
                  stroke="#789770"
                />
                <ellipse
                  cx="59"
                  cy="143"
                  rx="29"
                  ry="4"
                  fill="#c1cbb3"
                  stroke="#738c69"
                />
                <path d="M49 158h20v19H49z" fill="#b2c2a2" stroke="#7c9c6e" />
                <path
                  d="M52 161h14m-14 4h14m-14 4h14"
                  stroke="#839976"
                  strokeWidth=".7"
                />
                <path
                  d="M82 168h27v24H87"
                  fill="none"
                  stroke="#a2bc94"
                  strokeWidth="7"
                />
                <path
                  d="M82 168h27v24H87"
                  fill="none"
                  stroke="#476b40"
                  strokeWidth="3"
                />
                <g
                  data-concept-part="exhaust-path"
                  fill="none"
                  stroke="#85b6ac"
                  strokeWidth="1.1"
                >
                  <path d="M84 168h16m-4-3 4 3-4 3M109 186v5m0 1H90m4-3-4 3 4 3" />
                  <path
                    d="M105 176l8 7v-7l-8 7z"
                    fill="#5b806c"
                    stroke="#c2d5ba"
                  />
                </g>
                {showSignals && selected === "chamberAmbientTemp" ? (
                  <path
                    d="M105 91v77"
                    stroke={SIGNALS[3].color}
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                ) : null}
                <path
                  d="M108 106q-3 4 0 8t0 8m5-8q-3 4 0 8t0 8"
                  fill="none"
                  stroke={
                    showSignals && selected === "chamberAmbientTemp"
                      ? SIGNALS[3].color
                      : "#93a183"
                  }
                  strokeWidth="1"
                />
                <path d="M10 191h98" stroke="#6f8e65" strokeWidth="4" />
              </g>
            ) : (
              <>
                <path d="M12 24h94M12 184h94" stroke="#9baf8d" />
                <path d="M18 91v18" stroke="#6e8662" strokeWidth="4" />
              </>
            )}
            {[7, 111].flatMap(x =>
              [7, 201].map(y => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r="2" fill="#d4dec7" />
              ))
            )}
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
              <path
                d={`M${chosenPoint[0]} ${chosenPoint[1]} L${Math.min(520, Math.max(100, chosenPoint[0]))} 54 L26 54`}
                fill="none"
                stroke={signal.color}
                strokeWidth="1.3"
                opacity=".75"
              />
              <rect
                x="18"
                y="19"
                width="280"
                height="35"
                rx="4"
                fill="#122019"
                stroke="#52634d"
              />
              <text
                x="29"
                y="41"
                fill={signal.color}
                fontSize="13"
                fontWeight="600"
              >
                {signal.number}.{" "}
                {l(signal.name[0], signal.name[1], signal.name[2])}
              </text>
            </g>
          ) : null}
        </svg>
      </div>
      {showSignals ? (
        <div className="kev-signal-guide">
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
