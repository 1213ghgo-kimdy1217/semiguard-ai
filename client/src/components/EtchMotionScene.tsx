import React, { useId, type CSSProperties } from "react";
import { tr } from "../lib/productLanguage";
import { motionChannel, type MotionSceneProps } from "./process-motion-types";
import "./etch-motion-scene.css";

const paths = [
  "M240 21V91C240 107 183 108 132 131C95 148 130 186 226 192C306 197 342 176 397 175H453V264",
  "M240 21V91C241 111 213 119 159 142C121 159 168 187 253 180C316 174 354 169 397 175H453V264",
  "M240 21V91C241 112 257 124 288 131C344 145 357 158 329 175C310 187 356 188 397 175H453V264",
  "M240 21V91C239 113 307 111 351 137C385 157 337 192 274 198C330 207 367 180 397 175H453V264",
];
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
const fraction = (value: number) => ((value % 1) + 1) % 1;

function Reading({
  x,
  y,
  label,
  value,
  selected,
  accent,
  width = 133,
  onSelect,
}: {
  x: number;
  y: number;
  label: string;
  value: number;
  selected: boolean;
  accent: string;
  width?: number;
  onSelect?: () => void;
}) {
  return (
    <g
      className={`em-reading${selected ? " em-reading--selected" : ""}`}
      transform={`translate(${x} ${y})`}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={onSelect ? label : undefined}
      aria-pressed={onSelect ? selected : undefined}
      onClick={onSelect}
      onKeyDown={event => {
        if (onSelect && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <rect
        width={width}
        height="43"
        rx="9"
        fill="#102824"
        stroke={selected ? accent : "#48746a"}
        strokeWidth={selected ? 2 : 1}
      />
      <text x="10" y="15" fill="#b9d4c9" fontSize="11" fontWeight="500">
        {label}
      </text>
      <text
        x={width - 10}
        y="34"
        textAnchor="end"
        fill={selected ? accent : "#e4f0e9"}
        fontSize="21"
        fontWeight="650"
        className="em-number"
      >
        {value.toFixed(1)}
      </text>
    </g>
  );
}

/** The moving field is a visual encoding of existing indices, not a plasma model. */
export default function EtchMotionScene({
  scene,
  language,
  running,
  variant,
  selectedSignal,
  showReference,
  onSignalChange,
}: MotionSceneProps) {
  const id = `em-${useId().replace(/:/g, "")}`;
  const pressure = motionChannel(scene, "pressure", variant);
  const flow = motionChannel(scene, "flow", variant);
  const rf = motionChannel(scene, "rf", variant);
  const temperature = motionChannel(scene, "temperature", variant);
  const accent = variant === "reference" ? "#e9bf79" : "#8bdfcb";
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const baseCount = Math.round(
    18 + clamp((pressure.reference - 80) * 0.15, 0, 4)
  );
  const particleCount = Math.round(
    clamp(baseCount + pressure.delta * 12, 8, 45)
  );
  const flowRatio = clamp(flow.value / Math.max(1, flow.reference), 0.75, 1.3);
  const duration = 5.8 / flowRatio;
  const power = clamp(rf.value / 120, 0.2, 1);
  const cloudOpacity = clamp(
    0.1 + pressure.delta * 0.075 + power * 0.055,
    0.06,
    0.32
  );
  const heatOpacity = clamp(temperature.value / 130, 0.2, 0.85);
  const ghost = variant === "current" && showReference;

  function particles(count: number, reference = false) {
    const ratio = reference ? 1 : flowRatio;
    const particleDuration = reference ? 5.8 : duration;
    return Array.from({ length: count }, (_, index) => {
      const progress =
        fraction(index * 0.61803398875 + (scene.time * ratio) / 19) * 100;
      const style = {
        offsetPath: `path("${paths[index % paths.length]}")`,
        "--em-progress": `${progress}%`,
        "--em-delay": `${(-progress / 100) * particleDuration}s`,
        "--em-duration": `${particleDuration}s`,
      } as CSSProperties;
      return (
        <circle
          key={`${reference ? "reference" : "record"}-${index}`}
          className={`em-gas-particle${reference ? " em-reference-particle" : ""}`}
          cx="0"
          cy="0"
          r={reference ? 3.1 : 2.4 + (index % 3) * 0.42}
          fill={reference ? "none" : accent}
          stroke={reference ? "#e9bf79" : "none"}
          strokeWidth={reference ? 1.2 : undefined}
          style={style}
          opacity={reference ? 0.52 : 0.58 + (index % 3) * 0.16}
        />
      );
    });
  }

  return (
    <svg
      className="em-scene"
      viewBox="0 0 480 330"
      role={onSignalChange && variant === "current" ? "group" : "img"}
      aria-labelledby={`${id}-title ${id}-desc`}
      data-running={running ? "true" : "false"}
      data-variant={variant}
      data-time={scene.time}
      data-particle-count={particleCount}
    >
      <title id={`${id}-title`}>
        {l(
          "가스와 RF 흐름으로 살펴보는 식각 챔버",
          "Etch chamber with gas and RF flow",
          "ガスとRFの流れを見るエッチングチャンバー"
        )}
      </title>
      <desc id={`${id}-desc`}>
        {l(
          "입자 수와 흐름, 빛의 강도는 가상 관측 지수를 비교하기 위한 표현입니다. 실제 플라즈마·공정 속도·고장 위치를 계산하지 않습니다.",
          "Particle count, flow and light encode synthetic observation indices for comparison. They do not calculate plasma, process rates or fault locations.",
          "粒子数・流れ・光は仮想観測指数を比較する表現です。実際のプラズマ・工程速度・故障位置を計算しません。"
        )}
      </desc>
      <defs>
        <clipPath id={`${id}-chamber`}>
          <rect x="94" y="79" width="293" height="185" rx="19" />
        </clipPath>
      </defs>

      {/* A compact flat illustration deliberately fills the panel. */}
      <path
        d="M24 22H240V63"
        fill="none"
        stroke="#456f63"
        strokeWidth="15"
        strokeLinejoin="round"
      />
      <path
        d="M24 22H240V63"
        fill="none"
        stroke={accent}
        strokeWidth="4"
        opacity={selectedSignal === "flow" ? 0.75 : 0.35}
      />
      <path
        className="em-inlet-stream"
        d="M24 22H240V63"
        fill="none"
        stroke={accent}
        strokeWidth="3"
        strokeDasharray="4 15"
        strokeDashoffset={-scene.time * 3}
      />
      <path
        d="M395 175H453V264"
        fill="none"
        stroke="#456f63"
        strokeWidth="15"
        strokeLinejoin="round"
      />
      <path
        className="em-outlet-stream"
        d="M395 175H453V264"
        fill="none"
        stroke={accent}
        strokeWidth="3"
        strokeDasharray="4 15"
        strokeDashoffset={-scene.time * 3}
      />
      <rect
        x="84"
        y="62"
        width="313"
        height="218"
        rx="29"
        fill="#173b33"
        stroke="#8fbdae"
        strokeWidth="2.8"
      />
      <rect
        x="94"
        y="79"
        width="293"
        height="185"
        rx="19"
        fill="#0d2522"
        stroke="#365f52"
        strokeWidth="1"
      />
      <path d="M99 73H382" stroke="#a5d0bd" strokeWidth="2" opacity=".5" />
      <path
        d="M126 84H355"
        stroke="#71a690"
        strokeWidth="9"
        strokeLinecap="round"
      />
      {[145, 177, 209, 241, 273, 305, 337].map(x => (
        <path
          key={x}
          className="em-gas-jet"
          d={`M${x} 91v17`}
          stroke={accent}
          strokeWidth="2"
          strokeDasharray="3 6"
          opacity=".5"
        />
      ))}

      <g clipPath={`url(#${id}-chamber)`}>
        <path
          className="em-plasma-cloud"
          d="M111 157C123 112 184 108 238 117C300 97 365 122 372 161C363 197 294 213 241 197C183 214 120 200 111 157Z"
          fill={accent}
          opacity={cloudOpacity}
        />
        <path
          className="em-plasma-ribbon em-plasma-ribbon--one"
          d="M111 154Q174 123 239 155T373 150"
          fill="none"
          stroke={accent}
          strokeWidth={selectedSignal === "rf" ? 5 : 3}
          opacity={0.15 + power * 0.2}
        />
        <path
          className="em-plasma-ribbon em-plasma-ribbon--two"
          d="M113 178Q178 148 244 177T373 175"
          fill="none"
          stroke={accent}
          strokeWidth="2"
          opacity={0.12 + power * 0.17}
        />
        {ghost ? (
          <path
            className="em-plasma-cloud em-reference-cloud"
            d="M111 157C123 112 184 108 238 117C300 97 365 122 372 161C363 197 294 213 241 197C183 214 120 200 111 157Z"
            fill="none"
            stroke="#e9bf79"
            strokeDasharray="4 7"
            strokeWidth="1.3"
            opacity=".5"
          />
        ) : null}
      </g>

      {/* Incoming particles spread through the chamber and leave via the exhaust. */}
      <g className="em-particle-field" aria-hidden="true">
        {ghost ? particles(baseCount, true) : null}
        {particles(particleCount)}
      </g>

      {/* The unchanged wafer is the process context, not an inferred etch result. */}
      <path
        d="M141 223H338V231H141Z"
        fill="#92c6b3"
        stroke="#b7e0cc"
        strokeWidth="1.2"
      />
      <path d="M139 222H340" stroke={accent} strokeWidth="2" />
      <path
        d="M133 234H347V246H133Z"
        fill="#355e50"
        stroke="#92bda6"
        strokeWidth="1.2"
      />
      <path d="M154 247H326V255H154Z" fill="#22453b" stroke="#5f8a75" />
      <path
        className="em-heat-band"
        d="M159 259h17l7-4 12 8 12-8 12 8 12-8 12 8 12-8 12 8 12-8 12 8 12-8 8 4h16"
        fill="none"
        stroke={accent}
        strokeWidth={selectedSignal === "temperature" ? 3 : 2}
        opacity={heatOpacity}
      />
      <path d="M181 281v12m117-12v12" stroke="#729f8a" strokeWidth="5" />
      <text x="240" y="215" textAnchor="middle" fill="#a9c6b8" fontSize="12">
        {l("웨이퍼", "Wafer", "ウェーハ")}
      </text>

      <rect
        x="11"
        y="202"
        width="65"
        height="70"
        rx="12"
        fill="#23483d"
        stroke={selectedSignal === "rf" ? accent : "#729e89"}
        strokeWidth="1.5"
      />
      <text
        x="43"
        y="221"
        textAnchor="middle"
        fill="#c0daca"
        fontSize="13"
        fontWeight="650"
      >
        RF
      </text>
      <path
        className="em-rf-wave"
        d="M19 239q6-17 12 0t12 0t12 0t12 0"
        fill="none"
        stroke={accent}
        strokeWidth="2.3"
        strokeDasharray="54 10"
      />
      <path
        d="M77 238H98V243H132"
        fill="none"
        stroke={accent}
        strokeWidth="3"
      />
      <circle
        cx="453"
        cy="275"
        r="17"
        fill="#21473a"
        stroke="#709d84"
        strokeWidth="1.4"
      />
      <path
        className="em-exhaust-rotor"
        d="M453 262v26m-13-13h26"
        stroke={accent}
        strokeWidth="2"
      />

      <Reading
        x={105}
        y={103}
        width={128}
        label={l("챔버 압력", "Pressure", "チャンバー圧力")}
        value={pressure.value}
        selected={selectedSignal === "pressure"}
        onSelect={
          variant === "current" && onSignalChange
            ? () => onSignalChange("pressure")
            : undefined
        }
        accent={accent}
      />
      <Reading
        x={281}
        y={3}
        width={167}
        label={l("가스 유량", "Gas flow", "ガス流量")}
        value={flow.value}
        selected={selectedSignal === "flow"}
        onSelect={
          variant === "current" && onSignalChange
            ? () => onSignalChange("flow")
            : undefined
        }
        accent={accent}
      />
      <Reading
        x={13}
        y={282}
        width={134}
        label={l("RF 전력", "RF power", "RF電力")}
        value={rf.value}
        selected={selectedSignal === "rf"}
        onSelect={
          variant === "current" && onSignalChange
            ? () => onSignalChange("rf")
            : undefined
        }
        accent={accent}
      />
      <Reading
        x={332}
        y={282}
        width={134}
        label={l("온도", "Temperature", "温度")}
        value={temperature.value}
        selected={selectedSignal === "temperature"}
        onSelect={
          variant === "current" && onSignalChange
            ? () => onSignalChange("temperature")
            : undefined
        }
        accent={accent}
      />
    </svg>
  );
}
