import React, { useId, type ReactNode } from "react";
import { processLessons } from "../../../shared/learningHub";
import { processVisuals, type ProcessLessonId } from "../../../shared/processVisuals";
import { localizeLesson } from "../lib/learningLanguage";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import "./process-concept-figure.css";

function Pointer({ x, y, number }: { x: number; y: number; number: number }) {
  return <g><circle cx={x} cy={y} r="12" fill="#e4aa55" stroke="#101817" strokeWidth="3" /><text x={x} y={y + 4} textAnchor="middle" fill="#101817" stroke="none" fontSize="13" fontWeight="700">{number}</text></g>;
}

const arrow = <path d="M216 91h44m-9-9 9 9-9 9" fill="none" stroke="#98afa5" strokeWidth="2" />;
const drawings: Record<ProcessLessonId, ReactNode> = {
  wafer: <>
    <path d="M40 61v71c0 26 104 26 104 0V61" fill="#263b38" /><ellipse cx="92" cy="61" rx="52" ry="19" fill="#3c5650" /><path d="M40 61v71c0 26 104 26 104 0V61" fill="none" /><ellipse cx="92" cy="61" rx="52" ry="19" fill="none" />
    <path d="M159 94h27m-8-7 8 7-8 7" />
    {[0, 1, 2].map(n => <ellipse key={n} cx={232 + n * 9} cy={107 - n * 10} rx="38" ry="15" fill="#324740" />)}
    <path d="M292 94h27m-8-7 8 7-8 7" /><ellipse cx="393" cy="98" rx="59" ry="31" fill="#3b5150" stroke="#a9c7d2" /><path d="m363 85 48 24m-46-10 27 14" stroke="#a9c7d2" />
    <Pointer x={92} y={38} number={1} /><Pointer x={237} y={64} number={2} /><Pointer x={408} y={121} number={3} />
  </>,
  oxidation: <>
    <rect x="28" y="88" width="168" height="58" rx="4" fill="#304942" />{arrow}
    <rect x="283" y="88" width="169" height="58" rx="4" fill="#304942" /><rect x="283" y="72" width="169" height="16" fill="#e4aa55" stroke="#e4aa55" />
    <path d="M437 62h27m-27 36h27m-6-36v36m-5-30 5-6 5 6m-10 24 5 6 5-6" stroke="#a9c7d2" />
    <Pointer x={93} y={88} number={1} /><Pointer x={337} y={71} number={2} /><Pointer x={457} y={44} number={3} />
  </>,
  photo: <>
    <path d="M44 24v36m40-36v36m40-36v36m-86-6 6 6 6-6m28 0 6 6 6-6m28 0 6 6 6-6" stroke="#e4aa55" />
    <rect x="30" y="69" width="109" height="10" fill="#435654" /><rect x="58" y="69" width="24" height="10" fill="#101817" /><rect x="104" y="69" width="16" height="10" fill="#101817" />
    <path d="M70 82v22m42-22v22" stroke="#e4aa55" strokeDasharray="3 4" /><rect x="30" y="116" width="109" height="29" fill="#304942" /><rect x="30" y="106" width="109" height="10" fill="#a9c7d2" />
    <path d="M157 104h25m-8-7 8 7-8 7" /><rect x="202" y="116" width="93" height="29" fill="#304942" /><rect x="202" y="106" width="93" height="10" fill="#a9c7d2" /><path d="M236 106h17" stroke="#e4aa55" strokeWidth="10" />
    <path d="M315 104h25m-8-7 8 7-8 7" /><rect x="360" y="116" width="95" height="29" fill="#304942" /><rect x="360" y="104" width="26" height="12" fill="#a9c7d2" /><rect x="411" y="104" width="44" height="12" fill="#a9c7d2" />
    <Pointer x={147} y={53} number={1} /><Pointer x={248} y={85} number={2} /><Pointer x={409} y={85} number={3} />
  </>,
  etch: <>
    <rect x="30" y="116" width="166" height="30" fill="#304942" /><rect x="30" y="92" width="166" height="24" fill="#e4aa55" stroke="#e4aa55" /><path d="M30 84h44m42 0h42" stroke="#a9c7d2" strokeWidth="12" />{arrow}
    <rect x="284" y="116" width="167" height="30" fill="#304942" /><rect x="284" y="92" width="44" height="24" fill="#e4aa55" stroke="#e4aa55" /><rect x="370" y="92" width="44" height="24" fill="#e4aa55" stroke="#e4aa55" /><path d="M284 84h44m42 0h44" stroke="#a9c7d2" strokeWidth="12" />
    <path d="M349 45v58m-7-8 7 8 7-8" stroke="#a9c7d2" /><path d="M331 93h36v23h-36" fill="none" strokeDasharray="3 4" />
    <Pointer x={97} y={54} number={1} /><Pointer x={349} y={31} number={2} /><Pointer x={398} y={130} number={3} />
  </>,
  deposition: <>
    <path d="M242 28v117" strokeDasharray="3 5" stroke="#435b50" /><rect x="30" y="101" width="182" height="45" fill="#304942" /><rect x="30" y="86" width="182" height="15" fill="#e4aa55" stroke="#e4aa55" />
    <rect x="276" y="101" width="177" height="45" fill="#304942" />
    {[302, 334, 366, 398, 430].map((x, i) => <g key={x}><path d={`M${x} 52v36m-6-7 6 7 6-7`} stroke="#a9c7d2" /><circle cx={x} cy={117 + i % 2 * 14} r="4" fill="#a9c7d2" stroke="none" /></g>)}
    <Pointer x={114} y={65} number={1} /><Pointer x={369} y={37} number={2} /><Pointer x={242} y={158} number={3} />
  </>,
  metal: <>
    <rect x="43" y="36" width="393" height="102" fill="#21352e" /><rect x="43" y="138" width="393" height="14" fill="#3b5350" />
    <path d="M105 138v-27h94V64h173v74" fill="none" stroke="#e4aa55" strokeWidth="11" /><path d="M63 47h112m-28 0v39h-37m129 47h170" fill="none" stroke="#a9c7d2" strokeWidth="8" />
    <rect x="80" y="138" width="52" height="14" fill="#a9c7d2" /><rect x="346" y="138" width="52" height="14" fill="#a9c7d2" />
    <Pointer x={102} y={159} number={1} /><Pointer x={242} y={64} number={2} /><Pointer x={290} y={103} number={3} />
  </>,
  eds: <>
    <ellipse cx="112" cy="114" rx="84" ry="40" fill="#263b35" />
    {[0, 1, 2].flatMap(row => [0, 1, 2, 3, 4].map(col => <rect key={`${row}-${col}`} x={53 + col * 24} y={89 + row * 17} width="17" height="11" rx="1" fill="#4c6760" />))}
    <path d="M75 41h81v18H75zm13 18v25m20-25v25m20-25v25m20-25v25" fill="none" stroke="#a9c7d2" />{arrow}
    <circle cx="365" cy="97" r="68" fill="#263b35" />
    {[0, 1, 2, 3, 4].flatMap(row => [0, 1, 2, 3, 4].map(col => <rect key={`${row}-${col}`} x={319 + col * 19} y={51 + row * 19} width="14" height="14" rx="1" fill={(row + col) % 4 === 0 ? '#e4aa55' : '#6e9d8a'} stroke="#101817" />))}
    <Pointer x={71} y={145} number={1} /><Pointer x={159} y={42} number={2} /><Pointer x={433} y={145} number={3} />
  </>,
  packaging: <>
    <path d="M67 140V51q0-20 20-20h306q20 0 20 20v89" fill="#21372e" strokeDasharray="5 4" />
    <rect x="61" y="139" width="358" height="16" fill="#3b5350" /><rect x="172" y="113" width="133" height="26" fill="#a9c7d2" /><rect x="176" y="108" width="125" height="5" fill="#4c6760" />
    <path d="M180 109Q131 47 104 139m192-30q49-62 76 30" fill="none" stroke="#e4aa55" strokeWidth="3" /><path d="M104 155v14H51m321-14v14h57" stroke="#e4aa55" strokeWidth="5" />
    <Pointer x={238} y={126} number={1} /><Pointer x={145} y={78} number={2} /><Pointer x={352} y={32} number={3} />
  </>,
};

