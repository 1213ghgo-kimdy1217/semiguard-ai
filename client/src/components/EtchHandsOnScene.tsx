import React, { useId, type CSSProperties } from "react";
import { tr } from "../lib/productLanguage";
import type { EtchHandsOnSceneProps } from "./hands-on-scene-types";
import "./etch-hands-on-scene.css";

const clamp = (value: number, max = 1) =>
  Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : 0;
const gasPaths = [
  "M31 30H261V91C262 109 192 105 154 134C128 158 191 190 263 181C329 196 352 171 411 167H453V190",
  "M31 30H261V91C264 110 259 119 299 125C357 133 367 169 327 183C362 183 379 169 411 167H453V190",
  "M31 30H261V91C261 114 220 124 180 151C167 172 222 188 292 175C352 169 373 167 411 167H453V190",
];
const maskStarts = [74, 146, 218, 290, 362];
const gapStarts = [118, 190, 262, 334];

/** An authored hands-on concept sequence, independent of recorded practice data. */
export default function EtchHandsOnScene({
  state,
  language,
  activeAction,
  showGuide,
}: EtchHandsOnSceneProps) {
  const id = `eh-${useId().replace(/:/g, "")}`;
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const progress = clamp(state.progress);
  const pumpProgress = clamp(state.pumpProgress);
  const gasLevel = clamp(state.gasLevel, 100) / 100;
  const rfLevel = clamp(state.rfLevel, 100) / 100;
  const flowing =
    state.loaded && state.pump === "ready" && state.gasOn && gasLevel > 0;
  const plasma = flowing && state.rfOn && rfLevel > 0;
  const etching =
    plasma && state.running && state.loaded && state.pump === "ready";
  const active = (...actions: string[]) => actions.includes(activeAction);
  const teal = "#87e3ca",
    gold = "#ecc17a",
    dim = "#4b8070";
  const airCount =
    state.pump === "ready" ? 0 : Math.ceil(26 * (1 - pumpProgress));
  const gasCount = flowing ? Math.round(9 + gasLevel * 22) : 0;
  const remaining = 43 * (1 - progress);
  const pumpMoving =
    state.pump === "pumping" || (state.pump === "ready" && flowing);

  return (
    <svg
      className="eh-scene"
      viewBox="0 0 480 360"
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
      data-loaded={state.loaded ? "true" : "false"}
      data-pump={state.pump}
      data-gas={flowing ? "true" : "false"}
      data-plasma={plasma ? "true" : "false"}
      data-etching={etching ? "true" : "false"}
      data-progress={progress}
      data-active-action={activeAction}
    >
      <title id={`${id}-title`}>
        {l(
          "직접 켜고 진행하는 식각 개념 체험",
          "Hands-on etch concept sequence",
          "自分で操作するエッチングの概念体験"
        )}
      </title>
      <desc id={`${id}-desc`}>
        {l(
          "웨이퍼 투입, 감압, 가스 밸브와 RF 점화에 그림이 반응합니다. 진행 중에는 마스크가 보호한 막은 남고 노출된 막이 줄어듭니다.",
          "The picture responds to wafer loading, pump-down, the gas valve and RF ignition. During the concept sequence, the protected film remains while exposed film recedes.",
          "ウェーハ投入・減圧・ガスバルブ・RF点灯に図が反応します。進行中はマスクで守られた膜が残り、露出した膜が減ります。"
        )}
      </desc>
      <defs>
        <clipPath id={`${id}-inside`}>
          <rect x="124" y="86" width="274" height="138" rx="16" />
        </clipPath>
      </defs>

      {/* A gas line and a visibly rotating valve, with no recipe units. */}
      <path
        d="M31 30H261V70"
        fill="none"
        stroke={dim}
        strokeWidth="13"
        strokeLinejoin="round"
      />
      <path
        className="eh-gas-line"
        d="M31 30H261V70"
        fill="none"
        stroke={flowing ? teal : "#598377"}
        strokeWidth="4"
        strokeDasharray={flowing ? "6 12" : undefined}
      />
      <circle
        cx="122"
        cy="30"
        r="19"
        fill="#15392e"
        stroke={active("gas", "gasLevel") ? gold : "#82b49d"}
        strokeWidth={active("gas", "gasLevel") ? 2.5 : 1.5}
      />
      <g
        className="eh-valve"
        style={{ transform: `rotate(${flowing ? 0 : 90}deg)` }}
      >
        <path
          d="M109 23l13 7-13 7zm26 0-13 7 13 7z"
          fill={flowing ? teal : "#84a99a"}
        />
      </g>
      <path d="M122 11V4m-8 0h16" stroke="#bad5c4" strokeWidth="2.4" />
      <text x="31" y="15" fill={flowing ? teal : "#8daf9f"} fontSize="13">
        {l("가스 밸브", "Gas valve", "ガスバルブ")}
      </text>
      <text
        x="286"
        y="27"
        fill={flowing ? teal : "#8daf9f"}
        fontSize="14"
        fontWeight="600"
      >
        {flowing
          ? l("가스 흐름 ON", "Gas flow ON", "ガスの流れ ON")
          : l("가스 흐름 OFF", "Gas flow OFF", "ガスの流れ OFF")}
      </text>
      {flowing ? (
        <text x="286" y="45" fill="#b3cdbf" fontSize="12">
          {Math.round(gasLevel * 100)}%
        </text>
      ) : null}

      {/* The chamber is large; air leaves it during the user-triggered pump step. */}
      <rect
        x="111"
        y="69"
        width="301"
        height="171"
        rx="24"
        fill="#173c31"
        stroke={active("pump", "rf", "start", "pause") ? gold : "#8ab8a2"}
        strokeWidth={active("pump", "rf", "start", "pause") ? 2.8 : 2}
      />
      <rect
        x="124"
        y="86"
        width="274"
        height="138"
        rx="16"
        fill="#0b2722"
        stroke="#426c5c"
        strokeWidth="1"
      />
      <path d="M130 79H392" stroke="#aacdb8" opacity=".4" strokeWidth="2" />
      <path
        d="M155 93H370"
        stroke="#7aab93"
        strokeWidth="8"
        strokeLinecap="round"
      />
      {[170, 200, 230, 260, 290, 320, 350].map(x => (
        <path
          key={x}
          className="eh-gas-jet"
          d={`M${x} 100v15`}
          fill="none"
          stroke={flowing ? teal : "#345c4d"}
          strokeDasharray="3 7"
          strokeWidth="1.8"
        />
      ))}
      <g clipPath={`url(#${id}-inside)`}>
        {Array.from({ length: airCount }, (_, index) => (
          <circle
            key={index}
            className="eh-air"
            cx={143 + ((index * 53) % 233) + pumpProgress * (index % 3) * 6}
            cy={112 + ((index * 31) % 79)}
            r={2.4 + (index % 3) * 0.45}
            fill="#c0d3c7"
            opacity={0.65 * (1 - pumpProgress * 0.8)}
          />
        ))}
        {plasma ? (
          <g
            className="eh-plasma"
            style={
              { "--eh-rf-opacity": 0.13 + rfLevel * 0.35 } as CSSProperties
            }
          >
            <path
              d="M138 153C148 115 207 114 258 124C313 108 380 128 389 157C372 194 315 204 259 187C205 204 148 190 138 153Z"
              fill="#c0a5ff"
              opacity="var(--eh-rf-opacity)"
            />
            <path
              className="eh-plasma-wave"
              d="M139 151Q201 121 263 153T389 149M141 174Q205 148 264 174T388 173"
              fill="none"
              stroke="#cfbdff"
              strokeWidth={1.4 + rfLevel * 2.5}
              opacity={0.28 + rfLevel * 0.35}
            />
            <text
              x="264"
              y="147"
              textAnchor="middle"
              fill="#e3d5ff"
              fontSize="13"
              fontWeight="600"
            >
              {l("플라즈마", "Plasma", "プラズマ")}
            </text>
          </g>
        ) : null}
        {!state.loaded && showGuide ? (
          <text
            x="263"
            y="173"
            textAnchor="middle"
            fill="#6c9b86"
            fontSize="14"
          >
            {l(
              "웨이퍼를 먼저 넣어보세요",
              "Load the wafer first",
              "まずウェーハを入れてみましょう"
            )}
          </text>
        ) : null}
      </g>

      {/* Air/gas exits visibly through the pump on the right. */}
      <path
        d="M412 167H453V189"
        fill="none"
        stroke={dim}
        strokeWidth="13"
        strokeLinejoin="round"
      />
      <path
        className="eh-pump-flow"
        d="M412 167H453V189"
        fill="none"
        stroke={state.pump === "pumping" ? "#d4e2d7" : teal}
        strokeWidth="3"
        strokeDasharray="3 9"
        opacity={pumpMoving ? 0.8 : 0.15}
      />
      <circle
        cx="453"
        cy="207"
        r="22"
        fill="#1d4535"
        stroke={active("pump") ? gold : "#7bab91"}
        strokeWidth={active("pump") ? 2.5 : 1.5}
      />
      <path
        className="eh-pump-rotor"
        d="M453 191v32m-16-16h32"
        stroke={pumpMoving ? teal : "#729b86"}
        strokeWidth="2.5"
        style={{ animationPlayState: pumpMoving ? "running" : "paused" }}
      />
      <circle cx="453" cy="207" r="4" fill="#afcdb8" />
      <text
        x="453"
        y="246"
        textAnchor="middle"
        fill={state.pump === "ready" ? teal : "#b3cbbd"}
        fontSize="12"
      >
        {state.pump === "pumping"
          ? l("감압 중", "Pumping", "減圧中")
          : state.pump === "ready"
            ? l("감압 준비", "Ready", "減圧完了")
            : l("펌프 OFF", "Pump OFF", "ポンプ OFF")}
      </text>

      {flowing ? (
        <g className="eh-gas-particles" aria-hidden="true">
          {Array.from({ length: gasCount }, (_, index) => {
            const duration = 4.2 - gasLevel * 2.2;
            const position = ((index * 0.61803398875) % 1) * 100;
            return (
              <circle
                key={index}
                className="eh-gas-particle"
                cx="0"
                cy="0"
                r={1.9 + (index % 3) * 0.4}
                fill={plasma ? "#ceb7ff" : teal}
                opacity=".8"
                style={
                  {
                    offsetPath: `path("${gasPaths[index % 3]}")`,
                    "--eh-gas-position": `${position}%`,
                    "--eh-gas-duration": `${duration}s`,
                    "--eh-gas-delay": `${(-position / 100) * duration}s`,
                  } as CSSProperties
                }
              />
            );
          })}
        </g>
      ) : null}

      {/* The wafer visibly travels from its loading position to the stage. */}
      <path d="M9 218H84m-69 7h61" stroke="#527c67" strokeWidth="3" />
      {showGuide && !state.loaded ? (
        <path
          className="eh-load-arrow"
          d="M79 203H107m-8-7 8 7-8 7"
          fill="none"
          stroke={teal}
          strokeWidth="2"
        />
      ) : null}
      <g
        className="eh-load-wafer"
        style={{ transform: `translate(${state.loaded ? 219 : 0}px,0px)` }}
      >
        <ellipse
          cx="44"
          cy="207"
          rx="32"
          ry="7.2"
          fill="#7fb9ab"
          stroke="#c1e2cf"
          strokeWidth="1.1"
        />
        <path
          d="M18 206q26-8 52 0"
          stroke="#c7e7d4"
          opacity=".45"
          fill="none"
        />
      </g>
      <path
        d="M151 217H374V229H151Z"
        fill="#315a45"
        stroke="#93b69d"
        strokeWidth="1.2"
      />
      <path
        d="M176 231H349M205 239v8m112-8v8"
        stroke="#65937a"
        strokeWidth="3"
      />

      {/* RF can be switched on before starting the film-removal sequence. */}
      <rect
        x="17"
        y="119"
        width="74"
        height="65"
        rx="12"
        fill="#234936"
        stroke={active("rf", "rfLevel") ? gold : "#759e86"}
        strokeWidth={active("rf", "rfLevel") ? 2.5 : 1.5}
      />
      <text
        x="54"
        y="138"
        textAnchor="middle"
        fill={state.rfOn ? "#d7c3ff" : "#b8d1bf"}
        fontSize="13"
        fontWeight="650"
      >
        {state.rfOn ? "RF ON" : "RF OFF"}
      </text>
      <path
        className="eh-rf-wave"
        d="M26 156q6-15 12 0t12 0t12 0t12 0"
        fill="none"
        stroke={state.rfOn ? "#cbb2ff" : "#557e65"}
        strokeWidth="2.4"
        strokeDasharray="48 8"
      />
      {state.rfOn ? (
        <text x="54" y="176" textAnchor="middle" fill="#cbb2ff" fontSize="12">
          {Math.round(rfLevel * 100)}%
        </text>
      ) : null}
      <path
        d="M92 160H103V221H150"
        fill="none"
        stroke={state.rfOn ? "#bfa2f3" : "#466e54"}
        strokeWidth="3"
      />

      {/* The large lower cutaway shows protected versus exposed film directly. */}
      <g className="eh-film-section" opacity={state.loaded ? 1 : 0.2}>
        {showGuide ? (
          <>
            <path
              d="M169 215L74 278m283-63 49 63"
              fill="none"
              stroke="#7bab8e"
              strokeDasharray="3 5"
              opacity=".45"
            />
            <text
              x="239"
              y="263"
              textAnchor="middle"
              fill="#b5d1bc"
              fontSize="13"
            >
              {l(
                "웨이퍼 단면 확대",
                "Enlarged wafer section",
                "ウェーハ断面の拡大"
              )}
            </text>
          </>
        ) : null}
        <rect
          x="58"
          y="325"
          width="364"
          height="21"
          rx="3"
          fill="#325944"
          stroke="#82b095"
          strokeWidth="1.1"
        />
        <path d="M59 335H421" stroke="#649077" opacity=".6" />
        {maskStarts.map(x => (
          <g key={x}>
            <rect
              x={x}
              y="282"
              width="44"
              height="43"
              fill="#72c8b0"
              stroke="#9dddc7"
              strokeWidth=".7"
            />
            <rect
              x={x - 1}
              y="271"
              width="46"
              height="11"
              rx="1.5"
              fill={gold}
              stroke="#f2d5a7"
              strokeWidth=".7"
            />
          </g>
        ))}
        {gapStarts.map(x => (
          <g key={x}>
            <rect
              className="eh-exposed-film"
              data-film-gap="true"
              x={x}
              y={325 - remaining}
              width="28"
              height={remaining}
              fill="#72c8b0"
              stroke={remaining > 0.1 ? "#9dddc7" : "none"}
              strokeWidth=".7"
            />
            {etching ? (
              <path
                className="eh-etch-ion"
                d={`M${x + 14} 273V${Math.max(283, 325 - remaining)}`}
                stroke="#d1bbff"
                strokeWidth="2.2"
                strokeDasharray="3 8"
              />
            ) : null}
          </g>
        ))}
        {showGuide ? (
          <>
            <text x="45" y="280" textAnchor="end" fill={gold} fontSize="12">
              {l("마스크", "Mask", "マスク")}
            </text>
            <text x="45" y="311" textAnchor="end" fill="#9dddc7" fontSize="12">
              {l("막", "Film", "膜")}
            </text>
          </>
        ) : null}
        {progress >= 1 ? (
          <path
            d="M126 309l7 7 12-17m53 10 7 7 12-17m53 10 7 7 12-17m53 10 7 7 12-17"
            fill="none"
            stroke="#c0f2d4"
            strokeWidth="1.8"
            opacity=".8"
          />
        ) : null}
      </g>
    </svg>
  );
}
