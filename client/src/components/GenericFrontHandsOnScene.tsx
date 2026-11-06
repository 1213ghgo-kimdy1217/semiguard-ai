import React, { useId, type CSSProperties } from "react";
import { tr } from "../lib/productLanguage";
import type { GenericHandsOnSceneProps } from "./hands-on-scene-types";
import "./generic-front-hands-on-scene.css";

const unit = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const teal = "#8ce2c8",
  gold = "#e8c07b",
  ink = "#aacbb8",
  muted = "#507c65";
const point = (index: number) => ({
  x: 146 + (index % 4) * 59,
  y: 123 + Math.floor(index / 4) * 29,
});
const illustrativeMarks = new Set([2, 5, 10, 12]);

function WaferInspection({
  state,
  language,
  showGuide,
  onSelect,
}: GenericHandsOnSceneProps) {
  const id = `gf-w-${useId().replace(/:/g, "")}`;
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const loaded = state.stage >= 1,
    light = state.stage >= 2;
  const progress = unit(state.progress),
    level = unit(state.level / 100);
  const scanX = light ? 109 + progress * 253 : 236;
  const selected = Math.max(
    0,
    Math.min(
      15,
      Math.round(Number.isFinite(state.selection) ? state.selection : 5)
    )
  );
  const selectedPoint = point(selected);
  const selectable =
    loaded && state.stage < 3 && !state.running && progress === 0;
  const comparison = unit((progress - 0.55) / 0.45);
  const bow = [9, 5, 7, 3, 6, 8, 4, 5, 3, 7, 10, 5, 8, 4, 6, 9][selected];

  return (
    <svg
      className="gf-scene gf-wafer"
      viewBox="0 0 480 360"
      role="group"
      aria-labelledby={`${id}-title ${id}-desc`}
      data-process="wafer"
      data-stage={state.stage}
      data-running={state.running ? "true" : "false"}
      data-progress={progress}
      data-selection={selected}
    >
      <title id={`${id}-title`}>
        {l(
          "웨이퍼 표면 검사와 형상 비교 체험",
          "Wafer surface inspection and geometry comparison",
          "ウェーハ表面検査と形状比較の体験"
        )}
      </title>
      <desc id={`${id}-desc`}>
        {l(
          "웨이퍼를 놓고 검사광을 켠 뒤 표면을 스캔합니다. 표시되는 관찰 포인트와 형상은 직접 작성한 가상 예시입니다.",
          "Load a wafer, switch on the inspection light, then scan the surface. Observation points and profiles are authored examples.",
          "ウェーハを置き、検査光を点灯して表面を走査します。観察ポイントと形状は作成した仮想例です。"
        )}
      </desc>
      <defs>
        <clipPath id={`${id}-surface`}>
          <ellipse cx="236" cy="171" rx="139" ry="70" />
        </clipPath>
      </defs>

      <path
        d="M83 245V64h306v181"
        fill="none"
        stroke={muted}
        strokeWidth="11"
      />
      <path
        d="M92 246V74h289v172"
        fill="none"
        stroke="#234c38"
        strokeWidth="3"
      />
      <path d="M95 238H378V251H95Z" fill="#254c38" stroke="#6c9b7e" />
      <path
        d="M111 253h251m-219 0v9m187-9v9"
        stroke="#7ba58a"
        strokeWidth="4"
      />
      <ellipse
        cx="236"
        cy="180"
        rx="145"
        ry="73"
        fill="#204a3b"
        stroke="#5b8c72"
        strokeWidth="1.4"
        opacity={loaded ? 0.65 : 0.22}
      />
      <g
        className="gf-wafer-carrier"
        style={{
          transform: `translate(${loaded ? 236 : 36}px,${loaded ? 171 : 216}px)`,
        }}
      >
        <ellipse
          className="gf-wafer-disc"
          cx="0"
          cy="0"
          rx={loaded ? 139 : 29}
          ry={loaded ? 70 : 9}
          fill="#376956"
          stroke={ink}
          strokeWidth="1.4"
        />
        {loaded ? (
          <>
            <ellipse
              cx="0"
              cy="0"
              rx="129"
              ry="62"
              fill="none"
              stroke="#73a790"
              opacity=".5"
            />
            <path
              d="M-18 69l8-7h20l8 7"
              fill="#133529"
              stroke={ink}
              strokeWidth="1"
            />
          </>
        ) : null}
      </g>
      {!loaded && showGuide ? (
        <>
          <path
            className="gf-load-arrow"
            d="M68 213h31m-8-7 8 7-8 7"
            fill="none"
            stroke={teal}
            strokeWidth="2"
          />
          <text
            x="236"
            y="180"
            textAnchor="middle"
            fill="#769f86"
            fontSize="14"
          >
            {l(
              "검사할 웨이퍼를 놓아보세요",
              "Place a wafer for inspection",
              "検査するウェーハを置いてみましょう"
            )}
          </text>
        </>
      ) : null}

      <g clipPath={`url(#${id}-surface)`}>
        {loaded && showGuide ? (
          <path
            d="M108 143H365M102 171H370M108 200H365M176 109V231M235 102V239M295 109V231"
            stroke="#90bba7"
            strokeWidth=".7"
            strokeDasharray="2 7"
            opacity=".23"
          />
        ) : null}
        {light ? (
          <>
            <rect
              className="gf-scan-light"
              x={scanX - 18}
              y="98"
              width="36"
              height="151"
              fill={teal}
              opacity={0.08 + level * 0.13}
            />
            <path
              d={`M${scanX} 99V243`}
              stroke={teal}
              strokeWidth="2"
              opacity={0.4 + level * 0.5}
            />
            <path
              d={`M${scanX - 7} 101V241m14-140v140`}
              stroke={teal}
              strokeWidth="1"
              opacity=".25"
            />
          </>
        ) : null}
        <g opacity={loaded ? 1 : 0} aria-hidden={!loaded}>
          {Array.from({ length: 16 }, (_, index) => {
            const p = point(index),
              reached = state.stage >= 3 && progress > 0 && p.x <= scanX;
            const marked = illustrativeMarks.has(index) && reached;
            return (
              <g
                key={index}
                className={`gf-observation-point${selected === index ? " gf-observation-point--selected" : ""}`}
                role="button"
                tabIndex={selectable ? 0 : -1}
                aria-label={l(
                  `관찰 위치 ${index + 1} 선택`,
                  `Select observation location ${index + 1}`,
                  `観察位置${index + 1}を選択`
                )}
                aria-pressed={selected === index}
                aria-disabled={!selectable}
                onClick={() => {
                  if (selectable) onSelect(index);
                }}
                onKeyDown={event => {
                  if (
                    selectable &&
                    (event.key === "Enter" || event.key === " ")
                  ) {
                    event.preventDefault();
                    onSelect(index);
                  }
                }}
              >
                <rect
                  x={p.x - 26}
                  y={p.y - 12}
                  width="52"
                  height="25"
                  rx="6"
                  fill="transparent"
                />
                {showGuide && !marked ? (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="1.5"
                    fill={reached ? "#b6d8c7" : "#4e8067"}
                  />
                ) : null}
                {marked ? (
                  <g className="gf-scan-discovery">
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="5.5"
                      fill={teal}
                      opacity=".17"
                    />
                    <circle cx={p.x - 1.5} cy={p.y + 1} r="2" fill="#c1f5df" />
                    <circle
                      cx={p.x + 3}
                      cy={p.y - 2.2}
                      r="1.4"
                      fill="#8ce2c8"
                    />
                    <path
                      d={`M${p.x - 7} ${p.y - 5}l3-3m11 3 3-3m-2 14 3 3`}
                      stroke={teal}
                      strokeWidth=".8"
                      opacity=".6"
                    />
                  </g>
                ) : null}
                {selected === index && loaded ? (
                  <path
                    d={`M${p.x - 10} ${p.y - 7}h5m-5 0v5m20-5h-5m5 0v5m-20 9v-5m0 5h5m15 0h-5m5 0v-5`}
                    fill="none"
                    stroke={gold}
                    strokeWidth="1.6"
                  />
                ) : null}
              </g>
            );
          })}
        </g>
      </g>

      <g
        className="gf-optical-head"
        style={{ transform: `translate(${scanX - 236}px,0px)` }}
      >
        <rect
          x="209"
          y="39"
          width="54"
          height="38"
          rx="8"
          fill="#285540"
          stroke={light ? teal : ink}
          strokeWidth="1.5"
        />
        <path d="M220 77v12h32V77" fill="#2d5945" stroke="#6d9d83" />
        <ellipse
          cx="236"
          cy="90"
          rx="16"
          ry="4"
          fill={light ? teal : "#153d2d"}
          stroke={light ? "#d0ffea" : "#7fab91"}
        />
        {light ? (
          <path
            d={`M229 94l-11 24h36l-11-24`}
            fill={teal}
            opacity={0.14 + level * 0.16}
          />
        ) : null}
      </g>
      <text
        x="236"
        y="24"
        textAnchor="middle"
        fill={light ? teal : "#a2c0ac"}
        fontSize="13"
        fontWeight="600"
      >
        {light
          ? l("표면을 빛으로 스캔", "Optical surface scan", "光で表面を走査")
          : l(
              "표면 검사·형상 계측",
              "Surface inspection / geometry",
              "表面検査・形状計測"
            )}
      </text>

      {/* A separate authored geometry comparison, not a defect/yield map. */}
      <g opacity={loaded ? 1 : 0.2}>
        <path
          d={`M${selectedPoint.x} ${selectedPoint.y + 12}L${147 + (selected % 4) * 55} 279`}
          fill="none"
          stroke={gold}
          strokeDasharray="3 5"
          opacity={comparison * 0.45}
        />
        <rect
          x="54"
          y="278"
          width="372"
          height="63"
          rx="10"
          fill="#133a2b"
          stroke="#5c886e"
        />
        <path
          d="M76 300H404"
          stroke={gold}
          strokeWidth="1.5"
          strokeDasharray="5 5"
          opacity=".65"
        />
        {comparison > 0 ? (
          <g opacity={comparison}>
            <path
              d={`M76 310Q240 ${310 - bow * 2} 404 310V325Q240 ${325 - bow * 2} 76 325Z`}
              fill="#44775d"
              stroke={teal}
              strokeWidth="1.5"
            />
            <path
              d={`M76 310Q240 ${310 - bow * 2} 404 310`}
              fill="none"
              stroke="#c0f2d6"
              strokeWidth="1"
            />
          </g>
        ) : null}
        <text x="240" y="358" textAnchor="middle" fill="#b2cfb9" fontSize="12">
          {comparison > 0
            ? l(
                "선택 위치의 형상 비교 예시",
                "Illustrative profile at the selected location",
                "選択位置の形状比較例"
              )
            : l(
                "스캔 뒤 형상을 비교해 보세요",
                "Compare profiles after scanning",
                "走査後に形状を比べてみましょう"
              )}
        </text>
      </g>
    </svg>
  );
}

