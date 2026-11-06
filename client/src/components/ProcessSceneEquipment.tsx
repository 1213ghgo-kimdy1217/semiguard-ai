import React, { useId } from "react";
import { tr } from "../lib/productLanguage";
import { Bolt, IndexGauge, IndexStrip, Leader, SceneDefs, SceneLabel, channel, paint, palette, type SceneProps } from "./ProcessScenePrimitives";

const { ink, muted, teal, gold, panel, dark, violet } = palette;

/** An original teaching cutaway; fittings describe structure, not sensor placement. */
export function DetailedEtchScene({ scene, language }: SceneProps) {
  const id = useId().replace(/:/g, "");
  return <g>
    <SceneDefs id={id} />
    {/* The gas manifold, shut-off symbol and perforated distribution plate. */}
    <path d="M280 111h120v38" fill="none" stroke={muted} strokeWidth="13" />
    <path d="M280 111h120v38" fill="none" stroke={paint(id, "edge")} strokeWidth="8" />
    <path d="M297 103l14 8-14 8zm28 0-14 8 14 8z" fill={panel} stroke={ink} strokeWidth="1.2" />
    <path d="M311 102V91m-8 0h16" stroke={ink} strokeWidth="2" />
    <rect x="346" y="91" width="108" height="32" rx="7" fill={paint(id, "steel")} stroke={ink} />
    <IndexStrip x={351} y={95} width={98} delta={channel(scene, "flow")} />
    <path d="M392 132h16v16h-16z" fill={paint(id, "edge")} stroke={ink} />

    {/* Flanges, wall section, service ribs and replaceable chamber liner. */}
    <path d="M291 157v145q0 17 18 17h204q20 0 20-20V157" fill={paint(id, "steel")} stroke={ink} strokeWidth="2" />
    <path d="M293 158v143q0 15 17 15h203q17 0 17-15V158" fill={paint(id, "hatch")} />
    <rect x="304" y="162" width="215" height="141" rx="16" fill={dark} stroke="#658879" strokeWidth="1.5" />
    <path d="M316 174v112m192-112v112M315 289h193" stroke="#405e51" strokeWidth="3" />
    <path d="M283 145h257v14H283z" fill={paint(id, "edge")} stroke={ink} strokeWidth="1.5" />
    <path d="M291 142q4-16 24-16h194q19 0 22 16" fill={paint(id, "steel")} stroke={ink} strokeWidth="1.5" />
    {[297, 322, 347, 372, 397, 422, 447, 472, 497, 525].map(x => <Bolt key={x} x={x} y={152} r={2.3} />)}
    {[183, 211, 239, 267, 295].map(y => <g key={y}><Bolt x={298} y={y} r={2.2} /><Bolt x={526} y={y} r={2.2} /></g>)}
    <rect x="328" y="170" width="170" height="12" rx="3" fill={paint(id, "edge")} stroke={ink} />
    {[339, 353, 367, 381, 395, 409, 423, 437, 451, 465, 479, 491].map(x => <g key={x}>
      <circle cx={x} cy="177" r="1.3" fill={dark} />
      <path d={`M${x} 185v11`} stroke={teal} strokeWidth="1" opacity=".4" />
    </g>)}
    <ellipse cx="413" cy="222" rx="93" ry="34" fill={paint(id, "glow")} />
    <path d="M340 217q36-14 73 0t73 0M345 232q34-12 68 0t68 0" fill="none" stroke={violet} strokeWidth="1" opacity=".24" />
    <path d="M338 263h151v8H338z" fill={paint(id, "wafer")} stroke={ink} strokeWidth="1" />
    <path d="M330 272h166v13H330z" fill={paint(id, "edge")} stroke={ink} />
    <path d="M346 285h135v10H346zM373 296h81v18h-81z" fill={paint(id, "steel")} stroke={muted} />
    <path d="M355 280h119m-119 4h119" stroke={teal} strokeWidth=".9" opacity=".5" />
    <path d="M372 321v17h-21m105-17v17h21" stroke={ink} strokeWidth="4" fill="none" />

    {/* Matching network and insulated RF feedthrough. */}
    <rect x="209" y="218" width="69" height="88" rx="8" fill={paint(id, "steel")} stroke={ink} strokeWidth="1.4" />
    <path d="M216 224h55v75h-55z" fill={dark} stroke={muted} />
    <text x="243" y="239" textAnchor="middle" fill={ink} stroke="none" fontSize="12" fontWeight="700">RF</text>
    <path d="M223 254h5q3-10 6 0t6 0t6 0h8m2-8v16m4-16v16m0-8h7" fill="none" stroke={gold} strokeWidth="1.5" />
    <path d="M278 267h20v23h30" fill="none" stroke={gold} strokeWidth="4" />
    <path d="M291 281v16m5-16v16m5-16v16" stroke={ink} strokeWidth="3" />
    <IndexStrip x={222} y={274} width={44} delta={channel(scene, "rf")} />
    {[226, 238, 250, 262].map(x => <path key={x} d={`M${x} 310v4`} stroke={muted} strokeWidth="2" />)}

    {/* Independent observation glyphs retain the original synthetic values. */}
    <path d="M304 182h-25v-12" fill="none" stroke={ink} strokeWidth="3" />
    <IndexGauge x={269} y={170} radius={19} delta={channel(scene, "pressure")} />
    <path d="M498 280h44v-84h7" fill="none" stroke={ink} strokeWidth="2" />
    <IndexGauge x={569} y={196} radius={19} delta={channel(scene, "temperature")} />
    <path d="M532 239h42v73" fill="none" stroke={muted} strokeWidth="12" />
    <path d="M532 239h42v73" fill="none" stroke={paint(id, "edge")} strokeWidth="7" />
    <path d="M565 294l9-10 9 10-9 10z" fill={panel} stroke={ink} strokeWidth="1.2" />
    <path d="M582 294h9m0-6v12" stroke={ink} strokeWidth="1.5" />
    <rect x="551" y="312" width="47" height="28" rx="6" fill={paint(id, "steel")} stroke={ink} />
    <circle cx="565" cy="326" r="7" fill={dark} stroke={muted} />
    {[0, 1, 2].map(i => <path key={i} d={`M${580 + i * 4} 318v16`} stroke={muted} />)}

    <SceneLabel x={413} y={207}>{tr(language, "가스 분배판", "Gas distributor", "ガス分配板")}</SceneLabel>
    <SceneLabel x={411} y={252}>{tr(language, "웨이퍼 · 척", "Wafer · chuck", "ウェーハ・チャック")}</SceneLabel>
    <SceneLabel x={243} y={335}>{tr(language, "RF 정합부", "RF matching", "RF整合部")}</SceneLabel>
    <SceneLabel x={574} y={358}>{tr(language, "배기 계통", "Exhaust", "排気系統")}</SceneLabel>
    <Leader d="M180 70H241V147L253 158" x={253} y={158} />
    <Leader d="M620 70H503V107H454" x={454} y={107} />
    <Leader d="M180 370H243V307" x={243} y={307} />
    <Leader d="M620 370H611V196H592" x={592} y={196} />
  </g>;
}

