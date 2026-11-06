import React, { useId } from "react";
import { tr } from "../lib/productLanguage";
import { Bolt, Frame, IndexGauge, IndexStrip, Leader, SceneDefs, SceneLabel, channel, paint, palette as p, type SceneProps } from "./ProcessScenePrimitives";

/** Separate inspection stations: these drawings do not imply a shared wafer or a causal sequence. */
export function DetailedDepositionScene({ scene, language }: SceneProps) {
  const id = `${useId().replace(/:/g, "")}-deposition`;
  return <>
    <SceneDefs id={id} />
    <Frame x={199} y={117} width={194} height={228} />
    <Frame x={409} y={117} width={194} height={228} />
    <path d="M400 134V335" stroke={p.muted} strokeDasharray="3 7" opacity=".35" />
    <SceneLabel x={296} y={109}>{tr(language, "증착막 검사", "Film inspection", "成膜の検査")}</SceneLabel>
    <SceneLabel x={506} y={109}>{tr(language, "별도 전기적 검사", "Separate electrical test", "別の電気的検査")}</SceneLabel>

    {/* Optical head and receiving optics around a stable film cross-section. */}
    <path d="M218 296V154h155v142" fill="none" stroke={paint(id, "edge")} strokeWidth="8" />
    <path d="M216 155h160" stroke="#a4c1b4" strokeWidth="1.3" opacity=".7" />
    <rect x="227" y="164" width="45" height="34" rx="5" fill={paint(id, "steel")} stroke={p.ink} />
    <rect x="319" y="164" width="45" height="34" rx="5" fill={paint(id, "steel")} stroke={p.ink} />
    <path d="M236 171h26m66 0h26M236 177h26m66 0h26" stroke={p.muted} strokeWidth="1" />
    <path d="M245 198l13 16m79-16-13 16" stroke={p.ink} strokeWidth="8" />
    <ellipse cx="260" cy="216" rx="11" ry="5" transform="rotate(35 260 216)" fill={paint(id, "glass")} stroke={p.teal} />
    <ellipse cx="323" cy="216" rx="11" ry="5" transform="rotate(-35 323 216)" fill={paint(id, "glass")} stroke={p.teal} />
    <path d="M262 218l33 27 27-27" fill="none" stroke={p.teal} strokeWidth="1.3" strokeDasharray="4 3" opacity=".75" />
    <path d="M257 222l38 30 32-30" fill="none" stroke={p.teal} strokeWidth="6" opacity=".055" />
    <path d="M232 251l126-1 14 12-126 1z" fill={paint(id, "film")} stroke="#a6d1c3" />
    <path d="M232 251v29l14 11v-28z" fill="#3e5f51" stroke={p.muted} />
    <path d="M246 263h126v28H246z" fill={paint(id, "wafer")} stroke={p.ink} />
    <path d="M246 267H372M246 272H372" stroke="#a9cbbb" strokeWidth="1.1" />
    <path d="M246 278H372" stroke={p.muted} strokeDasharray="3 4" />
    <path d="M246 283H372" stroke={p.muted} opacity=".4" />
    <path d="M232 251l14 12m112-13 14 13" stroke={p.ink} strokeWidth="1.2" />
    <path d="M241 294h134v9H241zM258 303v9m98-9v9" fill={paint(id, "steel")} stroke={p.muted} />
    {[231, 360].map(x => <Bolt key={x} x={x} y={151} r={2.7} />)}
    <path d="M225 312h17m-17 5h17m126-5h17m-17 5h17" stroke={p.muted} strokeWidth="1" />
    <IndexStrip x={247} y={318} width={105} delta={channel(scene, "film")} />

    {/* Two-point contact inspection on a separate static sample. */}
    <rect x="436" y="141" width="143" height="39" rx="6" fill={paint(id, "steel")} stroke={p.ink} />
    <rect x="447" y="149" width="69" height="21" rx="3" fill={p.dark} stroke={p.muted} />
    <path d="M452 161h12l6-7 7 11 8-5h25" fill="none" stroke={p.teal} strokeWidth="1.4" opacity=".8" />
    {[531, 546, 561].map(x => <circle key={x} cx={x} cy="160" r="3.1" fill={p.dark} stroke={p.muted} />)}
    <path d="M450 180v19q0 8 9 8h15m89-27v19q0 8-9 8h-15" fill="none" stroke={p.ink} strokeWidth="3" />
    <path d="M470 201l13 38m62-38-13 38" stroke={paint(id, "edge")} strokeWidth="6" />
    <path d="M483 239l3 10m46-10-3 10" stroke={p.gold} strokeWidth="2.1" />
    <rect x="429" y="251" width="154" height="39" rx="2" fill={paint(id, "wafer")} stroke={p.ink} />
    <path d="M429 257H583M429 263H583" stroke={p.teal} opacity=".6" />
    <path d="M429 268H583" stroke={p.muted} strokeDasharray="3 5" />
    {[446, 474, 502, 530, 558].map((x, i) => <g key={x}>
      <rect x={x} y="247" width="13" height="5" fill={paint(id, "gold")} stroke="#e3c58f" strokeWidth=".6" />
      <path d={`M${x + 6} 252v${i % 2 ? 23 : 16}`} stroke={p.gold} opacity=".5" />
    </g>)}
    <path d="M437 292h137v10H437zM453 302v10m105-10v10" fill={paint(id, "steel")} stroke={p.muted} />
    <path d="M435 313h17m-17 4h17m109-4h17m-17 4h17" stroke={p.muted} strokeWidth="1" />
    {[446, 569].map(x => <Bolt key={x} x={x} y={178} r={2.4} />)}
    <IndexStrip x={455} y={318} width={105} delta={channel(scene, "electrical")} />
    <Leader d="M180 70H229V164" x={229} y={164} />
    <Leader d="M620 70H568V140" x={568} y={140} />
    <SceneLabel x={298} y={371}>{tr(language, "박막·기판 단면", "Film / substrate section", "薄膜・基板の断面")}</SceneLabel>
    <SceneLabel x={505} y={371}>{tr(language, "접촉 프로브", "Contact probes", "接触プローブ")}</SceneLabel>
  </>;
}

