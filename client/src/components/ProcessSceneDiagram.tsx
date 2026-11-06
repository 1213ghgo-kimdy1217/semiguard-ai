import React, { useId } from "react";
import type { ProcessSceneState } from "../../../shared/processScene";
import { tr, type ProductLanguage } from "../lib/productLanguage";

type SceneProps = { scene: ProcessSceneState; language: ProductLanguage };
const ink = "#99baae";
const teal = "#8bd4c2";
const gold = "#e2b974";
const panel = "#1c302a";
const surface = "#314c43";
const bounded = (value: number) => Number.isFinite(value) ? Math.max(-2, Math.min(2, value)) : 0;
const channel = (scene: ProcessSceneState, id: string) => bounded(scene.channels.find(item => item.id === id)?.delta ?? 0);

function Leader({ d, x, y }: { d: string; x: number; y: number }) {
  return <g fill="none" stroke={ink} strokeWidth="1.5" opacity=".5" aria-hidden="true">
    <path d={d} strokeDasharray="4 6" /><circle cx={x} cy={y} r="4" fill={ink} stroke="none" />
  </g>;
}

/** The moving dot encodes a relative index; it is not equipment geometry. */
function IndexStrip({ x, y, delta, width = 104 }: { x: number; y: number; delta: number; width?: number }) {
  const current = width / 2 + bounded(delta) * width * .19;
  return <g transform={`translate(${x} ${y})`} aria-hidden="true">
    <rect x="0" y="0" width={width} height="29" rx="7" fill="#11251e" stroke="#48685a" />
    <path d={`M10 14.5H${width - 10}`} stroke={ink} opacity=".45" />
    <path d={`M${width / 2} 5V24`} stroke={gold} strokeDasharray="2 3" />
    <circle cx={current} cy="14.5" r="4.5" fill={teal} />
  </g>;
}

function IndexGauge({ x, y, delta, radius = 25 }: { x: number; y: number; delta: number; radius?: number }) {
  const angle = (-90 + bounded(delta) * 31) * Math.PI / 180;
  return <g transform={`translate(${x} ${y})`} aria-hidden="true">
    <circle r={radius} fill="#13271f" stroke="#709b88" strokeWidth="2" />
    <path d={`M${-radius * .76} ${radius * .33}A${radius * .82} ${radius * .82} 0 1 1 ${radius * .76} ${radius * .33}`} fill="none" stroke={ink} opacity=".4" strokeWidth="3" />
    <path d={`M0 0L${Math.cos(angle) * radius * .67} ${Math.sin(angle) * radius * .67}`} stroke={teal} strokeWidth="3" strokeLinecap="round" />
    <circle r="3" fill={teal} /><path d={`M0 ${-radius * .83}v5`} stroke={gold} strokeWidth="2" />
  </g>;
}