/** A furnace context above two separate, symbolic film-inspection windows. */
export function DetailedOxidationScene({ scene, language }: SceneProps) {
  const id = useId().replace(/:/g, "");
  return <g>
    <SceneDefs id={id} />
    {/* Three heater zones surround the transparent teaching section. */}
    <path d="M230 150h336v119H230z" fill={paint(id, "steel")} stroke={ink} strokeWidth="1.7" />
    <path d="M237 156h322v106H237z" fill={paint(id, "hatch")} stroke={muted} />
    {[247, 352, 457].map(x => <g key={x}>
      <path d={`M${x} 162h89v93h-89z`} fill="#263f34" stroke={muted} strokeWidth="1" />
      {[0, 1, 2, 3, 4, 5].map(i => <path key={i} d={`M${x + 7 + i * 15} 165v16m0 53v17`} stroke={gold} opacity=".7" strokeWidth="2" />)}
    </g>)}
    <path d="M220 181h355v53H220z" fill={dark} stroke={ink} strokeWidth="1.3" />
    <path d="M237 177h319v61H237z" fill={paint(id, "glass")} stroke={teal} strokeWidth="1.1" />
    <path d="M242 183h307m-307 49h307" stroke={ink} opacity=".45" />
    <path d="M252 186l270 42M279 181l250 42" stroke="#a9cdbd" strokeWidth="1" opacity=".15" />
    <rect x="215" y="174" width="16" height="68" rx="4" fill={paint(id, "edge")} stroke={ink} />
    <rect x="564" y="174" width="16" height="68" rx="4" fill={paint(id, "edge")} stroke={ink} />
    {[183, 198, 217, 234].map(y => <g key={y}><Bolt x={222} y={y} r={2} /><Bolt x={573} y={y} r={2} /></g>)}
    <path d="M197 208h18m365 0h25v-26" fill="none" stroke={ink} strokeWidth="6" />
    <path d="M200 198l7 10-7 10m393-10 7-6v12z" fill={panel} stroke={ink} strokeWidth="1" />
    {/* A regularly spaced wafer boat, not a wafer-count or yield display. */}
    {[277, 295, 313, 331, 349, 367, 385, 403, 421, 439, 457, 475, 493, 511].map(x => <g key={x}>
      <ellipse cx={x} cy="205" rx="4.2" ry="21" fill={paint(id, "wafer")} stroke={ink} strokeWidth=".85" />
      <path d={`M${x - 2} 188v32`} stroke={teal} opacity=".28" />
    </g>)}
    <path d="M262 226h266v6H262zm18 7v9m48-9v9m48-9v9m48-9v9m48-9v9m48-9v9" fill={paint(id, "edge")} stroke={muted} />
    <path d="M230 270h336v12H230z" fill={paint(id, "edge")} stroke={ink} />
    {[246, 553].map(x => <path key={x} d={`M${x} 282v8h18v-8`} fill={panel} stroke={ink} />)}
    {[252, 273, 294, 315, 336, 457, 478, 499, 520, 541].map(x => <path key={x} d={`M${x} 274v5`} stroke={dark} strokeWidth="3" />)}

    {/* Inspection windows keep value encodings separate from the furnace structure. */}
    <rect x="245" y="296" width="142" height="55" rx="7" fill={dark} stroke={muted} />
    <path d="M254 308h124v11H254z" fill={paint(id, "wafer")} stroke={ink} strokeWidth=".8" />
    <path d="M254 303h124v5H254z" fill={paint(id, "film")} stroke={teal} strokeWidth=".8" />
    <IndexStrip x={257} y={324} width={118} delta={channel(scene, "film")} />
    <rect x="413" y="296" width="142" height="55" rx="7" fill={dark} stroke={muted} />
    <path d="M423 314h122m-122-9h122" stroke={teal} strokeWidth="1" opacity=".65" />
    {[431, 451, 471, 491, 511, 531].map(x => <g key={x}><path d={`M${x} 306v6`} stroke={gold} /><circle cx={x} cy="310" r="1.6" fill={teal} /></g>)}
    <IndexStrip x={425} y={324} width={118} delta={channel(scene, "uniformity")} />
    <path d="M316 285v10m169-10v10" stroke={muted} strokeDasharray="3 4" />

    <SceneLabel x={399} y={137}>{tr(language, "산화 열처리관", "Oxidation furnace tube", "酸化熱処理管")}</SceneLabel>
    <SceneLabel x={400} y={258}>{tr(language, "웨이퍼 보트", "Wafer boat", "ウェーハボート")}</SceneLabel>
    <SceneLabel x={316} y={373}>{tr(language, "막 단면 검사", "Film section", "膜断面の検査")}</SceneLabel>
    <SceneLabel x={484} y={373}>{tr(language, "균일도 검사", "Uniformity inspection", "均一性の検査")}</SceneLabel>
    <Leader d="M180 70H206V287L245 311" x={245} y={311} />
    <Leader d="M620 70H593V287L555 311" x={555} y={311} />
  </g>;
}