export default function ProcessConceptFigure({ processId, language }: { processId: ProcessLessonId; language: ProductLanguage }) {
  const id = useId();
  const lesson = processLessons.find(item => item.id === processId)!;
  const copy = processVisuals[processId][language];
  const name = localizeLesson(language, lesson).title;
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  return <figure className="pc-figure" data-process-visual={processId}>
    <div className="pc-heading"><span>{l("그림으로 이해하기", "Visual field note", "図で理解する")}</span><span aria-hidden="true">{String(processLessons.indexOf(lesson) + 1).padStart(2, "0")} / 08</span></div>
    <svg viewBox="0 0 480 180" role="img" aria-labelledby={`${id}-title ${id}-description`} className="pc-diagram">
      <title id={`${id}-title`}>{`${name} · ${l("개념도", "concept diagram", "概念図")}`}</title>
      <desc id={`${id}-description`}>{`${copy.explanation} ${copy.labels.map((label, index) => `${index + 1}: ${label}`).join('. ')}`}</desc>
      <g fill="none" stroke="#91a69d" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">{drawings[processId]}</g>
    </svg>
    <ol className="pc-labels">{copy.labels.map((label, index) => <li key={label}><span aria-hidden="true">{index + 1}</span>{label}</li>)}</ol>
    <figcaption><p>{copy.explanation}</p><p className="pc-observe"><b>{l("판단 연습 연결", "In judgment practice", "判断練習とのつながり")}</b>{copy.observe}</p>
      <div className="pc-footnote"><span>{l("SemiGuard 개념도 · 축척·실제 장비 구조 아님", "SemiGuard concept · not to scale or an actual equipment layout", "SemiGuardの概念図 · 縮尺・実際の装置構造ではありません")}</span><a href={lesson.source} target="_blank" rel="noopener noreferrer">{l("공식 원문 ↗", "Official source ↗", "公式原文 ↗")}</a></div>
    </figcaption>
  </figure>;
}
