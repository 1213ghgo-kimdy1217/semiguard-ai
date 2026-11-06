import React, { useId } from "react";
import { tr } from "../lib/productLanguage";
import { Bolt, IndexGauge, IndexStrip, Leader, SceneDefs, SceneLabel, channel, paint, palette, type SceneProps } from "./ProcessScenePrimitives";

/** Original inspection cutaway. The small moving readout encodes an index, not a defect. */
export function DetailedWaferScene({ scene, language }: SceneProps) {
  const id = `wafer-${useId().replace(/:/g, "")}`;
  const surfaceIndex = channel(scene, "surface");
  return <>
    <SceneDefs id={id} />
    <defs>
      <clipPath id={`${id}-surface`}><ellipse cx="377" cy="230" rx="134" ry="57" /></clipPath>
      <clipPath id={`${id}-inspection`}><circle cx="552" cy="228" r="34" /></clipPath>
    </defs>

    {/* Precision stage and the rear optical gantry. */}
    <path d="M222 294l30-12h257l35 12v25H222z" fill={paint(id, "steel")} stroke={palette.ink} strokeWidth="1.5" />
    <path d="M222 294h322M233 306h299" stroke={palette.muted} strokeWidth="1" />
    <path d="M252 319v14h39v-14m184 0v14h39v-14" fill={palette.dark} stroke={palette.muted} />
    <rect x="239" y="310" width="30" height="5" rx="2" fill={palette.dark} stroke={palette.muted} />
    <rect x="497" y="310" width="30" height="5" rx="2" fill={palette.dark} stroke={palette.muted} />
    {[236, 279, 487, 530].map(x => <Bolt key={x} x={x} y={300} r={2.4} />)}
    <path d="M236 272V125h292v147h-18V144H254v128z" fill={paint(id, "edge")} stroke={palette.ink} strokeWidth="1.2" />
    <path d="M244 127v143m275-143v143M255 135h254" stroke={palette.dark} strokeWidth="3" />
    {[251, 281, 482, 513].map(x => <Bolt key={x} x={x} y={134} r={2.3} />)}
    <rect x="296" y="121" width="153" height="12" rx="3" fill={palette.dark} stroke={palette.muted} />
    {Array.from({ length: 17 }, (_, i) => <path key={i} d={`M${301 + i * 8.4} 124v6`} stroke={palette.muted} strokeWidth=".7" />)}
    <path d="M355 110v-8h76v13m-8-7c28-16 57-5 57 15" fill="none" stroke={palette.muted} strokeWidth="3" />

    {/* Sensor body, lens barrel and a restrained optical cone. */}
    <path d="M344 113h92v34h-92z" fill={paint(id, "steel")} stroke={palette.ink} strokeWidth="1.4" />
    <rect x="351" y="120" width="78" height="19" rx="3" fill={palette.dark} stroke={palette.muted} />
    {[359, 370, 381, 392, 403].map(x => <path key={x} d={`M${x} 125v9`} stroke={palette.muted} strokeWidth="1" />)}
    <circle cx="419" cy="129" r="2" fill={palette.teal} />
    <path d="M365 147h48v23h-48z" fill={paint(id, "edge")} stroke={palette.ink} />
    <path d="M362 154h54m-54 7h54" stroke={palette.dark} strokeWidth="2" />
    <ellipse cx="389" cy="171" rx="25" ry="5.5" fill={palette.dark} stroke={palette.ink} />
    <ellipse cx="389" cy="171" rx="16" ry="3" fill={palette.teal} fillOpacity=".22" stroke={palette.teal} strokeWidth=".7" />
    <path d="M375 175l-37 52h102l-36-52" fill={palette.teal} fillOpacity=".035" stroke={palette.teal} strokeOpacity=".24" strokeDasharray="3 5" />
    <path d="M389 177v45" stroke={palette.teal} strokeOpacity=".25" strokeDasharray="2 6" />

    {/* Continuous, neutral wafer surface; no coloured defect map. */}
    <ellipse cx="377" cy="241" rx="139" ry="60" fill={palette.dark} stroke={palette.muted} strokeWidth="1.2" />
    <path d="M238 231v10c0 34 62 61 139 61s139-27 139-61v-10" fill={paint(id, "edge")} stroke={palette.muted} />
    <ellipse cx="377" cy="230" rx="139" ry="61" fill={paint(id, "wafer")} stroke={palette.ink} strokeWidth="1.4" />
    <ellipse cx="377" cy="230" rx="134" ry="57" fill="none" stroke="#9bb9ae" strokeOpacity=".65" strokeWidth=".8" />
    <ellipse cx="377" cy="230" rx="122" ry="50" fill="none" stroke={palette.ink} strokeOpacity=".16" strokeWidth=".7" />
    <g clipPath={`url(#${id}-surface)`}>
      <path d="M224 202l305 67M218 212l305 67" stroke="#d5e2db" strokeWidth="8" opacity=".07" />
      <path d="M239 230h275M377 170v121" stroke={palette.ink} strokeOpacity=".13" strokeDasharray="4 8" />
      <path d="M282 216l190 38m-165-56l137 27" stroke={palette.teal} strokeOpacity=".08" strokeWidth="2" />
      <circle cx="355" cy="232" r="22" fill={palette.dark} fillOpacity=".32" stroke={palette.teal} strokeWidth="1.2" />
      <path d="M338 232h34m-17-17v34" stroke={palette.ink} strokeOpacity=".55" strokeWidth=".7" />
      <circle className="pv-record-ink" cx={355 + surfaceIndex * 7} cy="232" r="3.4" fill={palette.teal} />
    </g>
    <path d="M363 290l7-6h14l7 6" fill={palette.dark} stroke={palette.ink} strokeWidth="1" />
    <path d="M357 291h40" stroke={palette.dark} strokeWidth="1.8" />

    {/* The magnifier repeats the same neutral inspection glyph at a readable scale. */}
    <path d="M374 224l140-19m-138 38l140 10" stroke={palette.teal} strokeOpacity=".32" strokeWidth=".9" strokeDasharray="3 5" />
    <circle cx="552" cy="228" r="39" fill={paint(id, "steel")} stroke={palette.muted} strokeWidth="1.4" />
    <circle cx="552" cy="228" r="34" fill={palette.dark} stroke={palette.ink} strokeWidth=".8" />
    <g clipPath={`url(#${id}-inspection)`}>
      <path d="M519 216h66m-66 12h66m-66 12h66M528 194v68m12-68v68m12-68v68m12-68v68m12-68v68" stroke={palette.muted} strokeOpacity=".18" strokeWidth=".7" />
      <path d="M526 228h52M552 203v50" stroke={palette.ink} strokeOpacity=".5" strokeDasharray="3 3" />
      <circle cx="552" cy="228" r="19" fill="none" stroke={palette.gold} strokeDasharray="3 3" strokeOpacity=".75" />
      <circle className="pv-record-ink" cx={552 + surfaceIndex * 9} cy="228" r="4" fill={palette.teal} />
    </g>
    {[0, 90, 180, 270].map(angle => <g key={angle} transform={`rotate(${angle} 552 228)`}><path d="M552 186v5" stroke={palette.ink} strokeWidth="1.3" /></g>)}

    {/* Fixed teaching cross-section and a separate thickness-index strip. */}
    <rect x="410" y="302" width="88" height="10" rx="1" fill={paint(id, "wafer")} stroke={palette.ink} strokeWidth=".8" />
    <rect x="410" y="312" width="88" height="5" fill={paint(id, "hatch")} stroke={palette.muted} strokeWidth=".6" />
    <path d="M404 299v21m-4-21h8m-8 21h8M503 299v21m-4-21h8m-8 21h8" stroke={palette.ink} strokeWidth=".8" />
    <path d="M415 299h78" stroke={palette.gold} strokeDasharray="3 3" strokeWidth=".7" />
    <IndexStrip x={251} y={307} width={126} delta={channel(scene, "thickness")} />
    <path d="M379 318h22" stroke={palette.muted} strokeDasharray="2 3" />
    <SceneLabel x={390} y={97}>{tr(language, "광학 검사 헤드", "Optical inspection head", "光学検査ヘッド")}</SceneLabel>
    <SceneLabel x={552} y={180}>{tr(language, "A3 관찰 확대", "A3 inspection detail", "A3観察の拡大")}</SceneLabel>
    <SceneLabel x={409} y={349}>{tr(language, "두께 단면 · 검사 지수", "Thickness section · inspection index", "厚さ断面・検査指数")}</SceneLabel>
    <Leader d="M180 70H221V190L338 223" x={338} y={223} />
    <Leader d="M620 70H610V307H509" x={509} y={307} />
  </>;
}