function OxidationFurnace({
  state,
  language,
  showGuide,
}: GenericHandsOnSceneProps) {
  const id = `gf-o-${useId().replace(/:/g, "")}`;
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const loaded = state.stage >= 1,
    closed = state.stage >= 2,
    oxygen = state.stage >= 3;
  const progress = unit(state.progress),
    level = unit(state.level / 100);
  const heated = state.running || progress > 0;
  const oxideHeight = progress * 34;
  const siliconTop = 228 + progress * 6;
  const oxygenCount = oxygen ? 8 + Math.round(level * 13) : 0;
  return (
    <svg
      className="gf-scene gf-oxidation"
      viewBox="0 0 480 360"
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
      data-process="oxidation"
      data-stage={state.stage}
      data-running={state.running ? "true" : "false"}
      data-progress={progress}
      data-oxygen={oxygen ? "true" : "false"}
      data-heated={heated ? "true" : "false"}
    >
      <title id={`${id}-title`}>
        {l(
          "보트를 넣고 산화막을 만드는 열처리 개념 체험",
          "Thermal-processing concept: load the boat and grow an oxide",
          "ボートを入れて酸化膜を作る熱処理の概念体験"
        )}
      </title>
      <desc id={`${id}-desc`}>
        {l(
          "웨이퍼 보트 투입, 가열관 닫기, 산소 분위기를 준비한 뒤 열처리를 진행합니다. 옆 단면은 산화막 형성을 크게 표현한 학습용 그림입니다.",
          "Load a wafer boat, close the tube and prepare the oxygen environment before the teaching sequence. The enlarged section illustrates oxide formation.",
          "ウェーハボートを投入し、加熱管を閉じて酸素雰囲気を準備した後、熱処理を進めます。横の拡大断面は酸化膜形成を示す学習図です。"
        )}
      </desc>
      <defs>
        <clipPath id={`${id}-tube`}>
          <rect x="64" y="56" width="198" height="195" rx="21" />
        </clipPath>
      </defs>

      <rect
        x="44"
        y="29"
        width="237"
        height="235"
        rx="27"
        fill="#234936"
        stroke="#91b79b"
        strokeWidth="2"
      />
      <rect
        x="64"
        y="56"
        width="198"
        height="195"
        rx="21"
        fill="#102d23"
        stroke="#68977b"
        strokeWidth="1.3"
      />
      {[65, 94, 123, 152, 181, 210].map(y => (
        <g key={y}>
          <path
            className="gf-heater"
            d={`M51 ${y}v21m222-21v21`}
            stroke={heated ? gold : "#466f56"}
            strokeWidth="5"
            strokeLinecap="round"
            opacity={heated ? 0.55 + level * 0.4 : 0.6}
          />
        </g>
      ))}
      <path d="M73 45H251" stroke="#bed6c3" opacity=".35" strokeWidth="2" />
      <g clipPath={`url(#${id}-tube)`}>
        {heated ? (
          <>
            <rect
              className="gf-heat-field"
              x="65"
              y="58"
              width="196"
              height="191"
              rx="20"
              fill="#d99a5d"
              opacity={0.06 + level * 0.1}
            />
            {[102, 162, 222].map(x => (
              <path
                key={x}
                className="gf-heat-wave"
                d={`M${x} 219q-12-25 0-50t0-50t0-50`}
                fill="none"
                stroke="#e4b978"
                strokeWidth="2"
                opacity=".28"
              />
            ))}
          </>
        ) : null}
      </g>

      <path
        d="M9 82H63m199 17h28v35"
        fill="none"
        stroke={oxygen ? teal : "#547c61"}
        strokeWidth="5"
      />
      <path
        className="gf-oxygen-stream"
        d="M9 82H63"
        stroke={teal}
        strokeWidth="2"
        strokeDasharray="3 9"
        opacity={oxygen ? 0.9 : 0}
      />
      <text x="12" y="68" fill={oxygen ? teal : "#7fa58b"} fontSize="15">
        O₂
      </text>
      {oxygen ? (
        <g aria-hidden="true">
          {Array.from({ length: oxygenCount }, (_, index) => {
            const x = 80 + ((index * 47) % 164),
              y = 76 + ((index * 31) % 151);
            return (
              <g
                key={index}
                className="gf-oxygen"
                style={
                  {
                    "--gf-oxygen-delay": `${-(index % 7) * 0.29}s`,
                  } as CSSProperties
                }
              >
                <circle cx={x} cy={y} r="2.7" fill={teal} opacity=".6" />
                <circle
                  cx={x + 5}
                  cy={y - 1}
                  r="2.7"
                  fill={teal}
                  opacity=".6"
                />
              </g>
            );
          })}
        </g>
      ) : null}

      {/* The teaching boat moves upward into a general vertical furnace. */}
      <g
        className="gf-boat"
        style={{ transform: `translateY(${loaded ? -130 : 0}px)` }}
      >
        <path d="M103 235v79m116-79v79" stroke="#729e81" strokeWidth="3" />
        {[239, 252, 265, 278, 291, 304].map(y => (
          <g key={y}>
            <ellipse
              cx="161"
              cy={y}
              rx="63"
              ry="7"
              fill="#4b8067"
              stroke="#a1cbb0"
              strokeWidth="1.1"
            />
            {progress > 0 ? (
              <ellipse
                cx="161"
                cy={y}
                rx="63"
                ry="7"
                fill="none"
                stroke={teal}
                strokeWidth={0.6 + progress * 2}
                opacity=".9"
              />
            ) : null}
          </g>
        ))}
        <rect
          x="95"
          y="316"
          width="132"
          height="10"
          rx="3"
          fill="#325e44"
          stroke="#91ba9b"
        />
        <path
          d="M134 328v9h55v-9"
          fill="none"
          stroke="#749e80"
          strokeWidth="4"
        />
      </g>
      <path
        className="gf-furnace-door"
        d="M56 266H163V278H56Z"
        fill="#3e6b4b"
        stroke="#a1c1a5"
        strokeWidth="1.3"
        style={{ transform: `translateX(${closed ? 0 : -39}px)` }}
      />
      <path
        className="gf-furnace-door"
        d="M163 266H270V278H163Z"
        fill="#3e6b4b"
        stroke="#a1c1a5"
        strokeWidth="1.3"
        style={{ transform: `translateX(${closed ? 0 : 39}px)` }}
      />
      <path
        d="M49 283h229M57 288v13m213-13v13"
        fill="none"
        stroke="#5d8968"
        strokeWidth="3"
      />
      <text
        x="162"
        y="20"
        textAnchor="middle"
        fill={heated ? gold : "#a2c1a8"}
        fontSize="13"
        fontWeight="600"
      >
        {heated
          ? l(
              "열처리 중의 개념 단면",
              "Thermal-processing concept",
              "熱処理の概念断面"
            )
          : l(
              "웨이퍼 보트·열처리관",
              "Wafer boat / furnace",
              "ウェーハボート・加熱管"
            )}
      </text>

      {/* The authored progress makes film growth obvious without physical scales. */}
      <path
        d="M264 169Q301 163 320 193"
        fill="none"
        stroke="#9cc5ab"
        strokeDasharray="3 5"
        opacity={loaded ? 0.5 : 0.15}
      />
      <g opacity={loaded ? 1 : 0.2}>
        <rect
          x="315"
          y="153"
          width="149"
          height="175"
          rx="13"
          fill="#123729"
          stroke="#548568"
        />
        <text x="389" y="140" textAnchor="middle" fill="#b1ceb8" fontSize="13">
          {l(
            "표면 산화막 확대",
            "Surface oxide enlarged",
            "表面の酸化膜を拡大"
          )}
        </text>
        <rect
          x="329"
          y={siliconTop}
          width="121"
          height={310 - siliconTop}
          fill="#46775a"
          stroke="#85b492"
        />
        <path d="M330 287H449m-119 10h119" stroke="#80a98b" opacity=".3" />
        {oxideHeight > 0 ? (
          <rect
            className="gf-oxide-film"
            data-oxide-film="true"
            x="329"
            y={228 - progress * 28}
            width="121"
            height={oxideHeight}
            fill={teal}
            stroke="#c1f0d7"
            strokeWidth="1"
          />
        ) : null}
        {showGuide ? (
          <path
            d="M326 228H453"
            stroke={gold}
            strokeWidth="1.2"
            strokeDasharray="4 5"
            opacity=".5"
          />
        ) : null}
        <text x="389" y="277" textAnchor="middle" fill="#c1dac7" fontSize="18">
          Si
        </text>
        {progress > 0.12 ? (
          <text
            x="389"
            y={218 - progress * 28}
            textAnchor="middle"
            fill={teal}
            fontSize="17"
            fontWeight="600"
          >
            SiO₂
          </text>
        ) : null}
        {oxygen ? (
          <g className="gf-surface-oxygen" opacity={state.running ? 0.8 : 0.45}>
            {[346, 378, 411, 439].map((x, index) => (
              <g key={x} style={{ animationDelay: `${-index * 0.3}s` }}>
                <circle cx={x} cy="174" r="3" fill={teal} />
                <circle cx={x + 5} cy="173" r="3" fill={teal} />
              </g>
            ))}
          </g>
        ) : null}
      </g>
      {showGuide ? (
        <text x="389" y="350" textAnchor="middle" fill="#a9c7af" fontSize="12">
          {l(
            "실리콘 표면에 막 형성",
            "Film forms at the Si surface",
            "Si表面に膜を形成"
          )}
        </text>
      ) : null}
    </svg>
  );
}

export default function GenericFrontHandsOnScene(
  props: GenericHandsOnSceneProps
) {
  return props.processId === "oxidation" ? (
    <OxidationFurnace {...props} />
  ) : (
    <WaferInspection {...props} />
  );
}
