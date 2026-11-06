import React, { useId, type ReactNode } from "react";
import { tr } from "../lib/productLanguage";
import type { GenericHandsOnSceneProps } from "./hands-on-scene-types";
import "./generic-film-hands-on-scene.css";

const mint = "#88e9cb";
const gold = "#efc47f";
const ink = "#b0cebd";
const unit = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const sectionTop = 244;

function SelectableZone({
  enabled,
  selected,
  label,
  onSelect,
  children,
}: {
  enabled: boolean;
  selected: boolean;
  label: string;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <g
      className="gfhs-zone"
      role="button"
      tabIndex={enabled ? 0 : -1}
      aria-label={label}
      aria-pressed={selected}
      aria-disabled={!enabled}
      onClick={() => {
        if (enabled) onSelect();
      }}
      onKeyDown={event => {
        if (enabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      {children}
    </g>
  );
}

/** Original concept illustrations; progress is a fixed teaching sequence, not a process model. */
export default function GenericFilmHandsOnScene({
  processId,
  state,
  language,
  showGuide,
  onSelect,
}: GenericHandsOnSceneProps) {
  const id = `${useId().replace(/:/g, "")}-film-hands-on`;
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const metal = processId === "metal";
  const implant = !metal && state.mode === "implant";
  const loaded = state.stage >= 1;
  const supplied = state.stage >= 2;
  const prepared = state.stage >= 3;
  const progress = unit(state.progress);
  const strength = unit(state.level / 100);
  const selected =
    Math.abs(
      Math.trunc(Number.isFinite(state.selection) ? state.selection : 0)
    ) % 2;
  const canSelect =
    (state.stage === 1 || state.stage === 2) &&
    !state.running &&
    progress === 0;
  const materialCount = Math.round(4 + strength * 8);
  const filmHeight = 56 * progress;
  const metalThickness = 22 * progress;
  const mode = metal ? "metal" : implant ? "implant" : "film";
  const title = metal
    ? l(
        "금속 막·접촉부 만들기",
        "Form a metal film and contact",
        "金属膜・コンタクト形成"
      )
    : implant
      ? l(
          "실리콘 내부로 이온 넣기",
          "Place ions inside silicon",
          "シリコン内部へのイオン注入"
        )
      : l(
          "기판 위에 막 쌓기",
          "Grow a film on the substrate",
          "基板上への成膜"
        );
  const sourceLabel = metal
    ? l(
        "금속 타깃과 플라스마",
        "Metal target and plasma",
        "金属ターゲットとプラズマ"
      )
    : implant
      ? l("이온 빔 경로", "Ion-beam path", "イオンビームの経路")
      : l(
          "원료 공급과 반응 공간",
          "Feed and reaction space",
          "原料供給と反応空間"
        );
  const sectionLabel = metal
    ? l(
        "금속 막·접촉부 단면",
        "Metal film and contact section",
        "金属膜・コンタクト断面"
      )
    : implant
      ? l("실리콘 내부 관찰", "Inspect inside silicon", "シリコン内部を観察")
      : l("막·기판 단면", "Film and substrate section", "膜・基板の断面");

  return (
    <svg
      viewBox="0 0 480 360"
      className="gfhs-scene"
      role="group"
      aria-labelledby={`${id}-title ${id}-description`}
      data-mode={mode}
      data-stage={state.stage}
      data-running={state.running ? "true" : "false"}
      data-progress={progress.toFixed(3)}
      data-selection={selected}
    >
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-description`}>
        {l(
          "표면 위 막의 성장, 실리콘 내부 이온 표시, 금속 접촉부 형성을 구분하는 학습용 개념 그림입니다. 실제 장비 내부·막 두께·주입 깊이·공정 속도·품질을 재현하지 않습니다.",
          "A teaching concept that separates film growth above a surface, ion symbols inside silicon, and metal contact formation. It does not reproduce equipment internals, thickness, implantation depth, process rate or quality.",
          "表面上の膜成長、シリコン内部のイオン表示、金属コンタクト形成を区別する学習用概念図です。実装置の内部、膜厚、注入深さ、工程速度、品質を再現するものではありません。"
        )}
      </desc>
      <defs>
        <clipPath id={`${id}-section-clip`}>
          <rect x="36" y="188" width="408" height="128" rx="3" />
        </clipPath>
        <clipPath id={`${id}-silicon-clip`}>
          <rect x="37" y="220" width="406" height="94" />
        </clipPath>
      </defs>

      <SelectableZone
        enabled={canSelect}
        selected={selected === 0}
        label={sourceLabel}
        onSelect={() => onSelect(0)}
      >
        <rect
          className="gfhs-zone-outline"
          x="14"
          y="9"
          width="452"
          height="123"
          rx="12"
          fill="none"
          stroke={selected === 0 ? mint : "#36594b"}
          strokeWidth={selected === 0 ? 1.5 : 1}
        />
        {implant ? (
          <g aria-hidden="true">
            <rect
              x="28"
              y="31"
              width="80"
              height="57"
              rx="10"
              fill="#223e33"
              stroke="#87ad98"
              strokeWidth="1.5"
            />
            <path
              d="M108 45h190v28H108z"
              fill="#142b22"
              stroke="#7d9f8a"
              strokeWidth="1.5"
            />
            <path
              d="M298 45h37v51h-28V73h-9z"
              fill="#223e33"
              stroke="#87ad98"
              strokeWidth="1.5"
            />
            {[126, 149, 172, 195, 218, 241, 264, 287].map(x => (
              <path
                key={x}
                d={`M${x} 40v38`}
                stroke="#587d67"
                strokeWidth="2"
              />
            ))}
            <circle
              cx="68"
              cy="60"
              r="16"
              fill={supplied ? "#34644b" : "#183329"}
              stroke={supplied ? mint : "#6a927a"}
            />
            <path
              d="M63 60h10m-5-5v10"
              stroke={supplied ? "#bdffe2" : "#6a927a"}
              strokeWidth="2"
            />
            {supplied ? (
              <path
                className="gfhs-beam-path"
                d="M87 59H321V96"
                fill="none"
                stroke={mint}
                strokeWidth={4 + strength * 5}
                opacity={0.2 + strength * 0.65}
                strokeDasharray="8 7"
              />
            ) : null}
            {loaded ? (
              <path d="M279 102h84v7h-84z" fill="#759b87" stroke={ink} />
            ) : (
              <path
                d="M279 102h84v7h-84z"
                fill="none"
                stroke="#577966"
                strokeDasharray="4 4"
              />
            )}
            {prepared ? (
              <path
                d="M314 78v18m14-18v18m-17-3 10 8 10-8"
                fill="none"
                stroke={gold}
                strokeWidth="1.7"
              />
            ) : null}
            <text
              x="70"
              y="115"
              textAnchor="middle"
              fill="#a8c5b4"
              fontSize="11"
            >
              {l("이온원", "Ion source", "イオン源")}
            </text>
            <text
              x="210"
              y="108"
              textAnchor="middle"
              fill="#a8c5b4"
              fontSize="11"
            >
              {l("빔 경로", "Beam path", "ビーム経路")}
            </text>
          </g>
        ) : (
          <g aria-hidden="true">
            <path
              d="M144 33q0-14 14-14h164q14 0 14 14v70q0 13-14 13H158q-14 0-14-13z"
              fill="#1b352a"
              stroke="#90b29b"
              strokeWidth="1.7"
            />
            <path d="M158 39h164v57H158z" fill="#10271e" stroke="#3c6250" />
            {metal ? (
              <>
                <rect
                  x="167"
                  y="30"
                  width="146"
                  height="13"
                  rx="3"
                  fill="#a99562"
                  stroke={gold}
                  strokeWidth="1.3"
                />
                {supplied ? (
                  <ellipse
                    className="gfhs-plasma"
                    cx="240"
                    cy="69"
                    rx="67"
                    ry="22"
                    fill="#a9a4e2"
                    opacity={0.13 + strength * 0.22}
                  />
                ) : null}
                <rect
                  x="36"
                  y="44"
                  width="74"
                  height="42"
                  rx="8"
                  fill="#213e32"
                  stroke="#78a18a"
                />
                <path
                  d="M48 65q5-15 10 0t10 0t10 0h18M110 66h33"
                  fill="none"
                  stroke={supplied ? gold : "#688c77"}
                  strokeWidth="2.2"
                />
                {prepared
                  ? Array.from({ length: materialCount }, (_, i) => (
                      <circle
                        key={i}
                        className="gfhs-source-particle"
                        cx={177 + i * (126 / Math.max(1, materialCount - 1))}
                        cy={54 + ((i * 19 + progress * 47) % 34)}
                        r="2.5"
                        fill={gold}
                      />
                    ))
                  : null}
                <text x="379" y="39" fill={gold} fontSize="11">
                  {l("타깃", "Target", "ターゲット")}
                </text>
                <path d="M371 36H315" stroke="#8e9f78" strokeWidth="1" />
              </>
            ) : (
              <>
                <path
                  d="M78 42h96v8"
                  fill="none"
                  stroke={supplied ? mint : "#6d947e"}
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                <path
                  d="M201 14v22m78-22v22"
                  stroke="#6d947e"
                  strokeWidth="6"
                />
                <rect
                  x="168"
                  y="38"
                  width="144"
                  height="9"
                  rx="2"
                  fill="#426b55"
                  stroke="#94bda2"
                />
                {[180, 200, 220, 240, 260, 280, 300].map(x => (
                  <circle key={x} cx={x} cy="43" r="1.5" fill="#142c20" />
                ))}
                {supplied
                  ? Array.from({ length: materialCount }, (_, i) => (
                      <g
                        key={i}
                        className="gfhs-feed-mark"
                        opacity={0.3 + strength * 0.6}
                      >
                        <path
                          d={`M${175 + i * (130 / Math.max(1, materialCount - 1))} 54v25`}
                          stroke={mint}
                          strokeWidth="1.5"
                          strokeDasharray="3 5"
                        />
                      </g>
                    ))
                  : null}
                {prepared ? (
                  <ellipse
                    className="gfhs-reaction"
                    cx="240"
                    cy="74"
                    rx="63"
                    ry="16"
                    fill={mint}
                    opacity=".1"
                  />
                ) : null}
                <text
                  x="73"
                  y="30"
                  textAnchor="middle"
                  fill="#acd0bc"
                  fontSize="11"
                >
                  {l("원료", "Feed", "原料")}
                </text>
              </>
            )}
            {loaded ? (
              <path d="M178 93h124v7H178z" fill="#759c86" stroke={ink} />
            ) : (
              <path
                d="M178 93h124v7H178z"
                fill="none"
                stroke="#557965"
                strokeDasharray="4 4"
              />
            )}
            <path d="M190 101v6h100v-6" fill="#284c39" stroke="#658f75" />
          </g>
        )}
      </SelectableZone>

      <g aria-hidden="true">
        {showGuide ? (
          <path
            d="M222 137l18 15 18-15m-18-3v17"
            fill="none"
            stroke="#b3ccb7"
            strokeWidth="1.4"
          />
        ) : null}
        <text
          x="240"
          y="175"
          textAnchor="middle"
          fill="#c4d9c8"
          fontSize="13"
          fontWeight="600"
        >
          {sectionLabel}
        </text>
      </g>
      <SelectableZone
        enabled={canSelect}
        selected={selected === 1}
        label={sectionLabel}
        onSelect={() => onSelect(1)}
      >
        <rect
          className="gfhs-zone-outline"
          x="14"
          y="186"
          width="452"
          height="137"
          rx="12"
          fill="none"
          stroke={selected === 1 ? mint : "#36594b"}
          strokeWidth={selected === 1 ? 1.5 : 1}
        />
        {!loaded ? (
          <g aria-hidden="true">
            <rect
              x="36"
              y="238"
              width="408"
              height="69"
              rx="4"
              fill="none"
              stroke="#658771"
              strokeDasharray="7 6"
            />
            <text
              x="240"
              y="279"
              textAnchor="middle"
              fill="#9cbba6"
              fontSize="13"
            >
              {l(
                "먼저 기판을 투입해보세요",
                "Load a substrate first",
                "先に基板を投入してみよう"
              )}
            </text>
          </g>
        ) : metal ? (
          <g aria-hidden="true" data-material="metal">
            <path
              d="M40 220H184V287H296V220H440V310H40Z"
              fill="#315747"
              stroke="#8faf97"
              strokeWidth="1.5"
            />
            <path
              d="M40 249H184M296 249H440M40 280H184M296 280H440M40 302H440"
              stroke="#527c61"
              strokeWidth="1.1"
            />
            <path d="M207 287h66v16h-66z" fill="#79947c" stroke="#a4baa0" />
            {progress > 0 ? (
              <path
                className="gfhs-grown-metal"
                data-film-thickness={metalThickness.toFixed(2)}
                d={`M40 ${220 - metalThickness}H${184 + metalThickness}V${287 - metalThickness}H${296 - metalThickness}V${220 - metalThickness}H440V220H296V287H184V220H40Z`}
                fill={gold}
                stroke="#ffdea2"
                strokeWidth="1.2"
              />
            ) : null}
            {state.running ? (
              <g className="gfhs-growing-stream">
                {[80, 132, 210, 268, 346, 402].map((x, i) => (
                  <path
                    key={x}
                    d={`M${x} 194v${i === 2 || i === 3 ? 60 : 16}`}
                    stroke={gold}
                    strokeWidth="2"
                    strokeDasharray="3 7"
                    opacity={0.25 + strength * 0.6}
                  />
                ))}
              </g>
            ) : null}
            <text
              x="239"
              y="253"
              textAnchor="middle"
              fill="#cad6be"
              fontSize="11"
            >
              {l("접촉부", "Contact", "コンタクト")}
            </text>
            {showGuide ? (
              <path
                d="M184 211v-8h112v8"
                fill="none"
                stroke="#8eb79c"
                strokeDasharray="3 4"
              />
            ) : null}
          </g>
        ) : implant ? (
          <g aria-hidden="true" data-material="silicon">
            <rect
              x="36"
              y="220"
              width="408"
              height="94"
              rx="3"
              fill="#315747"
              stroke="#8faf97"
              strokeWidth="1.5"
            />
            <g clipPath={`url(#${id}-silicon-clip)`}>
              {[0, 1, 2, 3].flatMap(row =>
                [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(column => (
                  <g key={`${row}-${column}`}>
                    <path
                      d={`M${52 + column * 42} ${234 + row * 24}h25m-12-12v24`}
                      stroke="#5d876c"
                      strokeWidth=".7"
                      opacity=".45"
                    />
                    <circle
                      cx={65 + column * 42}
                      cy={234 + row * 24}
                      r="3"
                      fill="#71967a"
                      opacity=".6"
                    />
                  </g>
                ))
              )}
              {Array.from({ length: Math.floor(progress * 36) }, (_, i) => {
                const x = 55 + ((i * 71) % 366);
                const y = 236 + ((i * 31) % 64);
                return (
                  <g
                    key={i}
                    className="gfhs-implanted-ion"
                    data-implanted-ion="true"
                    transform={`translate(${x} ${y})`}
                  >
                    <circle
                      r="5.4"
                      fill={gold}
                      stroke="#fff0bd"
                      strokeWidth=".65"
                    />
                    <path
                      d="M-2.3 0h4.6M0-2.3v4.6"
                      stroke="#435c41"
                      strokeWidth="1"
                    />
                  </g>
                );
              })}
            </g>
            {state.running ? (
              <g
                className="gfhs-beam-to-silicon"
                opacity={0.25 + strength * 0.65}
              >
                {[80, 160, 240, 320, 400].map(x => (
                  <g key={x}>
                    <path
                      d={`M${x} 191V230`}
                      stroke={mint}
                      strokeWidth={2 + strength * 3}
                      strokeDasharray="4 6"
                    />
                    <path
                      d={`M${x - 4} 214l4 6 4-6`}
                      fill="none"
                      stroke={mint}
                      strokeWidth="1.6"
                    />
                  </g>
                ))}
              </g>
            ) : null}
            <text x="430" y="305" textAnchor="end" fill="#b5cfbb" fontSize="11">
              Si
            </text>
            {showGuide ? (
              <path
                d="M43 221H437"
                stroke="#9bc2a6"
                strokeDasharray="4 5"
                strokeWidth="1.2"
              />
            ) : null}
          </g>
        ) : (
          <g aria-hidden="true" data-material="film">
            <rect
              x="36"
              y={sectionTop}
              width="408"
              height="76"
              rx="3"
              fill="#315747"
              stroke="#8faf97"
              strokeWidth="1.5"
            />
            <path
              d="M36 265H444M36 291H444"
              stroke="#4f785e"
              strokeWidth="1.2"
            />
            <path
              d="M50 250l30 12m12-12 30 12m12-12 30 12m12-12 30 12m12-12 30 12m12-12 30 12m12-12 30 12m12-12 30 12m12-12 30 12"
              stroke="#709179"
              strokeWidth=".8"
              opacity=".3"
            />
            {progress > 0 ? (
              <g
                className="gfhs-grown-film"
                data-film-height={filmHeight.toFixed(2)}
              >
                <rect
                  x="36"
                  y={sectionTop - filmHeight}
                  width="408"
                  height={filmHeight}
                  fill={mint}
                  fillOpacity=".75"
                  stroke="#c3ffe0"
                  strokeWidth="1.2"
                />
                {[1, 2, 3, 4, 5, 6, 7]
                  .filter(layer => layer * 8 < filmHeight)
                  .map(layer => (
                    <path
                      key={layer}
                      d={`M37 ${sectionTop - layer * 8}H443`}
                      stroke="#3b8d72"
                      strokeWidth="1"
                      opacity=".5"
                    />
                  ))}
              </g>
            ) : null}
            {state.running ? (
              <g
                className="gfhs-growing-stream"
                opacity={0.25 + strength * 0.6}
              >
                {[68, 120, 172, 224, 276, 328, 380, 424].map(x => (
                  <path
                    key={x}
                    d={`M${x} 191V${Math.max(192, sectionTop - filmHeight - 3)}`}
                    stroke={mint}
                    strokeWidth="1.8"
                    strokeDasharray="3 6"
                  />
                ))}
              </g>
            ) : null}
            <text
              x="240"
              y="289"
              textAnchor="middle"
              fill="#bed8c5"
              fontSize="12"
            >
              {l("기판", "Substrate", "基板")}
            </text>
            {showGuide ? (
              <path
                d={`M29 ${sectionTop}H451`}
                stroke={gold}
                strokeWidth="1.2"
                strokeDasharray="4 5"
              />
            ) : null}
          </g>
        )}
      </SelectableZone>
      <text
        x="240"
        y="347"
        textAnchor="middle"
        fill={implant ? gold : mint}
        fontSize={language === "en" ? 11.5 : 12}
        fontWeight="600"
      >
        {implant
          ? l(
              "표면 위 막이 아니라, 실리콘 내부의 이온",
              "Ions inside silicon — a separate operation from film growth",
              "表面の膜ではなく、シリコン内部のイオン"
            )
          : metal
            ? l(
                "표면과 접촉부에 금속 막이 형성돼요",
                "A metal layer forms on the surface and contact",
                "表面とコンタクトに金属膜が形成されます"
              )
            : l(
                "진행할수록 기판 위의 막이 두꺼워져요",
                "The film visibly grows above the substrate",
                "進行すると基板上の膜が厚くなります"
              )}
      </text>
    </svg>
  );
}
