import React, { useId } from "react";
import { tr } from "../lib/productLanguage";
import { motionChannel, type MotionSceneProps } from "./process-motion-types";
import "./judgment-layer-scenes.css";

const mint = "#91e2cb",
  gold = "#ebc07b",
  muted = "#628d79",
  ink = "#b7d4c2";
const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, Number.isFinite(value) ? value : low));
type ReadingProps = {
  x: number;
  y: number;
  label: string;
  value: number;
  selected: boolean;
  accent: string;
  signalId: string;
  onSelect?: () => void;
};
function Reading({
  x,
  y,
  label,
  value,
  selected,
  accent,
  signalId,
  onSelect,
}: ReadingProps) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      className="jl-reading"
      data-signal={signalId}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-pressed={onSelect ? selected : undefined}
      aria-label={onSelect ? `${label} · ${value.toFixed(1)}` : undefined}
      onClick={onSelect}
      onKeyDown={event => {
        if (onSelect && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <rect
        width="211"
        height="49"
        rx="8"
        fill="#122d24"
        stroke={selected ? accent : "#416e58"}
        strokeWidth={selected ? 2 : 1}
      />
      <text x="11" y="18" fill="#b9d3c2" fontSize="10.5">
        {label}
      </text>
      <text
        x="199"
        y="39"
        textAnchor="end"
        fill={accent}
        fontSize="22"
        fontWeight="650"
      >
        {value.toFixed(1)}
      </text>
    </g>
  );
}
function Wave({
  x,
  y,
  width,
  amplitude,
  phase,
  accent,
  ghost = false,
}: {
  x: number;
  y: number;
  width: number;
  amplitude: number;
  phase: number;
  accent: string;
  ghost?: boolean;
}) {
  const points = Array.from(
    { length: 33 },
    (_, i) =>
      `${x + (i * width) / 32},${y + Math.sin(i * 0.61 + phase) * amplitude + Math.sin(i * 1.19 + phase) * amplitude * 0.15}`
  ).join(" ");
  return (
    <polyline
      className={ghost ? "jl-reference-trace" : "jl-value-trace"}
      data-wave-amplitude={amplitude.toFixed(2)}
      points={points}
      fill="none"
      stroke={accent}
      strokeWidth={ghost ? 1.6 : 3.2}
      strokeDasharray={ghost ? "5 5" : undefined}
      strokeLinejoin="round"
      opacity={ghost ? 0.85 : 1}
    />
  );
}

/** Two independent synthetic inspections, drawn from the existing record at this observed time. */
export function JudgmentDepositionScene({
  scene,
  language,
  running,
  variant,
  selectedSignal,
  showReference,
  onSignalChange,
}: MotionSceneProps) {
  const id = `jl-dep-${useId().replace(/:/g, "")}`;
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja),
    accent = variant === "reference" ? gold : mint;
  const film = motionChannel(scene, "film", variant),
    electrical = motionChannel(scene, "electrical", variant);
  const height = clamp(66 + film.delta * 36, 8, 112),
    amplitude = clamp(18 + electrical.delta * 16, 5, 52),
    ghost = variant === "current" && showReference;
  const phase = scene.time * 0.05;
  const select = (signal: string) =>
    variant === "current" && onSignalChange
      ? () => onSignalChange(signal)
      : undefined;
  return (
    <svg
      className="jl-scene jl-deposition"
      viewBox="0 0 480 330"
      role={variant === "current" && onSignalChange ? "group" : "img"}
      aria-labelledby={`${id}-title ${id}-desc`}
      data-running={running}
      data-variant={variant}
      data-time={scene.time}
      data-process="deposition"
    >
      <title id={`${id}-title`}>
        {l(
          "막 검사와 별도 전기적 기록 비교",
          "Compare film and separate electrical records",
          "膜検査と別の電気的記録を比較"
        )}
      </title>
      <desc id={`${id}-desc`}>
        {l(
          "막 높이와 파형은 선택한 가상 검사 지수를 크게 그린 비교 표현입니다. 실제 막 두께나 전기 파형을 재현하지 않으며 두 검사는 별도 자료입니다.",
          "Film height and trace size magnify the selected synthetic indices. They are not measured thickness or electrical waveforms; these are separate inspection records.",
          "膜の高さと波形は選んだ仮想検査指数の拡大表現です。実測の膜厚や電気波形ではなく、二つの検査は別の資料です。"
        )}
      </desc>
      <Reading
        x={20}
        y={10}
        label={l("막 검사 지수", "Film inspection index", "膜検査指数")}
        value={film.value}
        selected={selectedSignal === "film"}
        accent={accent}
        signalId="film"
        onSelect={select("film")}
      />
      <Reading
        x={249}
        y={10}
        label={l(
          "별도 전기적 검사 지수",
          "Separate electrical index",
          "別の電気的検査指数"
        )}
        value={electrical.value}
        selected={selectedSignal === "electrical"}
        accent={accent}
        signalId="electrical"
        onSelect={select("electrical")}
      />
      <rect
        className="jl-observation-frame"
        x="20"
        y="79"
        width="261"
        height="207"
        rx="12"
        fill="#10291f"
        stroke={selectedSignal === "film" ? accent : muted}
        strokeWidth={selectedSignal === "film" ? 2 : 1}
      />
      <rect
        x="295"
        y="79"
        width="165"
        height="207"
        rx="12"
        fill="#10291f"
        stroke={selectedSignal === "electrical" ? accent : muted}
        strokeWidth={selectedSignal === "electrical" ? 2 : 1}
      />
      <text x="150" y="101" textAnchor="middle" fill={ink} fontSize="11">
        {l(
          "증착 결과 · 막 기록 확대",
          "Deposition result · film record",
          "成膜結果・膜記録の拡大"
        )}
      </text>
      <path
        d="M51 132v-13h38v13m117 0v-13h38v13"
        fill="#325d47"
        stroke={ink}
        strokeWidth="2"
      />
      <path
        className="jl-optical-rays"
        d="M69 136l82 42 74-42"
        fill="none"
        stroke={accent}
        strokeWidth="2"
        strokeDasharray="4 6"
        opacity=".55"
      />
      <rect
        x="43"
        y="250"
        width="215"
        height="22"
        fill="#426b53"
        stroke={ink}
      />
      {[259, 266].map(y => (
        <path key={y} d={`M45 ${y}H256`} stroke="#759881" opacity=".5" />
      ))}
      {ghost ? (
        <rect
          x="43"
          y="184"
          width="215"
          height="66"
          fill="none"
          stroke={gold}
          strokeWidth="2"
          strokeDasharray="6 5"
          opacity=".85"
        />
      ) : null}
      <g className="jl-film-layer" data-film-height={height.toFixed(2)}>
        <rect
          x="43"
          y={250 - height}
          width="215"
          height={height}
          fill={accent}
          fillOpacity=".57"
          stroke={accent}
          strokeWidth="2"
        />
        {Array.from({ length: Math.floor(height / 12) }, (_, i) => (
          <path
            key={i}
            d={`M44 ${250 - (i + 1) * 12}H257`}
            stroke="#20624b"
            opacity=".5"
          />
        ))}
      </g>
      <path
        d={`M50 ${250 - height}H250`}
        stroke="#d3f7e5"
        strokeWidth="1.5"
        opacity=".75"
      />
      <text x="149" y="303" textAnchor="middle" fill="#b6d0bd" fontSize="11">
        {l(
          "기판 위의 기록 표현",
          "Record encoding above substrate",
          "基板上の記録表現"
        )}
      </text>
      <text x="378" y="101" textAnchor="middle" fill={ink} fontSize="11">
        {l("별도 검사 자료", "Separate inspection", "別の検査資料")}
      </text>
      <rect
        x="309"
        y="118"
        width="137"
        height="31"
        rx="5"
        fill="#2b513e"
        stroke={muted}
      />
      <path d="M328 149v28m101-28v28" stroke={ink} strokeWidth="3" />
      <path d="M328 177l8 22m93-22-8 22" stroke={gold} strokeWidth="2" />
      <rect
        x="313"
        y="200"
        width="130"
        height="15"
        rx="2"
        fill="#4b7356"
        stroke={ink}
      />
      <path d="M321 203h17m78 0h17" stroke={gold} strokeWidth="4" />
      <rect
        x="307"
        y="222"
        width="140"
        height="51"
        rx="5"
        fill="#0c2219"
        stroke="#3e6650"
      />
      {ghost ? (
        <Wave
          x={314}
          y={247}
          width={126}
          amplitude={18}
          phase={phase}
          accent={gold}
          ghost
        />
      ) : null}
      <Wave
        x={314}
        y={247}
        width={126}
        amplitude={amplitude}
        phase={phase}
        accent={accent}
      />
      <text
        x="378"
        y="303"
        textAnchor="middle"
        fill="#b6d0bd"
        fontSize={language === "en" ? 9.6 : 11}
      >
        {l(
          "이온 주입 결과의 전기적 기록",
          "Implantation-result electrical record",
          "イオン注入結果の電気的記録"
        )}
      </text>
    </svg>
  );
}

