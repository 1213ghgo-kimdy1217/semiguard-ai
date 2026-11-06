import React, { useId } from "react";
import { tr } from "../lib/productLanguage";
import { motionChannel, type MotionSceneProps } from "./process-motion-types";
import "./photo-motion-scene.css";

const teal = "#8ee5d0";
const gold = "#f1c47e";
const finite = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;
const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, finite(value)));

function Pattern({
  offset,
  width,
  ink,
  ghost = false,
}: {
  offset: number;
  width: number;
  ink: string;
  ghost?: boolean;
}) {
  return (
    <g
      className={ghost ? "pmf-reference-pattern" : "pmf-current-pattern"}
      transform={`translate(${offset} 0)`}
      fill="none"
      stroke={ink}
      strokeWidth={width}
      strokeLinecap="square"
      strokeLinejoin="miter"
      opacity={ghost ? 0.8 : 1}
      strokeDasharray={ghost ? "5 5" : undefined}
    >
      {[0, 1].map(row => (
        <g key={row} transform={`translate(0 ${row * 62})`}>
          {[-1, 0, 1, 2, 3, 4, 5].map(column => {
            const x = 65 + column * 82;
            return <path key={column} d={`M${x} 181v-32h33v16h-15v24h37`} />;
          })}
        </g>
      ))}
    </g>
  );
}