function Frame({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return <rect x={x} y={y} width={width} height={height} rx="16" fill={panel} stroke="#597967" strokeWidth="2" />;
}

function WaferScene({ scene }: Pick<SceneProps, "scene">) {
  const delta = channel(scene, "surface");
  return <>
    <path d="M242 295V120h116v30H280v145m238 0V120H402v30h78v145" fill="none" stroke={ink} strokeWidth="9" />
    <rect x="350" y="107" width="100" height="45" rx="10" fill={surface} stroke={ink} />
    <path d="M372 152l-33 77h122l-33-77" fill={teal} opacity=".06" stroke={teal} strokeDasharray="4 5" />
    <ellipse cx="400" cy="242" rx="146" ry="62" fill="#28443b" stroke={ink} strokeWidth="2" />
    <ellipse cx="400" cy="242" rx="121" ry="47" fill="none" stroke="#527969" strokeDasharray="5 8" />
    <path d="M377 300l7-8h32l7 8" stroke={ink} fill="none" />
    <path d="M290 242H510M400 199v86" stroke="#45695b" strokeWidth="1" />
    <circle cx="365" cy="236" r="29" fill="#11281f" stroke={teal} strokeWidth="1.5" />
    <path d={`M344 236h42M365 218v36`} stroke={ink} opacity=".4" />
    <circle cx={365 + delta * 7} cy="236" r="5" fill={teal} />
    <rect x="286" y="317" width="228" height="10" rx="3" fill={surface} stroke={ink} />
    <path d="M277 307v30m246-30v30M271 307h12m-12 30h12m234-30h12m-12 30h12" fill="none" stroke={ink} />
    <IndexStrip x={348} y={333} delta={channel(scene, "thickness")} />
    <Leader d="M180 70H240V184L342 224" x={342} y={224} />
    <Leader d="M620 70H565V322H523" x={523} y={322} />
  </>;
}

function OxidationScene({ scene }: Pick<SceneProps, "scene">) {
  return <>
    <Frame x={212} y={113} width={376} height={220} />
    <path d="M245 283h310v32H245z" fill={surface} stroke={ink} />
    <path d="M245 266h310v17H245z" fill="#a4caba" opacity=".8" stroke={teal} />
    <path d="M263 245h274" stroke={gold} strokeWidth="2" strokeDasharray="5 5" />
    <path d="M293 145v61m107-61v61m107-61v61" stroke={teal} opacity=".5" strokeWidth="2" />
    <path d="M287 199l6 7 6-7m95 0 6 7 6-7m95 0 6 7 6-7" fill="none" stroke={teal} opacity=".5" />
    <IndexStrip x={251} y={215} width={116} delta={channel(scene, "film")} />
    <IndexStrip x={433} y={215} width={116} delta={channel(scene, "uniformity")} />
    <path d="M258 249v11m289-11v11" stroke={ink} strokeDasharray="2 3" />
    <rect x="363" y="102" width="74" height="27" rx="7" fill={surface} stroke={ink} />
    <Leader d="M180 70H217V196L278 218" x={278} y={218} />
    <Leader d="M620 70H583V196L521 218" x={521} y={218} />
  </>;
}

function PhotoScene({ scene }: Pick<SceneProps, "scene">) {
  const offset = channel(scene, "position") * 13;
  const width = 27 + channel(scene, "shape") * 5;
  return <>
    <Frame x={201} y={105} width={398} height={229} />
    <rect x="345" y="120" width="110" height="27" rx="6" fill={surface} stroke={ink} />
    <path d="M360 149l-28 57h136l-28-57" fill={gold} opacity=".07" />
    <path d="M381 150v41m19-41v41m19-41v41" stroke={gold} opacity=".65" strokeWidth="2" />
    <path d="M292 201h80m28 0h31m28 0h49" stroke={ink} strokeWidth="9" />
    <path d="M248 295h304v20H248z" fill={surface} stroke={ink} />
    {[286, 350, 414, 478].map(x => <g key={x}>
      <rect x={x - (width - 27) / 2 + offset} y="240" width={width} height="55" rx="3" fill={teal} opacity=".7" stroke={teal} />
      <rect x={x} y="240" width="27" height="55" rx="3" fill="none" stroke={gold} strokeDasharray="4 4" />
    </g>)}
    <path d="M254 225h290" stroke="#506b5e" strokeDasharray="4 6" />
    <Leader d="M180 70H231V213L294 250" x={294} y={250} />
    <Leader d="M620 70H569V213L493 267" x={493} y={267} />
  </>;
}

function EtchScene({ scene }: Pick<SceneProps, "scene">) {
  return <>
    <rect x="286" y="133" width="252" height="188" rx="29" fill={panel} stroke={ink} strokeWidth="3" />
    <path d="M397 88v45M538 229h58v61M222 257h64" stroke={ink} strokeWidth="9" fill="none" />
    <rect x="347" y="84" width="100" height="31" rx="8" fill={surface} stroke={ink} />
    <IndexStrip x={352} y={85} width={90} delta={channel(scene, "flow")} />
    <ellipse cx="411" cy="220" rx="78" ry="30" fill="#8f7ba3" opacity=".13" stroke="#b5a3c8" strokeWidth="2" />
    <path d="M321 277h181v10H321z" fill={gold} opacity=".75" />
    <path d="M311 288h201v14H311z" fill={surface} stroke={ink} />
    <IndexGauge x={410} y={171} delta={channel(scene, "pressure")} radius={25} />
    <Frame x={188} y={216} width={77} height={98} />
    <text x="226" y="241" textAnchor="middle" fill={ink} fontSize="13" fontWeight="700">RF</text>
    <path d="M200 259q6-13 12 0t12 0t12 0t12 0" fill="none" stroke={gold} strokeWidth="2" />
    <IndexStrip x={196} y={275} width={61} delta={channel(scene, "rf")} />
    <IndexGauge x={595} y={283} delta={channel(scene, "temperature")} radius={23} />
    <path d="M579 310h32v12h-32zM380 322v21m63-21v21" fill="none" stroke={ink} strokeWidth="3" />
    <Leader d="M180 70H251V171H381" x={381} y={171} />
    <Leader d="M620 70H504V99H446" x={446} y={99} />
    <Leader d="M180 370H225V313" x={225} y={313} />
    <Leader d="M620 370H595V308" x={595} y={308} />
  </>;
}

function DepositionScene({ scene, language }: SceneProps) {
  return <>
    <Frame x={191} y={113} width={199} height={220} />
    <Frame x={410} y={113} width={199} height={220} />
    <path d="M400 127v183" stroke={ink} opacity=".25" strokeDasharray="4 6" />
    <text x="290" y="145" textAnchor="middle" fill={ink} fontSize="13">{tr(language, "증착 결과 검사", "Film inspection", "成膜結果の検査")}</text>
    <text x="510" y="145" textAnchor="middle" fill={ink} fontSize="13">{tr(language, "별도 전기적 검사", "Separate electrical test", "別の電気的検査")}</text>
    <rect x="218" y="258" width="146" height="46" rx="3" fill={surface} stroke={ink} />
    <rect x="218" y="244" width="146" height="14" fill={gold} opacity=".75" />
    <path d="M240 174v40m50-40v40m50-40v40" stroke={teal} opacity=".5" strokeWidth="2" />
    <path d="M235 207l5 7 5-7m40 0 5 7 5-7m40 0 5 7 5-7" fill="none" stroke={teal} opacity=".5" />
    <IndexStrip x={239} y={316} delta={channel(scene, "film")} />
    <rect x="439" y="258" width="143" height="46" rx="3" fill={surface} stroke={ink} />
    {[462, 494, 526, 558].map((x, index) => <circle key={x} cx={x} cy={278 + index % 2 * 10} r="3" fill={gold} opacity=".7" />)}
    <path d="M457 173v71m35-71v71m35-71v71m35-71v71" stroke={teal} strokeWidth="2" opacity=".5" />
    <path d="M453 236l4 8 4-8m27 0 4 8 4-8m27 0 4 8 4-8m27 0 4 8 4-8" fill="none" stroke={teal} opacity=".5" />
    <IndexStrip x={458} y={316} delta={channel(scene, "electrical")} />
    <Leader d="M180 70H258V106" x={258} y={106} />
    <Leader d="M620 70H543V106" x={543} y={106} />
  </>;
}

function MetalScene({ scene }: Pick<SceneProps, "scene">) {
  return <>
    <Frame x={208} y={111} width={384} height={224} />
    <path d="M231 289h337v27H231z" fill={surface} stroke={ink} />
    <rect x="249" y="273" width="49" height="16" fill="#9ebbb0" />
    <rect x="504" y="273" width="43" height="16" fill="#9ebbb0" />
    <path d="M273 273v-45h90v-58h120v103m-80-103v46h122" fill="none" stroke={gold} strokeWidth="9" strokeLinejoin="round" />
    <path d="M235 187h79v58h107m-56 0v44" fill="none" stroke={ink} opacity=".65" strokeWidth="6" />
    <path d="M331 141v155m140-155v155" stroke="#3e5b4d" strokeDasharray="5 8" />
    <IndexStrip x={228} y={122} width={103} delta={channel(scene, "connection")} />
    <circle cx="532" cy="213" r="35" fill="#10251d" fillOpacity=".82" stroke={ink} strokeWidth="2" />
    <path d="M515 200h22v25h15" fill="none" stroke={gold} strokeWidth="5" />
    <path d={`M${512 + channel(scene, "appearance") * 6} 190v45`} stroke={teal} strokeWidth="2" />
    <path d="M556 239l20 21" stroke={ink} strokeWidth="8" strokeLinecap="round" />
    <Leader d="M180 70H251V116" x={251} y={116} />
    <Leader d="M620 70H575V166L550 188" x={550} y={188} />
  </>;
}

function EdsScene({ scene }: Pick<SceneProps, "scene">) {
  return <>
    <ellipse cx="363" cy="246" rx="148" ry="77" fill={panel} stroke={ink} strokeWidth="2" />
    <ellipse cx="363" cy="246" rx="127" ry="61" fill="none" stroke="#466c58" strokeDasharray="5 7" />
    {[0, 1, 2].flatMap(row => [0, 1, 2, 3, 4].map(column => <rect key={`${row}-${column}`} x={267 + column * 41} y={205 + row * 30} width="29" height="21" rx="3" fill={surface} stroke="#5b8870" />))}
    <path d="M302 111h120v35H302z" fill={surface} stroke={ink} strokeWidth="2" />
    <path d="M319 147v43m21-43v43m21-43v43m21-43v43m21-43v43" stroke={gold} strokeWidth="3" />
    <path d="M362 94v16M225 325h280" stroke={ink} strokeWidth="4" />
    <Frame x={515} y={156} width={86} height={154} />
    <path d="M528 180h60v54h-60z" fill="#11251e" stroke={ink} />
    <IndexGauge x={558} y={207} radius={20} delta={channel(scene, "comparison")} />
    <IndexStrip x={528} y={258} width={60} delta={channel(scene, "die")} />
    <path d="M510 249h-21" fill="none" stroke={ink} strokeWidth="3" />
    <Leader d="M180 70H242V175L284 213" x={284} y={213} />
    <Leader d="M620 70H558V150" x={558} y={150} />
  </>;
}

function PackagingScene({ scene }: Pick<SceneProps, "scene">) {
  return <>
    <path d="M234 288V142q0-27 27-27h279q27 0 27 27v146" fill={panel} stroke={ink} strokeWidth="2" strokeDasharray="7 5" />
    <rect x="222" y="289" width="357" height="23" rx="4" fill={surface} stroke={ink} strokeWidth="2" />
    <rect x="333" y="251" width="134" height="38" rx="4" fill="#7caa96" stroke={ink} />
    <rect x="340" y="243" width="120" height="8" fill="#a5bfaf" />
    <path d="M344 246Q297 171 264 289m184-43q48-75 88 43" fill="none" stroke={gold} strokeWidth="4" />
    <path d="M263 312v19h-47m321-19v19h47" fill="none" stroke={gold} strokeWidth="5" />
    <IndexStrip x={251} y={155} width={106} delta={channel(scene, "connection")} />
    <path d="M304 190v22" stroke={ink} opacity=".5" strokeDasharray="3 4" />
    <IndexGauge x={513} y={171} radius={25} delta={channel(scene, "appearance")} />
    <path d="M491 195l-14 14" stroke={ink} strokeWidth="5" />
    <Leader d="M180 70H271V149" x={271} y={149} />
    <Leader d="M620 70H544V142L531 152" x={531} y={152} />
  </>;
}

export default function ProcessSceneDiagram({ scene, language }: SceneProps) {
  const id = useId();
  const names = {
    wafer: ["웨이퍼 표면·두께 검사", "Wafer surface and thickness inspection", "ウェーハ表面・厚さ検査"],
    oxidation: ["산화막 검사", "Oxide-film inspection", "酸化膜検査"],
    photo: ["패턴 위치·형상 검사", "Pattern position and shape inspection", "パターン位置・形状検査"],
    etch: ["식각 챔버 관측", "Etch chamber observation", "エッチングチャンバー観測"],
    deposition: ["증착·이온 주입의 별도 검사", "Separate deposition and implantation inspections", "成膜・イオン注入の別々の検査"],
    metal: ["금속 배선 연결·외관 검사", "Interconnect connection and appearance inspection", "金属配線の接続・外観検査"],
    eds: ["웨이퍼 칩 검사", "Wafer die inspection", "ウェーハチップ検査"],
    packaging: ["패키지 연결·외관 검사", "Package connection and appearance inspection", "パッケージ接続・外観検査"],
  } as const;
  const copy = names[scene.processId];
  const title = tr(language, copy[0], copy[1], copy[2]);
  return <svg viewBox="0 0 800 440" className="pv-diagram" role="img" aria-labelledby={`${id}-title ${id}-description`} data-process-scene={scene.processId}>
    <title id={`${id}-title`}>{title}</title>
    <desc id={`${id}-description`}>{tr(language,
      "관련 위치 옆의 움직이는 점과 바늘은 선택 시점의 교육용 상대지수를 나타냅니다. 물리 치수·실제 장비 상태·고장 위치를 그린 것이 아닙니다.",
      "Moving dots and needles beside related locations encode the selected teaching-only relative indices. They are not physical dimensions, actual equipment conditions or fault locations.",
      "関連位置の横の点と針は選択時点の教育用相対指数を表します。物理寸法・実際の装置状態・故障位置を描いたものではありません。")}</desc>
    <g fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M188 355H612M188 92H612" stroke="#2b4538" strokeDasharray="3 9" opacity=".65" />
      {scene.processId === "wafer" ? <WaferScene scene={scene} /> : null}
      {scene.processId === "oxidation" ? <OxidationScene scene={scene} /> : null}
      {scene.processId === "photo" ? <PhotoScene scene={scene} /> : null}
      {scene.processId === "etch" ? <EtchScene scene={scene} /> : null}
      {scene.processId === "deposition" ? <DepositionScene scene={scene} language={language} /> : null}
      {scene.processId === "metal" ? <MetalScene scene={scene} /> : null}
      {scene.processId === "eds" ? <EdsScene scene={scene} /> : null}
      {scene.processId === "packaging" ? <PackagingScene scene={scene} /> : null}
    </g>
  </svg>;
}