/** An intact conductor provides context; the broad waveform is an index encoding, not a fracture. */
export function JudgmentMetalScene({
  scene,
  language,
  running,
  variant,
  selectedSignal,
  showReference,
  onSignalChange,
}: MotionSceneProps) {
  const id = `jl-met-${useId().replace(/:/g, "")}`,
    l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja),
    accent = variant === "reference" ? gold : mint;
  const connection = motionChannel(scene, "connection", variant),
    appearance = motionChannel(scene, "appearance", variant),
    ghost = variant === "current" && showReference;
  const amplitude = clamp(15 + connection.delta * 24, 5, 62),
    stripeWidth = clamp(16 + appearance.delta * 8, 5, 31),
    scan = 36 + (scene.time % 37) * 2.9;
  const select = (signal: string) =>
    variant === "current" && onSignalChange
      ? () => onSignalChange(signal)
      : undefined;
  return (
    <svg
      className="jl-scene jl-metal"
      viewBox="0 0 480 330"
      role={variant === "current" && onSignalChange ? "group" : "img"}
      aria-labelledby={`${id}-title ${id}-desc`}
      data-running={running}
      data-variant={variant}
      data-time={scene.time}
      data-process="metal"
    >
      <title id={`${id}-title`}>
        {l(
          "금속 배선의 연결·외관 기록 비교",
          "Compare interconnect connection and appearance records",
          "金属配線の接続・外観記録を比較"
        )}
      </title>
      <desc id={`${id}-desc`}>
        {l(
          "연결 기록은 확대 파형으로, 외관 기록은 줄무늬 폭으로 표현합니다. 도선은 그대로 연결되어 있으며 실제 단선·치수·전기 파형을 그린 것이 아닙니다.",
          "Connection records use an enlarged trace; appearance records use stripe width. The conductor remains intact. These encodings do not show a real break, dimensions or electrical waveforms.",
          "接続記録は拡大波形、外観記録は縞の幅で表します。導線は接続されたままで、実際の断線・寸法・電気波形を描きません。"
        )}
      </desc>
      <Reading
        x={20}
        y={10}
        label={l(
          "연결 검사 지수",
          "Connection inspection index",
          "接続検査指数"
        )}
        value={connection.value}
        selected={selectedSignal === "connection"}
        accent={accent}
        signalId="connection"
        onSelect={select("connection")}
      />
      <Reading
        x={249}
        y={10}
        label={l(
          "외관 검사 지수",
          "Appearance inspection index",
          "外観検査指数"
        )}
        value={appearance.value}
        selected={selectedSignal === "appearance"}
        accent={accent}
        signalId="appearance"
        onSelect={select("appearance")}
      />
      <rect
        x="20"
        y="79"
        width="261"
        height="207"
        rx="12"
        fill="#10291f"
        stroke={selectedSignal === "connection" ? accent : muted}
        strokeWidth={selectedSignal === "connection" ? 2 : 1}
      />
      <rect
        x="295"
        y="79"
        width="165"
        height="207"
        rx="12"
        fill="#10291f"
        stroke={selectedSignal === "appearance" ? accent : muted}
        strokeWidth={selectedSignal === "appearance" ? 2 : 1}
      />
      <text x="150" y="101" textAnchor="middle" fill={ink} fontSize="11">
        {l(
          "연결 기록 · 파형 크기로 비교",
          "Connection record · trace size",
          "接続記録・波形の大きさで比較"
        )}
      </text>
      <path
        d="M38 178H263M38 139H263M38 216H263"
        stroke="#325640"
        strokeDasharray="3 5"
      />
      {ghost ? (
        <Wave
          x={40}
          y={177}
          width={220}
          amplitude={15}
          phase={scene.time * 0.05}
          accent={gold}
          ghost
        />
      ) : null}
      <Wave
        x={40}
        y={177}
        width={220}
        amplitude={amplitude}
        phase={scene.time * 0.05}
        accent={accent}
      />
      <path
        d="M42 257h55v-18h49v16h53v-18h61"
        fill="none"
        stroke={gold}
        strokeWidth="8"
        strokeLinejoin="round"
      />
      <path
        className="jl-route-flow"
        d="M42 257h55v-18h49v16h53v-18h61"
        fill="none"
        stroke="#fff0bd"
        strokeWidth="2"
        strokeDasharray="5 14"
        opacity=".65"
      />
      <path d="M48 263H254" stroke="#456c52" strokeWidth="8" />
      <text
        x="150"
        y="303"
        textAnchor="middle"
        fill="#b6d0bd"
        fontSize={language === "en" ? 10 : 11}
      >
        {l(
          "배선의 실제 파단을 뜻하지 않아요",
          "The wiring is not shown as broken",
          "実際の配線断線を示しません"
        )}
      </text>
      <text x="378" y="101" textAnchor="middle" fill={ink} fontSize="11">
        {l("별도 외관 기록", "Separate appearance record", "別の外観記録")}
      </text>
      <rect
        x="310"
        y="120"
        width="135"
        height="141"
        rx="7"
        fill="#1e3a2b"
        stroke="#547e60"
      />
      <defs>
        <clipPath id={`${id}-appearance`}>
          <rect x="311" y="121" width="133" height="139" rx="6" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-appearance)`}>
        {[331, 377, 423].map((x, i) => (
          <g key={x}>
            {ghost ? (
              <path
                d={`M${x} 140v32h${i % 2 ? -12 : 12}v69`}
                fill="none"
                stroke={gold}
                strokeWidth="16"
                strokeDasharray="4 4"
                opacity=".7"
              />
            ) : null}
            <path
              className="jl-appearance-stripe"
              data-stripe-width={stripeWidth.toFixed(2)}
              d={`M${x} 140v32h${i % 2 ? -12 : 12}v69`}
              fill="none"
              stroke={accent}
              strokeWidth={stripeWidth}
              opacity=".72"
            />
          </g>
        ))}
        <rect
          className="jl-inspection-light"
          x={310 + (scan % 122)}
          y="121"
          width="12"
          height="139"
          fill="#e5f7c8"
          opacity=".1"
        />
      </g>
      <text
        x="378"
        y="303"
        textAnchor="middle"
        fill="#b6d0bd"
        fontSize={language === "en" ? 9.7 : 11}
      >
        {l(
          "연결 결과와 분리해서 관찰",
          "Observe separately from connection",
          "接続結果と分けて観察"
        )}
      </text>
    </svg>
  );
}

/** The package remains intact; recorded connection differences are displayed in a separate signal ribbon. */
export function JudgmentPackagingScene({
  scene,
  language,
  running,
  variant,
  selectedSignal,
  showReference,
  onSignalChange,
}: MotionSceneProps) {
  const id = `jl-pkg-${useId().replace(/:/g, "")}`,
    l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja),
    accent = variant === "reference" ? gold : mint;
  const connection = motionChannel(scene, "connection", variant),
    appearance = motionChannel(scene, "appearance", variant),
    ghost = variant === "current" && showReference;
  const amplitude = clamp(25 + connection.delta * 16, 5, 54),
    surfaceWidth = clamp(88 + appearance.delta * 22, 52, 122),
    phase = scene.time * 0.055;
  const select = (signal: string) =>
    variant === "current" && onSignalChange
      ? () => onSignalChange(signal)
      : undefined;
  return (
    <svg
      className="jl-scene jl-packaging"
      viewBox="0 0 480 330"
      role={variant === "current" && onSignalChange ? "group" : "img"}
      aria-labelledby={`${id}-title ${id}-desc`}
      data-running={running}
      data-variant={variant}
      data-time={scene.time}
      data-process="packaging"
    >
      <title id={`${id}-title`}>
        {l(
          "패키지의 연결 기록과 외관 기록 관찰",
          "Observe package connection and appearance records",
          "パッケージの接続記録と外観記録を観察"
        )}
      </title>
      <desc id={`${id}-desc`}>
        {l(
          "이어진 본딩 와이어 아래의 신호대는 연결 검사 지수를, 오른쪽 확대창은 별도 외관 지수를 표현합니다. 신호대 변화는 실제 와이어 형상이나 고장 위치를 뜻하지 않습니다.",
          "The signal ribbon below intact bond wires encodes connection indices; the separate window encodes appearance indices. Ribbon changes do not imply actual wire geometry or a fault location.",
          "接続されたボンディングワイヤ下の信号帯は接続検査指数、右の拡大窓は別の外観指数です。信号帯の変化は実際のワイヤ形状や故障位置を示しません。"
        )}
      </desc>
      <Reading
        x={20}
        y={10}
        label={l(
          "연결 검사 지수",
          "Connection inspection index",
          "接続検査指数"
        )}
        value={connection.value}
        selected={selectedSignal === "connection"}
        accent={accent}
        signalId="connection"
        onSelect={select("connection")}
      />
      <Reading
        x={249}
        y={10}
        label={l(
          "외관 검사 지수",
          "Appearance inspection index",
          "外観検査指数"
        )}
        value={appearance.value}
        selected={selectedSignal === "appearance"}
        accent={accent}
        signalId="appearance"
        onSelect={select("appearance")}
      />
      <rect
        x="20"
        y="79"
        width="261"
        height="207"
        rx="12"
        fill="#10291f"
        stroke={selectedSignal === "connection" ? accent : muted}
        strokeWidth={selectedSignal === "connection" ? 2 : 1}
      />
      <rect
        x="295"
        y="79"
        width="165"
        height="207"
        rx="12"
        fill="#10291f"
        stroke={selectedSignal === "appearance" ? accent : muted}
        strokeWidth={selectedSignal === "appearance" ? 2 : 1}
      />
      <text x="150" y="101" textAnchor="middle" fill={ink} fontSize="11">
        {l(
          "와이어 본딩 · 연결 검사 맥락",
          "Wire bonding · connection context",
          "ワイヤ接続・接続検査の背景"
        )}
      </text>
      <path
        d="M41 182v-40q0-13 13-13h193q13 0 13 13v40"
        fill="#264c37"
        fillOpacity=".45"
        stroke="#689476"
        strokeWidth="1.5"
      />
      <rect
        x="37"
        y="181"
        width="226"
        height="13"
        rx="3"
        fill="#486d53"
        stroke={ink}
      />
      <rect
        x="113"
        y="151"
        width="75"
        height="30"
        rx="3"
        fill="#365b43"
        stroke={ink}
      />
      <path d="M120 155h61m-61 10h61" stroke="#6e9276" />
      {[0, 1, 2].map(i => (
        <g key={i}>
          <path
            d={`M${119 + i * 12} 154Q${81 + i * 9} ${105 + i * 10} ${52 + i * 20} 181`}
            fill="none"
            stroke={gold}
            strokeWidth="2.7"
          />
          <path
            d={`M${182 - i * 12} 154Q${220 - i * 9} ${105 + i * 10} ${247 - i * 20} 181`}
            fill="none"
            stroke={gold}
            strokeWidth="2.7"
          />
        </g>
      ))}
      {[52, 72, 92, 207, 227, 247].map(x => (
        <g key={x}>
          <rect x={x - 5} y="178" width="10" height="7" fill={gold} />
          <path d={`M${x} 195v8`} stroke={ink} strokeWidth="5" />
        </g>
      ))}
      <text x="150" y="220" textAnchor="middle" fill="#a9cab6" fontSize="10">
        {l(
          "아래 신호대는 검사 기록의 표현",
          "Signal ribbon encodes the inspection record",
          "下の信号帯は検査記録の表現"
        )}
      </text>
      <path d="M38 252H263" stroke="#355e46" strokeDasharray="3 6" />
      {ghost ? (
        <Wave
          x={39}
          y={252}
          width={222}
          amplitude={25}
          phase={phase}
          accent={gold}
          ghost
        />
      ) : null}
      <Wave
        x={39}
        y={252}
        width={222}
        amplitude={amplitude}
        phase={phase}
        accent={accent}
      />
      <text x="378" y="101" textAnchor="middle" fill={ink} fontSize="11">
        {l("별도 외관 기록", "Separate appearance record", "別の外観記録")}
      </text>
      <rect
        x="307"
        y="119"
        width="141"
        height="143"
        rx="8"
        fill="#1c3929"
        stroke={muted}
      />
      <rect
        x={378 - surfaceWidth / 2}
        y="143"
        width={surfaceWidth}
        height="92"
        rx="7"
        className="jl-package-surface"
        data-surface-width={surfaceWidth.toFixed(2)}
        fill={accent}
        fillOpacity=".28"
        stroke={accent}
        strokeWidth="2"
      />
      {ghost ? (
        <rect
          x="334"
          y="143"
          width="88"
          height="92"
          rx="7"
          fill="none"
          stroke={gold}
          strokeWidth="1.7"
          strokeDasharray="5 5"
        />
      ) : null}
      <path
        d="M326 137v-7h14m76 0h14v7m-104 106v7h14m76 0h14v-7"
        fill="none"
        stroke={gold}
        strokeWidth="1.6"
      />
      <path
        className="jl-surface-scan"
        d={`M316 ${142 + (scene.time % 83)}H440`}
        stroke={accent}
        strokeWidth="2"
        opacity=".6"
      />
      <text
        x="378"
        y="278"
        textAnchor="middle"
        fill="#a9cab6"
        fontSize={language === "en" ? 9.5 : 10}
      >
        {l(
          "같은 패키지의 외관 지수",
          "Appearance index of same package",
          "同じパッケージの外観指数"
        )}
      </text>
      <text x="240" y="310" textAnchor="middle" fill="#b6d0bd" fontSize="11">
        {l(
          "연결과 외관의 변화를 각각 비교해 보세요",
          "Compare connection and appearance separately",
          "接続と外観の変化をそれぞれ比較しましょう"
        )}
      </text>
    </svg>
  );
}

export default function JudgmentLayerScenes(props: MotionSceneProps) {
  return props.scene.processId === "deposition" ? (
    <JudgmentDepositionScene {...props} />
  ) : props.scene.processId === "metal" ? (
    <JudgmentMetalScene {...props} />
  ) : (
    <JudgmentPackagingScene {...props} />
  );
}