export function DetailedMetalScene({ scene, language }: SceneProps) {
  const id = `${useId().replace(/:/g, "")}-metal`;
  const scan = channel(scene, "appearance") * 6;
  return <>
    <SceneDefs id={id} />
    {/* Fixture and probe heads; continuity is not represented as a broken conductor. */}
    <path d="M217 320h370v11H217z" fill={paint(id, "steel")} stroke={p.muted} />
    <path d="M234 330v13m335-13v13" stroke={p.ink} strokeWidth="6" />
    <rect x="220" y="121" width="126" height="41" rx="6" fill={paint(id, "steel")} stroke={p.ink} />
    <IndexStrip x={231} y={130} width={104} delta={channel(scene, "connection")} />
    <path d="M234 163v23q0 8 8 8h14m75-31v13q0 9 10 9h17" stroke={p.ink} strokeWidth="3" fill="none" />
    <rect x="249" y="185" width="14" height="23" rx="3" fill={paint(id, "edge")} stroke={p.muted} />
    <path d="M255 208l7 17" stroke={p.gold} strokeWidth="2.4" />
    <rect x="352" y="176" width="14" height="23" rx="3" fill={paint(id, "edge")} stroke={p.muted} />
    <path d="M359 199l4 18" stroke={p.gold} strokeWidth="2.4" />
    {[229, 337].map(x => <Bolt key={x} x={x} y={157} r={2.1} />)}

    {/* Exposed multilayer interconnect: front, top and side faces keep the stack legible. */}
    <path d="M242 236l35-26h253l30 26z" fill="#456b5d" stroke={p.ink} />
    <path d="M242 236h318v75H242z" fill={paint(id, "wafer")} stroke={p.ink} strokeWidth="1.4" />
    <path d="M242 236l-17-13v75l17 13z" fill="#213e33" stroke={p.muted} />
    <path d="M242 237h318v21H242z" fill="#395a4c" stroke={p.muted} />
    <path d="M242 265h318v19H242z" fill="#2e4b42" stroke={p.muted} />
    <path d="M242 290h318v21H242z" fill={paint(id, "hatch")} />
    <path d="M242 258H560M242 283H560" stroke="#9db7aa" strokeWidth="1" />
    <path d="M242 264H560M242 289H560" stroke={p.muted} strokeWidth="1" />
    <path d="M254 231h44v-11h68v-3h70v15h100" fill="none" stroke={paint(id, "gold")} strokeWidth="8" strokeLinejoin="round" />
    <path d="M257 229h41v-11h68v-3h70v15h95" fill="none" stroke="#efd7a8" strokeWidth="1.2" opacity=".8" />
    <path d="M263 260h91v-17h92v17h102" fill="none" stroke={paint(id, "gold")} strokeWidth="6" />
    <path d="M258 286h61v-12h77v12h152" fill="none" stroke={paint(id, "gold")} strokeWidth="6" />
    {[{x:290,top:237,bottom:258},{x:443,top:237,bottom:258},{x:318,top:265,bottom:283},{x:509,top:265,bottom:283}].map(via => <g key={`${via.x}-${via.top}`}>
      <rect x={via.x - 5} y={via.top} width="10" height={via.bottom - via.top} fill={paint(id, "gold")} stroke="#dec18d" strokeWidth=".8" />
      <ellipse cx={via.x} cy={via.top} rx="5" ry="2" fill="#ead0a0" stroke="#7e6949" strokeWidth=".7" />
      <path d={`M${via.x - 2} ${via.top + 3}v${via.bottom - via.top - 5}`} stroke="#f0d9af" opacity=".6" />
    </g>)}
    {[263, 363].map(x => <rect key={x} x={x - 10} y={x === 263 ? 223 : 212} width="20" height="7" rx="1.5" fill={paint(id, "gold")} stroke="#e9cea1" />)}
    <path d="M252 307h296M252 302h296" stroke={p.muted} opacity=".5" strokeDasharray="2 5" />
    <path d="M220 222l17 12m-17-5 17 12m-17-5 17 12m-17-5 17 12m-17-5 17 12m-17-5 17 12" stroke={p.muted} strokeWidth=".8" opacity=".65" />

    {/* Stable enlarged inspection feature with a moving index cursor. */}
    <circle cx="540" cy="165" r="45" fill={p.dark} stroke={paint(id, "edge")} strokeWidth="5" />
    <circle cx="540" cy="165" r="39" fill={paint(id, "glass")} stroke={p.muted} />
    <path d="M516 145h19v20h26v22" fill="none" stroke={paint(id, "gold")} strokeWidth="8" />
    <path d="M518 145h17v20h25" fill="none" stroke="#efd7a8" strokeWidth="1" />
    <path d="M514 190h51M512 139v52" stroke={p.muted} opacity=".3" strokeWidth=".8" />
    <path className="pv-record-ink" d={`M${535 + scan} 134v62`} stroke={p.teal} strokeWidth="1.5" />
    <circle className="pv-record-ink" cx={535 + scan} cy="165" r="3" fill={p.teal} />
    <path d="M572 197l26 25" stroke={paint(id, "edge")} strokeWidth="10" strokeLinecap="round" />
    <path d="M571 197l25 24" stroke={p.ink} strokeWidth="1.2" opacity=".5" />
    <path d="M484 230l24-25" stroke={p.muted} strokeDasharray="3 4" />
    <SceneLabel x={417} y={182}>{tr(language, "금속 배선", "Metal wiring", "金属配線")}</SceneLabel>
    <path d="M417 187v19" stroke={p.muted} />
    <SceneLabel x={420} y={347}>{tr(language, "절연층·비아 단면", "Dielectric / via section", "絶縁層・ビアの断面")}</SceneLabel>
    <path d="M418 331v-20" stroke={p.muted} />
    <SceneLabel x={540} y={108}>{tr(language, "외관 확대 검사", "Magnified inspection", "外観の拡大検査")}</SceneLabel>
    <Leader d="M180 70H246V119" x={246} y={119} />
    <Leader d="M620 70H588V123L573 137" x={573} y={137} />
  </>;
}