/** Projection optics and an enlarged symbolic resist section, not real dimensions. */
export function DetailedPhotoScene({ scene, language }: SceneProps) {
  const id = useId().replace(/:/g, "");
  const offset = channel(scene, "position") * 13;
  const width = 27 + channel(scene, "shape") * 5;
  return <g>
    <SceneDefs id={id} />
    {/* Structural column and the enclosed illumination source. */}
    <path d="M238 311V138h24v173m276 0V138h24v173" fill={paint(id, "steel")} stroke={ink} strokeWidth="1.4" />
    <path d="M235 141h330v9H235z" fill={paint(id, "edge")} stroke={ink} />
    <rect x="345" y="95" width="110" height="42" rx="9" fill={paint(id, "steel")} stroke={ink} strokeWidth="1.5" />
    <path d="M354 102h92v22h-92z" fill={dark} stroke={muted} />
    <path d="M368 108h64m-64 7h64" stroke={gold} opacity=".8" strokeWidth="1.5" />
    {[359, 441].map(x => <g key={x}><Bolt x={x} y={101} r={1.8} /><Bolt x={x} y={131} r={1.8} /></g>)}
    <path d="M369 138l-36 34h134l-36-34" fill={gold} opacity=".07" />
    <path d="M375 138l-20 34m45-34v34m25-34 20 34" stroke={gold} strokeWidth="1.1" opacity=".55" />

    {/* A mask frame with explicit openings; no fabricated critical dimensions. */}
    <path d="M289 172h222v17H289z" fill={paint(id, "edge")} stroke={ink} strokeWidth="1.3" />
    <path d="M307 176h186v9H307z" fill={dark} stroke={muted} strokeWidth=".7" />
    {[339, 377, 415, 453].map(x => <path key={x} d={`M${x} 176h14v9h-14z`} fill={paint(id, "glass")} stroke={gold} strokeWidth=".7" />)}
    {[300, 500].map(x => <Bolt key={x} x={x} y={181} r={2} />)}
    <path d="M346 190l29 21m9-21 9 21m29-21-12 21m49-21-36 21" stroke={gold} strokeWidth="1" opacity=".48" />

    {/* Lens barrel, retaining rings, and internal glass sections. */}
    <path d="M361 201h78v54h-78z" fill={paint(id, "steel")} stroke={ink} strokeWidth="1.2" />
    <path d="M369 205h62v46h-62z" fill={dark} stroke={muted} strokeWidth=".7" />
    {[209, 223, 237].map(y => <g key={y}>
      <ellipse cx="400" cy={y} rx="30" ry="4.5" fill={paint(id, "glass")} stroke={teal} strokeWidth=".8" />
      <path d={`M361 ${y - 4}h8m62 0h8`} stroke={ink} strokeWidth="2" />
    </g>)}
    <path d="M358 199h84v7h-84zm0 48h84v9h-84z" fill={paint(id, "edge")} stroke={ink} />
    <path d="M378 255l-37 23m59-23v23m22-23 37 23" stroke={gold} strokeWidth="1" opacity=".52" />
    <path d="M378 255l-37 23h118l-37-23" fill={gold} opacity=".045" />

    {/* Enlarged inspection section: teal=current, gold dash=reference. */}
    <path d="M267 311h266v17H267z" fill={paint(id, "steel")} stroke={ink} />
    <path d="M280 302h240v9H280z" fill={paint(id, "wafer")} stroke={ink} strokeWidth="1" />
    <path d="M280 297h240v5H280z" fill="#8c98a3" opacity=".55" />
    {[294, 350, 406, 462].map(x => <g key={x}>
      <rect className="pv-record-ink" x={x - (width - 27) / 2 + offset} y="279" width={width} height="18" rx="1.2" fill={paint(id, "film")} stroke={teal} strokeWidth="1" />
      <rect x={x} y="279" width="27" height="18" rx="1" fill="none" stroke={gold} strokeWidth="1" strokeDasharray="3 3" />
    </g>)}
    <path d="M293 328v14h30m184-14v14h-30" stroke={ink} strokeWidth="3" fill="none" />
    <path d="M279 336h239v6H279z" fill={paint(id, "steel")} stroke={muted} />
    {[290, 307, 324, 476, 493, 510].map(x => <path key={x} d={`M${x} 339v5`} stroke={dark} strokeWidth="2" />)}
    <path d="M250 152v147m300-147v147" stroke={muted} strokeWidth="1" strokeDasharray="4 5" />

    <SceneLabel x={486} y={119} anchor="start">{tr(language, "조명 광학계", "Illumination optics", "照明光学系")}</SceneLabel>
    <SceneLabel x={536} y={185} anchor="start">{tr(language, "마스크", "Mask", "マスク")}</SceneLabel>
    <SceneLabel x={458} y={231} anchor="start">{tr(language, "투영 렌즈", "Projection lens", "投影レンズ")}</SceneLabel>
    <SceneLabel x={400} y={366}>{tr(language, "레지스트 · 웨이퍼 단면", "Resist · wafer section", "レジスト・ウェーハ断面")}</SceneLabel>
    <Leader d="M180 70H215V259L310 288" x={310} y={288} />
    <Leader d="M620 70H585V259L488 288" x={488} y={288} />
  </g>;
}