function ValueTag({
  x,
  label,
  value,
  ink,
  active,
  onSelect,
}: {
  x: number;
  label: string;
  value: number;
  ink: string;
  active: boolean;
  onSelect?: () => void;
}) {
  return (
    <g
      className="pmf-value-tag"
      transform={`translate(${x} 11)`}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={onSelect ? label : undefined}
      aria-pressed={onSelect ? active : undefined}
      onClick={onSelect}
      onKeyDown={event => {
        if (onSelect && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <rect
        width="139"
        height="56"
        rx="10"
        fill={active ? "#223c35" : "#142a25"}
        stroke={active ? ink : "#426a5b"}
        strokeWidth={active ? 1.7 : 1}
      />
      <text x="12" y="19" fill="#bed0c5" fontSize="12" fontWeight="500">
        {label}
      </text>
      <text
        x="12"
        y="44"
        fill={ink}
        fontSize="24"
        fontWeight="650"
        fontVariant="tabular-nums"
      >
        {finite(value, 100).toFixed(1)}
      </text>
    </g>
  );
}

/** A magnified index comparison: no measured feature dimensions or fault verdict. */
export default function PhotoMotionScene({
  scene,
  language,
  running,
  variant,
  selectedSignal,
  showReference,
  onSignalChange,
}: MotionSceneProps) {
  const id = `${useId().replace(/:/g, "")}-photo-motion`;
  const position = motionChannel(scene, "position", variant);
  const shape = motionChannel(scene, "shape", variant);
  const offset = clamp(position.delta, -2, 2) * 30;
  const width = clamp(10 + shape.delta * 6, 3, 24);
  const ink = variant === "reference" ? gold : teal;
  const scanX = 45 + ((Math.max(0, finite(scene.time)) % 12) / 12) * 365;
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  return (
    <svg
      viewBox="0 0 480 330"
      className="pmf-scene"
      role={onSignalChange && variant === "current" ? "group" : "img"}
      aria-labelledby={`${id}-title ${id}-desc`}
      data-running={running ? "true" : "false"}
      data-variant={variant}
      data-time={scene.time}
      data-position-shift={offset.toFixed(2)}
      data-pattern-width={width.toFixed(2)}
    >
      <title id={`${id}-title`}>
        {l(
          "포토 패턴을 크게 비교하기",
          "Compare magnified photo patterns",
          "フォトパターンを拡大して比較"
        )}
      </title>
      <desc id={`${id}-desc`}>
        {l(
          "위치·형상 검사 지수의 차이를 패턴 이동과 선의 폭으로 확대 표현합니다. 실제 웨이퍼 치수나 결함을 재현한 것은 아닙니다.",
          "Position and shape index differences are magnified as pattern displacement and line width. This does not reproduce measured wafer dimensions or defects.",
          "位置・形状検査指数の差をパターンの移動と線幅で拡大表示します。実測のウェーハ寸法や欠陥を再現するものではありません。"
        )}
      </desc>
      <defs>
        <clipPath id={`${id}-pattern-clip`}>
          <rect x="43" y="137" width="394" height="139" rx="4" />
        </clipPath>
        <linearGradient id={`${id}-scan`} x1="0" x2="1">
          <stop stopColor={ink} stopOpacity="0" />
          <stop offset=".6" stopColor={ink} stopOpacity=".14" />
          <stop offset="1" stopColor={ink} stopOpacity=".7" />
        </linearGradient>
      </defs>
      <ValueTag
        x={12}
        label={l("패턴 위치 지수", "Position index", "パターン位置指数")}
        value={position.value}
        ink={ink}
        active={selectedSignal === "position"}
        onSelect={
          variant === "current" && onSignalChange
            ? () => onSignalChange("position")
            : undefined
        }
      />
      <ValueTag
        x={329}
        label={l("패턴 형상 지수", "Shape index", "パターン形状指数")}
        value={shape.value}
        ink={ink}
        active={selectedSignal === "shape"}
        onSelect={
          variant === "current" && onSignalChange
            ? () => onSignalChange("shape")
            : undefined
        }
      />

      <g aria-hidden="true">
        {/* The optical head stays compact; the inspection pattern fills the scene. */}
        <path
          d="M190 23h100v37H190z"
          fill="#234136"
          stroke="#83b3a0"
          strokeWidth="1.5"
        />
        <path
          d="M206 60v17h68V60"
          fill="#36594b"
          stroke="#83b3a0"
          strokeWidth="1.5"
        />
        <ellipse
          cx="240"
          cy="77"
          rx="34"
          ry="7"
          fill="#122a22"
          stroke={ink}
          strokeWidth="1.5"
        />
        <path
          className="pmf-light-cone"
          d="M211 80L132 124H348L269 80Z"
          fill={ink}
          opacity=".07"
        />
        <path
          className="pmf-projection-ray"
          d="M222 84l-45 40m63-40v40m18-40 45 40"
          fill="none"
          stroke={ink}
          strokeWidth="1.5"
          opacity=".55"
        />
        <path
          d="M211 39h58M211 47h58"
          stroke={ink}
          strokeWidth="2"
          opacity=".65"
        />
        <text x="240" y="111" textAnchor="middle" fill="#a7c4b6" fontSize="11">
          {l(
            "패턴 확대 검사",
            "Magnified pattern inspection",
            "パターン拡大検査"
          )}
        </text>

        {/* A fixed inspection window makes displacement directly comparable. */}
        <rect
          x="24"
          y="123"
          width="432"
          height="170"
          rx="14"
          fill="#213d34"
          stroke="#668e7b"
          strokeWidth="2"
        />
        <rect
          x="35"
          y="130"
          width="410"
          height="153"
          rx="7"
          fill="#0f241d"
          stroke="#87bba4"
          strokeWidth="1.2"
        />
        {[63, 104, 145, 186, 227, 268, 309, 350, 391, 432].map(x => (
          <path
            key={x}
            d={`M${x} 139v134`}
            stroke="#315548"
            strokeWidth=".7"
            opacity=".55"
          />
        ))}
        {[147, 177, 207, 237, 267].map(y => (
          <path
            key={y}
            d={`M45 ${y}H435`}
            stroke="#315548"
            strokeWidth=".7"
            opacity=".55"
          />
        ))}
        <g clipPath={`url(#${id}-pattern-clip)`}>
          {variant === "current" && showReference ? (
            <Pattern offset={0} width={10} ink={gold} ghost />
          ) : null}
          <Pattern offset={offset} width={width} ink={ink} />
          <g
            className="pmf-scan"
            style={{ transform: `translateX(${scanX}px)` }}
          >
            <rect
              x="-22"
              y="138"
              width="27"
              height="138"
              fill={`url(#${id}-scan)`}
            />
            <path d="M5 138V276" stroke={ink} strokeWidth="1.5" opacity=".85" />
          </g>
        </g>
        {/* Stable corner marks are the registration frame, not a verdict. */}
        <path
          d="M43 153v-16h16m362 0h16v16M43 260v16h16m362 0h16v-16"
          fill="none"
          stroke={gold}
          strokeWidth="2"
          opacity=".8"
        />
        <path
          d="M41 294v10h398v-10"
          fill="#142d23"
          stroke="#739b86"
          strokeWidth="1.5"
        />
        <path
          d="M91 305v7m298-7v7M72 313h336"
          fill="none"
          stroke="#84a995"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {selectedSignal === "position" &&
        variant === "current" &&
        showReference ? (
          <g className="pmf-position-guide">
            <path d={`M65 288H${65 + offset}`} stroke={teal} strokeWidth="2" />
            <path
              d={`M65 284v8M${65 + offset} 284v8`}
              stroke={teal}
              strokeWidth="1.5"
            />
          </g>
        ) : null}
        {selectedSignal === "shape" ? (
          <g
            className="pmf-width-guide"
            transform={`translate(${65 + offset} 0)`}
          >
            <path
              d={`M${-width / 2} 143V133H${width / 2}V143`}
              fill="none"
              stroke={ink}
              strokeWidth="1.5"
            />
          </g>
        ) : null}
      </g>
    </svg>
  );
}