export function DetailedPackagingScene({ scene, language }: SceneProps) {
  const id = `${useId().replace(/:/g, "")}-packaging`;
  return <>
    <SceneDefs id={id} />
    {/* The molding compound is cut away to reveal an intact package assembly. */}
    <path d="M230 292V188q0-24 24-24h288q26 0 26 24v104" fill={paint(id, "glass")} stroke={p.muted} strokeWidth="1.6" />
    <path d="M230 188l20-17h280l38 17" fill="none" stroke={p.ink} opacity=".6" />
    <path d="M230 188v105h17V188m304 0v105h17V188" fill={paint(id, "hatch")} stroke={p.muted} strokeWidth=".7" />
    <path d="M251 174h279" stroke={p.ink} strokeDasharray="5 5" opacity=".4" />
    <rect x="215" y="292" width="371" height="24" rx="3" fill={paint(id, "steel")} stroke={p.ink} strokeWidth="1.6" />
    <path d="M215 298H586M215 309H586" stroke={p.muted} />
    <path d="M215 316l16 10h340l15-10" fill="#213d31" stroke={p.muted} />
    {[241, 266, 291, 316, 341, 366, 391, 416, 441, 466, 491, 516, 541, 566].map((x, i) => <g key={x}>
      <rect x={x - 5} y="287" width="10" height="6" fill={paint(id, "gold")} stroke="#d5bb89" strokeWidth=".5" />
      <path d={`M${x} 299v${i % 2 ? 5 : 10}h${x < 400 ? 5 : -5}v${i % 2 ? 12 : 7}`} fill="none" stroke={p.gold} strokeWidth="1.4" opacity=".7" />
      <ellipse cx={x} cy="318" rx="6" ry="2" fill="#688475" stroke={p.muted} strokeWidth=".6" />
      <circle cx={x} cy="327" r="7" fill={paint(id, "edge")} stroke={p.ink} strokeWidth=".8" />
      <path d={`M${x - 3} 324q3-3 6 0`} fill="none" stroke="#d0dfd6" strokeWidth=".9" opacity=".8" />
    </g>)}
    {/* Die attach, die layers and bond pads keep their geometry stable across time. */}
    <rect x="332" y="276" width="136" height="10" rx="2" fill="#879a88" stroke={p.muted} />
    <rect x="337" y="245" width="126" height="31" rx="3" fill={paint(id, "wafer")} stroke={p.ink} />
    <path d="M337 251H463M337 269H463" stroke={p.muted} />
    <rect x="343" y="237" width="114" height="8" rx="1.5" fill={paint(id, "film")} stroke="#aecfc0" />
    {[350, 358, 366, 374, 382, 418, 426, 434, 442, 450].map(x => <g key={x}>
      <path d={`M${x} 239v5`} stroke={p.gold} strokeWidth="1.6" />
      <rect x={x - 2.8} y="235" width="5.6" height="3" fill={paint(id, "gold")} />
    </g>)}
    {[0,1,2,3,4].map(index => <g key={index}>
      <path d={`M${350 + index * 8} 240Q${296 + index * 3} ${192 + index * 6} ${241 + index * 25} 287`} fill="none" stroke={paint(id, "gold")} strokeWidth="1.8" />
      <path d={`M${450 - index * 8} 240Q${504 - index * 3} ${192 + index * 6} ${566 - index * 25} 287`} fill="none" stroke={paint(id, "gold")} strokeWidth="1.8" />
    </g>)}
    <path d="M343 243h114" stroke="#d5e2d8" strokeWidth=".7" />
    <path d="M347 266h106" stroke={p.muted} strokeDasharray="2 4" />
    {/* Inspection head and fixed focus window are separate from the package geometry. */}
    <rect x="485" y="113" width="60" height="25" rx="5" fill={paint(id, "steel")} stroke={p.ink} />
    <path d="M496 138v10h38v-10" fill={paint(id, "edge")} stroke={p.muted} />
    <ellipse cx="515" cy="150" rx="18" ry="4.2" fill={paint(id, "glass")} stroke={p.teal} />
    <path d="M501 152l-14 38h56l-14-38" fill={p.teal} opacity=".035" stroke={p.teal} strokeDasharray="3 4" />
    <path d="M488 192h15m-15 0v12m55-12h-15m15 0v12m-55 10v12h15m40-12v12h-15" stroke={p.teal} opacity=".55" />
    <IndexGauge x={579} y={151} delta={channel(scene, "appearance")} radius={20} />
    <path d="M560 163l-14 14" stroke={p.muted} strokeWidth="3" />
    <IndexStrip x={229} y={118} width={113} delta={channel(scene, "connection")} />
    <path d="M284 143v20" stroke={p.muted} strokeDasharray="3 4" />
    {[230, 571].map(x => <Bolt key={x} x={x} y={303} r={2.5} />)}
    <SceneLabel x={284} y={190}>{tr(language, "본딩 와이어", "Bond wires", "ボンディングワイヤ")}</SceneLabel>
    <path d="M301 194l10 20" stroke={p.muted} />
    <SceneLabel x={400} y={221}>{tr(language, "반도체 칩", "Semiconductor die", "半導体チップ")}</SceneLabel>
    <path d="M400 224v10" stroke={p.muted} />
    <SceneLabel x={520} y={361}>{tr(language, "기판·솔더볼", "Substrate / solder balls", "基板・はんだボール")}</SceneLabel>
    <path d="M520 346v-18" stroke={p.muted} />
    <Leader d="M180 70H254V116" x={254} y={116} />
    <Leader d="M620 70H579V126" x={579} y={126} />
  </>;
}
