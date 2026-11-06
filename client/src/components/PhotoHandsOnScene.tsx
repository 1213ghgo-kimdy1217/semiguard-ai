import React, { useId, useRef } from "react";
import { tr } from "../lib/productLanguage";
import type { PhotoHandsOnSceneProps } from "./hands-on-scene-types";
import "./photo-hands-on-scene.css";

const left = 28;
const right = 452;
const resistTop = 218;
const resistHeight = 60;
const openingWidth = 44;
const nominalOpenings = [86, 174, 262, 350];
const unit = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const offsetBound = (value: number) =>
  Number.isFinite(value) ? Math.max(-36, Math.min(36, value)) : 0;

/** Positive-resist concept view, not the internal geometry or recipe of a scanner. */
export default function PhotoHandsOnScene({
  state,
  language,
  showGuide,
  onOffsetChange,
}: PhotoHandsOnSceneProps) {
  const id = `${useId().replace(/:/g, "")}-photo-hands-on`;
  const drag = useRef<{
    pointerId: number;
    startX: number;
    offset: number;
  } | null>(null);
  const canAlign = state.phase === "align";
  const offset = offsetBound(canAlign ? state.offset : state.exposureOffset);
  const exposure = unit(state.exposureProgress);
  const development = unit(state.developmentProgress);
  const isExposing = state.phase === "exposing";
  const isDeveloping = state.phase === "developing";
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const openings = nominalOpenings.map(x => ({
    x: x + offset,
    width: openingWidth,
  }));
  const segments: { x: number; width: number; exposed: boolean }[] = [];
  let cursor = left;
  for (const opening of openings) {
    if (opening.x > cursor)
      segments.push({ x: cursor, width: opening.x - cursor, exposed: false });
    segments.push({ ...opening, exposed: true });
    cursor = opening.x + opening.width;
  }
  if (cursor < right)
    segments.push({ x: cursor, width: right - cursor, exposed: false });

  const viewX = (event: React.PointerEvent<SVGGElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(matrix.inverse()).x;
  };
  const endDrag = (event: React.PointerEvent<SVGGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null;
  };
  const status =
    state.phase === "align"
      ? l(
          "마스크를 옮겨 아래 패턴 위치를 맞춰보세요",
          "Move the mask to align the pattern below",
          "マスクを動かして下のパターン位置を合わせよう"
        )
      : isExposing
        ? l(
            "빛이 통과한 감광막 부분이 노광되고 있어요",
            "The resist beneath the openings is being exposed",
            "開口部の下のレジストが露光されています"
          )
        : state.phase === "exposed"
          ? l(
              "색이 바뀐 부분이 노광부예요 · 이제 현상해보세요",
              "The changed color marks exposed resist · now develop it",
              "色の変わった部分が露光部です・現像してみよう"
            )
          : isDeveloping
            ? l(
                "양성 감광막의 노광된 부분이 제거되고 있어요",
                "The exposed positive resist is being removed",
                "ポジ型レジストの露光部が除去されています"
              )
            : l(
                "노광부가 제거되어 기판이 드러났어요",
                "The exposed areas cleared, revealing the substrate",
                "露光部が除去され、基板が現れました"
              );

  return (
    <svg
      viewBox="0 0 480 360"
      className="phh-scene"
      data-phase={state.phase}
      data-offset={offset.toFixed(1)}
      data-exposure-offset={offsetBound(state.exposureOffset).toFixed(1)}
      data-exposure-progress={exposure.toFixed(3)}
      data-development-progress={development.toFixed(3)}
      role="group"
      aria-labelledby={`${id}-title ${id}-desc`}
    >
      <title id={`${id}-title`}>
        {l(
          "마스크 정렬·노광·현상 체험",
          "Mask alignment, exposure and development",
          "マスク位置合わせ・露光・現像体験"
        )}
      </title>
      <desc id={`${id}-desc`}>
        {l(
          "양성 감광막의 기본 개념입니다. 마스크가 빛을 통과시킨 부분은 노광되며, 현상 단계에서 그 부분이 제거됩니다. 학습용 상대 위치이며 실제 장비의 치수나 운전 조건이 아닙니다.",
          "A basic positive-resist concept. Mask openings expose the resist below; development removes those exposed areas. Positions are a teaching model, not real equipment dimensions or operating conditions.",
          "ポジ型レジストの基本概念です。マスクの開口部の下が露光され、現像時にその部分が除去されます。学習用の相対位置であり、実装置の寸法や運転条件ではありません。"
        )}
      </desc>
      <defs>
        <linearGradient id={`${id}-light`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#d1fff0" stopOpacity=".5" />
          <stop offset="1" stopColor="#72dec4" stopOpacity=".15" />
        </linearGradient>
        <clipPath id={`${id}-wafer`}>
          <rect x={left} y="202" width={right - left} height="114" />
        </clipPath>
      </defs>

      <g aria-hidden="true">
        <rect
          x="156"
          y="13"
          width="168"
          height="32"
          rx="10"
          fill={isExposing ? "#295849" : "#1b342c"}
          stroke={isExposing ? "#a1f3d9" : "#658d7b"}
          strokeWidth="1.5"
        />
        <path
          d="M178 26h124m-124 7h124"
          stroke={isExposing ? "#c2ffe9" : "#729584"}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <text x="240" y="65" textAnchor="middle" fill="#aac9ba" fontSize="12">
          {l("빛", "Light", "光")}
        </text>
        {isExposing ? (
          <g className="phh-illumination" opacity={0.32 + exposure * 0.35}>
            <path d="M178 44L48 86H432L302 44Z" fill={`url(#${id}-light)`} />
            {[88, 176, 264, 352].map(x => (
              <path
                key={x}
                d={`M${x} 53V85`}
                stroke="#bcffdf"
                strokeWidth="1.5"
                opacity=".65"
              />
            ))}
          </g>
        ) : null}
        {showGuide ? (
          <g
            className="phh-guide"
            fill="none"
            stroke="#e9c98e"
            strokeDasharray="5 5"
            strokeWidth="1.1"
            opacity=".55"
          >
            <path d="M240 70V317" opacity=".55" />
            {nominalOpenings.map(x => (
              <g key={x}>
                <path
                  d={`M${x} 113V282M${x + openingWidth} 113V282`}
                  opacity=".4"
                />
                <rect
                  x={x}
                  y={resistTop}
                  width={openingWidth}
                  height={resistHeight}
                  rx="1"
                />
              </g>
            ))}
          </g>
        ) : null}

        {/* Projected opening positions are frozen when exposure begins. */}
        {(showGuide && canAlign) || isExposing ? (
          <g
            clipPath={`url(#${id}-wafer)`}
            className="phh-opening-projections"
            opacity={isExposing ? 0.18 + exposure * 0.38 : 0.14}
          >
            {openings.map(opening => (
              <rect
                key={opening.x}
                x={opening.x}
                y="202"
                width={opening.width}
                height="76"
                fill={isExposing ? "#84e8ce" : "#d4b476"}
              />
            ))}
          </g>
        ) : null}
        {(showGuide && canAlign) || isExposing ? (
          <g
            className="phh-light-columns"
            opacity={isExposing ? 0.2 + exposure * 0.4 : 0.12}
          >
            {openings.map(opening => (
              <g key={opening.x}>
                <path
                  d={`M${opening.x} 113H${opening.x + openingWidth}V218H${opening.x}Z`}
                  fill={`url(#${id}-light)`}
                />
                <path
                  d={`M${opening.x + 6} 119V211M${opening.x + openingWidth - 6} 119V211`}
                  stroke="#b3ffe0"
                  strokeWidth="1.1"
                  opacity=".7"
                />
              </g>
            ))}
          </g>
        ) : null}

        {/* Substrate and positive-resist intervals. Only exposed intervals clear. */}
        <path
          d="M28 278H452V306L438 316H42L28 306Z"
          fill="#315b51"
          stroke="#8db6a1"
          strokeWidth="1.5"
        />
        <path d="M28 304H452M42 315H438" stroke="#1c382f" strokeWidth="2" />
        <path d="M42 287H438" stroke="#6d9c88" strokeWidth="1" opacity=".55" />
        {isDeveloping ? (
          <rect
            className="phh-developer"
            x="24"
            y="205"
            width="432"
            height="77"
            rx="10"
            fill="#79cad2"
            opacity=".07"
          />
        ) : null}
        {segments.map((segment, index) => {
          const removed = segment.exposed ? development * resistHeight : 0;
          const remaining = resistHeight - removed;
          return (
            <g
              key={index}
              data-photo-region={segment.exposed ? "exposed" : "shielded"}
              data-remaining-height={remaining.toFixed(2)}
            >
              {remaining > 0.02 ? (
                <>
                  <rect
                    x={segment.x}
                    y={resistTop + removed}
                    width={segment.width}
                    height={remaining}
                    fill="#d5ae78"
                  />
                  {segment.exposed && exposure > 0 ? (
                    <rect
                      x={segment.x}
                      y={resistTop + removed}
                      width={segment.width}
                      height={remaining}
                      fill="#75dfc2"
                      opacity={exposure * 0.92}
                    />
                  ) : null}
                  <path
                    d={`M${segment.x} ${resistTop + removed}H${segment.x + segment.width}`}
                    stroke={
                      segment.exposed && exposure > 0 ? "#b8ffe1" : "#f0d0a2"
                    }
                    strokeWidth="1.5"
                  />
                  {development > 0 ? (
                    <path
                      d={`M${segment.x} ${resistTop + removed}V278M${segment.x + segment.width} ${resistTop + removed}V278`}
                      stroke="#567965"
                      strokeWidth="1"
                    />
                  ) : null}
                </>
              ) : null}
              {segment.exposed && isDeveloping && remaining > 0
                ? [0, 1, 2].map(dot => {
                    const rise = ((development * 2.7 + dot * 0.29) % 1) * 29;
                    return (
                      <rect
                        key={dot}
                        className="phh-dissolving"
                        x={segment.x + 8 + dot * 12}
                        y={resistTop + removed - 5 - rise}
                        width="4"
                        height="3"
                        rx="1"
                        fill="#a8f5dc"
                        opacity={0.6 - rise / 70}
                      />
                    );
                  })
                : null}
            </g>
          );
        })}
        <text x="36" y="207" fill="#e9c68f" fontSize="12" fontWeight="600">
          {l("양성 감광막", "Positive resist", "ポジ型レジスト")}
        </text>
        <text
          x="240"
          y="300"
          textAnchor="middle"
          fill="#bbd7c8"
          fontSize="13"
          fontWeight="600"
        >
          {l("기판", "Substrate", "基板")}
        </text>
        {showGuide ? (
          <text x="444" y="330" textAnchor="end" fill="#d6bf92" fontSize="10.5">
            {l(
              "점선 = 맞출 위치",
              "Dashed = alignment guide",
              "破線＝合わせる位置"
            )}
          </text>
        ) : null}
      </g>

      <g
        className="phh-mask"
        data-draggable={canAlign ? "true" : "false"}
        transform={`translate(${offset} 0)`}
        role="slider"
        tabIndex={canAlign ? 0 : -1}
        aria-label={l(
          "마스크를 좌우로 옮기기",
          "Move the mask left or right",
          "マスクを左右に動かす"
        )}
        aria-valuemin={-36}
        aria-valuemax={36}
        aria-valuenow={Math.round(offset)}
        aria-valuetext={l(
          `학습 모형의 상대 위치 ${Math.round(offset)}`,
          `Teaching-model relative position ${Math.round(offset)}`,
          `学習模型の相対位置 ${Math.round(offset)}`
        )}
        aria-disabled={!canAlign}
        onPointerDown={event => {
          if (!canAlign) return;
          const startX = viewX(event);
          if (startX === null) return;
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { pointerId: event.pointerId, startX, offset };
        }}
        onPointerMove={event => {
          if (!canAlign || drag.current?.pointerId !== event.pointerId) return;
          const current = viewX(event);
          if (current !== null)
            onOffsetChange(
              offsetBound(drag.current.offset + current - drag.current.startX)
            );
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
        onKeyDown={event => {
          if (!canAlign) return;
          const step = event.shiftKey ? 5 : 1;
          const next =
            event.key === "ArrowLeft"
              ? offset - step
              : event.key === "ArrowRight"
                ? offset + step
                : event.key === "Home"
                  ? -36
                  : event.key === "End"
                    ? 36
                    : null;
          if (next !== null) {
            event.preventDefault();
            onOffsetChange(offsetBound(next));
          }
        }}
      >
        <rect
          className="phh-focus-ring"
          x="41"
          y="78"
          width="398"
          height="43"
          rx="8"
          fill="none"
          stroke="#d1ffe9"
          strokeWidth="2.5"
        />
        <rect
          x="45"
          y="82"
          width="390"
          height="35"
          rx="6"
          fill="#243d35"
          stroke="#8dbca5"
          strokeWidth="1.6"
        />
        <rect x="49" y="87" width="382" height="25" rx="2" fill="#1a241f" />
        {nominalOpenings.map(x => (
          <g key={x}>
            <rect
              x={x}
              y="87"
              width={openingWidth}
              height="25"
              fill="#92cdbd"
              fillOpacity=".28"
              stroke="#a6dec6"
              strokeWidth="1"
            />
            <path
              d={`M${x + 7} 90l11 19m6-19 11 19`}
              stroke="#ceeadd"
              opacity=".23"
            />
          </g>
        ))}
        <rect
          x="207"
          y="73"
          width="66"
          height="8"
          rx="4"
          fill={canAlign ? "#8ee6c7" : "#719784"}
        />
        {canAlign ? (
          <path
            d="M177 99h-15l6-6m-6 6 6 6m135-6h15l-6-6m6 6-6 6"
            fill="none"
            stroke="#a5e5c8"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ) : null}
        <text
          x="240"
          y="136"
          textAnchor="middle"
          fill="#b8d3c3"
          fontSize="12"
          fontWeight="600"
        >
          {canAlign
            ? l(
                "마스크 · 좌우로 끌기",
                "Mask · drag sideways",
                "マスク・左右にドラッグ"
              )
            : l(
                "마스크 · 위치 고정",
                "Mask · position locked",
                "マスク・位置固定"
              )}
        </text>
      </g>
      <text
        x="240"
        y="352"
        textAnchor="middle"
        fill="#c1d7c9"
        fontSize={language === "en" ? 11.5 : 12}
        fontWeight="500"
      >
        {status}
      </text>
    </svg>
  );
}