/** The die layout is decorative and fixed; it never encodes defect counts or outcomes. */
export function DetailedEdsScene({ scene, language }: SceneProps) {
  const id = `eds-${useId().replace(/:/g, "")}`;
  return <>
    <SceneDefs id={id} />
    <defs><clipPath id={`${id}-dies`}><ellipse cx="366" cy="250" rx="132" ry="59" /></clipPath></defs>

    {/* Stage body and grounded chuck sit below the wafer. */}
    <path d="M216 302l34-19h233l34 19v28H216z" fill={paint(id, "steel")} stroke={palette.ink} strokeWidth="1.2" />
    <path d="M216 302h301M230 317h272" stroke={palette.muted} strokeWidth="1" />
    {[230, 260, 474, 503].map(x => <Bolt key={x} x={x} y={309} r={2.3} />)}
    <path d="M245 330v10h29v-10m190 0v10h29v-10" fill={palette.dark} stroke={palette.muted} />
    <ellipse cx="366" cy="261" rx="138" ry="62" fill={palette.dark} stroke={palette.muted} />
    <path d="M228 250v11c0 34 62 62 138 62s138-28 138-62v-11" fill={paint(id, "edge")} stroke={palette.muted} />
    <ellipse cx="366" cy="250" rx="138" ry="62" fill={paint(id, "wafer")} stroke={palette.ink} strokeWidth="1.4" />
    <ellipse cx="366" cy="250" rx="132" ry="59" fill="none" stroke={palette.ink} strokeOpacity=".55" strokeWidth=".7" />
    <g clipPath={`url(#${id}-dies)`}>
      {Array.from({ length: 6 }, (_, row) => Array.from({ length: 9 }, (_, col) => <g key={`${row}-${col}`}>
        <rect x={236 + col * 30} y={194 + row * 22} width="25" height="17" rx="1.5" fill="#385a52" stroke="#87aa98" strokeOpacity=".55" strokeWidth=".7" />
        <rect x={241 + col * 30} y={198 + row * 22} width="15" height="9" rx=".6" fill="none" stroke={palette.ink} strokeOpacity=".2" strokeWidth=".5" />
        <path d={`M${239 + col * 30} ${201 + row * 22}h2m15 0h2`} stroke={palette.gold} strokeOpacity=".55" strokeWidth="1" />
      </g>))}
      <path d="M231 214l268 64" stroke="#d2e2db" strokeWidth="12" opacity=".045" />
    </g>
    <path d="M352 312l7-6h14l7 6" fill={palette.dark} stroke={palette.ink} strokeWidth="1" />
    <path d="M346 313h39" stroke={palette.dark} strokeWidth="1.8" />

    {/* Probe-card support, connector fingers and the stylised contact-needle fan. */}
    <path d="M236 198V108h258v90h-13v-77H249v77z" fill={paint(id, "edge")} stroke={palette.muted} strokeWidth="1.2" />
    {[249, 276, 454, 481].map(x => <Bolt key={x} x={x} y={115} r={2.3} />)}
    <path d="M354 102v25h25v-25" fill={paint(id, "steel")} stroke={palette.ink} />
    <path d="M287 132l15-8h128l16 8v40H287z" fill={paint(id, "steel")} stroke={palette.ink} strokeWidth="1.3" />
    <path d="M287 143h159m-148 22h137" stroke={palette.muted} strokeWidth=".9" />
    <rect x="306" y="140" width="119" height="18" rx="2" fill={palette.dark} stroke={palette.muted} />
    {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${312 + i * 9.8} 143v11`} stroke={palette.gold} strokeOpacity=".7" strokeWidth="2" />)}
    {[297, 436].map(x => <Bolt key={x} x={x} y={150} r={2.4} />)}
    <path d="M314 173h105v13H314z" fill={palette.surface} stroke={palette.ink} strokeWidth=".9" />
    {Array.from({ length: 10 }, (_, i) => {
      const x = 320 + i * 10.3;
      return <path key={i} d={`M${x} 186v12l${(365 - x) * .11} 12v8`} fill="none" stroke={palette.gold} strokeWidth="1.3" />;
    })}
    <path d="M317 218h104" stroke={palette.teal} strokeOpacity=".38" strokeDasharray="2 4" strokeWidth=".7" />

    {/* Signal harness, strain relief and tester enclosure. */}
    <path d="M446 141h18c27 0 37-10 52-3s17 22 17 37" fill="none" stroke={palette.dark} strokeWidth="10" />
    <path d="M446 141h18c27 0 37-10 52-3s17 22 17 37" fill="none" stroke={palette.muted} strokeWidth="6" />
    {[450, 456, 462].map(x => <path key={x} d={`M${x} 136v10`} stroke={palette.ink} strokeWidth="1" />)}
    <path d="M519 151l10-6h68l9 6v169l-9 8h-78z" fill={paint(id, "steel")} stroke={palette.ink} strokeWidth="1.3" />
    <path d="M596 152v168h-77m77-168h10" fill="none" stroke={palette.muted} />
    <rect x="528" y="162" width="60" height="83" rx="5" fill={palette.dark} stroke={palette.muted} />
    <IndexGauge x={558} y={203} radius={22} delta={channel(scene, "comparison")} />
    <path d="M536 233h44" stroke={palette.muted} strokeWidth=".7" />
    <circle cx="537" cy="170" r="1.7" fill={palette.teal} />
    <circle cx="579" cy="170" r="1.7" fill={palette.ink} fillOpacity=".4" />
    <IndexStrip x={528} y={255} width={60} delta={channel(scene, "die")} />
    {[0, 1, 2, 3].map(i => <path key={i} d={`M532 ${290 + i * 5}h52`} stroke={palette.muted} strokeWidth="1.4" />)}
    {[528, 587].map(x => <Bolt key={x} x={x} y={315} r={2.1} />)}
    <path d="M518 284h-12m12 6h-12m12 6h-12" stroke={palette.gold} strokeWidth="2" />
    <path d="M526 328v8m64-8v8" stroke={palette.ink} strokeWidth="4" />
    <SceneLabel x={367} y={96}>{tr(language, "프로브 카드 · 접촉 니들", "Probe card · contact needles", "プローブカード・接触針")}</SceneLabel>
    <SceneLabel x={367} y={359}>{tr(language, "동일 조건의 다이 검사", "Die inspection under matched conditions", "同じ条件でのダイ検査")}</SceneLabel>
    <SceneLabel x={558} y={349}>{tr(language, "검사 테스터", "Test unit", "検査テスター")}</SceneLabel>
    <Leader d="M180 70H214V192L290 232" x={290} y={232} />
    <Leader d="M620 70H610V187H590" x={590} y={187} />
  </>;
}
