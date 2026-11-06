import React from "react";
import type { ProcessSceneState } from "../../../shared/processScene";
import type { ProductLanguage } from "../lib/productLanguage";

export type SceneProps = { scene: ProcessSceneState; language: ProductLanguage };
export const palette = { ink: "#b0c6bf", muted: "#66887b", teal: "#8bd4c2", gold: "#e2b974", panel: "#1b302c", surface: "#35534a", dark: "#0e211c", violet: "#b4a3cd" };
const bounded = (value: number) => Number.isFinite(value) ? Math.max(-2, Math.min(2, value)) : 0;
export const channel = (scene: ProcessSceneState, id: string) => bounded(scene.channels.find(item => item.id === id)?.delta ?? 0);
export const paint = (id: string, name: string) => `url(#${id}-${name})`;

/** Original teaching artwork: material shading adds structure, not measured geometry. */
export function SceneDefs({ id }: { id: string }) {
  return <defs>
    <linearGradient id={`${id}-steel`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#59796e" /><stop offset=".25" stopColor="#29483d" /><stop offset=".55" stopColor="#395b4c" /><stop offset="1" stopColor="#142e24" /></linearGradient>
    <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#9ab6a9" /><stop offset=".42" stopColor="#4d7361" /><stop offset="1" stopColor="#213e30" /></linearGradient>
    <linearGradient id={`${id}-wafer`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#7d9d95" /><stop offset=".28" stopColor="#344f4c" /><stop offset=".6" stopColor="#4a6c6c" /><stop offset="1" stopColor="#263d3a" /></linearGradient>
    <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#eed5a5" /><stop offset=".5" stopColor="#c4a267" /><stop offset="1" stopColor="#7c6747" /></linearGradient>
    <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#9dcdbe" stopOpacity=".2" /><stop offset=".4" stopColor="#476b5b" stopOpacity=".04" /><stop offset="1" stopColor="#9dcdbe" stopOpacity=".15" /></linearGradient>
    <linearGradient id={`${id}-film`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#a3d1c4" /><stop offset="1" stopColor="#528774" /></linearGradient>
    <radialGradient id={`${id}-glow`}><stop stopColor="#c5b8dd" stopOpacity=".23" /><stop offset=".65" stopColor="#a094c4" stopOpacity=".09" /><stop offset="1" stopColor="#a094c4" stopOpacity="0" /></radialGradient>
    <pattern id={`${id}-hatch`} width="7" height="7" patternUnits="userSpaceOnUse"><path d="M-2 2l4-4M0 7l7-7M5 9l4-4" stroke="#98b4a5" strokeWidth=".7" opacity=".3" /></pattern>
  </defs>;
}

export function Bolt({ x, y, r = 3 }: { x: number; y: number; r?: number }) {
  return <g transform={`translate(${x} ${y})`}><circle r={r + 1.3} fill="#142a20" stroke="#60826f" strokeWidth=".8" /><path d={`M${-r * .65} 0H${r * .65}`} stroke="#a0b7aa" strokeWidth=".9" /></g>;
}

export function Leader({ d, x, y }: { d: string; x: number; y: number }) {
  return <g fill="none" stroke={palette.ink} strokeWidth="1.25" opacity=".6"><path d={d} strokeDasharray="3 5" /><circle cx={x} cy={y} r="3" fill={palette.teal} stroke="none" /></g>;
}

export function SceneLabel({ x, y, children, anchor = "middle" }: { x: number; y: number; children: React.ReactNode; anchor?: "start" | "middle" | "end" }) {
  return <text className="pv-part-label" x={x} y={y} textAnchor={anchor} fill="#bdcfc5" fontSize="13" fontWeight="500" stroke="#13271f" strokeWidth="3" paintOrder="stroke">{children}</text>;
}

export function Frame({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return <rect x={x} y={y} width={width} height={height} rx="12" fill={palette.panel} stroke="#648473" strokeWidth="1.5" />;
}

/** Current dot and gold reference tick encode only the existing relative index. */
export function IndexStrip({ x, y, delta, width = 104 }: { x: number; y: number; delta: number; width?: number }) {
  const current = width / 2 + bounded(delta) * width * .19;
  return <g transform={`translate(${x} ${y})`}>
    <rect width={width} height="23" rx="5" fill="#10231b" stroke="#5b7f6c" />
    <path d={`M8 11.5H${width - 8}`} stroke="#789888" opacity=".4" />
    {[.15,.3,.7,.85].map(value=><path key={value} d={`M${width*value} 8v7`} stroke="#668878" strokeWidth=".6" />)}
    <path d={`M${width / 2} 3V20`} stroke={palette.gold} strokeDasharray="2 2" />
    <circle className="pv-record-ink" cx={current} cy="11.5" r="3.7" fill={palette.teal} />
  </g>;
}

export function IndexGauge({ x, y, delta, radius = 21 }: { x: number; y: number; delta: number; radius?: number }) {
  const angle=(-90+bounded(delta)*31)*Math.PI/180;
  return <g transform={`translate(${x} ${y})`}>
    <circle r={radius+3} fill="#142a20" stroke="#5d806d" /><circle r={radius} fill="#10231b" stroke="#a1b9a9" strokeWidth="1.3" />
    {[-60,-30,0,30,60].map(a=>{const v=(a-90)*Math.PI/180;return <path key={a} d={`M${Math.cos(v)*radius*.72} ${Math.sin(v)*radius*.72}L${Math.cos(v)*radius*.85} ${Math.sin(v)*radius*.85}`} stroke="#769987" strokeWidth="1" />;})}
    <path d={`M0 ${-radius*.88}v5`} stroke={palette.gold} strokeWidth="2" />
    <path className="pv-record-ink" d={`M0 0L${Math.cos(angle)*radius*.63} ${Math.sin(angle)*radius*.63}`} stroke={palette.teal} strokeWidth="2.4" strokeLinecap="round" />
    <circle r="2.6" fill={palette.teal} />
  </g>;
}
