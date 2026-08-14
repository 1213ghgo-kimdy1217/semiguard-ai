import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import { translations, type Lang, type Translation } from "@/lib/i18n";
import type { RiskLevel, SensorData, AnomalyResult, AnomalyLogEntry } from "../../../shared/semiguard";
import { MANUAL_CHUNK_LIMIT, MANUAL_CHUNK_WARNING_THRESHOLD, splitManualTextIntoChunks } from "../../../shared/ragManual";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { toast } from "sonner";
import { startGoogleLink, startNaverLink, startKakaoLink } from "@/const";

// ─── 위험도 색상 매핑 ────────────────────────────────────────────────────────
// ─── 버튼 스피너 ─────────────────────────────────────────────────────────────
// ─── 미니 스파크라인 ──────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const W = 80, H = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const lastPt = pts.split(" ").pop()!;
  const [lx, ly] = lastPt.split(",").map(Number);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <circle cx={lx} cy={ly} r="2.5" fill={color} />
    </svg>
  );
}

// ─── CSV 내보내기 ─────────────────────────────────────────────────────────────
function exportLogsToCSV(logs: AnomalyLogEntry[], lang: Lang) {
  const headers = lang === "ko"
    ? ["발생 시각", "전류(A)", "온도(°C)", "진동(mm/s)", "소음(dB)", "이상 점수", "위험도", "이상 여부"]
    : ["Time", "Current(A)", "Temp(°C)", "Vib(mm/s)", "Noise(dB)", "Score", "Level", "Anomaly"];
  // 쉼표·따옴표·줄바꿈이 포함된 셀을 RFC 4180 방식으로 이스케이프
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = logs.map(log => [
    escape(new Date(log.timestamp).toLocaleString(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", { hour12: false })),
    escape(log.current.toFixed(2)),
    escape(log.temperature.toFixed(1)),
    escape(log.vibration.toFixed(2)),
    escape(log.noise.toFixed(1)),
    escape(log.anomalyScore),
    escape(log.riskLevel),
    escape(log.isAnomaly ? (lang === "ko" ? "이상" : "Anomaly") : (lang === "ko" ? "정상" : "Normal")),
  ]);
  const csv = [headers.map(h => escape(h)), ...rows].map(r => r.join(",")).join("\n");
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `semiguard_logs_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Web Audio 경고음 ────────────────────────────────────────────────────────
// AudioContext를 모듈 수준에서 지연 생성하여 재사용 (autoplay 정책 대응)
let _audioCtx: AudioContext | null = null;
// 재생 중인 oscillator 추적 (음소거 즉시 중단용)
const _activeOscillators: OscillatorNode[] = [];

function getAudioCtx(): AudioContext | null {
  try {
    if (!_audioCtx || _audioCtx.state === "closed") {
      _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return _audioCtx;
  } catch (_) { return null; }
}

function playDangerAlertSound(volume = 0.35) {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    // 브라우저 autoplay 정책: suspended 상태이면 resume 후 재생
    const doPlay = () => {
      const beepAt = (startTime: number, freq: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(Math.max(0.001, volume), startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
        _activeOscillators.push(osc);
        osc.onended = () => {
          const idx = _activeOscillators.indexOf(osc);
          if (idx !== -1) _activeOscillators.splice(idx, 1);
        };
      };
      const t0 = ctx.currentTime;
      beepAt(t0,        880, 0.18);
      beepAt(t0 + 0.22, 660, 0.18);
      beepAt(t0 + 0.44, 880, 0.18);
      beepAt(t0 + 0.66, 660, 0.28);
    };
    if (ctx.state === "suspended") {
      ctx.resume().then(doPlay).catch(() => {});
    } else {
      doPlay();
    }
  } catch (_) { /* 브라우저 미지원 시 무시 */ }
}

// ─── 카운트업/다운 훅 ────────────────────────────────────────────────────────
function useAnimatedScore(target: number, duration = 400): number {
  const [displayed, setDisplayed] = useState(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const from = displayed;
    if (from === target) return;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplayed(Math.round(from + (target - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayed(target);
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [target]);

  return displayed;
}

function ButtonSpinner({ color }: { color: string }) {
  return (
    <span className="inline-block w-3 h-3 rounded-full border-2 border-transparent"
      style={{
        borderTopColor: color,
        borderRightColor: color,
        animation: "spin 0.6s linear infinite",
        verticalAlign: "middle",
      }} />
  );
}

const RISK_COLORS: Record<RiskLevel, string> = {
  normal: "#22c55e",
  caution: "#eab308",
  warning: "#f97316",
  danger: "#ef4444",
};
const RISK_BG: Record<RiskLevel, string> = {
  normal: "rgba(34,197,94,0.10)",
  caution: "rgba(234,179,8,0.10)",
  warning: "rgba(249,115,22,0.10)",
  danger: "rgba(239,68,68,0.10)",
};
const RISK_BORDER: Record<RiskLevel, string> = {
  normal: "rgba(34,197,94,0.30)",
  caution: "rgba(234,179,8,0.30)",
  warning: "rgba(249,115,22,0.30)",
  danger: "rgba(239,68,68,0.30)",
};

function getQuickChatPrompts(riskLevel: RiskLevel, lang: Lang): string[] {
  const prompts: Record<RiskLevel, Record<Lang, string[]>> = {
    normal: {
      ko: ["현재 센서 상태는 정상 범위인가요?", "예방 점검 우선순위를 알려주세요.", "주의해야 할 변화 추이는 무엇인가요?"],
      ja: ["現在のセンサー状態は正常範囲ですか？", "予防点検の優先順位を教えてください。", "注意すべき変化傾向は何ですか？"],
      en: ["Are the current sensors within normal range?", "What should be prioritized for preventive inspection?", "Which trends should we watch closely?"],
    },
    caution: {
      ko: ["어떤 센서가 주의 단계에 영향을 주나요?", "다음 점검 순서를 알려주세요.", "위험 단계로 악화될 가능성이 있나요?"],
      ja: ["どのセンサーが注意段階に影響していますか？", "次の点検手順を教えてください。", "危険段階に悪化する可能性はありますか？"],
      en: ["Which sensor is driving the caution level?", "What inspection steps should come next?", "Could this worsen into a higher risk level?"],
    },
    warning: {
      ko: ["경고의 주요 원인은 무엇인가요?", "위험을 즉시 줄일 방법은 무엇인가요?", "정지 전에 확인할 항목은 무엇인가요?"],
      ja: ["警告の主な原因は何ですか？", "リスクを直ちに下げる方法は？", "停止前に確認すべき項目は何ですか？"],
      en: ["What is the main cause of this warning?", "How can we reduce the risk immediately?", "What must be checked before stopping equipment?"],
    },
    danger: {
      ko: ["장비를 즉시 중지해야 하나요?", "가장 먼저 점검할 부품은 무엇인가요?", "현장 안전 절차를 알려주세요."],
      ja: ["直ちに設備を停止すべきですか？", "最初に点検すべき部品は何ですか？", "現場の安全手順を教えてください。"],
      en: ["Should the equipment be stopped immediately?", "Which component should be inspected first?", "What is the on-site safety procedure?"],
    },
  };
  return prompts[riskLevel][lang];
}

interface ChartPoint extends SensorData { label: string; }
const MAX_CHART_POINTS = 30;

// ─── 센서 카드 ───────────────────────────────────────────────────────────────
function SensorCard({ label, value, unit, color, icon }: {
  label: string; value: number; unit: string; color: string; icon: string;
}) {
  return (
    <div className="rounded-xl p-4 border flex flex-col gap-2 transition-all duration-300"
      style={{ background: "rgba(255,255,255,0.025)", borderColor: `${color}35` }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
        <span className="text-base opacity-70">{icon}</span>
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-3xl font-bold font-mono leading-none" style={{ color }}>{value.toFixed(1)}</span>
        <span className="text-xs text-muted-foreground mb-0.5">{unit}</span>
      </div>
    </div>
  );
}

// ─── 위험도 게이지 ───────────────────────────────────────────────────────────
function RiskGauge({ score, riskLevel, t }: { score: number; riskLevel: RiskLevel; t: Translation }) {
  const color = RISK_COLORS[riskLevel];
  const animatedScore = useAnimatedScore(score);
  const circumference = 2 * Math.PI * 48;
  const offset = circumference * (1 - animatedScore / 100);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          <circle cx="60" cy="60" r="48" fill="none"
            stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.23,1,0.32,1), stroke 0.4s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-4xl font-bold font-mono leading-none" style={{ color, transition: "color 0.4s" }}>{animatedScore}</span>
          <span className="text-[10px] text-muted-foreground tracking-wide">{t.riskScore}</span>
        </div>
      </div>
      <div className="px-5 py-1.5 rounded-full text-sm font-bold tracking-widest border transition-all duration-400"
        style={{ color, background: RISK_BG[riskLevel], borderColor: RISK_BORDER[riskLevel] }}>
        {t[riskLevel]}
      </div>
      {/* 4단계 인디케이터 바 */}
      <div className="flex gap-1.5 w-full px-1">
        {(["normal","caution","warning","danger"] as RiskLevel[]).map(lvl => (
          <div key={lvl} className="flex-1 h-1.5 rounded-full transition-all duration-300"
            style={{ background: riskLevel === lvl ? RISK_COLORS[lvl] : "rgba(255,255,255,0.05)" }} />
        ))}
      </div>
    </div>
  );
}

// ─── Heartbeat 인디케이터 ───────────────────────────────────────────────────

// ─── 카운트업 애니메이션 훅 ──────────────────────────────────────────────────
function useCountUp(target: number, duration = 800) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const from = prevRef.current;
    const to = target;
    if (from === to) return;
    prevRef.current = to;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);
  return display;
}

function HeartbeatIndicator({ alive, t }: { alive: boolean; t: Translation }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold"
      style={{ background: alive ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)" }}>
      <div className="w-2 h-2 rounded-full" style={{
        background: alive ? "#22c55e" : "#ef4444",
        animation: alive ? "pulse 2s infinite" : "none",
      }} />
      <span style={{ color: alive ? "#22c55e" : "#ef4444" }}>
        {alive ? t.heartbeatOk : t.heartbeatFail}
      </span>
    </div>
  );
}

// ─── 경고 패널 ──────────────────────────────────────────────────────────────
function AlertPanel({ riskLevel, relayTripped, t }: { riskLevel: RiskLevel; relayTripped: boolean; t: Translation }) {
  const isDanger = riskLevel === "danger";
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full" style={{
          background: isDanger ? "#ef4444" : "#22c55e",
          animation: isDanger ? "pulse 0.5s infinite" : "none",
        }} />
        <span className="text-xs font-semibold text-muted-foreground">{t.alertLight}</span>
      </div>
      <div className="w-px h-4 bg-border" />
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold" style={{ color: relayTripped ? "#ef4444" : "#22c55e" }}>
          {relayTripped ? t.relayActive : t.relayInactive}
        </span>
      </div>
    </div>
  );
}

// ─── 커스텀 차트 Tooltip ────────────────────────────────────────────────────
function CustomTooltip(props: any) {
  if (!props.active || !props.payload) return null;
  return (
    <div className="bg-black/80 border border-white/20 rounded-lg p-2 text-xs text-white backdrop-blur">
      {props.payload.map((entry: any, i: number) => (
        <div key={i} style={{ color: entry.color }}>
          {entry.name}: {entry.value.toFixed(2)}
        </div>
      ))}
    </div>
  );
}

// ─── 임팩트 통계 카드 ────────────────────────────────────────────────────────
function ImpactCard({ label, value, unit, icon, color }: {
  label: string; value: string | number; unit?: string; icon: string; color: string;
}) {
  return (
    <div className="rounded-xl p-4 border flex flex-col gap-2"
      style={{ background: "rgba(255,255,255,0.025)", borderColor: `${color}35` }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-2xl font-bold font-mono leading-none" style={{ color }}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {unit && <span className="text-xs text-muted-foreground mb-0.5">{unit}</span>}
      </div>
    </div>
  );
}

// ─── 월간 히트맵 캘린더 ──────────────────────────────────────────────────────
const RISK_ORDER: Record<RiskLevel, number> = { normal: 1, caution: 2, warning: 3, danger: 4 };

// ─── 위험도 점수 라인 차트 ────────────────────────────────────────────────────
const RISK_COLOR_MAP: Record<string, string> = {
  normal: "#22c55e", caution: "#eab308", warning: "#f97316", danger: "#ef4444",
};

function ScoreLineChart({
  data,
  lang,
  isDark = true,
}: {
  data: { timestamp: string; score: number; riskLevel: string }[];
  lang: Lang;
  isDark?: boolean;
}) {
  const chartTextColor = isDark ? "oklch(0.45 0.01 240)" : "oklch(0.30 0.01 240)";
  const chartAxisColor = isDark ? "oklch(0.25 0.02 240)" : "oklch(0.75 0.01 240)";
  const chartDotStroke = isDark ? "oklch(0.10 0.01 240)" : "oklch(0.95 0.005 240)";
  const tooltipBg      = isDark ? "oklch(0.15 0.02 240)" : "oklch(0.97 0.005 240)";
  const tooltipBorder  = isDark ? "oklch(0.28 0.03 240)" : "oklch(0.80 0.01 240)";
  const tooltipTime    = isDark ? "oklch(0.55 0.01 240)" : "oklch(0.40 0.01 240)";

  const [tooltip, setTooltip] = useState<{ x: number; y: number; score: number; time: string; risk: string } | null>(null);
  const W = 800, H = 200, PAD = { top: 16, right: 16, bottom: 32, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">
        {lang === "ko" ? "데이터가 쌓이면 차트가 표시됩니다." : "Chart will appear as data accumulates."}
      </div>
    );
  }

  const minScore = 0, maxScore = 100;
  const xScale = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
  const yScale = (v: number) => PAD.top + innerH - ((v - minScore) / (maxScore - minScore)) * innerH;

  // 위험 단계별 배경 밴드
  const bands = [
    { y1: yScale(70), y2: yScale(100), color: "rgba(239,68,68,0.06)" },
    { y1: yScale(50), y2: yScale(70),  color: "rgba(249,115,22,0.06)" },
    { y1: yScale(30), y2: yScale(50),  color: "rgba(234,179,8,0.06)" },
    { y1: yScale(0),  y2: yScale(30),  color: "rgba(34,197,94,0.06)" },
  ];

  // 임계선
  const threshLines = [
    { y: yScale(70), color: "#ef4444", label: "70" },
    { y: yScale(50), color: "#f97316", label: "50" },
    { y: yScale(30), color: "#eab308", label: "30" },
  ];

  // 폴리라인 포인트
  const points = data.map((d, i) => `${xScale(i)},${yScale(d.score)}`).join(" ");

  // X축 레이블 (최대 6개)
  const xLabels: { i: number; label: string }[] = [];
  const step = Math.max(1, Math.floor((data.length - 1) / 5));
  for (let i = 0; i < data.length; i += step) {
    const d = new Date(data[i].timestamp);
    xLabels.push({ i, label: `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}` });
  }
  if (xLabels[xLabels.length - 1]?.i !== data.length - 1) {
    const last = data[data.length - 1];
    const d = new Date(last.timestamp);
    xLabels.push({ i: data.length - 1, label: `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}` });
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }}>
      {/* 배경 밴드 */}
      {bands.map((b, i) => (
        <rect key={i} x={PAD.left} y={b.y1} width={innerW} height={Math.abs(b.y2 - b.y1)} fill={b.color} />
      ))}
      {/* 임계선 */}
      {threshLines.map(tl => (
        <g key={tl.label}>
          <line x1={PAD.left} y1={tl.y} x2={PAD.left + innerW} y2={tl.y}
            stroke={tl.color} strokeWidth={0.8} strokeDasharray="4 3" opacity={0.6} />
          <text x={PAD.left - 4} y={tl.y + 4} textAnchor="end" fontSize={9} fill={tl.color} opacity={0.8}>{tl.label}</text>
        </g>
      ))}
      {/* Y축 레이블 */}
      {[0, 50, 100].map(v => (
        <text key={v} x={PAD.left - 4} y={yScale(v) + 4} textAnchor="end" fontSize={9} fill={chartTextColor}>{v}</text>
      ))}
      {/* 라인 */}
      <polyline points={points} fill="none" stroke="oklch(0.65 0.18 200)" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      {/* 점 */}
      {data.map((d, i) => (
        <circle key={i} cx={xScale(i)} cy={yScale(d.score)} r={3}
          fill={RISK_COLOR_MAP[d.riskLevel] ?? "#38bdf8"}
          stroke={chartDotStroke} strokeWidth={1}
          style={{ cursor: "crosshair" }}
          onMouseEnter={() => {
            const d2 = new Date(d.timestamp);
            setTooltip({
              x: xScale(i),
              y: yScale(d.score),
              score: d.score,
              time: `${d2.getHours().toString().padStart(2,"0")}:${d2.getMinutes().toString().padStart(2,"0")}:${d2.getSeconds().toString().padStart(2,"0")}`,
              risk: d.riskLevel,
            });
          }}
          onMouseLeave={() => setTooltip(null)}
        />
      ))}
      {/* X축 레이블 */}
      {xLabels.map(xl => (
        <text key={xl.i} x={xScale(xl.i)} y={H - 4} textAnchor="middle" fontSize={9} fill={chartTextColor}>{xl.label}</text>
      ))}
      {/* X축 선 */}
      <line x1={PAD.left} y1={PAD.top + innerH} x2={PAD.left + innerW} y2={PAD.top + innerH} stroke={chartAxisColor} strokeWidth={1} />
      {/* 툴팁 */}
      {tooltip && (() => {
        const TW = 110, TH = 44;
        const tx = tooltip.x + TW + 8 > W ? tooltip.x - TW - 8 : tooltip.x + 8;
        const ty = tooltip.y - TH / 2 < PAD.top ? PAD.top : tooltip.y + TH / 2 > H - PAD.bottom ? H - PAD.bottom - TH : tooltip.y - TH / 2;
        const riskColor = RISK_COLOR_MAP[tooltip.risk] ?? "#38bdf8";
        return (
          <g style={{ pointerEvents: "none" }}>
            <rect x={tx} y={ty} width={TW} height={TH} rx={6} fill={tooltipBg} stroke={tooltipBorder} strokeWidth={1} />
            <text x={tx + 8} y={ty + 15} fontSize={10} fill={riskColor} fontWeight="600">{`${lang === "ko" ? "점수" : "Score"}: ${tooltip.score}`}</text>
            <text x={tx + 8} y={ty + 30} fontSize={9} fill={tooltipTime}>{tooltip.time}</text>
            <text x={tx + 8} y={ty + 42} fontSize={9} fill={riskColor} opacity={0.8}>{
              lang === "ko"
                ? tooltip.risk === "danger" ? "위험" : tooltip.risk === "warning" ? "경고" : tooltip.risk === "caution" ? "주의" : "정상"
                : tooltip.risk.charAt(0).toUpperCase() + tooltip.risk.slice(1)
            }</text>
          </g>
        );
      })()}
    </svg>
  );
}

function MonthlyHeatmap({
  dailyData,
  lang,
  t,
  onDateClick,
  isDark,
}: {
  dailyData: { date: string; riskLevel: string }[];
  lang: Lang;
  t: import("@/lib/i18n").Translation;
  onDateClick?: (date: string) => void;
  isDark: boolean;
}) {
  const th = {
    bgCard:    isDark ? "oklch(0.13 0.015 240)"  : "oklch(0.99 0.003 240)",
    border:    isDark ? "oklch(0.20 0.02 240)"   : "oklch(0.85 0.01 240)",
    border2:   isDark ? "oklch(0.25 0.02 240)"   : "oklch(0.80 0.01 240)",
    textMuted: isDark ? "oklch(0.50 0.01 240)"   : "oklch(0.45 0.01 240)",
  };
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // 날짜별 최고 위험도 집계
  const dayMap = useMemo(() => {
    const map: Record<string, RiskLevel> = {};
    for (const row of dailyData) {
      map[row.date] = row.riskLevel as RiskLevel;
    }
    return map;
  }, [dailyData]);

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDow = new Date(year, month, 1).getDay(); // 0=일
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  })();

  const CELL_COLOR: Record<RiskLevel, string> = {
    normal:  "rgba(34,197,94,0.55)",
    caution: "rgba(234,179,8,0.65)",
    warning: "rgba(249,115,22,0.70)",
    danger:  "rgba(239,68,68,0.80)",
  };
  const CELL_BORDER: Record<RiskLevel, string> = {
    normal:  "rgba(34,197,94,0.80)",
    caution: "rgba(234,179,8,0.90)",
    warning: "rgba(249,115,22,0.90)",
    danger:  "rgba(239,68,68,1.00)",
  };

  const weekDays = lang === "ko"
    ? ["일", "월", "화", "수", "목", "금", "토"]
    : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const monthLabel = calMonth.toLocaleDateString(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", { year: "numeric", month: "long" });

  // 범례 항목
  const legend: { level: RiskLevel; label: string }[] = [
    { level: "normal",  label: lang === "ko" ? "정상" : "Normal" },
    { level: "caution", label: lang === "ko" ? "주의" : "Caution" },
    { level: "warning", label: lang === "ko" ? "경고" : "Warning" },
    { level: "danger",  label: lang === "ko" ? "위험" : "Danger" },
  ];

  return (
    <div className="rounded-xl border p-5" style={{ background: th.bgCard, borderColor: th.border }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          {lang === "ko" ? "월간 위험도 히트맵" : "Monthly Risk Heatmap"}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="w-6 h-6 flex items-center justify-center rounded text-xs border transition-all hover:opacity-80 active:scale-95"
            style={{ borderColor: th.border2, color: th.textMuted }}>‹</button>
          <span className="text-xs font-semibold min-w-[90px] text-center">{monthLabel}</span>
          <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="w-6 h-6 flex items-center justify-center rounded text-xs border transition-all hover:opacity-80 active:scale-95"
            style={{ borderColor: th.border2, color: th.textMuted }}>›</button>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map(d => (
          <div key={d} className="text-center text-[9px] font-semibold text-muted-foreground py-0.5">{d}</div>
        ))}
      </div>

      {/* 날짜 셀 */}
      <div className="grid grid-cols-7 gap-1">
        {/* 첫 주 빈 칸 */}
        {Array.from({ length: firstDow }).map((_, i) => <div key={`empty-${i}`} />)}
        {/* 날짜 */}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const lvl = dayMap[key];
          const isToday = key === todayStr;
          return (
            <div key={day}
              title={lvl ? `${key}: ${lang === "ko" ? { normal: "정상", caution: "주의", warning: "경고", danger: "위험" }[lvl] : lvl}` : key}
              onClick={() => onDateClick?.(key)}
              className="aspect-square flex items-center justify-center rounded text-[10px] font-mono transition-all duration-200 select-none"
              style={{
                cursor: onDateClick ? "pointer" : "default",
                background: lvl ? CELL_COLOR[lvl] : (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"),
                border: isToday
                  ? "1.5px solid oklch(0.65 0.18 200)"
                  : lvl ? `1px solid ${CELL_BORDER[lvl]}` : `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.10)"}`,
                color: lvl ? (isDark ? "#fff" : "#111") : (isDark ? "oklch(0.45 0.01 240)" : "oklch(0.30 0.01 240)"),
                fontWeight: isToday ? 700 : 400,
              }}>
              {day}
            </div>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-3 mt-4 flex-wrap">
        <span className="text-[9px] text-muted-foreground">{lang === "ko" ? "범례:" : "Legend:"}</span>
        {legend.map(({ level, label }) => (
          <div key={level} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ background: CELL_COLOR[level], border: `1px solid ${CELL_BORDER[level]}` }} />
            <span className="text-[9px] text-muted-foreground">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }} />
          <span className="text-[9px] text-muted-foreground">{lang === "ko" ? "데이터 없음" : "No data"}</span>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 대시보드 ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [lang, setLang] = useState<Lang>(() => {
    const requestedLang = import.meta.env.DEV
      ? new URLSearchParams(window.location.search).get("lang")
      : null;
    if (requestedLang === "en" || requestedLang === "ja" || requestedLang === "ko") return requestedLang;
    try {
      const savedLang = localStorage.getItem("semiguard_lang");
      return savedLang === "en" || savedLang === "ja" || savedLang === "ko" ? savedLang : "ko";
    } catch {
      return "ko";
    }
  });
  const t = translations[lang] as Translation;
  const [isDark, setIsDark] = useState<boolean>(() => {
    try { return localStorage.getItem("semiguard_theme") !== "light"; } catch { return true; }
  });
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(() =>
    import.meta.env.DEV && new URLSearchParams(window.location.search).get("menu") === "open",
  );

  useEffect(() => {
    try {
      localStorage.setItem("semiguard_lang", lang);
    } catch {
      // 저장 공간 제한 또는 개인정보 보호 모드에서는 기본 언어로 계속 동작한다.
    }
  }, [lang]);
  // ─── 테마 색상 팔레트 ─────────────────────────────────────────────────────
  const th = {
    bg:        isDark ? "oklch(0.10 0.01 240)"   : "oklch(0.97 0.005 240)",
    bgCard:    isDark ? "oklch(0.13 0.015 240)"  : "oklch(0.99 0.003 240)",
    bgCard2:   isDark ? "oklch(0.115 0.015 240)" : "oklch(0.96 0.005 240)",
    border:    isDark ? "oklch(0.20 0.02 240)"   : "oklch(0.85 0.01 240)",
    border2:   isDark ? "oklch(0.25 0.02 240)"   : "oklch(0.80 0.01 240)",
    text:      isDark ? "oklch(0.90 0.01 240)"   : "oklch(0.15 0.01 240)",
    textMuted: isDark ? "oklch(0.50 0.01 240)"   : "oklch(0.45 0.01 240)",
    accent:    "oklch(0.65 0.18 200)",
    header:    isDark ? "oklch(0.115 0.015 240)" : "oklch(0.98 0.005 240)",
  };

  // ─── 위험도 임계값 state (클라이언트 전용) ───────────────────────────────────
  const [thresholds, setThresholds] = useState({ normal: 29, caution: 49, warning: 69 });
  const saveThresholdsMutation = trpc.semiguard.saveThresholds.useMutation();
  const getThresholdsQuery = trpc.semiguard.getThresholds.useQuery(undefined, { staleTime: Infinity });
  const socialLinksQuery = trpc.auth.socialLinks.useQuery();
  const unlinkSocialMutation = trpc.auth.unlinkSocial.useMutation({
    onSuccess: () => {
      void socialLinksQuery.refetch();
      toast.success(lang === "ko" ? "소셜 계정 연결을 해제했습니다." : "Social account unlinked.");
    },
    onError: () => toast.error(lang === "ko" ? "소셜 계정 연결 해제에 실패했습니다." : "Failed to unlink social account."),
  });

  // DB에서 임계값 불러오기 (초기 1회)
  useEffect(() => {
    if (getThresholdsQuery.data) {
      setThresholds(getThresholdsQuery.data);
    }
  }, [getThresholdsQuery.data]);
  const [showThresholdPanel, setShowThresholdPanel] = useState(false);

  // 임계값 기반 riskLevel 판정 함수 (클라이언트 로컬 analyzeData에 사용)
  const getLocalRiskLevel = useCallback((score: number): RiskLevel => {
    if (score <= thresholds.normal) return "normal";
    if (score <= thresholds.caution) return "caution";
    if (score <= thresholds.warning) return "warning";
    return "danger";
  }, [thresholds]);

  // ─── 히트맵 날짜 클릭 → 로그 탭 날짜 필터 state ──────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateStart, setDateStart] = useState<string>("");
  const [dateEnd, setDateEnd] = useState<string>("");

  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [current, setCurrent] = useState<AnomalyResult | null>(null);
  const [heartbeatAlive, setHeartbeatAlive] = useState(true);
  const lastUpdateRef = useRef<number>(Date.now());
  const [relayTripped, setRelayTripped] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "log">("dashboard");
  const [initialized, setInitialized] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const autoPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [dangerAlert, setDangerAlert] = useState(false);
  const [muted, setMuted] = useState<boolean>(false);
  const mutedRef = useRef<boolean>(false);
  // localStorage에서 초기값 복원
  useEffect(() => {
    try {
      const savedMuted = localStorage.getItem("semiguard_muted") === "true";
      const savedVolume = parseFloat(localStorage.getItem("semiguard_volume") ?? "0.35");
      setMuted(savedMuted);
      mutedRef.current = savedMuted;
      const vol = isNaN(savedVolume) ? 0.35 : Math.min(1, Math.max(0, savedVolume));
      setVolume(vol);
      volumeRef.current = vol;
    } catch { /* localStorage 미지원 환경 무시 */ }
  }, []);
  const [volume, setVolume] = useState<number>(0.35);
  const volumeRef = useRef<number>(0.35);
  const [dangerFlash, setDangerFlash] = useState(false);
  const [newLogCount, setNewLogCount] = useState(0);
  const prevLogCountRef = useRef(0);
  const [selectedLog, setSelectedLog] = useState<import("../../../shared/semiguard").AnomalyLogEntry | null>(null);
  const [logPage, setLogPage] = useState(1);
  const LOG_PAGE_SIZE = 10;
  const [scoreHistory, setScoreHistory] = useState<number[]>([10]);
  const [logFilter, setLogFilter] = useState<RiskLevel | "all">("all");
  const [llmAnalysis, setLlmAnalysis] = useState<{
    primaryCause: string;
    details: string;
    recommendation: string;
    score: number;
    riskLevel: string;
  } | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [showAiHistory, setShowAiHistory] = useState(false);
  const llmHistoryQuery = trpc.semiguard.getLlmHistory.useQuery(undefined, { refetchInterval: 10000 });

  // 대화형 AI 상담 챗봇 상태 및 세션 보관 관리
  const [isChatOpen, setIsChatOpen] = useState(() =>
    import.meta.env.DEV && new URLSearchParams(window.location.search).get("chat") === "open",
  );
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(() =>
    import.meta.env.DEV && new URLSearchParams(window.location.search).get("history") === "open",
  );
  const [showManualRagModal, setShowManualRagModal] = useState(() =>
    import.meta.env.DEV && new URLSearchParams(window.location.search).get("manual") === "open",
  );
  const [manualTitle, setManualTitle] = useState("");
  const [manualContent, setManualContent] = useState("");
  const [manualSearchQuery, setManualSearchQuery] = useState("");
  const [debouncedManualSearch, setDebouncedManualSearch] = useState("");
  const [manualDocumentToDelete, setManualDocumentToDelete] = useState<number | null>(null);
  const [previewManualDocumentId, setPreviewManualDocumentId] = useState<number | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [showFeedbackHistoryPanel, setShowFeedbackHistoryPanel] = useState(() =>
    import.meta.env.DEV && new URLSearchParams(window.location.search).get("feedback") === "open",
  );
  const [messageFeedbackIds, setMessageFeedbackIds] = useState<Record<number, number>>({});
  const [feedbackHistoryFilter, setFeedbackHistoryFilter] = useState<"all" | "like" | "dislike">("all");
  const [feedbackHistorySearch, setFeedbackHistorySearch] = useState("");
  const [feedbackHistoryStartDate, setFeedbackHistoryStartDate] = useState("");
  const [feedbackHistoryEndDate, setFeedbackHistoryEndDate] = useState("");
  const [feedbackHistorySort, setFeedbackHistorySort] = useState<"newest" | "oldest">("newest");
  const [feedbackHistoryPage, setFeedbackHistoryPage] = useState(1);
  const [animatedPositiveRatio, setAnimatedPositiveRatio] = useState(0);
  const [feedbackKeywordSummary, setFeedbackKeywordSummary] = useState<{ mode: "ai" | "fallback"; keywords: string[]; summary: string; improvement: string } | null>(null);
  const [feedbackContextItem, setFeedbackContextItem] = useState<{ id: number; sessionId: number; messageId: number | null; messageContent: string } | null>(null);
  const [feedbackToDelete, setFeedbackToDelete] = useState<number | null>(null);
  const [showDeleteAllFeedbackConfirm, setShowDeleteAllFeedbackConfirm] = useState(false);
  const [showDeleteAllFeedbackFinalConfirm, setShowDeleteAllFeedbackFinalConfirm] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [debouncedHistorySearch, setDebouncedHistorySearch] = useState("");
  const [historySessionFilter, setHistorySessionFilter] = useState<"all" | "pinned">("all");
  const [historySessionSort, setHistorySessionSort] = useState<"newest" | "oldest" | "title">("newest");
  const [historySessionPage, setHistorySessionPage] = useState(1);
  const [historySessionStartDate, setHistorySessionStartDate] = useState("");
  const [historySessionEndDate, setHistorySessionEndDate] = useState("");
  const [historySessionDatePreset, setHistorySessionDatePreset] = useState<"all" | "today" | "week" | "month" | "custom">("all");

  const chatUtils = trpc.useUtils();
  const chatSessionsQuery = trpc.semiguard.getChatSessions.useQuery(undefined, { enabled: isChatOpen });
  const normalizedHistorySearch = searchKeyword.trim();
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedHistorySearch(normalizedHistorySearch), 250);
    return () => window.clearTimeout(timer);
  }, [normalizedHistorySearch]);
  const isHistorySearchPending = normalizedHistorySearch !== debouncedHistorySearch;
  const searchChatSessionsQuery = trpc.semiguard.searchChatSessions.useQuery(
    { query: debouncedHistorySearch || "pending" },
    { enabled: isChatOpen && debouncedHistorySearch.length > 0 },
  );
  const visibleChatSessions = isHistorySearchPending
    ? []
    : debouncedHistorySearch.length > 0
    ? (searchChatSessionsQuery.data ?? [])
    : (chatSessionsQuery.data ?? []);
  const historySessionStartTime = historySessionStartDate ? new Date(`${historySessionStartDate}T00:00:00`).getTime() : null;
  const historySessionEndTime = historySessionEndDate ? new Date(`${historySessionEndDate}T23:59:59.999`).getTime() : null;
  const filteredAndSortedChatSessions = visibleChatSessions
    .filter(session => {
      const updatedTime = new Date(session.updatedAt).getTime();
      return (historySessionFilter === "all" || session.isPinned === 1)
        && (historySessionStartTime === null || updatedTime >= historySessionStartTime)
        && (historySessionEndTime === null || updatedTime <= historySessionEndTime);
    })
    .slice()
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return (b.isPinned ?? 0) - (a.isPinned ?? 0);
      if (historySessionSort === "title") return a.title.localeCompare(b.title, lang === "ja" ? "ja" : lang === "ko" ? "ko" : "en");
      const timeA = new Date(a.updatedAt).getTime();
      const timeB = new Date(b.updatedAt).getTime();
      return historySessionSort === "oldest" ? timeA - timeB : timeB - timeA;
    });
  const historySessionPageSize = 8;
  const historySessionTotalPages = Math.max(1, Math.ceil(filteredAndSortedChatSessions.length / historySessionPageSize));
  const activeHistorySessionPage = Math.min(historySessionPage, historySessionTotalPages);
  const paginatedChatSessions = filteredAndSortedChatSessions.slice(
    (activeHistorySessionPage - 1) * historySessionPageSize,
    activeHistorySessionPage * historySessionPageSize,
  );
  const filteredHistoryMessageCount = filteredAndSortedChatSessions.reduce((total, session) => total + Number(session.messageCount ?? 0), 0);
  const filteredHistoryPinnedCount = filteredAndSortedChatSessions.filter(session => session.isPinned === 1).length;
  useEffect(() => {
    setHistorySessionPage(1);
  }, [debouncedHistorySearch, historySessionFilter, historySessionSort, historySessionStartDate, historySessionEndDate]);
  const applyHistoryDatePreset = (preset: "all" | "today" | "week" | "month") => {
    setHistorySessionDatePreset(preset);
    if (preset === "all") {
      setHistorySessionStartDate("");
      setHistorySessionEndDate("");
      return;
    }
    const formatDateInput = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    const end = new Date();
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    if (preset === "week") start.setDate(start.getDate() - 6);
    if (preset === "month") start.setDate(start.getDate() - 29);
    setHistorySessionStartDate(formatDateInput(start));
    setHistorySessionEndDate(formatDateInput(end));
  };
  const createSessionMutation = trpc.semiguard.createChatSession.useMutation();
  const saveMessageMutation = trpc.semiguard.saveChatMessage.useMutation();
  const saveFeedbackMutation = trpc.semiguard.saveChatFeedback.useMutation();
  const attachRegeneratedAnswerMutation = trpc.semiguard.attachRegeneratedAnswer.useMutation();
  const deleteChatFeedbackMutation = trpc.semiguard.deleteChatFeedback.useMutation();
  const deleteAllChatFeedbacksMutation = trpc.semiguard.deleteAllChatFeedbacks.useMutation();
  const analyzeFeedbackKeywordsMutation = trpc.semiguard.analyzeFeedbackKeywords.useMutation();
  const feedbackHistoryQuery = trpc.semiguard.getFeedbackHistory.useQuery(
    { limit: 30 },
    { enabled: isChatOpen && showFeedbackHistoryPanel },
  );
  const feedbackContextMessagesQuery = trpc.semiguard.getChatMessages.useQuery(
    { sessionId: feedbackContextItem?.sessionId ?? 0 },
    { enabled: feedbackContextItem !== null },
  );
  const addManualTextMutation = trpc.semiguard.addManualText.useMutation();
  const deleteManualDocumentMutation = trpc.semiguard.deleteManualDocument.useMutation();
  const manualDocumentsQuery = trpc.semiguard.getManualDocuments.useQuery(undefined, { enabled: isChatOpen });
  const normalizedManualSearch = manualSearchQuery.trim();
  const normalizedDebouncedManualSearch = debouncedManualSearch.trim();
  const manualDocumentSearchQuery = trpc.semiguard.searchManualDocuments.useQuery(
    { search: normalizedDebouncedManualSearch || "_" },
    { enabled: isChatOpen && showManualRagModal && normalizedDebouncedManualSearch.length > 0 },
  );
  const manualPreviewQuery = trpc.semiguard.getManualDocumentPreview.useQuery(
    { documentId: previewManualDocumentId ?? 1 },
    { enabled: isChatOpen && showManualRagModal && previewManualDocumentId !== null },
  );
  const allManualDocuments = manualDocumentsQuery.data ?? [];
  const manualChunkEstimate = useMemo(() => splitManualTextIntoChunks(manualContent).length, [manualContent]);
  const isManualChunkWarning = manualChunkEstimate >= MANUAL_CHUNK_WARNING_THRESHOLD;
  const isManualSearchPending = normalizedManualSearch.length > 0 && normalizedManualSearch !== normalizedDebouncedManualSearch;
  const isManualSearching = normalizedManualSearch.length > 0 && (isManualSearchPending || manualDocumentSearchQuery.isFetching);
  const filteredManualDocuments = normalizedManualSearch
    ? (isManualSearchPending ? [] : (manualDocumentSearchQuery.data ?? []))
    : allManualDocuments;
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedManualSearch(normalizedManualSearch), 250);
    return () => window.clearTimeout(timer);
  }, [normalizedManualSearch]);
  const deleteSessionMutation = trpc.semiguard.deleteChatSession.useMutation();
  const deleteAllSessionsMutation = trpc.semiguard.deleteAllChatSessions.useMutation();
  const updateSessionTitleMutation = trpc.semiguard.updateChatSessionTitle.useMutation();
  const setChatSessionPinnedMutation = trpc.semiguard.setChatSessionPinned.useMutation();
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [messageFeedbacks, setMessageFeedbacks] = useState<Record<number, "like" | "dislike">>({});
  const [activeDislikeIdx, setActiveDislikeIdx] = useState<number | null>(null);
  const [messageReasons, setMessageReasons] = useState<Record<number, string>>({});
  const [messageReasonCodes, setMessageReasonCodes] = useState<Record<number, "inaccurate" | "insufficient" | "irrelevant" | "other">>({});
  const [otherReasonIdx, setOtherReasonIdx] = useState<number | null>(null);
  const [otherFeedbackText, setOtherFeedbackText] = useState("");
  const [isFeedbackRegenerating, setIsFeedbackRegenerating] = useState(false);
  type ManualSource = { label: number; documentId: number; documentTitle: string; chunkIndex: number; content: string; relevanceScore?: number; matchedTerms?: string[] };
  const [activeManualSource, setActiveManualSource] = useState<ManualSource | null>(null);

  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string; timestamp: number; feedbackApplied?: boolean; manualSources?: ManualSource[]; recoveryPrompt?: string }>>([
    {
      role: "assistant",
      content: lang === "ko"
        ? "안녕하세요! 반도체 설비 예지안전 수석 엔지니어 AI입니다. 현재 센서 상태와 이상 이력에 대해 무엇이든 물어보세요. 점검 순서나 즉시 조치법을 안내해 드립니다."
        : lang === "ja"
        ? "こんにちは！半導体設備予知保全シニアエンジニアAIです。現在のセンサー状態や異常履歴について何でもご質問ください。"
        : "Hello! I am your senior predictive maintenance AI engineer. Ask me anything about current sensor states or troubleshooting steps.",
      timestamp: Date.now(),
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatMutation = trpc.semiguard.chatWithAi.useMutation();
  const FEEDBACK_PAGE_SIZE = 5;
  const allFeedbackHistory = feedbackHistoryQuery.data ?? [];
  const normalizedFeedbackSearch = feedbackHistorySearch.trim().toLocaleLowerCase();
  const feedbackStartAt = feedbackHistoryStartDate ? new Date(`${feedbackHistoryStartDate}T00:00:00`).getTime() : null;
  const feedbackEndAt = feedbackHistoryEndDate ? new Date(`${feedbackHistoryEndDate}T23:59:59.999`).getTime() : null;
  const filteredFeedbackHistory = allFeedbackHistory.filter(item => {
    const matchesType = feedbackHistoryFilter === "all" || item.feedbackType === feedbackHistoryFilter;
    const searchable = [item.reasonCode, item.reasonText, item.messageContent, item.regeneratedContent].filter(Boolean).join(" ").toLocaleLowerCase();
    const createdAt = new Date(item.createdAt).getTime();
    const matchesDate = (feedbackStartAt === null || createdAt >= feedbackStartAt) && (feedbackEndAt === null || createdAt <= feedbackEndAt);
    return matchesType && matchesDate && (!normalizedFeedbackSearch || searchable.includes(normalizedFeedbackSearch));
  });
  const sortedFeedbackHistory = [...filteredFeedbackHistory].sort((a, b) => {
    const delta = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return feedbackHistorySort === "newest" ? delta : -delta;
  });
  const positiveFeedbackCount = allFeedbackHistory.filter(item => item.feedbackType === "like").length;
  const negativeFeedbackCount = allFeedbackHistory.filter(item => item.feedbackType === "dislike").length;
  const positiveFeedbackRatio = allFeedbackHistory.length ? Math.round((positiveFeedbackCount / allFeedbackHistory.length) * 100) : 0;
  const negativeFeedbackRatio = allFeedbackHistory.length ? 100 - positiveFeedbackRatio : 0;
  const feedbackHistoryTotalPages = Math.max(1, Math.ceil(sortedFeedbackHistory.length / FEEDBACK_PAGE_SIZE));
  const paginatedFeedbackHistory = sortedFeedbackHistory.slice((feedbackHistoryPage - 1) * FEEDBACK_PAGE_SIZE, feedbackHistoryPage * FEEDBACK_PAGE_SIZE);

  useEffect(() => {
    setFeedbackHistoryPage(1);
    setFeedbackKeywordSummary(null);
  }, [feedbackHistoryFilter, feedbackHistorySearch, feedbackHistoryStartDate, feedbackHistoryEndDate, feedbackHistorySort]);

  useEffect(() => {
    setFeedbackHistoryPage(currentPage => Math.min(currentPage, feedbackHistoryTotalPages));
  }, [feedbackHistoryTotalPages]);

  useEffect(() => {
    setAnimatedPositiveRatio(0);
    const timer = window.setTimeout(() => setAnimatedPositiveRatio(positiveFeedbackRatio), 80);
    return () => window.clearTimeout(timer);
  }, [positiveFeedbackRatio, allFeedbackHistory.length]);

  const exportFilteredFeedbackCsv = () => {
    if (filteredFeedbackHistory.length === 0) {
      toast.info(lang === "ko" ? "내보낼 피드백 기록이 없습니다." : lang === "ja" ? "エクスポートするフィードバック履歴がありません。" : "There are no feedback records to export.");
      return;
    }
    const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
    const headers = lang === "ko"
      ? ["평가", "사유 코드", "직접 사유", "평가한 답변", "재생성 답변", "평가 시간", "재생성 시간"]
      : lang === "ja"
        ? ["評価", "理由コード", "直接理由", "評価した回答", "再生成回答", "評価時刻", "再生成時刻"]
        : ["Feedback", "Reason code", "Reason text", "Rated answer", "Regenerated answer", "Feedback time", "Regenerated time"];
    const rows = sortedFeedbackHistory.map(item => [
      item.feedbackType === "like" ? (lang === "ko" ? "긍정" : lang === "ja" ? "肯定" : "Positive") : (lang === "ko" ? "부정" : lang === "ja" ? "否定" : "Negative"),
      item.reasonCode,
      item.reasonText,
      item.messageContent,
      item.regeneratedContent,
      new Date(item.createdAt).toLocaleString(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US"),
      item.regeneratedAt ? new Date(item.regeneratedAt).toLocaleString(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US") : "",
    ]);
    const csv = `\ufeff${[headers, ...rows].map(row => row.map(escapeCsv).join(",")).join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const filterName = feedbackHistoryFilter === "all" ? "all" : feedbackHistoryFilter === "like" ? "positive" : "negative";
    anchor.href = url;
    anchor.download = `semiguard-feedback-${filterName}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success(lang === "ko" ? `${sortedFeedbackHistory.length}개 피드백 기록을 CSV로 내보냈습니다.` : lang === "ja" ? `${sortedFeedbackHistory.length}件のフィードバック履歴をCSVでエクスポートしました。` : `Exported ${sortedFeedbackHistory.length} feedback records as CSV.`);
  };

  const exportFilteredChatSessionsCsv = () => {
    if (filteredAndSortedChatSessions.length === 0) {
      toast.info(lang === "ko" ? "내보낼 상담 기록이 없습니다." : lang === "ja" ? "エクスポートする相談履歴がありません。" : "There are no consultation records to export.");
      return;
    }
    const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
    const headers = lang === "ko"
      ? ["상담 제목", "고정 여부", "메시지 수", "마지막 갱신 시각"]
      : lang === "ja"
        ? ["相談タイトル", "固定", "メッセージ数", "最終更新日時"]
        : ["Consultation title", "Pinned", "Message count", "Last updated"];
    const rows = filteredAndSortedChatSessions.map(session => [
      session.title,
      session.isPinned === 1 ? (lang === "ko" ? "고정" : lang === "ja" ? "固定" : "Pinned") : (lang === "ko" ? "일반" : lang === "ja" ? "通常" : "Normal"),
      Number(session.messageCount ?? 0),
      new Date(session.updatedAt).toLocaleString(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US"),
    ]);
    const csv = `\ufeff${[headers, ...rows].map(row => row.map(escapeCsv).join(",")).join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `semiguard-consultations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success(lang === "ko" ? `${filteredAndSortedChatSessions.length}개 상담 기록을 CSV로 내보냈습니다.` : lang === "ja" ? `${filteredAndSortedChatSessions.length}件の相談履歴をCSVでエクスポートしました。` : `Exported ${filteredAndSortedChatSessions.length} consultation records as CSV.`);
  };

  const analyzeCurrentFeedbackKeywords = async () => {
    if (sortedFeedbackHistory.length === 0) {
      toast.info(lang === "ko" ? "AI가 분석할 현재 필터 결과가 없습니다." : lang === "ja" ? "AIが分析する現在のフィルター結果がありません。" : "There are no currently filtered records for AI analysis.");
      return;
    }
    try {
      setFeedbackKeywordSummary(null);
      const result = await analyzeFeedbackKeywordsMutation.mutateAsync({
        lang,
        entries: sortedFeedbackHistory.slice(0, 30).map(item => ({
          feedbackType: item.feedbackType,
          reasonCode: item.reasonCode,
          reasonText: item.reasonText,
          messageContent: item.messageContent.slice(0, 1200),
          regeneratedContent: item.regeneratedContent?.slice(0, 1200) ?? null,
        })),
      });
      setFeedbackKeywordSummary(result);
    } catch (error) {
      console.error("Feedback keyword analysis request failed:", error);
      toast.error(lang === "ko" ? "AI 키워드 요약을 생성하지 못했습니다." : lang === "ja" ? "AIキーワード要約を生成できませんでした。" : "Could not generate the AI keyword summary.");
    }
  };

  const exportActiveChatMarkdown = () => {
    if (isChatLoading) {
      toast.info(lang === "ko" ? "AI 답변 생성이 끝난 뒤 현재 상담을 내보낼 수 있습니다." : lang === "ja" ? "AI回答の生成が完了してから現在の相談をエクスポートできます。" : "Export the current consultation after the AI response is complete.");
      return;
    }
    if (activeSessionId === null || createSessionMutation.isPending) {
      toast.info(lang === "ko" ? "상담 세션을 준비 중입니다. 잠시 후 다시 시도해 주세요." : lang === "ja" ? "相談セッションを準備中です。しばらくしてからもう一度お試しください。" : "Your consultation session is being prepared. Please try again in a moment.");
      return;
    }
    const exportableMessages = chatMessages.filter(message => message.content.trim().length > 0);
    if (!exportableMessages.some(message => message.role === "user")) {
      toast.info(lang === "ko" ? "질문을 보낸 뒤 현재 상담을 내보낼 수 있습니다." : lang === "ja" ? "質問を送信した後に現在の相談をエクスポートできます。" : "Send a question before exporting the current consultation.");
      return;
    }

    try {
      const locale = lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US";
      const activeSession = chatSessionsQuery.data?.find(session => session.id === activeSessionId);
      const title = activeSession?.title.trim() || (lang === "ko" ? "현재 상담" : lang === "ja" ? "現在の相談" : "Current Consultation");
      const exportedAtLabel = lang === "ko" ? "내보낸 시각" : lang === "ja" ? "エクスポート時刻" : "Exported at";
      const updatedAtLabel = lang === "ko" ? "현재 대화 시각" : lang === "ja" ? "現在の会話時刻" : "Current conversation time";
      const userLabel = lang === "ko" ? "사용자" : lang === "ja" ? "ユーザー" : "User";
      const assistantLabel = lang === "ko" ? "SemiGuard AI 수석 엔지니어" : lang === "ja" ? "SemiGuard AI シニアエンジニア" : "SemiGuard AI Senior Engineer";
      const markdown = [
        `# ${title}`,
        "",
        `- ${updatedAtLabel}: ${new Date().toLocaleString(locale)}`,
        `- ${exportedAtLabel}: ${new Date().toLocaleString(locale)}`,
        "",
        "---",
        "",
        ...exportableMessages.flatMap(message => [
          `## ${message.role === "user" ? userLabel : assistantLabel}`,
          "",
          message.content,
          "",
          `> ${new Date(message.timestamp).toLocaleString(locale)}`,
          "",
          "---",
          "",
        ]),
      ].join("\n");
      const blob = new Blob([`\ufeff${markdown}`], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const safeTitle = title.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").slice(0, 40) || "consultation";
      anchor.href = url;
      anchor.download = `semiguard-current-${safeTitle}-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success(lang === "ko" ? "현재 상담을 Markdown 파일로 내보냈습니다." : lang === "ja" ? "現在の相談をMarkdownファイルとしてエクスポートしました。" : "Current consultation exported as a Markdown file.");
    } catch (error) {
      console.error("Active consultation export failed:", error);
      toast.error(lang === "ko" ? "현재 상담을 내보내지 못했습니다." : lang === "ja" ? "現在の相談をエクスポートできませんでした。" : "Could not export the current consultation.");
    }
  };

  const exportChatSessionMarkdown = async (session: { id: number; title: string; updatedAt: Date | string }) => {
    try {
      const messages = await chatUtils.client.semiguard.getChatMessages.query({ sessionId: session.id });
      if (messages.length === 0) {
        toast.info(lang === "ko" ? "내보낼 대화가 없습니다." : lang === "ja" ? "エクスポートする会話がありません。" : "There are no messages to export.");
        return;
      }
      const locale = lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US";
      const title = session.title.trim() || (lang === "ko" ? "상담 기록" : lang === "ja" ? "相談履歴" : "Consultation history");
      const exportedAtLabel = lang === "ko" ? "내보낸 시각" : lang === "ja" ? "エクスポート時刻" : "Exported at";
      const updatedAtLabel = lang === "ko" ? "최근 갱신" : lang === "ja" ? "最終更新" : "Last updated";
      const userLabel = lang === "ko" ? "사용자" : lang === "ja" ? "ユーザー" : "User";
      const assistantLabel = lang === "ko" ? "SemiGuard AI 수석 엔지니어" : lang === "ja" ? "SemiGuard AI シニアエンジニア" : "SemiGuard AI Senior Engineer";
      const markdown = [
        `# ${title}`,
        "",
        `- ${updatedAtLabel}: ${new Date(session.updatedAt).toLocaleString(locale)}`,
        `- ${exportedAtLabel}: ${new Date().toLocaleString(locale)}`,
        "",
        "---",
        "",
        ...messages.flatMap(message => [
          `## ${message.role === "user" ? userLabel : assistantLabel}`,
          "",
          message.content,
          "",
          `> ${new Date(message.createdAt).toLocaleString(locale)}`,
          "",
          "---",
          "",
        ]),
      ].join("\n");
      const blob = new Blob([`\ufeff${markdown}`], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const safeTitle = title.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").slice(0, 40) || "consultation";
      anchor.href = url;
      anchor.download = `semiguard-${safeTitle}-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success(lang === "ko" ? "상담 기록을 Markdown 파일로 내보냈습니다." : lang === "ja" ? "相談履歴をMarkdownファイルとしてエクスポートしました。" : "Consultation history exported as Markdown.");
    } catch (error) {
      console.error("Consultation export failed:", error);
      toast.error(lang === "ko" ? "상담 기록을 내보내지 못했습니다." : lang === "ja" ? "相談履歴をエクスポートできませんでした。" : "Could not export the consultation history.");
    }
  };

  // 최초 챗봇 오픈 시 세션이 없으면 기본 세션 생성
  useEffect(() => {
    if (isChatOpen && activeSessionId === null) {
      createSessionMutation.mutateAsync({ title: lang === "ko" ? "새로운 상담" : lang === "ja" ? "新しい相談" : "New Consultation" }).then((res) => {
        setActiveSessionId(res.sessionId);
        chatUtils.semiguard.getChatSessions.invalidate();
      }).catch(err => console.error("Failed to create chat session:", err));
    }
  }, [isChatOpen]);

  const handleResetChat = async () => {
    try {
      const newTitle = chatMessages.length > 1
        ? chatMessages[1].content.slice(0, 25) + "..."
        : (lang === "ko" ? "새로운 상담" : lang === "ja" ? "新しい相談" : "New Consultation");
      const res = await createSessionMutation.mutateAsync({ title: newTitle });
      setActiveSessionId(res.sessionId);
      const initialMsg = lang === "ko"
        ? "새로운 상담 세션이 시작되었습니다. 이전 상담 기록은 상단의 '상담 기록' 버튼에서 언제든지 다시 확인하실 수 있습니다."
        : lang === "ja"
        ? "新しい相談セッションが開始されました。過去の相談履歴は上部の「相談履歴」ボタンからいつでもご確認いただけます。"
        : "A new consultation session has started. Previous conversation history remains accessible via the 'History' button.";
      
      setChatMessages([
        {
          role: "assistant",
          content: initialMsg,
          timestamp: Date.now(),
        },
      ]);
      await saveMessageMutation.mutateAsync({ sessionId: res.sessionId, role: "assistant", content: initialMsg });
      chatUtils.semiguard.getChatSessions.invalidate();
    } catch (e) {
      console.error("Reset chat session error:", e);
    } finally {
      setShowResetConfirmModal(false);
    }
  };

  const handleSendChatMessage = async (textToSend?: string) => {
    const text = textToSend ?? chatInput;
    if (!text.trim() || isChatLoading) return;
    const userMsg = { role: "user" as const, content: text.trim(), timestamp: Date.now() };
    const nextMessages = [...chatMessages, userMsg];
    const activeSession = activeSessionId === null
      ? undefined
      : chatSessionsQuery.data?.find(session => session.id === activeSessionId);
    const defaultSessionTitles = ["새로운 상담", "新しい相談", "New Consultation"];
    const shouldAutoTitleSession = activeSessionId !== null &&
      nextMessages.filter(message => message.role === "user").length === 1 &&
      (!activeSession || defaultSessionTitles.includes(activeSession.title));
    setChatMessages(nextMessages);
    if (!textToSend) setChatInput("");
    setIsChatLoading(true);

    if (activeSessionId !== null) {
      saveMessageMutation.mutateAsync({ sessionId: activeSessionId, role: "user", content: text.trim() }).catch(err => console.error("Failed to save user message:", err));
      if (shouldAutoTitleSession) {
        const normalizedTitle = text.trim().replace(/\s+/g, " ");
        const autoTitle = normalizedTitle.length > 48 ? `${normalizedTitle.slice(0, 48)}…` : normalizedTitle;
        updateSessionTitleMutation.mutateAsync({ sessionId: activeSessionId, title: autoTitle })
          .then(() => chatUtils.semiguard.getChatSessions.invalidate())
          .catch(err => console.error("Failed to auto-title consultation session:", err));
      }
    }

    try {
      const sensorContext = {
        current: current?.sensorData.current ?? 5.0,
        temperature: current?.sensorData.temperature ?? 45.0,
        vibration: current?.sensorData.vibration ?? 2.0,
        noise: current?.sensorData.noise ?? 55.0,
        anomalyScore: current?.anomalyScore ?? 10,
        riskLevel: current?.riskLevel ?? "normal",
      };
      // 수집된 피드백 이력을 서버로 전달하여 LLM이 실시간 학습하도록 반영
      const feedbackHistory = Object.entries(messageFeedbacks).map(([idxStr, type]) => {
        const idx = Number(idxStr);
        return {
          type,
          reason: messageReasons[idx],
          reasonCode: messageReasonCodes[idx],
        };
      });

      const res = await chatMutation.mutateAsync({
        sensorContext,
        messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        lang,
        feedbackHistory,
      });
      const aiReply = res.reply;
      const isTemporaryServiceReply = lang === "ko"
        ? aiReply.includes("AI 상담 연결 중 일시적인 지연")
        : lang === "ja"
          ? aiReply.includes("AI相談への接続中に一時的な遅延")
          : aiReply.includes("Temporary delay connecting to AI consultation");
      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: aiReply,
        timestamp: Date.now(),
        manualSources: res.manualSources ?? [],
        recoveryPrompt: isTemporaryServiceReply ? text.trim() : undefined,
      }]);

      if (activeSessionId !== null) {
        saveMessageMutation.mutateAsync({ sessionId: activeSessionId, role: "assistant", content: aiReply }).catch(err => console.error("Failed to save AI message:", err));
        chatUtils.semiguard.getChatSessions.invalidate();
      }
    } catch {
      setChatMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: lang === "ko"
            ? "응답 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
            : lang === "ja"
              ? "回答の生成中にエラーが発生しました。しばらくしてからもう一度お試しください。"
              : "Error generating response. Please try again.",
          timestamp: Date.now(),
          recoveryPrompt: text.trim(),
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const regenerateWithFeedback = async (assistantIndex: number) => {
    if (isChatLoading || isFeedbackRegenerating || !messageReasons[assistantIndex]) return;
    const sourceMessages = chatMessages.slice(0, assistantIndex);
    if (!sourceMessages.some(message => message.role === "user")) return;

    setIsFeedbackRegenerating(true);
    setIsChatLoading(true);
    try {
      const sensorContext = {
        current: current?.sensorData.current ?? 5.0,
        temperature: current?.sensorData.temperature ?? 45.0,
        vibration: current?.sensorData.vibration ?? 2.0,
        noise: current?.sensorData.noise ?? 55.0,
        anomalyScore: current?.anomalyScore ?? 10,
        riskLevel: current?.riskLevel ?? "normal",
      };
      const feedbackHistory = Object.entries(messageFeedbacks).map(([idxStr, type]) => ({
        type,
        reason: messageReasons[Number(idxStr)],
        reasonCode: messageReasonCodes[Number(idxStr)],
      }));
      const result = await chatMutation.mutateAsync({
        sensorContext,
        messages: sourceMessages.map(message => ({ role: message.role, content: message.content })),
        lang,
        feedbackHistory,
      });
      const improvedReply = { role: "assistant" as const, content: result.reply, timestamp: Date.now(), feedbackApplied: true, manualSources: result.manualSources ?? [] };
      setChatMessages(previous => [...previous, improvedReply]);
      if (activeSessionId !== null) {
        await saveMessageMutation.mutateAsync({ sessionId: activeSessionId, role: "assistant", content: result.reply });
        try {
          await attachRegeneratedAnswerMutation.mutateAsync({
            sessionId: activeSessionId,
            feedbackId: messageFeedbackIds[assistantIndex],
            regeneratedContent: result.reply,
          });
          chatUtils.semiguard.getFeedbackHistory.invalidate();
        } catch (error) {
          console.error("Failed to attach regenerated answer:", error);
        }
        chatUtils.semiguard.getChatSessions.invalidate();
      }
      toast.success(lang === "ko" ? "피드백을 반영한 답변을 생성했습니다." : lang === "ja" ? "フィードバックを反映した回答を生成しました。" : "Generated an answer using your feedback.");
    } catch (error) {
      console.error("Feedback regeneration failed:", error);
      toast.error(lang === "ko"
        ? "답변을 다시 생성하지 못했습니다. 잠시 후 재시도해 주세요."
        : lang === "ja"
          ? "回答を再生成できませんでした。しばらくしてからもう一度お試しください。"
          : "Could not regenerate the answer. Please try again.");
    } finally {
      setIsFeedbackRegenerating(false);
      setIsChatLoading(false);
    }
  };

  const persistChatFeedback = async (messageIndex: number, feedbackType: "like" | "dislike", reasonCode?: "inaccurate" | "insufficient" | "irrelevant" | "other", reasonText?: string) => {
    const message = chatMessages[messageIndex];
    if (!message || message.role !== "assistant") return;
    setMessageFeedbacks(previous => ({ ...previous, [messageIndex]: feedbackType }));
    if (reasonCode) setMessageReasonCodes(previous => ({ ...previous, [messageIndex]: reasonCode }));
    if (reasonText) setMessageReasons(previous => ({ ...previous, [messageIndex]: reasonText }));
    if (activeSessionId === null) return;
    try {
      const saved = await saveFeedbackMutation.mutateAsync({
        sessionId: activeSessionId,
        messageContent: message.content,
        feedbackType,
        reasonCode,
        reasonText,
      });
      if (saved?.feedbackId) {
        setMessageFeedbackIds(previous => ({ ...previous, [messageIndex]: saved.feedbackId }));
      }
      chatUtils.semiguard.getFeedbackHistory.invalidate();
    } catch (error) {
      console.error("Failed to persist chat feedback:", error);
      toast.error(lang === "ko" ? "피드백을 저장하지 못했습니다. 다시 시도해 주세요." : lang === "ja" ? "フィードバックを保存できませんでした。" : "Could not save feedback. Please try again.");
    }
  };

  // 슬라이드 메뉴가 열린 동안 Escape로 닫고 배경 스크롤을 잠급니다.
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    document.title = "SemiGuard AI - 반도체 장비 실시간 AI 예지보전 및 이상탐지 시스템";
    
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', 'SemiGuard AI는 반도체 제조 장비의 전류, 온도, 진동, 소음 센서 데이터를 Isolation Forest AI로 실시간 분석하여 고장 징후를 조기에 탐지하고 LLM으로 원인을 진단하는 스마트 예지안전 솔루션입니다.');

    let metaKw = document.querySelector('meta[name="keywords"]');
    if (!metaKw) {
      metaKw = document.createElement('meta');
      metaKw.setAttribute('name', 'keywords');
      document.head.appendChild(metaKw);
    }
    metaKw.setAttribute('content', 'SemiGuard AI, 반도체 예지보전, 이상탐지, 센서 모니터링, 예지안전 시스템');

    const provider = new URLSearchParams(window.location.search).get("social_linked");
    if (!provider) return;
    const label = provider === "google" ? "Google" : provider === "naver" ? "Naver" : provider === "kakao" ? "Kakao" : "소셜 계정";
    toast.success(lang === "ko" ? `${label} 계정이 연결되었습니다.` : `${label} account linked successfully.`);
    void socialLinksQuery.refetch();
    window.history.replaceState({}, document.title, window.location.pathname);
  }, [lang]);

  // ─── 경고음 콜백 ─────────────────────────────────────────────────────────
  const playAlert = useCallback(() => {
    if (!mutedRef.current) playDangerAlertSound(volumeRef.current);
  }, []); // mutedRef는 ref이므로 deps 불필요 — 항상 최신 muted 값 참조

  // 음소거 토글 시 재생 중인 소리 즉시 중단
  useEffect(() => {
    if (muted) {
      _activeOscillators.forEach(osc => { try { osc.stop(); } catch (_) {} });
      _activeOscillators.length = 0;
    }
  }, [muted]);


  const injectNormal = trpc.semiguard.injectNormal.useMutation();
  const injectAnomaly = trpc.semiguard.injectAnomaly.useMutation();
  const clearLogs = trpc.semiguard.clearLogs.useMutation();
  const trackVisit = trpc.semiguard.trackVisit.useMutation();
  const injectCaution = trpc.semiguard.injectCaution.useMutation();
  const injectWarning = trpc.semiguard.injectWarning.useMutation();
  const autoFetch = trpc.semiguard.autoFetch.useMutation();
  const resetCostMutation = trpc.semiguard.resetSavedCost.useMutation();
  const analyzeAnomalyMutation = trpc.semiguard.analyzeAnomaly.useMutation();
  const getStats = trpc.semiguard.getStats.useQuery(undefined, { refetchInterval: 5000 });
  const getLogs = trpc.semiguard.getLogs.useQuery({ limit: 200 }, { refetchInterval: 5000 });
  const getDailyMaxRisk = trpc.semiguard.getDailyMaxRisk.useQuery(undefined, { refetchInterval: 10000 });
  const utils = trpc.useUtils();
  const getRecentScoresQuery = trpc.semiguard.getRecentScores.useQuery({ limit: 50 }, { refetchInterval: 5000 });
  const { data: logsData, isLoading: logsLoading } = getLogs;

  const [lastInjectedMode, setLastInjectedMode] = useState<RiskLevel | null>(null);

  // ─── 센서별 임계값 state ─────────────────────────────────────────────────────
  const [sensorThresh, setSensorThresh] = useState({
    currentCaution: 7.0, currentWarning: 9.0, currentDanger: 11.0,
    tempCaution: 55.0, tempWarning: 70.0, tempDanger: 85.0,
    vibCaution: 2.3, vibWarning: 2.6, vibDanger: 3.0,
    noiseCaution: 65.0, noiseWarning: 75.0, noiseDanger: 85.0,
  });
  const [showSensorPanel, setShowSensorPanel] = useState(false);

  // ─── 데모 자동 실행 state ────────────────────────────────────────────────────
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoSpeed, setDemoSpeed] = useState(3); // 1~10초
  const [pdfExporting, setPdfExporting] = useState(false);
  const displayedSavedCost = useCountUp(getStats.data?.savedCost ?? 0, 1000);
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── 센서별 임계값 tRPC 훅 ──────────────────────────────────────────────────
  const getSensorThresholdsQuery = trpc.semiguard.getSensorThresholds.useQuery(undefined, { staleTime: Infinity });
  const saveSensorThresholdsMutation = trpc.semiguard.saveSensorThresholds.useMutation();

  const sensorData = current?.sensorData;
  const anomalyScore = current?.anomalyScore ?? 0;
  const riskLevel = current?.riskLevel ?? "normal";
  const quickChatPrompts = getQuickChatPrompts(riskLevel, lang);
  const logs = logsData ?? [];
  // 새 기록 배너: logs 개수 증가 감지
  useEffect(() => {
    const prev = prevLogCountRef.current;
    const curr = logs.length;
    if (curr > prev && prev > 0) {
      setNewLogCount(n => n + (curr - prev));
    }
    prevLogCountRef.current = curr;
  }, [logs.length]);
  const filteredLogs = useMemo(
    () => {
      let result = logs;
      if (selectedDate) result = result.filter(l => l.timestamp.slice(0, 10) === selectedDate);
      // 날짜 범위 필터 (dateStart ~ dateEnd)
      if (dateStart) result = result.filter(l => l.timestamp.slice(0, 10) >= dateStart);
      if (dateEnd)   result = result.filter(l => l.timestamp.slice(0, 10) <= dateEnd);
      if (logFilter !== "all") result = result.filter(l => l.riskLevel === logFilter);
      return result;
    },
    [logs, logFilter, selectedDate, dateStart, dateEnd]
  );
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / LOG_PAGE_SIZE));
  const pagedLogs = useMemo(
    () => filteredLogs.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE),
    [filteredLogs, logPage]
  );

  // 초기 방문자 추적
  useEffect(() => {
    trackVisit.mutate();
  }, []);

  // DB에서 센서 임계값 불러오기 (초기 1회)
  useEffect(() => {
    if (getSensorThresholdsQuery.data) {
      setSensorThresh(getSensorThresholdsQuery.data);
    }
  }, [getSensorThresholdsQuery.data]);

  // 데모 자동 실행 useEffect
  useEffect(() => {
    if (demoRunning) {
      const modes = ["normal", "caution", "warning", "danger"] as const;
      let step = 0;
      demoIntervalRef.current = setInterval(async () => {
        const mode = modes[step % modes.length];
        step++;
        try {
          let result;
          if (mode === "normal") result = await injectNormal.mutateAsync();
          else if (mode === "caution") result = await injectCaution.mutateAsync();
          else if (mode === "warning") result = await injectWarning.mutateAsync();
          else result = await injectAnomaly.mutateAsync();
          setScoreHistory(prev => [...prev.slice(-19), result.anomalyScore]);
          setCurrent(result);
          setChartData(prev => [...prev, { ...result.sensorData, label: `D${step}` }].slice(-MAX_CHART_POINTS));
          if (result.riskLevel === "danger") {
            setRelayTripped(true);
            setDangerAlert(true);
            setDangerFlash(true);
            setTimeout(() => setDangerFlash(false), 600);
            playAlert();
            setTimeout(() => setRelayTripped(false), 2000);
            triggerLlmAnalysis(result);
          }
          await utils.semiguard.getStats.invalidate();
          await utils.semiguard.getLogs.invalidate();
        } catch (_) {}
      }, demoSpeed * 1000);
    } else {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
    }
    return () => {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
    };
  }, [demoRunning, demoSpeed]);

  // 자동 폴링 (4초마다)
  useEffect(() => {
    if (!initialized) {
      const initData = generateInitialData();
      setCurrent(initData);
      setChartData([{ ...initData.sensorData, label: "0s" }]);
      setInitialized(true);
    }

    autoPollingRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.round((now - lastUpdateRef.current) / 1000);
      // 자동 폴링: 80% 정상, 10% 주의, 10% 경고 (자연스러운 변동)
      const roll = Math.random();
      const newData = roll < 0.80
        ? generateNormalData()
        : roll < 0.90
          ? generateSlightCautionData()
          : generateSlightWarningData();
      const result = analyzeData(newData);
      // 서버 DB에도 저장 (fire-and-forget)
      autoFetch.mutate(undefined, {
        onSuccess: () => {
          utils.semiguard.getLogs.invalidate();
          utils.semiguard.getStats.invalidate();
        },
        onError: (error) => {
          // 개발 서버 재시작·일시 네트워크 지연은 다음 4초 폴링 주기에서 자동 복구한다.
          console.warn("Auto polling will retry on the next interval:", error);
        }
      });
      setScoreHistory(prev => [...prev.slice(-19), result.anomalyScore]);
      setCurrent(result);
      setChartData(prev => {
        const updated = [...prev, { ...result.sensorData, label: `${elapsed}s` }];
        return updated.slice(-MAX_CHART_POINTS);
      });
      setHeartbeatAlive(true);
      if (result.riskLevel === "danger") {
        setRelayTripped(true);
        setDangerAlert(true);
        setDangerFlash(true);
        setTimeout(() => setDangerFlash(false), 600);
        playAlert();
        setTimeout(() => setRelayTripped(false), 2000);
        triggerLlmAnalysis(result);
      }
    }, 4000);

    return () => {
      if (autoPollingRef.current) clearInterval(autoPollingRef.current);
    };
  }, [initialized]);

  // LLM 이상 원인 분석 트리거 (30초 throttle)
  const lastLlmCallRef = useRef<number>(0);
  const triggerLlmAnalysis = useCallback(async (result: AnomalyResult) => {
    if (!result.sensorData) return;
    // 30초 이내 중복 호출 방지
    const now = Date.now();
    if (now - lastLlmCallRef.current < 30_000) return;
    lastLlmCallRef.current = now;
    setLlmLoading(true);
    try {
      const analysis = await analyzeAnomalyMutation.mutateAsync({
        current: result.sensorData.current,
        temperature: result.sensorData.temperature,
        vibration: result.sensorData.vibration,
        noise: result.sensorData.noise,
        anomalyScore: result.anomalyScore,
        riskLevel: result.riskLevel,
        lang: lang,
      });
      setLlmAnalysis({
        ...analysis,
        score: result.anomalyScore,
        riskLevel: result.riskLevel,
      });
    } catch {
      // 분석 실패 시 무시
    } finally {
      setLlmLoading(false);
    }
  }, [lang, analyzeAnomalyMutation]);

  const handleInjectNormal = async () => {
    try {
      const result = await injectNormal.mutateAsync();
      // ✅ FIXED: 서버 결과(result)를 그대로 신뢰, analyzeData 호출 제거
      setScoreHistory(prev => [...prev.slice(-19), result.anomalyScore]);
      setCurrent(result);
      setChartData(prev => [...prev, { ...result.sensorData, label: `${prev.length}` }].slice(-MAX_CHART_POINTS));
      await utils.semiguard.getStats.invalidate();
      await utils.semiguard.getLogs.invalidate();
      setLastInjectedMode("normal");
      toast.success(`✅ ${t.injectNormal} 완료`);
    } catch (e) {
      toast.error(t.error);
    }
  };

  const handleInjectAnomaly = async () => {
    try {
      const result = await injectAnomaly.mutateAsync();
      // ✅ FIXED: 서버 결과(result)를 그대로 신뢰, analyzeData 호출 제거
      setScoreHistory(prev => [...prev.slice(-19), result.anomalyScore]);
      setCurrent(result);
      setChartData(prev => [...prev, { ...result.sensorData, label: `${prev.length}` }].slice(-MAX_CHART_POINTS));
      await utils.semiguard.getStats.invalidate();
      await utils.semiguard.getLogs.invalidate();
      setLastInjectedMode("danger");
      if (result.riskLevel === "danger") {
        setRelayTripped(true);
        setDangerAlert(true);
        setDangerFlash(true);
        setTimeout(() => setDangerFlash(false), 600);
        playAlert();
        setTimeout(() => setRelayTripped(false), 2000);
        triggerLlmAnalysis(result);
      }
      toast.error(`⚠ ${t.injectAnomaly} 완료`);
    } catch (e) {
      toast.error(t.error);
    }
  };

  const handleInjectCaution = async () => {
    try {
      const result = await injectCaution.mutateAsync();
      // ✅ FIXED: 서버 결과(result)를 그대로 신뢰, analyzeData 호출 제거
      setScoreHistory(prev => [...prev.slice(-19), result.anomalyScore]);
      setCurrent(result);
      setChartData(prev => [...prev, { ...result.sensorData, label: `${prev.length}` }].slice(-MAX_CHART_POINTS));
      await utils.semiguard.getStats.invalidate();
      await utils.semiguard.getLogs.invalidate();
      setLastInjectedMode("caution");
      toast.info(`⚡ ${t.injectCaution} 완료`);
    } catch (e) {
      toast.error(t.error);
    }
  };

  const handleInjectWarning = async () => {
    try {
      const result = await injectWarning.mutateAsync();
      // ✅ FIXED: 서버 결과(result)를 그대로 신뢰, analyzeData 호출 제거
      setScoreHistory(prev => [...prev.slice(-19), result.anomalyScore]);
      setCurrent(result);
      setChartData(prev => [...prev, { ...result.sensorData, label: `${prev.length}` }].slice(-MAX_CHART_POINTS));
      await utils.semiguard.getStats.invalidate();
      await utils.semiguard.getLogs.invalidate();
      setLastInjectedMode("warning");
      if (result.riskLevel === "warning" || result.riskLevel === "danger") {
        triggerLlmAnalysis(result);
      }
      toast.warning(`🔶 ${t.injectWarning} 완료`);
    } catch (e) {
      toast.error(t.error);
    }
  };

  const handleResetCost = async () => {
    try {
      await resetCostMutation.mutateAsync();
      await utils.semiguard.getStats.invalidate();
      toast.success("절감 비용이 초기화되었습니다.");
    } catch (e) {
      toast.error(t.error);
    }
  };

  const handleClearLogs = async () => {
    try {
      await clearLogs.mutateAsync();
      await utils.semiguard.getLogs.invalidate();
      await utils.semiguard.getStats.invalidate();
      toast.success("로그가 초기화되었습니다.");
    } catch (e) {
      toast.error(t.error);
    }
  };

  // 임시 데이터 생성 함수 (서버 함수와 동일)
  function generateInitialData(): AnomalyResult {
    return {
      sensorData: { current: 5.0, temperature: 45.0, vibration: 2.0, noise: 55.0, timestamp: Date.now() },
      anomalyScore: 10,
      riskLevel: "normal",
      isAnomaly: false,
    };
  }

  function generateNormalData(): SensorData {
    return {
      current: 5.0 + (Math.random() - 0.5) * 0.5,
      temperature: 45.0 + (Math.random() - 0.5) * 2,
      vibration: 2.0 + (Math.random() - 0.5) * 0.3,
      noise: 55.0 + (Math.random() - 0.5) * 3,
      timestamp: Date.now(),
    };
  }

  // 자동 폴링용 약한 주의 데이터 (점수 25~40)
  function generateSlightCautionData(): SensorData {
    const rand = (mean: number, std: number) =>
      mean + std * (1.2 + Math.random() * 0.8) * (Math.random() > 0.5 ? 1 : -1);
    return {
      current: parseFloat(rand(5.0, 0.5).toFixed(2)),
      temperature: parseFloat(rand(45.0, 3.0).toFixed(1)),
      vibration: parseFloat(rand(2.0, 0.3).toFixed(2)),
      noise: parseFloat(rand(55.0, 4.0).toFixed(1)),
      timestamp: Date.now(),
    };
  }

  // 자동 폴링용 약한 경고 데이터 (점수 45~60)
  function generateSlightWarningData(): SensorData {
    const rand = (mean: number, std: number) =>
      mean + std * (2.0 + Math.random() * 0.8) * (Math.random() > 0.5 ? 1 : -1);
    return {
      current: parseFloat(rand(5.0, 0.5).toFixed(2)),
      temperature: parseFloat(rand(45.0, 3.0).toFixed(1)),
      vibration: parseFloat(rand(2.0, 0.3).toFixed(2)),
      noise: parseFloat(rand(55.0, 4.0).toFixed(1)),
      timestamp: Date.now(),
    };
  }

  function analyzeData(data: SensorData): AnomalyResult {
    const currentMean = 5.0, currentStd = 0.3;
    const tempMean = 45.0, tempStd = 3.0;
    const vibMean = 2.0, vibStd = 0.4;
    const noiseMean = 55.0, noiseStd = 4.0;

    const zCurrent = Math.abs((data.current - currentMean) / currentStd);
    const zTemp = Math.abs((data.temperature - tempMean) / tempStd);
    const zVib = Math.abs((data.vibration - vibMean) / vibStd);
    const zNoise = Math.abs((data.noise - noiseMean) / noiseStd);

    // 서버와 동일한 점수 계산: 각 센서 z-score에 8을 곱하고 25로 cap (최대 100)
    const score = Math.min(100, Math.round(
      Math.min(zCurrent * 8, 25) +
      Math.min(zTemp * 8, 25) +
      Math.min(zVib * 8, 25) +
      Math.min(zNoise * 8, 25)
    ));
    const riskLevel: RiskLevel = score <= 29 ? "normal" : score <= 49 ? "caution" : score <= 69 ? "warning" : "danger";
    const isAnomaly = score > thresholds.warning;

    return { sensorData: data, anomalyScore: score, riskLevel, isAnomaly };
  }

  const socialProviderItems: Array<{ provider: "google" | "naver" | "kakao"; label: string; start: () => void }> = [
    { provider: "google", label: "Google", start: startGoogleLink },
    { provider: "naver", label: "Naver", start: startNaverLink },
    { provider: "kakao", label: "Kakao", start: startKakaoLink },
  ];
  const linkedProviders = new Set((socialLinksQuery.data ?? []).map((link) => link.provider));

  return (
    <div id="dashboard-root" className="min-h-screen flex flex-col" style={{ background: th.bg, color: th.text, transition: "background 0.3s ease, color 0.3s ease" }}>
      {/* ── 위험 화면 플래시 효과 ── */}
      {dangerFlash && (
        <div
          className="fixed inset-0 z-[1000] pointer-events-none"
          style={{
            background: "rgba(239, 68, 68, 0.35)",
            animation: "dangerFlashAnim 0.6s ease-out forwards",
          }}
        />
      )}
      {/* ── 위험 상태 팝업 ── */}
      {/* ── 이상 이력 상세 모달 ── */}
      {selectedLog && (() => {
        const log = selectedLog;
        const lvl = log.riskLevel as RiskLevel;
        const color = RISK_COLORS[lvl];
        const sensorItems = [
          { label: lang === "ko" ? "전류" : "Current",     value: log.current.toFixed(2),    unit: "A",    icon: "⚡", color: "#38bdf8" },
          { label: lang === "ko" ? "온도" : "Temperature", value: log.temperature.toFixed(1), unit: "°C",   icon: "🌡", color: "#fb923c" },
          { label: lang === "ko" ? "진동" : "Vibration",   value: log.vibration.toFixed(2),   unit: "mm/s", icon: "📳", color: "#a78bfa" },
          { label: lang === "ko" ? "소음" : "Noise",       value: log.noise.toFixed(1),       unit: "dB",   icon: "🔊", color: "#34d399" },
        ];
        return (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.65)", animation: "fadeIn 0.2s ease-out" }}
            onClick={() => setSelectedLog(null)}>
            <div className="relative w-full max-w-sm mx-4 rounded-2xl shadow-2xl overflow-hidden"
              style={{ background: isDark ? "oklch(0.13 0.015 240)" : "oklch(0.99 0.003 240)", border: `1px solid ${color}40` }}
              onClick={e => e.stopPropagation()}>
              {/* 헤더 */}
              <div className="px-5 py-4 border-b flex items-center justify-between"
                style={{ borderColor: `${color}30`, background: `${color}10` }}>
                <div>
                  <p className="text-xs font-semibold" style={{ color: isDark ? "oklch(0.90 0.01 240)" : "oklch(0.15 0.01 240)" }}>
                    {lang === "ko" ? "이상 이력 상세" : lang === "ja" ? "異常履歴詳細" : "Anomaly Detail"}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: isDark ? "oklch(0.50 0.01 240)" : "oklch(0.45 0.01 240)" }}>
                    {new Date(log.timestamp).toLocaleString(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", { hour12: false })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
                    style={{ color, background: RISK_BG[lvl], borderColor: RISK_BORDER[lvl] }}>
                    {lang === "ko"
                      ? lvl === "danger" ? "위험" : lvl === "warning" ? "경고" : lvl === "caution" ? "주의" : "정상"
                      : lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                  </span>
                  <button onClick={() => setSelectedLog(null)}
                    className="text-lg leading-none hover:opacity-60 transition-opacity"
                    style={{ color: isDark ? "oklch(0.50 0.01 240)" : "oklch(0.45 0.01 240)" }}>✕</button>
                </div>
              </div>
              {/* 이상 점수 */}
              <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold" style={{ color: isDark ? "oklch(0.60 0.01 240)" : "oklch(0.40 0.01 240)" }}>
                  {lang === "ko" ? "이상 점수" : lang === "ja" ? "異常スコア" : "Anomaly Score"}
                </span>
                <span className="text-2xl font-bold font-mono" style={{ color }}>{log.anomalyScore}</span>
              </div>
              {/* 점수 바 */}
              <div className="px-5 pb-4">
                <div className="w-full h-2 rounded-full" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
                  <div className="h-2 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(log.anomalyScore, 100)}%`, background: color }} />
                </div>
              </div>
              {/* 센서 값 그리드 */}
              <div className="px-5 pb-5 grid grid-cols-2 gap-2">
                {sensorItems.map(s => (
                  <div key={s.label} className="rounded-xl p-3 border flex flex-col gap-1"
                    style={{ background: `${s.color}0d`, borderColor: `${s.color}30` }}>
                    <div className="flex items-center gap-1">
                      <span className="text-sm">{s.icon}</span>
                      <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: s.color }}>{s.label}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</span>
                      <span className="text-[9px]" style={{ color: isDark ? "oklch(0.50 0.01 240)" : "oklch(0.45 0.01 240)" }}>{s.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* LLM 분석 결과 (저장된 경우) - 현재 언어에 맞는 컬럼 표시 */}
              {(log.llmAnalysisKo || log.llmAnalysisEn) && (() => {
                const raw = lang === "ko" ? log.llmAnalysisKo : lang === "ja" ? log.llmAnalysisJa : log.llmAnalysisEn;
                const fallback = log.llmAnalysisKo || log.llmAnalysisEn || log.llmAnalysisJa;
                try {
                  const a = JSON.parse(raw ?? fallback ?? "");
                  return (
                    <div className="px-5 pb-5 flex flex-col gap-2">
                      <div className="rounded-xl p-3 border" style={{ background: "oklch(0.75 0.18 200 / 0.06)", borderColor: "oklch(0.75 0.18 200 / 0.25)" }}>
                        <p className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "oklch(0.75 0.18 200)" }}>
                          🤖 {lang === "ko" ? "AI 이상 원인 분석" : lang === "ja" ? "AI異常原因分析" : "AI Anomaly Analysis"}
                        </p>
                        <p className="text-[11px] font-semibold mb-1" style={{ color: isDark ? "oklch(0.90 0.01 240)" : "oklch(0.15 0.01 240)" }}>{a.primaryCause}</p>
                        <p className="text-[10px] leading-relaxed mb-1.5" style={{ color: isDark ? "oklch(0.60 0.01 240)" : "oklch(0.40 0.01 240)" }}>{a.details}</p>
                        <p className="text-[10px] font-medium" style={{ color: "oklch(0.75 0.18 200)" }}>→ {a.recommendation}</p>
                      </div>
                    </div>
                  );
                } catch { return null; }
              })()}
            </div>
          </div>
        );
      })()}
      {dangerAlert && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)", animation: "fadeIn 0.3s ease-out" }}>
          <div className="relative w-full max-w-md mx-4 rounded-2xl p-8 shadow-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.10))",
              border: "2px solid rgb(239,68,68)",
              animation: "slideUp 0.4s cubic-bezier(0.23, 1, 0.32, 1)"
            }}>
            <div className="flex flex-col items-center gap-4">
              <div className="text-6xl animate-pulse">🚨</div>
              <h2 className="text-2xl font-bold text-center" style={{ color: "rgb(239,68,68)" }}>
                {lang === "ko" ? "위험 단계 도달!" : lang === "ja" ? "危険レベル到達！" : "DANGER LEVEL REACHED!"}
              </h2>
              <p className="text-center text-sm" style={{ color: "rgb(220,38,38)" }}>
                {lang === "ko"
                  ? "장비가 위험 상태에 도달했습니다. 즉시 점검이 필요합니다."
                  : lang === "ja"
                  ? "装置が危険な状態に達しました。即時点検が必要です。"
                  : "Equipment has reached a dangerous state. Immediate inspection required."}
              </p>
              <div className="w-full h-1 rounded-full" style={{ background: "rgb(239,68,68)" }}>
                <div className="h-full rounded-full" style={{
                  background: "rgb(239,68,68)",
                  animation: "pulse 1s ease-in-out infinite"
                }} />
              </div>
              {/* LLM 분석 결과 */}
              {llmLoading && (
                <div className="w-full flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <div className="w-4 h-4 rounded-full border-2 border-red-400 border-t-transparent animate-spin flex-shrink-0" />
                  <span className="text-xs" style={{ color: "rgb(220,38,38)" }}>
                    {lang === "ko" ? "AI 이상 원인 분석 중..." : lang === "ja" ? "AI異常原因分析中..." : "AI analyzing anomaly cause..."}
                  </span>
                </div>
              )}
              {llmAnalysis && !llmLoading && (
                <div className="w-full rounded-xl p-4 text-left"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">🤖</span>
                    <span className="text-xs font-bold" style={{ color: "oklch(0.65 0.18 200)" }}>
                      {lang === "ko" ? "AI 이상 원인 분석" : lang === "ja" ? "AI異常原因分析" : "AI Anomaly Analysis"}
                    </span>
                  </div>
                  <p className="text-sm font-bold mb-1" style={{ color: "rgb(239,68,68)" }}>
                    {llmAnalysis.primaryCause}
                  </p>
                  <p className="text-xs mb-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                    {llmAnalysis.details}
                  </p>
                  <div className="flex items-start gap-1.5">
                    <span className="text-xs mt-0.5">💡</span>
                    <p className="text-xs" style={{ color: "rgba(255,200,100,0.9)" }}>
                      {llmAnalysis.recommendation}
                    </p>
                  </div>
                </div>
              )}
              <button
                onClick={() => { setDangerAlert(false); }}
                className="mt-4 px-6 py-2 rounded-lg font-bold transition-all duration-200 active:scale-95"
                style={{
                  background: "rgb(239,68,68)",
                  color: "white",
                  boxShadow: "0 0 20px rgba(239,68,68,0.5)"
                }}>
                {lang === "ko" ? "확인" : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* LLM 분석 결과 플로팅 패널 (위험/경고 탐지 후 dangerAlert 닫혀도 유지) */}
      {llmAnalysis && !dangerAlert && (
        <div className="fixed bottom-6 right-6 z-[500] w-80 rounded-2xl shadow-2xl"
          style={{
            background: isDark ? "oklch(0.13 0.015 240)" : "oklch(0.99 0.003 240)",
            border: `1px solid ${llmAnalysis.riskLevel === "danger" ? "rgba(239,68,68,0.5)" : "rgba(249,115,22,0.5)"}`,
            animation: "slideUp 0.4s cubic-bezier(0.23, 1, 0.32, 1)"
          }}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🤖</span>
                <span className="text-xs font-bold" style={{ color: "oklch(0.65 0.18 200)" }}>
                  {lang === "ko" ? "AI 이상 원인 분석" : lang === "ja" ? "AI異常原因分析" : "AI Anomaly Analysis"}
                </span>
              </div>
              <button
                onClick={() => setLlmAnalysis(null)}
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs transition-opacity hover:opacity-70"
                style={{ background: "rgba(128,128,128,0.2)", color: th.textMuted }}>
                ✕
              </button>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{
                  background: llmAnalysis.riskLevel === "danger" ? "rgba(239,68,68,0.15)" : "rgba(249,115,22,0.15)",
                  color: llmAnalysis.riskLevel === "danger" ? "rgb(239,68,68)" : "rgb(249,115,22)",
                  border: `1px solid ${llmAnalysis.riskLevel === "danger" ? "rgba(239,68,68,0.3)" : "rgba(249,115,22,0.3)"}`
                }}>
                {lang === "ko"
                  ? (llmAnalysis.riskLevel === "danger" ? "위험" : llmAnalysis.riskLevel === "warning" ? "경고" : "주의")
                  : llmAnalysis.riskLevel}
                &nbsp;{llmAnalysis.score.toFixed(0)}점
              </span>
            </div>
            <p className="text-sm font-bold mb-2" style={{ color: th.text }}>
              {llmAnalysis.primaryCause}
            </p>
            <p className="text-xs mb-3 leading-relaxed" style={{ color: th.textMuted }}>
              {llmAnalysis.details}
            </p>
            <div className="flex items-start gap-1.5 rounded-lg p-2"
              style={{ background: isDark ? "rgba(255,200,100,0.06)" : "rgba(180,120,0,0.06)", border: "1px solid rgba(255,200,100,0.15)" }}>
              <span className="text-xs mt-0.5 flex-shrink-0">💡</span>
              <p className="text-xs leading-relaxed" style={{ color: isDark ? "rgba(255,200,100,0.9)" : "oklch(0.40 0.10 80)" }}>
                {llmAnalysis.recommendation}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── AI 분석 히스토리 패널 ── */}
      {showAiHistory && (
        <div className="fixed bottom-6 left-6 z-[490] w-80 rounded-2xl shadow-2xl overflow-hidden"
          style={{
            background: isDark ? "oklch(0.13 0.015 240)" : "oklch(0.99 0.003 240)",
            border: "1px solid oklch(0.75 0.18 200 / 0.35)",
            animation: "slideUp 0.4s cubic-bezier(0.23, 1, 0.32, 1)"
          }}>
          <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "oklch(0.75 0.18 200 / 0.20)", background: "oklch(0.75 0.18 200 / 0.06)" }}>
            <div className="flex items-center gap-2">
              <span className="text-sm">📋</span>
              <span className="text-xs font-bold" style={{ color: "oklch(0.75 0.18 200)" }}>
                {lang === "ko" ? "AI 분석 히스토리 (최근 5건)" : lang === "ja" ? "AI分析履歴（直近5件）" : "AI Analysis History (Last 5)"}
              </span>
            </div>
            <button onClick={() => setShowAiHistory(false)}
              className="w-5 h-5 rounded-full flex items-center justify-center text-xs transition-opacity hover:opacity-70"
              style={{ background: "rgba(128,128,128,0.2)", color: th.textMuted }}>✕</button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {llmHistoryQuery.isLoading ? (
              <div className="px-4 py-6 flex justify-center">
                <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "oklch(0.75 0.18 200)", borderTopColor: "transparent" }} />
              </div>
            ) : llmHistoryQuery.isError ? (
              <div className="px-4 py-6 text-center text-xs" style={{ color: "rgb(239,68,68)" }}>
                {lang === "ko" ? "분석 이력을 불러오지 못했습니다." : lang === "ja" ? "分析履歴を取得できませんでした。" : "Failed to load analysis history."}
              </div>
            ) : !llmHistoryQuery.data || llmHistoryQuery.data.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                {lang === "ko" ? "저장된 AI 분석 결과가 없습니다." : lang === "ja" ? "保存されたAI分析結果がありません。" : "No AI analysis results saved yet."}
              </div>
            ) : llmHistoryQuery.data.map((item) => {
              let parsed: { primaryCause?: string; recommendation?: string } = {};
              const rawItem = lang === "ko" ? item.llmAnalysisKo : lang === "ja" ? item.llmAnalysisJa : item.llmAnalysisEn;
              const fallbackItem = item.llmAnalysisKo || item.llmAnalysisEn || item.llmAnalysisJa;
              try { parsed = JSON.parse(rawItem ?? fallbackItem ?? ""); } catch {}
              const lvlColor = item.riskLevel === "danger" ? "rgb(239,68,68)" : item.riskLevel === "warning" ? "rgb(249,115,22)" : "rgb(234,179,8)";
              return (
                <div key={item.id} className="px-4 py-3 border-b last:border-0" style={{ borderColor: isDark ? "oklch(0.18 0.015 240)" : "oklch(0.90 0.005 240)" }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-mono text-muted-foreground">
                      {new Date(item.timestamp).toLocaleString(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", { hour12: false })}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: lvlColor, background: `${lvlColor}18`, border: `1px solid ${lvlColor}30` }}>
                      {lang === "ko" ? (item.riskLevel === "danger" ? "위험" : item.riskLevel === "warning" ? "경고" : "주의") : lang === "ja" ? (item.riskLevel === "danger" ? "危険" : item.riskLevel === "warning" ? "警告" : "注意") : item.riskLevel} {item.anomalyScore}
                    </span>
                  </div>
                  {parsed.primaryCause && <p className="text-[11px] font-semibold mb-1" style={{ color: isDark ? "oklch(0.88 0.01 240)" : "oklch(0.15 0.01 240)" }}>{parsed.primaryCause}</p>}
                  {parsed.recommendation && <p className="text-[10px]" style={{ color: "oklch(0.75 0.18 200)" }}>→ {parsed.recommendation}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* AI 히스토리 토글 버튼 */}
      {!showAiHistory && (
        <button
          onClick={() => setShowAiHistory(true)}
          className="fixed bottom-6 left-6 z-[490] flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg text-xs font-bold border transition-all duration-200 hover:opacity-90 active:scale-95"
          style={{ background: isDark ? "oklch(0.13 0.015 240)" : "oklch(0.99 0.003 240)", borderColor: "oklch(0.75 0.18 200 / 0.40)", color: "oklch(0.75 0.18 200)" }}>
          📋 {lang === "ko" ? "AI 분석 이력" : lang === "ja" ? "AI分析履歴" : "AI History"}
          {llmHistoryQuery.data && llmHistoryQuery.data.length > 0 && (
            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: "oklch(0.75 0.18 200)", color: "white" }}>
              {llmHistoryQuery.data.length}
            </span>
          )}
        </button>
      )}
      {menuOpen && (
        <>
          <button
            type="button"
            aria-label={lang === "ko" ? "메뉴 닫기" : lang === "ja" ? "メニューを閉じる" : "Close menu"}
            onPointerDown={() => setMenuOpen(false)}
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-[600] bg-black/45 cursor-default"
          />
          <aside
            id="dashboard-settings-menu"
            role="dialog"
            aria-modal="true"
            aria-label={lang === "ko" ? "대시보드 메뉴" : lang === "ja" ? "ダッシュボードメニュー" : "Dashboard menu"}
            className="fixed inset-y-0 left-0 z-[610] w-[min(86vw,360px)] overflow-y-auto border-r px-4 pb-6 pt-20 shadow-2xl"
            style={{ background: th.bgCard, borderColor: th.border, color: th.text, animation: "slideInMenu 240ms cubic-bezier(0.23,1,0.32,1)" }}
          >
            <div className="flex items-center justify-between border-b pb-4 mb-4" style={{ borderColor: th.border }}>
              <div>
                <p className="text-sm font-bold">{lang === "ko" ? "대시보드 메뉴" : lang === "ja" ? "ダッシュボードメニュー" : "Dashboard menu"}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{t.appSubtitle}</p>
              </div>
              <button
                type="button"
                onPointerDown={() => setMenuOpen(false)}
                onClick={() => setMenuOpen(false)}
                aria-label={lang === "ko" ? "메뉴 닫기" : lang === "ja" ? "メニューを閉じる" : "Close menu"}
                className="w-9 h-9 rounded-lg border flex items-center justify-center text-lg transition-all hover:opacity-80 active:scale-95"
                style={{ borderColor: th.border2, background: th.bgCard2, color: th.textMuted }}
              >
                ×
              </button>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              {lang === "ko" ? "소셜 계정 연동" : lang === "ja" ? "ソーシャルアカウント連携" : "Connected accounts"}
            </p>
            <div className="rounded-xl border p-3 mb-5" style={{ borderColor: th.border2, background: th.bgCard2 }}>
              <p className="text-[10px] leading-relaxed text-muted-foreground mb-3">
                {lang === "ko" ? "회원가입한 계정에 소셜 로그인을 연결하면 다음부터 간편하게 로그인할 수 있습니다." : lang === "ja" ? "登録済みのアカウントにソーシャルログインを連携できます。" : "Connect a social account to sign in more easily next time."}
              </p>
              <div className="space-y-2">
                {socialProviderItems.map(({ provider, label, start }) => {
                  const linked = linkedProviders.has(provider);
                  return (
                    <div key={provider} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2" style={{ borderColor: th.border, background: th.bg }}>
                      <span className="text-xs font-semibold">{label}</span>
                      <button
                        type="button"
                        disabled={unlinkSocialMutation.isPending}
                        onClick={() => linked ? unlinkSocialMutation.mutate({ provider }) : start()}
                        className="min-h-8 rounded-md border px-2.5 text-[10px] font-bold transition-all hover:opacity-80 active:scale-95 disabled:opacity-50"
                        style={{ borderColor: linked ? "rgba(34,197,94,0.45)" : th.border2, color: linked ? "rgb(34,197,94)" : th.accent, background: linked ? "rgba(34,197,94,0.10)" : th.bgCard2 }}
                      >
                        {linked ? (lang === "ko" ? "연결됨 · 해제" : lang === "ja" ? "連携済み · 解除" : "Linked · Unlink") : (lang === "ko" ? "연결하기" : lang === "ja" ? "連携する" : "Connect")}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              {lang === "ko" ? "화면 및 알림" : lang === "ja" ? "画面と通知" : "Display & alerts"}
            </p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              <button type="button" onClick={() => setLang(l => l === "ko" ? "en" : l === "en" ? "ja" : "ko")} className="min-h-11 rounded-lg border px-3 py-2 text-xs font-bold transition-all hover:opacity-80 active:scale-95" style={{ borderColor: "oklch(0.65 0.18 200 / 0.4)", color: "oklch(0.65 0.18 200)", background: "oklch(0.65 0.18 200 / 0.08)" }}>
                {lang === "ko" ? "EN" : lang === "en" ? "日本語" : "한국어"}
              </button>
              <button type="button" onClick={() => setIsDark(d => { const next = !d; try { localStorage.setItem("semiguard_theme", next ? "dark" : "light"); } catch {} return next; })} className="min-h-11 rounded-lg border px-3 py-2 text-xs font-bold transition-all hover:opacity-80 active:scale-95" style={{ borderColor: isDark ? "oklch(0.35 0.01 240)" : "oklch(0.75 0.08 80 / 0.5)", color: isDark ? "oklch(0.65 0.15 60)" : "oklch(0.40 0.08 80)", background: isDark ? "oklch(0.15 0.01 240)" : "oklch(0.92 0.04 80 / 0.3)" }}>
                {isDark ? "☀️" : "🌙"} {isDark ? (lang === "ko" ? "라이트" : "Light") : (lang === "ko" ? "다크" : "Dark")}
              </button>
              <button type="button" onClick={() => { setMuted(m => { const next = !m; mutedRef.current = next; try { localStorage.setItem("semiguard_muted", String(next)); } catch {} return next; }); }} className="min-h-11 rounded-lg border px-3 py-2 text-xs font-bold transition-all hover:opacity-80 active:scale-95" style={{ borderColor: muted ? "oklch(0.35 0.01 240)" : "oklch(0.65 0.18 200 / 0.4)", color: muted ? "oklch(0.45 0.01 240)" : "oklch(0.65 0.18 200)", background: muted ? (isDark ? "oklch(0.15 0.01 240)" : "oklch(0.88 0.01 240)") : "oklch(0.65 0.18 200 / 0.08)" }}>
                {muted ? "🔕" : "🔔"} {muted ? (lang === "ko" ? "음소거 해제" : "Unmute") : (lang === "ko" ? "음소거" : "Mute")}
              </button>
            </div>
            {!muted && (
              <div className="rounded-xl border p-3 mb-3" style={{ borderColor: th.border2, background: th.bgCard2 }}>
                <div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold">{lang === "ko" ? "볼륨" : "Volume"}</span><span className="text-xs font-mono" style={{ color: th.accent }}>{Math.round(volume * 100)}%</span></div>
                <input type="range" min={0} max={1} step={0.05} value={volume} aria-label={lang === "ko" ? "경고음 볼륨" : "Alert volume"} onChange={e => { const v = parseFloat(e.target.value); setVolume(v); volumeRef.current = v; try { localStorage.setItem("semiguard_volume", String(v)); } catch {} }} className="w-full accent-cyan-400 cursor-pointer" />
              </div>
            )}
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 mt-5">{lang === "ko" ? "시연 및 보고서" : lang === "ja" ? "デモとレポート" : "Demo & report"}</p>
            <button type="button" onClick={() => setDemoRunning(r => !r)} className="w-full min-h-11 flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-bold transition-all hover:opacity-80 active:scale-95" style={{ borderColor: demoRunning ? "oklch(0.65 0.20 30 / 0.6)" : th.border2, color: demoRunning ? "oklch(0.75 0.20 30)" : th.textMuted, background: demoRunning ? "oklch(0.65 0.20 30 / 0.12)" : th.bgCard2 }}>
              <span>{demoRunning ? "■" : "▶"} {demoRunning ? (lang === "ko" ? "데모 중지" : "Stop demo") : (lang === "ko" ? "데모 자동 실행" : "Auto demo")}</span><span className="text-[10px]">{demoRunning ? `${demoSpeed}s` : ""}</span>
            </button>
            {demoRunning && <div className="rounded-xl border p-3 mt-2" style={{ borderColor: th.border2, background: th.bgCard2 }}><div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold">{lang === "ko" ? "데모 간격" : "Demo interval"}</span><span className="text-xs font-mono" style={{ color: "oklch(0.75 0.20 30)" }}>{demoSpeed}s</span></div><input type="range" min={1} max={10} step={1} value={demoSpeed} onChange={e => setDemoSpeed(Number(e.target.value))} aria-label={lang === "ko" ? "데모 간격" : "Demo interval"} className="w-full accent-orange-400 cursor-pointer" /></div>}
            <button type="button" onClick={() => document.getElementById("btn-export-pdf")?.click()} className="w-full min-h-11 mt-2 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-all hover:opacity-80 active:scale-95" style={{ borderColor: th.border2, color: th.accent, background: th.bgCard2 }}>📄 {lang === "ko" ? "PDF 보고서 내보내기" : "Export PDF report"}</button>
            <div className="border-t mt-5 pt-5" style={{ borderColor: th.border }}><button type="button" onClick={() => document.getElementById("btn-logout")?.click()} className="w-full min-h-11 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-all hover:opacity-80 active:scale-95" style={{ borderColor: "oklch(0.65 0.20 30 / 0.6)", color: "oklch(0.75 0.20 30)", background: "oklch(0.65 0.20 30 / 0.12)" }}>🚪 {lang === "ko" ? "로그아웃" : "Logout"}</button></div>
          </aside>
        </>
      )}
      {/* ── 헤더 ── */}
      <header className="sticky top-0 z-50 border-b flex items-center justify-between px-3 sm:px-5 py-3"
        style={{ background: th.header, borderColor: th.border, transition: "background 0.3s ease" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl font-bold"
            style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 200), oklch(0.55 0.20 220))" }}>
            🛡
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide">{t.appTitle}</h1>
            <h2 className="text-[10px] text-muted-foreground leading-tight m-0 font-normal">{t.appSubtitle}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {!isMobile && <HeartbeatIndicator alive={heartbeatAlive} t={t} />}
          {!isMobile && <div className="w-px h-5 bg-border" />}
          <AlertPanel riskLevel={riskLevel} relayTripped={relayTripped} t={t} />
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-expanded={menuOpen}
            aria-controls="dashboard-settings-menu"
            aria-label={lang === "ko" ? "대시보드 메뉴 열기" : lang === "ja" ? "ダッシュボードメニューを開く" : "Open dashboard menu"}
            className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all hover:opacity-80 active:scale-95"
            style={{ borderColor: th.border2, color: th.text, background: th.bgCard2 }}
          >
            <span className="text-base leading-none">☰</span>
            <span className="hidden sm:inline">{lang === "ko" ? "메뉴" : lang === "ja" ? "メニュー" : "Menu"}</span>
          </button>
          {!isMobile && <div className="w-px h-5 bg-border" />}
          <button onClick={() => setLang(l => l === "ko" ? "en" : l === "en" ? "ja" : "ko")}
            className="hidden px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 hover:opacity-80 active:scale-95"
            style={{ borderColor: "oklch(0.65 0.18 200 / 0.4)", color: "oklch(0.65 0.18 200)", background: "oklch(0.65 0.18 200 / 0.08)" }}
            title={lang === "ko" ? "영어로 전환" : lang === "en" ? "日本語に切替" : "한국어로 전환"}>
            {lang === "ko" ? "EN" : lang === "en" ? "日本語" : "한국어"}
          </button>
          {/* 다크/라이트 모드 전환 */}
          <button
            onClick={() => setIsDark(d => {
              const next = !d;
              try { localStorage.setItem("semiguard_theme", next ? "dark" : "light"); } catch {}
              return next;
            })}
            title={isDark ? (lang === "ko" ? "라이트 모드" : "Light Mode") : (lang === "ko" ? "다크 모드" : "Dark Mode")}
            className="hidden w-8 h-8 flex items-center justify-center rounded-lg border transition-all duration-200 hover:opacity-80 active:scale-95 text-base"
            style={{
              borderColor: isDark ? "oklch(0.35 0.01 240)" : "oklch(0.75 0.08 80 / 0.5)",
              color: isDark ? "oklch(0.65 0.15 60)" : "oklch(0.40 0.08 80)",
              background: isDark ? "oklch(0.15 0.01 240)" : "oklch(0.92 0.04 80 / 0.3)",
            }}>
            {isDark ? "☀️" : "🌙"}
          </button>
          {/* 음소거 토글 */}
          <button
            onClick={() => {
              setMuted(m => {
                const next = !m;
                mutedRef.current = next;
                try { localStorage.setItem("semiguard_muted", String(next)); } catch {}
                return next;
              });
            }}
            title={muted ? (lang === "ko" ? "소리 켜기" : "Unmute") : (lang === "ko" ? "소리 끄기" : "Mute")}
            className="hidden w-8 h-8 flex items-center justify-center rounded-lg border transition-all duration-200 hover:opacity-80 active:scale-95 text-base"
            style={{
              borderColor: muted ? "oklch(0.35 0.01 240)" : "oklch(0.65 0.18 200 / 0.4)",
              color: muted ? "oklch(0.45 0.01 240)" : "oklch(0.65 0.18 200)",
              background: muted ? (isDark ? "oklch(0.15 0.01 240)" : "oklch(0.88 0.01 240)") : "oklch(0.65 0.18 200 / 0.08)",
            }}>
            {muted ? "🔕" : "🔔"}
          </button>
          {/* 볼륨 슬라이더 - 모바일 숨김 */}
          {!muted && !isMobile && (
            <div className="hidden flex items-center gap-1.5" title={lang === "ko" ? "볼륨 조절" : "Volume"}>
              <span style={{ fontSize: 11, color: "oklch(0.50 0.01 240)" }}>🔉</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  volumeRef.current = v;
                  try { localStorage.setItem("semiguard_volume", String(v)); } catch {}
                }}
                style={{
                  width: 72,
                  accentColor: "oklch(0.65 0.18 200)",
                  cursor: "pointer",
                }}
              />
              <span style={{ fontSize: 10, color: "oklch(0.50 0.01 240)", minWidth: 28, textAlign: "right" }}>
                {Math.round(volume * 100)}%
              </span>
            </div>
          )}
          {/* 데모 자동 실행 토글 */}
          <button
            onClick={() => setDemoRunning(r => !r)}
            title={demoRunning ? (lang === "ko" ? "데모 중지" : "Stop Demo") : (lang === "ko" ? "데모 자동 실행" : "Auto Demo")}
            className="hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-200 hover:opacity-80 active:scale-95"
            style={{
              borderColor: demoRunning ? "oklch(0.65 0.20 30 / 0.6)" : "oklch(0.35 0.01 240)",
              color: demoRunning ? "oklch(0.75 0.20 30)" : "oklch(0.50 0.01 240)",
              background: demoRunning ? "oklch(0.65 0.20 30 / 0.12)" : th.bgCard,
            }}>
            {demoRunning ? (
              <><span className="inline-block w-2 h-2 rounded-sm" style={{ background: "oklch(0.75 0.20 30)", animation: "pulse 1s ease-in-out infinite" }} /> {lang === "ko" ? "데모 중" : "Demo ON"}</>
            ) : (
              <><span>▶</span> {lang === "ko" ? "데모" : "Demo"}</>
            )}
          </button>
          {/* 데모 속도 슬라이더 - 모바일 숨김 */}
          {demoRunning && !isMobile && (
            <div className="hidden flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs"
              style={{ borderColor: th.border2, background: th.bgCard }}>
              <span style={{ color: "oklch(0.50 0.01 240)" }}>{lang === "ko" ? "속도" : "Speed"}</span>
              <input
                type="range" min={1} max={10} step={1}
                value={demoSpeed}
                onChange={e => setDemoSpeed(Number(e.target.value))}
                className="w-20 h-1 accent-orange-400 cursor-pointer"
              />
              <span style={{ color: "oklch(0.65 0.18 200)", fontWeight: 700 }}>{demoSpeed}s</span>
            </div>
          )}
          {/* PDF 내보내기 버튼 */}
          <button
            id="btn-export-pdf"
            disabled={pdfExporting}
            onClick={async () => {
              // PDF 전용: 헤더/버튼 숨기고 센서+차트 영역만 캡처
              const captureEl = document.getElementById('pdf-capture-area');
              if (!captureEl) { toast.error(lang === "ko" ? "캡처 영역을 찾을 수 없습니다." : "Capture area not found."); return; }
              const el = captureEl;
              setPdfExporting(true);
              try {
                // html-to-image: oklch 포함 모든 CSS 색상 지원, html2canvas 대체
                const { toJpeg } = await import('html-to-image');
                const { jsPDF } = await import('jspdf');
                const dataUrl = await toJpeg(el, {
                  quality: 0.92,
                  backgroundColor: isDark ? '#0d1117' : '#f5f7fa',
                  width: el.scrollWidth,
                  height: el.scrollHeight,
                  style: { transform: 'none' },
                  skipFonts: false,
                  pixelRatio: 1,
                });
                // dataUrl에서 실제 이미지 크기 추출
                const img = new Image();
                await new Promise<void>((resolve, reject) => {
                  img.onload = () => resolve();
                  img.onerror = reject;
                  img.src = dataUrl;
                });
                const pdfW = img.naturalWidth;
                const pdfH = img.naturalHeight;
                const pdf = new jsPDF({
                  orientation: pdfW > pdfH ? 'landscape' : 'portrait',
                  unit: 'px',
                  format: [pdfW, pdfH],
                  hotfixes: ['px_scaling'],
                });
                pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfW, pdfH);
                pdf.save(`semiguard_report_${new Date().toISOString().slice(0,10)}.pdf`);
                toast.success(lang === "ko" ? "PDF가 저장되었습니다." : "PDF saved successfully.");
              } catch (e) {
                console.error('PDF export error:', e);
                toast.error(lang === "ko" ? "PDF 내보내기 실패: " + String(e) : "PDF export failed: " + String(e));
              } finally {
                setPdfExporting(false);
              }
            }}
            title={lang === "ko" ? "PDF 내보내기" : "Export PDF"}
            className="hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-200 hover:opacity-80 active:scale-95 disabled:opacity-50"
            style={{ borderColor: th.border2, color: "oklch(0.65 0.18 200)", background: th.bgCard }}>
            {pdfExporting ? <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid oklch(0.65 0.18 200)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> : "📄"} {lang === "ko" ? "PDF" : "PDF"}
          </button>
          {/* 로그아웃 버튼 */}
          <button
            id="btn-logout"
            onClick={async () => {
              try {
                await fetch("/api/trpc/auth.logout", { method: "POST" });
                setLocation("/login");
              } catch (e) {
                console.error("Logout error:", e);
                toast.error(lang === "ko" ? "로그아웃 실패" : "Logout failed");
              }
            }}
            title={lang === "ko" ? "로그아웃" : "Logout"}
            className="hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-200 hover:opacity-80 active:scale-95"
            style={{ borderColor: "oklch(0.65 0.20 30 / 0.6)", color: "oklch(0.75 0.20 30)", background: "oklch(0.65 0.20 30 / 0.12)" }}>
            🚪 {lang === "ko" ? "로그아웃" : "Logout"}
          </button>
        </div>
      </header>

      {/* ── 랜딩 섹션 ── */}
      {showLanding && (
        <div className="border-b px-5 py-6" style={{ borderColor: th.border, background: isDark ? "linear-gradient(135deg, oklch(0.13 0.015 240), oklch(0.12 0.01 240))" : "linear-gradient(135deg, oklch(0.97 0.005 240), oklch(0.95 0.008 240))" }}>
          <div className="max-w-4xl mx-auto flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-3"
                style={{ background: "oklch(0.65 0.18 200 / 0.15)", color: "oklch(0.65 0.18 200)" }}>
                {t.landingBadge}
              </div>
              <h2 className="text-xl font-bold mb-2">{t.landingTitle}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{t.landingDesc}</p>
            </div>
            <button onClick={() => setShowLanding(false)}
              className="text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 hover:opacity-70"
              style={{ borderColor: th.border2, color: th.textMuted }}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── 플로팅 챗봇 버튼 ── */}
      <button
        type="button"
        onClick={() => setIsChatOpen(true)}
        aria-label={lang === "ko" ? "AI 수석 엔지니어 상담 열기" : lang === "ja" ? "AIシニアエンジニア相談を開く" : "Open AI expert chatbot"}
        className="fixed bottom-5 right-4 sm:bottom-8 sm:right-8 z-[495] flex items-center gap-2.5 sm:gap-3 px-5 py-4 sm:px-7 sm:py-5 rounded-full shadow-2xl font-extrabold text-sm sm:text-base transition-transform duration-200 hover:scale-[1.04] active:scale-[0.97]"
        style={{
          background: "linear-gradient(135deg, oklch(0.65 0.18 200), oklch(0.55 0.22 240))",
          color: "white",
          border: "2px solid oklch(0.85 0.14 200 / 0.7)",
          boxShadow: "0 18px 45px -10px rgba(0,0,0,0.45), 0 0 0 8px oklch(0.65 0.18 200 / 0.12)",
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}>
        <span className="relative flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full text-xl sm:text-2xl shrink-0" style={{ background: "rgba(255,255,255,0.18)" }}>
          🤖
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full" style={{ background: "oklch(0.8 0.19 145)", border: "2px solid white" }} />
        </span>
        <span className="flex flex-col items-start leading-tight text-left">
          <span className="whitespace-nowrap">{lang === "ko" ? "AI 수석 엔지니어 상담" : lang === "ja" ? "AIシニアエンジニア相談" : "AI Expert Chatbot"}</span>
          <span className="text-[10px] sm:text-xs font-semibold opacity-90 whitespace-nowrap">
            {lang === "ko" ? "LLM 진단 활성화" : lang === "ja" ? "LLM診断を起動" : "Activate LLM diagnosis"}
          </span>
        </span>
      </button>

      {/* ── AI 챗봇 대화창 모달 ── */}
      {isChatOpen && (
        <div className="fixed inset-0 z-[550] flex items-stretch justify-center bg-black/60 backdrop-blur-sm animate-fadeIn sm:items-center sm:p-4">
          <div
            className="relative flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden border shadow-2xl sm:h-[min(600px,90vh)] sm:w-[95vw] sm:max-w-lg sm:rounded-2xl"
            style={{
              background: isDark ? "oklch(0.13 0.015 240)" : "oklch(0.99 0.003 240)",
              borderColor: "oklch(0.75 0.18 200 / 0.4)",
            }}>
            {/* 챗봇 헤더 */}
            <div className="flex flex-col gap-2 border-b px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4" style={{ borderColor: th.border, background: "oklch(0.75 0.18 200 / 0.08)" }}>
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-base sm:text-lg font-bold shrink-0" style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 200), oklch(0.55 0.22 240))", color: "white" }}>
                  🤖
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-xs sm:text-sm font-bold truncate" style={{ color: isDark ? "oklch(0.92 0.01 240)" : "oklch(0.12 0.01 240)" }}>
                      {lang === "ko" ? "SemiGuard AI 수석 엔지니어" : lang === "ja" ? "SemiGuard AI シニアエンジニア" : "SemiGuard AI Expert Engineer"}
                    </h3>
                    <span className="px-1.5 py-0.2 rounded text-[8px] sm:text-[9px] font-mono border whitespace-nowrap shrink-0" style={{ borderColor: "oklch(0.75 0.18 200 / 0.3)", background: "oklch(0.75 0.18 200 / 0.1)", color: "oklch(0.75 0.18 200)" }}>
                      {lang === "ko" ? `대화 ${chatMessages.length}` : lang === "ja" ? `会話 ${chatMessages.length}` : `Msgs ${chatMessages.length}`}
                    </span>
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">
                    {chatMessages.length > 12
                      ? (lang === "ko" ? "⚡ 오래된 대화 요약 압축 중" : lang === "ja" ? "⚡ 古い会話を要約圧縮中" : "⚡ Older turns summarized")
                      : (lang === "ko" ? "실시간 센서 기반 맞춤형 진단" : lang === "ja" ? "リアルタイムセンサーカスタム診断" : "Real-time custom diagnosis")}
                  </p>
                </div>
              </div>
              <div className="-mb-1 flex w-full flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 sm:mb-0 sm:w-auto sm:justify-end sm:overflow-visible sm:pb-0">
                <button
                  type="button"
                  onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                  title={lang === "ko" ? "과거 상담 기록 보기" : lang === "ja" ? "過去の相談履歴を見る" : "View Consultation History"}
                  className="px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold border transition-all duration-150 hover:opacity-80 active:scale-95 whitespace-nowrap shrink-0 flex items-center gap-1"
                  style={{ borderColor: "oklch(0.65 0.22 145 / 0.4)", background: "oklch(0.65 0.22 145 / 0.10)", color: "oklch(0.75 0.18 145)" }}>
                  📂 {lang === "ko" ? "기록" : lang === "ja" ? "履歴" : "History"}
                </button>
                <button
                  type="button"
                  onClick={exportActiveChatMarkdown}
                  aria-disabled={isChatLoading || activeSessionId === null || !chatMessages.some(message => message.role === "user")}
                  title={isChatLoading
                    ? (lang === "ko" ? "AI 답변 생성이 끝난 뒤 내보낼 수 있습니다." : lang === "ja" ? "AI回答の生成完了後にエクスポートできます。" : "Available after the AI response is complete.")
                    : (lang === "ko" ? "현재 상담을 Markdown 파일로 내보내기" : lang === "ja" ? "現在の相談をMarkdownファイルとしてエクスポート" : "Export current consultation as Markdown")}
                  className="px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold border transition-all duration-150 hover:opacity-80 active:scale-95 whitespace-nowrap shrink-0 flex items-center gap-1"
                  style={{ borderColor: "oklch(0.72 0.15 75 / 0.45)", background: "oklch(0.72 0.15 75 / 0.12)", color: isDark ? "oklch(0.86 0.14 80)" : "oklch(0.46 0.16 75)", opacity: isChatLoading || activeSessionId === null || !chatMessages.some(message => message.role === "user") ? 0.58 : 1 }}>
                  ⬇️ {lang === "ko" ? "내보내기" : lang === "ja" ? "出力" : "Export"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowFeedbackHistoryPanel(previous => !previous);
                    setShowHistoryPanel(false);
                  }}
                  title={lang === "ko" ? "피드백·재생성 답변 히스토리 보기" : lang === "ja" ? "フィードバック・再生成回答の履歴を見る" : "View feedback and regenerated answer history"}
                  className="px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold border transition-all duration-150 hover:opacity-80 active:scale-95 whitespace-nowrap shrink-0 flex items-center gap-1"
                  style={{ borderColor: "oklch(0.62 0.20 300 / 0.45)", background: "oklch(0.62 0.20 300 / 0.12)", color: isDark ? "oklch(0.82 0.16 300)" : "oklch(0.45 0.20 300)" }}>
                  ✨ {lang === "ko" ? "피드백" : lang === "ja" ? "フィードバック" : "Feedback"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowManualRagModal(true)}
                  title={lang === "ko" ? "설비 매뉴얼을 RAG 지식으로 등록" : lang === "ja" ? "設備マニュアルをRAG知識として登録" : "Add equipment manual as RAG knowledge"}
                  className="px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold border transition-all duration-150 hover:opacity-80 active:scale-95 whitespace-nowrap shrink-0 flex items-center gap-1"
                  style={{ borderColor: "oklch(0.72 0.15 75 / 0.45)", background: "oklch(0.72 0.15 75 / 0.12)", color: isDark ? "oklch(0.86 0.14 80)" : "oklch(0.46 0.16 75)" }}>
                  📘 {lang === "ko" ? "매뉴얼" : lang === "ja" ? "マニュアル" : "Manual"}{manualDocumentsQuery.data?.length ? ` ${manualDocumentsQuery.data.length}` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirmModal(true)}
                  title={lang === "ko" ? "새 상담 시작 (이전 대화 보관)" : lang === "ja" ? "新しい相談 (会話保存)" : "New Consultation"}
                  className="px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold border transition-all duration-150 hover:opacity-80 active:scale-95 whitespace-nowrap shrink-0"
                  style={{ borderColor: "oklch(0.75 0.18 200 / 0.4)", background: "oklch(0.75 0.18 200 / 0.10)", color: "oklch(0.75 0.18 200)" }}>
                  🔄 {lang === "ko" ? "새 상담" : lang === "ja" ? "新規相談" : "New Chat"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsChatOpen(false)}
                  aria-label={lang === "ko" ? "상담 닫기" : lang === "ja" ? "相談を閉じる" : "Close consultation"}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs transition-opacity hover:opacity-70 border shrink-0"
                  style={{ borderColor: th.border2, color: th.textMuted }}>
                  ✕
                </button>
              </div>
            </div>

            {/* 새 상담 초기화 확인 모달 */}
            {showResetConfirmModal && (
              <div className="absolute inset-0 z-[560] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
                <div
                  className="w-full max-w-sm rounded-xl p-5 shadow-2xl border space-y-4"
                  style={{
                    background: isDark ? "oklch(0.15 0.02 240)" : "oklch(0.98 0.005 240)",
                    borderColor: "oklch(0.75 0.18 200 / 0.5)",
                    color: isDark ? "oklch(0.92 0.01 240)" : "oklch(0.12 0.01 240)"
                  }}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <h4 className="text-sm font-bold">
                        {lang === "ko" ? "대화를 초기화하시겠습니까?" : lang === "ja" ? "会話をリセットしますか？" : "Reset Conversation?"}
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {lang === "ko"
                          ? "새 상담을 시작하면 현재까지의 대화 내용이 모두 초기화됩니다. 계속하시겠습니까?"
                          : lang === "ja"
                          ? "新しい相談を開始すると、これまでの会話内容がすべてリセットされます。続行しますか？"
                          : "Starting a new consultation will clear all current conversation turns. Do you want to continue?"}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowResetConfirmModal(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:opacity-80"
                      style={{ borderColor: th.border2, color: th.textMuted }}>
                      {lang === "ko" ? "취소" : lang === "ja" ? "キャンセル" : "Cancel"}
                    </button>
                    <button
                      type="button"
                      onClick={handleResetChat}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90 shadow-md"
                      style={{ background: "linear-gradient(135deg, oklch(0.65 0.22 25), oklch(0.55 0.22 25))" }}>
                      {lang === "ko" ? "초기화 (새 상담)" : lang === "ja" ? "リセット (新規相談)" : "Reset & New Chat"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 설비 매뉴얼 RAG 지식 등록 모달 */}
            {showManualRagModal && (
              <div className="absolute inset-0 z-[565] flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md animate-fadeIn">
                <div className="w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border p-4 sm:p-5 shadow-2xl space-y-3 custom-scrollbar" style={{ background: isDark ? "oklch(0.15 0.02 240)" : "oklch(0.98 0.005 240)", borderColor: "oklch(0.72 0.15 75 / 0.45)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold" style={{ color: th.text }}>📘 {lang === "ko" ? "설비 매뉴얼 RAG 등록" : lang === "ja" ? "設備マニュアルRAG登録" : "Add Manual to RAG"}</h4>
                      <p className="mt-1 text-[10px] leading-relaxed" style={{ color: th.textMuted }}>
                        {lang === "ko" ? "매뉴얼·점검표의 텍스트를 등록하면, AI가 질문과 관련된 부분을 찾아 근거로 제시합니다. 민감정보는 제외해 주세요." : lang === "ja" ? "マニュアル・点検表のテキストを登録すると、AIが質問に関連する箇所を根拠として提示します。機密情報は除外してください。" : "Add manual or checklist text. The AI retrieves relevant sections as evidence. Exclude confidential information."}
                      </p>
                    </div>
                    <button type="button" onClick={() => setShowManualRagModal(false)} className="text-sm shrink-0 hover:opacity-70" style={{ color: th.textMuted }} aria-label={lang === "ko" ? "매뉴얼 등록 닫기" : lang === "ja" ? "マニュアル登録を閉じる" : "Close manual registration"}>✕</button>
                  </div>
                  <input
                    value={manualTitle}
                    onChange={event => setManualTitle(event.target.value)}
                    maxLength={255}
                    placeholder={lang === "ko" ? "예: 식각 장비 일일 점검 매뉴얼" : lang === "ja" ? "例: エッチング装置の日常点検マニュアル" : "e.g. Etcher daily inspection manual"}
                    className="w-full rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2"
                    style={{ background: isDark ? "oklch(0.18 0.02 240)" : "white", borderColor: th.border, color: th.text }}
                  />
                  <textarea
                    value={manualContent}
                    onChange={event => setManualContent(event.target.value)}
                    minLength={50}
                    maxLength={60000}
                    placeholder={lang === "ko" ? "매뉴얼 또는 점검표 본문을 붙여넣어 주세요. 문단으로 나누면 더 정확하게 검색됩니다." : lang === "ja" ? "マニュアルまたは点検表の本文を貼り付けてください。段落で区切ると検索精度が向上します。" : "Paste manual or checklist text. Separate paragraphs for more accurate retrieval."}
                    className="custom-scrollbar min-h-40 w-full resize-y rounded-lg border px-3 py-2 text-xs leading-relaxed outline-none focus:ring-2"
                    style={{ background: isDark ? "oklch(0.18 0.02 240)" : "white", borderColor: th.border, color: th.text }}
                  />
                  <div className="rounded-lg border px-2.5 py-2 text-[10px] leading-relaxed" role="status" aria-live="polite" style={{ borderColor: isManualChunkWarning ? "oklch(0.72 0.16 75 / 0.55)" : th.border, background: isManualChunkWarning ? "oklch(0.72 0.16 75 / 0.10)" : "transparent", color: isManualChunkWarning ? (isDark ? "oklch(0.86 0.14 80)" : "oklch(0.45 0.16 75)") : th.textMuted }}>
                    {manualChunkEstimate === 0
                      ? (lang === "ko" ? "본문을 입력하면 등록될 RAG 구간 수를 미리 계산합니다." : lang === "ja" ? "本文を入力すると、登録されるRAG区間数を事前に計算します。" : "Enter manual text to preview the number of RAG chunks to be registered.")
                      : isManualChunkWarning
                        ? (lang === "ko" ? `예상 ${manualChunkEstimate}개 구간입니다. ${MANUAL_CHUNK_WARNING_THRESHOLD}개 이상은 검색 범위가 넓어질 수 있으니 장·설비별로 나누어 등록해 주세요. 최대 ${MANUAL_CHUNK_LIMIT}개까지 등록할 수 있습니다.` : lang === "ja" ? `推定${manualChunkEstimate}区間です。${MANUAL_CHUNK_WARNING_THRESHOLD}区間以上では検索範囲が広くなる可能性があるため、章・設備ごとに分けて登録してください。最大${MANUAL_CHUNK_LIMIT}区間まで登録できます。` : `Estimated ${manualChunkEstimate} chunks. At ${MANUAL_CHUNK_WARNING_THRESHOLD}+ chunks, retrieval may become broader; split the manual by chapter or equipment. Up to ${MANUAL_CHUNK_LIMIT} chunks can be registered.`)
                        : (lang === "ko" ? `예상 ${manualChunkEstimate}개 RAG 구간으로 등록됩니다. 문단 구분을 유지하면 근거 검색 정확도에 도움이 됩니다.` : lang === "ja" ? `推定${manualChunkEstimate}件のRAG区間として登録されます。段落区切りを保つと根拠検索の精度向上に役立ちます。` : `Estimated ${manualChunkEstimate} RAG chunks. Keeping paragraph breaks helps retrieval accuracy.`)}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px]" style={{ color: th.textMuted }}>{manualContent.length.toLocaleString()} / 60,000</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShowManualRagModal(false)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: th.border, color: th.textMuted }}>{lang === "ko" ? "취소" : lang === "ja" ? "キャンセル" : "Cancel"}</button>
                      <button
                        type="button"
                        disabled={manualTitle.trim().length === 0 || manualContent.trim().length < 50 || addManualTextMutation.isPending}
                        onClick={async () => {
                          try {
                            const result = await addManualTextMutation.mutateAsync({ title: manualTitle.trim(), content: manualContent.trim() });
                            toast.success(lang === "ko" ? `매뉴얼 ${result.chunkCount}개 구간을 RAG 지식으로 등록했습니다.` : lang === "ja" ? `マニュアルを${result.chunkCount}件のRAG知識として登録しました。` : `Added ${result.chunkCount} manual chunks to RAG knowledge.`);
                            setManualTitle("");
                            setManualContent("");
                            setShowManualRagModal(false);
                            chatUtils.semiguard.getManualDocuments.invalidate();
                          } catch {
                            toast.error(lang === "ko" ? "매뉴얼을 등록하지 못했습니다." : lang === "ja" ? "マニュアルを登録できませんでした。" : "Could not add the manual.");
                          }
                        }}
                        className="rounded-lg px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg, oklch(0.58 0.16 75), oklch(0.48 0.18 55))" }}>
                        {addManualTextMutation.isPending ? (lang === "ko" ? "등록 중..." : lang === "ja" ? "登録中..." : "Adding...") : (lang === "ko" ? "RAG 지식 등록" : lang === "ja" ? "RAG知識に登録" : "Add to RAG")}
                      </button>
                    </div>
                  </div>
                  <div className="border-t pt-3" style={{ borderColor: th.border }}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h5 className="text-[11px] font-bold" style={{ color: th.text }}>
                        📚 {lang === "ko" ? "등록된 RAG 매뉴얼" : lang === "ja" ? "登録済みRAGマニュアル" : "Registered RAG manuals"}
                      </h5>
                      <span className="text-[10px]" style={{ color: th.textMuted }}>
                        {isManualSearching
                          ? (lang === "ko" ? "검색 중..." : lang === "ja" ? "検索中..." : "Searching...")
                          : <>{normalizedManualSearch ? `${filteredManualDocuments.length}/` : ""}{allManualDocuments.length}{lang === "ko" ? "개" : lang === "ja" ? "件" : " items"}</>}
                      </span>
                    </div>
                    {manualDocumentsQuery.isLoading ? (
                      <p className="py-2 text-center text-[10px]" style={{ color: th.textMuted }}>
                        {lang === "ko" ? "매뉴얼 목록을 불러오는 중..." : lang === "ja" ? "マニュアル一覧を読み込み中..." : "Loading manuals..."}
                      </p>
                    ) : manualDocumentsQuery.isError ? (
                      <div className="flex flex-col items-center gap-1.5 py-3 text-center text-[10px]" style={{ color: th.textMuted }}>
                        <p>⚠️ {lang === "ko" ? "매뉴얼 목록을 불러오지 못했습니다." : lang === "ja" ? "マニュアル一覧を読み込めませんでした。" : "Could not load manuals."}</p>
                        <button type="button" onClick={() => void manualDocumentsQuery.refetch()} disabled={manualDocumentsQuery.isFetching} className="rounded border px-2 py-1 text-[9px] font-bold disabled:opacity-45" style={{ borderColor: "oklch(0.72 0.15 75 / 0.45)", color: isDark ? "oklch(0.86 0.14 80)" : "oklch(0.46 0.16 75)" }}>
                          ↻ {manualDocumentsQuery.isFetching ? (lang === "ko" ? "다시 불러오는 중..." : lang === "ja" ? "再読み込み中..." : "Retrying...") : (lang === "ko" ? "다시 시도" : lang === "ja" ? "再試行" : "Retry")}
                        </button>
                      </div>
                    ) : allManualDocuments.length > 0 ? (
                      <>
                        <div className="relative mb-2">
                          <input
                            value={manualSearchQuery}
                            onChange={event => setManualSearchQuery(event.target.value)}
                            placeholder={lang === "ko" ? "매뉴얼 제목 또는 원문 검색..." : lang === "ja" ? "マニュアルのタイトル・原文を検索..." : "Search manual titles or content..."}
                            className="w-full rounded-lg border px-2.5 py-1.5 pr-7 text-[10px] outline-none focus:ring-2 focus:ring-amber-500/35"
                            style={{ borderColor: th.border2, background: th.bgCard, color: th.text }}
                            aria-label={lang === "ko" ? "RAG 매뉴얼 제목 또는 원문 검색" : lang === "ja" ? "RAGマニュアルのタイトル・原文を検索" : "Search RAG manual titles or content"}
                          />
                          {manualSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setManualSearchQuery("")}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-1 text-[10px] hover:opacity-70"
                              style={{ color: th.textMuted }}
                              aria-label={lang === "ko" ? "매뉴얼 검색 지우기" : lang === "ja" ? "マニュアル検索をクリア" : "Clear manual search"}>
                              ✕
                            </button>
                          )}
                        </div>
                        {isManualSearching ? (
                          <p className="py-3 text-center text-[10px]" style={{ color: th.textMuted }}>
                            {isManualSearchPending
                              ? (lang === "ko" ? "입력을 확인하는 중..." : lang === "ja" ? "入力を確認中..." : "Waiting for input...")
                              : (lang === "ko" ? "매뉴얼 제목과 원문을 검색하는 중..." : lang === "ja" ? "マニュアルのタイトル・原文を検索中..." : "Searching manual titles and content...")}
                          </p>
                        ) : normalizedManualSearch && manualDocumentSearchQuery.isError ? (
                          <div className="flex flex-col items-center gap-1.5 py-3 text-center text-[10px]" style={{ color: th.textMuted }}>
                            <p>⚠️ {lang === "ko" ? "매뉴얼 검색 결과를 불러오지 못했습니다." : lang === "ja" ? "マニュアル検索結果を読み込めませんでした。" : "Could not load manual search results."}</p>
                            <button type="button" onClick={() => void manualDocumentSearchQuery.refetch()} disabled={manualDocumentSearchQuery.isFetching} className="rounded border px-2 py-1 text-[9px] font-bold disabled:opacity-45" style={{ borderColor: "oklch(0.72 0.15 75 / 0.45)", color: isDark ? "oklch(0.86 0.14 80)" : "oklch(0.46 0.16 75)" }}>
                              ↻ {manualDocumentSearchQuery.isFetching ? (lang === "ko" ? "다시 불러오는 중..." : lang === "ja" ? "再読み込み中..." : "Retrying...") : (lang === "ko" ? "다시 시도" : lang === "ja" ? "再試行" : "Retry")}
                            </button>
                          </div>
                        ) : filteredManualDocuments.length > 0 ? (
                        <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1 custom-scrollbar">
                        {filteredManualDocuments.map(document => (
                          <div key={document.id} className="rounded-lg border p-2" style={{ borderColor: th.border2, background: th.bgCard }}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-[10px] font-bold" style={{ color: th.text }} title={document.title}>{document.title}</p>
                                <p className="mt-0.5 text-[9px]" style={{ color: th.textMuted }}>
                                  {document.chunkCount}{lang === "ko" ? "개 구간" : lang === "ja" ? "区間" : " chunks"} · {new Date(document.updatedAt).toLocaleDateString(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US")}
                                </p>
                                {(() => {
                                  const matchedExcerpt = "matchedContentExcerpt" in document && typeof document.matchedContentExcerpt === "string"
                                    ? document.matchedContentExcerpt
                                    : null;
                                  return matchedExcerpt ? (
                                    <p className="mt-1 line-clamp-2 text-[9px] leading-relaxed" style={{ color: isDark ? "oklch(0.78 0.12 80)" : "oklch(0.42 0.13 75)" }}>
                                      {lang === "ko" ? "원문 일치: " : lang === "ja" ? "原文一致: " : "Content match: "}{matchedExcerpt}
                                    </p>
                                  ) : null;
                                })()}
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setPreviewManualDocumentId(previewManualDocumentId === document.id ? null : document.id)}
                                  className="rounded border px-1.5 py-1 text-[9px] font-bold transition-all hover:opacity-80"
                                  style={{ borderColor: "oklch(0.72 0.15 75 / 0.4)", background: "oklch(0.72 0.15 75 / 0.10)", color: isDark ? "oklch(0.86 0.14 80)" : "oklch(0.46 0.16 75)" }}
                                  aria-label={lang === "ko" ? "매뉴얼 원문 보기" : lang === "ja" ? "マニュアルの原文を見る" : "View manual source"}>
                                  {previewManualDocumentId === document.id ? (lang === "ko" ? "닫기" : lang === "ja" ? "閉じる" : "Close") : (lang === "ko" ? "원문" : lang === "ja" ? "原文" : "Source")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setManualDocumentToDelete(document.id)}
                                  className="rounded border border-red-500/35 bg-red-500/10 px-1.5 py-1 text-[9px] font-bold text-red-400 transition-all hover:bg-red-500/20"
                                  aria-label={lang === "ko" ? "매뉴얼 삭제" : lang === "ja" ? "マニュアルを削除" : "Delete manual"}>
                                  🗑️
                                </button>
                              </div>
                            </div>
                            {previewManualDocumentId === document.id && (
                              <div className="mt-2 border-t pt-2" style={{ borderColor: th.border2 }}>
                                <p className="mb-1 text-[9px] font-bold" style={{ color: th.textMuted }}>
                                  {lang === "ko" ? "저장된 원문 구간" : lang === "ja" ? "保存された原文区間" : "Stored source sections"}
                                </p>
                                {manualPreviewQuery.isLoading ? (
                                  <p className="py-1 text-[9px]" style={{ color: th.textMuted }}>{lang === "ko" ? "원문을 불러오는 중..." : lang === "ja" ? "原文を読み込み中..." : "Loading source..."}</p>
                                ) : manualPreviewQuery.isError ? (
                                  <div className="flex items-center justify-between gap-2 py-1 text-[9px]" style={{ color: th.textMuted }}>
                                    <span>⚠️ {lang === "ko" ? "원문을 불러오지 못했습니다." : lang === "ja" ? "原文を読み込めませんでした。" : "Could not load the source."}</span>
                                    <button type="button" onClick={() => void manualPreviewQuery.refetch()} disabled={manualPreviewQuery.isFetching} className="shrink-0 rounded border px-1.5 py-0.5 font-bold disabled:opacity-45" style={{ borderColor: "oklch(0.72 0.15 75 / 0.45)", color: isDark ? "oklch(0.86 0.14 80)" : "oklch(0.46 0.16 75)" }}>
                                      ↻ {lang === "ko" ? "재시도" : lang === "ja" ? "再試行" : "Retry"}
                                    </button>
                                  </div>
                                ) : manualPreviewQuery.data ? (
                                  <>
                                    <div className="mb-1.5 flex justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            await navigator.clipboard.writeText(manualPreviewQuery.data.chunks.map(chunk => `[${chunk.chunkIndex + 1}] ${chunk.content}`).join("\n\n"));
                                            toast.success(lang === "ko" ? "매뉴얼 원문을 복사했습니다." : lang === "ja" ? "マニュアル原文をコピーしました。" : "Manual source copied.");
                                          } catch (error) {
                                            console.error("Manual preview copy failed:", error);
                                            toast.error(lang === "ko" ? "원문을 복사하지 못했습니다." : lang === "ja" ? "原文をコピーできませんでした。" : "Could not copy the source.");
                                          }
                                        }}
                                        className="rounded border px-1.5 py-1 text-[9px] font-bold transition-opacity hover:opacity-75"
                                        style={{ borderColor: th.border2, color: th.textMuted }}>
                                        📋 {lang === "ko" ? "복사" : lang === "ja" ? "コピー" : "Copy"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const locale = lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US";
                                          const markdown = [
                                            `# ${manualPreviewQuery.data.document.title}`,
                                            "",
                                            `- ${lang === "ko" ? "내보낸 시각" : lang === "ja" ? "エクスポート日時" : "Exported"}: ${new Date().toLocaleString(locale)}`,
                                            `- ${lang === "ko" ? "갱신일" : lang === "ja" ? "更新日" : "Updated"}: ${new Date(manualPreviewQuery.data.document.updatedAt).toLocaleString(locale)}`,
                                            "",
                                            ...manualPreviewQuery.data.chunks.flatMap(chunk => [`## ${lang === "ko" ? "구간" : lang === "ja" ? "区間" : "Section"} ${chunk.chunkIndex + 1}`, "", chunk.content, ""]),
                                          ].join("\n");
                                          const blob = new Blob([`\ufeff${markdown}`], { type: "text/markdown;charset=utf-8" });
                                          const url = URL.createObjectURL(blob);
                                          const anchor = window.document.createElement("a");
                                          const safeTitle = manualPreviewQuery.data.document.title.replace(/[\\/:*?\"<>|]/g, "-").replace(/\s+/g, "-").slice(0, 40) || "manual";
                                          anchor.href = url;
                                          anchor.download = `semiguard-manual-${safeTitle}-${new Date().toISOString().slice(0, 10)}.md`;
                                          window.document.body.appendChild(anchor);
                                          anchor.click();
                                          anchor.remove();
                                          URL.revokeObjectURL(url);
                                          toast.success(lang === "ko" ? "매뉴얼 원문을 Markdown 파일로 내보냈습니다." : lang === "ja" ? "マニュアル原文をMarkdownファイルとしてエクスポートしました。" : "Manual source exported as Markdown.");
                                        }}
                                        className="rounded border px-1.5 py-1 text-[9px] font-bold transition-opacity hover:opacity-75"
                                        style={{ borderColor: "oklch(0.72 0.15 75 / 0.4)", color: isDark ? "oklch(0.86 0.14 80)" : "oklch(0.46 0.16 75)" }}>
                                        ⬇️ Markdown
                                      </button>
                                    </div>
                                    <div className="max-h-36 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
                                      {manualPreviewQuery.data.chunks.map(chunk => (
                                        <div key={chunk.id} className="rounded border px-1.5 py-1 text-[9px] leading-relaxed" style={{ borderColor: th.border2, background: th.bgCard2, color: th.text }}>
                                          <span className="mr-1 font-bold" style={{ color: th.textMuted }}>[{chunk.chunkIndex + 1}]</span>{chunk.content}
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                ) : (
                                  <p className="py-1 text-[9px] text-red-400">{lang === "ko" ? "원문을 불러오지 못했습니다." : lang === "ja" ? "原文を読み込めませんでした。" : "Could not load the source."}</p>
                                )}
                              </div>
                            )}
                            {manualDocumentToDelete === document.id && (
                              <div className="mt-2 border-t pt-2" style={{ borderColor: th.border2 }}>
                                <p className="text-[9px] leading-relaxed text-red-400">
                                  {lang === "ko" ? "이 매뉴얼과 연결된 모든 RAG 구간을 삭제할까요? 되돌릴 수 없습니다." : lang === "ja" ? "このマニュアルと関連するすべてのRAG区間を削除しますか？元に戻せません。" : "Delete this manual and all related RAG chunks? This cannot be undone."}
                                </p>
                                <div className="mt-1.5 flex justify-end gap-1.5">
                                  <button type="button" onClick={() => setManualDocumentToDelete(null)} className="rounded px-2 py-1 text-[9px]" style={{ color: th.textMuted }}>
                                    {lang === "ko" ? "취소" : lang === "ja" ? "キャンセル" : "Cancel"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={deleteManualDocumentMutation.isPending}
                                    onClick={async () => {
                                      try {
                                        const result = await deleteManualDocumentMutation.mutateAsync({ documentId: document.id });
                                        if (!result.deleted) throw new Error("Manual document was not found");
                                        toast.success(lang === "ko" ? "RAG 매뉴얼을 삭제했습니다." : lang === "ja" ? "RAGマニュアルを削除しました。" : "RAG manual deleted.");
                                        setManualDocumentToDelete(null);
                                        chatUtils.semiguard.getManualDocuments.invalidate();
                                      } catch (error) {
                                        console.error("Manual deletion failed:", error);
                                        toast.error(lang === "ko" ? "매뉴얼을 삭제하지 못했습니다." : lang === "ja" ? "マニュアルを削除できませんでした。" : "Could not delete the manual.");
                                      }
                                    }}
                                    className="rounded bg-red-600 px-2 py-1 text-[9px] font-bold text-white disabled:opacity-50">
                                    {deleteManualDocumentMutation.isPending ? (lang === "ko" ? "삭제 중..." : lang === "ja" ? "削除中..." : "Deleting...") : (lang === "ko" ? "삭제" : lang === "ja" ? "削除" : "Delete")}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        </div>
                        ) : (
                          <p className="rounded-lg border border-dashed p-2 text-center text-[10px] leading-relaxed" style={{ borderColor: th.border2, color: th.textMuted }}>
                            {lang === "ko" ? "검색어와 일치하는 매뉴얼이 없습니다." : lang === "ja" ? "検索語に一致するマニュアルがありません。" : "No manuals match your search."}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="rounded-lg border border-dashed p-2 text-center text-[10px] leading-relaxed" style={{ borderColor: th.border2, color: th.textMuted }}>
                        {lang === "ko" ? "등록된 매뉴얼이 없습니다. 위에서 첫 매뉴얼을 등록해 보세요." : lang === "ja" ? "登録済みのマニュアルはありません。上から最初のマニュアルを登録してください。" : "No manuals registered yet. Add your first manual above."}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 상담 기록 사이드 패널 */}
            {showHistoryPanel && (
              <div className="absolute inset-0 z-[570] flex flex-col border p-3 shadow-2xl backdrop-blur-md animate-fadeIn sm:inset-x-auto sm:right-4 sm:top-14 sm:bottom-2 sm:w-72 sm:rounded-xl"
                style={{
                  background: isDark ? "oklch(0.14 0.02 240 / 0.95)" : "oklch(0.98 0.005 240 / 0.95)",
                  borderColor: "oklch(0.75 0.18 200 / 0.4)",
                  color: isDark ? "oklch(0.92 0.01 240)" : "oklch(0.12 0.01 240)"
                }}>
                <div className="flex flex-col gap-2 pb-2 border-b mb-2" style={{ borderColor: th.border }}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold flex items-center gap-1.5">
                      📂 {lang === "ko" ? "과거 상담 기록" : lang === "ja" ? "過去の相談履歴" : "Consultation History"}
                    </h4>
                    <div className="flex items-center gap-2">
                      {chatSessionsQuery.data && chatSessionsQuery.data.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowDeleteAllConfirm(true)}
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-all">
                          🗑️ {lang === "ko" ? "전체 초기화" : lang === "ja" ? "すべてリセット" : "Clear All"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowHistoryPanel(false)}
                        className="text-xs text-muted-foreground hover:opacity-70"
                        aria-label={lang === "ko" ? "상담 기록 닫기" : lang === "ja" ? "相談履歴を閉じる" : "Close consultation history"}>
                        ✕
                      </button>
                    </div>
                  </div>
                  {/* 검색창 */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={lang === "ko" ? "과거 대화 내용 검색..." : lang === "ja" ? "過去の会話を検索..." : "Search past consultations..."}
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none transition-all focus:ring-1 focus:ring-sky-500"
                      style={{
                        background: isDark ? "oklch(0.12 0.01 240)" : "oklch(0.99 0.002 240)",
                        borderColor: th.border2,
                        color: isDark ? "oklch(0.92 0.01 240)" : "oklch(0.12 0.01 240)"
                      }}
                    />
                    {searchKeyword && (
                      <button
                        type="button"
                        onClick={() => setSearchKeyword("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:opacity-70">
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1 rounded-lg border p-0.5" style={{ borderColor: th.border2, background: th.bgCard2 }}>
                      {(["all", "pinned"] as const).map(filter => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setHistorySessionFilter(filter)}
                          className="rounded px-2 py-1 text-[9px] font-bold transition-all"
                          style={{
                            background: historySessionFilter === filter ? "oklch(0.67 0.17 210 / 0.20)" : "transparent",
                            color: historySessionFilter === filter ? (isDark ? "oklch(0.84 0.12 210)" : "oklch(0.42 0.15 210)") : th.textMuted,
                          }}>
                          {filter === "all" ? (lang === "ko" ? "전체" : lang === "ja" ? "すべて" : "All") : (lang === "ko" ? "📌 고정" : lang === "ja" ? "📌 固定" : "📌 Pinned")}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <label className="sr-only" htmlFor="consultation-history-sort">
                        {lang === "ko" ? "상담 기록 정렬" : lang === "ja" ? "相談履歴の並び替え" : "Sort consultation history"}
                      </label>
                      <select
                        id="consultation-history-sort"
                        value={historySessionSort}
                        onChange={(event) => setHistorySessionSort(event.target.value as "newest" | "oldest" | "title")}
                        className="max-w-[86px] rounded border px-1.5 py-1 text-[9px] outline-none focus:ring-1 focus:ring-sky-500"
                        style={{ borderColor: th.border2, background: th.bgCard2, color: th.textMuted }}>
                        <option value="newest">{lang === "ko" ? "최신순" : lang === "ja" ? "新しい順" : "Newest"}</option>
                        <option value="oldest">{lang === "ko" ? "오래된순" : lang === "ja" ? "古い順" : "Oldest"}</option>
                        <option value="title">{lang === "ko" ? "제목순" : lang === "ja" ? "タイトル順" : "Title"}</option>
                      </select>
                      <button
                        type="button"
                        onClick={exportFilteredChatSessionsCsv}
                        disabled={filteredAndSortedChatSessions.length === 0}
                        title={lang === "ko" ? "현재 필터 결과를 CSV로 내보내기" : lang === "ja" ? "現在のフィルター結果をCSVでエクスポート" : "Export current filtered results as CSV"}
                        className="rounded border px-1.5 py-1 text-[9px] font-bold transition-all hover:opacity-80 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ borderColor: "oklch(0.65 0.18 200 / 0.40)", background: "oklch(0.65 0.18 200 / 0.10)", color: isDark ? "oklch(0.78 0.14 200)" : "oklch(0.42 0.17 200)" }}>
                        ⬇ CSV
                      </button>
                      <span className="text-[9px] whitespace-nowrap" style={{ color: th.textMuted }}>
                        {filteredAndSortedChatSessions.length}{lang === "ko" ? "건" : lang === "ja" ? "件" : " results"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[9px] font-medium" style={{ color: th.textMuted }}>
                      {lang === "ko" ? "기간" : lang === "ja" ? "期間" : "Period"}
                    </span>
                    {([
                      { id: "all", ko: "전체", ja: "すべて", en: "All" },
                      { id: "today", ko: "오늘", ja: "今日", en: "Today" },
                      { id: "week", ko: "7일", ja: "7日", en: "7d" },
                      { id: "month", ko: "30일", ja: "30日", en: "30d" },
                    ] as const).map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyHistoryDatePreset(preset.id)}
                        className="rounded border px-1.5 py-1 text-[9px] font-bold transition-all"
                        style={{
                          borderColor: historySessionDatePreset === preset.id ? "oklch(0.67 0.17 210 / 0.65)" : th.border2,
                          background: historySessionDatePreset === preset.id ? "oklch(0.67 0.17 210 / 0.16)" : "transparent",
                          color: historySessionDatePreset === preset.id ? (isDark ? "oklch(0.84 0.12 210)" : "oklch(0.42 0.15 210)") : th.textMuted,
                        }}>
                        {lang === "ko" ? preset.ko : lang === "ja" ? preset.ja : preset.en}
                      </button>
                    ))}
                    <span className="h-3 w-px" style={{ background: th.border2 }} />
                    <label className="sr-only" htmlFor="consultation-history-start-date">
                      {lang === "ko" ? "상담 기록 시작일" : lang === "ja" ? "相談履歴の開始日" : "Consultation history start date"}
                    </label>
                    <input
                      id="consultation-history-start-date"
                      type="date"
                      value={historySessionStartDate}
                      max={historySessionEndDate || undefined}
                      onChange={(event) => { setHistorySessionStartDate(event.target.value); setHistorySessionDatePreset("custom"); }}
                      className="min-w-0 rounded border px-1.5 py-1 text-[9px] outline-none focus:ring-1 focus:ring-sky-500"
                      style={{ borderColor: th.border2, background: th.bgCard2, color: th.textMuted }}
                    />
                    <span className="text-[9px]" style={{ color: th.textMuted }}>~</span>
                    <label className="sr-only" htmlFor="consultation-history-end-date">
                      {lang === "ko" ? "상담 기록 종료일" : lang === "ja" ? "相談履歴の終了日" : "Consultation history end date"}
                    </label>
                    <input
                      id="consultation-history-end-date"
                      type="date"
                      value={historySessionEndDate}
                      min={historySessionStartDate || undefined}
                      onChange={(event) => { setHistorySessionEndDate(event.target.value); setHistorySessionDatePreset("custom"); }}
                      className="min-w-0 rounded border px-1.5 py-1 text-[9px] outline-none focus:ring-1 focus:ring-sky-500"
                      style={{ borderColor: th.border2, background: th.bgCard2, color: th.textMuted }}
                    />
                    {(historySessionStartDate || historySessionEndDate) && (
                      <button
                        type="button"
                        onClick={() => applyHistoryDatePreset("all")}
                        className="rounded border px-1.5 py-1 text-[9px] font-bold hover:opacity-75"
                        style={{ borderColor: th.border2, color: th.textMuted }}>
                        {lang === "ko" ? "초기화" : lang === "ja" ? "リセット" : "Reset"}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 rounded-lg border p-1.5" style={{ borderColor: th.border2, background: th.bgCard2 }}>
                    <div className="min-w-0 text-center">
                      <p className="text-[8px]" style={{ color: th.textMuted }}>{lang === "ko" ? "세션" : lang === "ja" ? "セッション" : "Sessions"}</p>
                      <p className="text-[11px] font-bold" style={{ color: th.text }}>{filteredAndSortedChatSessions.length}</p>
                    </div>
                    <div className="min-w-0 text-center border-x" style={{ borderColor: th.border2 }}>
                      <p className="text-[8px]" style={{ color: th.textMuted }}>{lang === "ko" ? "대화" : lang === "ja" ? "メッセージ" : "Messages"}</p>
                      <p className="text-[11px] font-bold" style={{ color: th.text }}>{filteredHistoryMessageCount}</p>
                    </div>
                    <div className="min-w-0 text-center">
                      <p className="text-[8px]" style={{ color: th.textMuted }}>{lang === "ko" ? "고정" : lang === "ja" ? "固定" : "Pinned"}</p>
                      <p className="text-[11px] font-bold text-amber-400">{filteredHistoryPinnedCount}</p>
                    </div>
                  </div>
                </div>

                {/* 전체 초기화 2단계 확인 모달 */}
                {showDeleteAllConfirm && (
                  <div className="absolute inset-0 z-[580] rounded-xl flex flex-col items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn text-center">
                    <p className="text-xs font-bold text-red-300 mb-1">
                      ⚠️ {lang === "ko" ? "모든 상담 기록을 삭제하시겠습니까?" : lang === "ja" ? "すべての相談履歴を削除しますか？" : "Delete all consultation history?"}
                    </p>
                    <p className="text-[10px] text-muted-foreground mb-4">
                      {lang === "ko" ? "이 작업은 되돌릴 수 없으며 모든 대화가 영구 삭제됩니다." : lang === "ja" ? "この操作は取り消せません。" : "This action cannot be undone."}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDeleteAllConfirm(false)}
                        className="px-3 py-1 rounded-lg text-xs font-bold border"
                        style={{ borderColor: th.border2, color: th.textMuted }}>
                        {lang === "ko" ? "취소" : lang === "ja" ? "キャンセル" : "Cancel"}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await deleteAllSessionsMutation.mutateAsync();
                            // 새로 빈 세션 생성하여 대화창 완전 리셋
                            const newTitle = lang === "ko" ? "새로운 상담" : lang === "ja" ? "新しい相談" : "New Consultation";
                            const res = await createSessionMutation.mutateAsync({ title: newTitle });
                            setActiveSessionId(res.sessionId);
                            const initialMsg = lang === "ko"
                              ? "모든 상담 기록이 초기화되었습니다. 새로운 상담을 시작합니다."
                              : lang === "ja"
                              ? "すべての相談履歴が初期化されました。新しい相談を開始します。"
                              : "All consultation history has been cleared. Starting a new consultation.";
                            setChatMessages([{ role: "assistant", content: initialMsg, timestamp: Date.now() }]);
                            await saveMessageMutation.mutateAsync({ sessionId: res.sessionId, role: "assistant", content: initialMsg });

                            chatUtils.semiguard.getChatSessions.invalidate();
                            setShowDeleteAllConfirm(false);
                            setShowHistoryPanel(false);
                          } catch (e) {
                            console.error("Failed to delete all sessions:", e);
                          }
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-all">
                        {lang === "ko" ? "전체 삭제" : lang === "ja" ? "すべて削除" : "Delete All"}
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {chatSessionsQuery.isLoading || isHistorySearchPending || (debouncedHistorySearch.length > 0 && searchChatSessionsQuery.isLoading) ? (
                    <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
                      <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>{isHistorySearchPending || debouncedHistorySearch.length > 0 ? (lang === "ko" ? "기록 검색 중..." : lang === "ja" ? "履歴を検索中..." : "Searching history...") : (lang === "ko" ? "기록 불러오는 중..." : lang === "ja" ? "履歴を読み込んでいます..." : "Loading history...")}</span>
                    </div>
                  ) : chatSessionsQuery.data && chatSessionsQuery.data.length > 0 ? (
                    (() => {
                      const filtered = filteredAndSortedChatSessions;
                      if (filtered.length === 0) {
                        return (
                          <p className="text-[11px] text-muted-foreground text-center py-6">
                            {historySessionFilter === "pinned"
                              ? (lang === "ko" ? "고정한 상담 기록이 없습니다." : lang === "ja" ? "固定した相談履歴はありません。" : "No pinned consultations found.")
                              : (lang === "ko" ? "검색 결과가 없습니다." : lang === "ja" ? "検索結果がありません。" : "No matching consultations found.")}
                          </p>
                        );
                      }
                      return paginatedChatSessions.map((session) => (
                      <div
                        key={session.id}
                        onClick={async () => {
                          setActiveSessionId(session.id);
                          setShowHistoryPanel(false);
                          // 해당 세션 메시지 조회
                          try {
                            const res = await chatUtils.client.semiguard.getChatMessages.query({ sessionId: session.id });
                            if (res && res.length > 0) {
                              setChatMessages(res.map(m => ({
                                role: m.role as "user" | "assistant",
                                content: m.content,
                                timestamp: m.createdAt ? new Date(m.createdAt).getTime() : Date.now()
                              })));
                            } else {
                              setChatMessages([
                                {
                                  role: "assistant",
                                  content: lang === "ko" ? "저장된 대화가 없는 세션입니다." : lang === "ja" ? "保存された会話のないセッションです。" : "Empty session.",
                                  timestamp: Date.now(),
                                },
                              ]);
                            }
                          } catch (err) {
                            console.error("Failed to load session messages:", err);
                          }
                        }}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex items-center justify-between ${
                          activeSessionId === session.id ? "ring-2 ring-sky-500 shadow-sm" : ""
                        }`}
                        style={{
                          background: activeSessionId === session.id
                            ? "oklch(0.75 0.18 200 / 0.18)"
                            : isDark
                            ? "oklch(0.17 0.015 240)"
                            : "oklch(0.96 0.005 240)",
                          borderColor: activeSessionId === session.id ? "oklch(0.75 0.18 200)" : th.border2
                        }}>
                        <div className="min-w-0 flex-1 pr-2">
                          {editingSessionId === session.id ? (
                            <div className="space-y-1.5" onClick={event => event.stopPropagation()}>
                              <input
                                value={editingSessionTitle}
                                maxLength={120}
                                autoFocus
                                onChange={event => setEditingSessionTitle(event.target.value)}
                                onKeyDown={event => {
                                  if (event.key === "Escape") {
                                    setEditingSessionId(null);
                                    return;
                                  }
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    if (!editingSessionTitle.trim()) return;
                                    void (async () => {
                                      try {
                                        const result = await updateSessionTitleMutation.mutateAsync({ sessionId: session.id, title: editingSessionTitle.trim() });
                                        if (!result.success) throw new Error("Session was not found");
                                        chatUtils.semiguard.getChatSessions.invalidate();
                                        setEditingSessionId(null);
                                        toast.success(lang === "ko" ? "상담 기록 제목을 수정했습니다." : lang === "ja" ? "相談履歴のタイトルを変更しました。" : "Consultation title updated.");
                                      } catch (error) {
                                        console.error("Failed to update consultation title:", error);
                                        toast.error(lang === "ko" ? "상담 기록 제목을 수정하지 못했습니다." : lang === "ja" ? "相談履歴のタイトルを変更できませんでした。" : "Could not update the consultation title.");
                                      }
                                    })();
                                  }
                                }}
                                className="w-full rounded border px-2 py-1 text-[10px] outline-none focus:ring-2 focus:ring-cyan-500/40"
                                style={{ borderColor: th.border2, background: th.bgCard, color: th.text }}
                                aria-label={lang === "ko" ? "상담 기록 제목" : lang === "ja" ? "相談履歴のタイトル" : "Consultation title"}
                              />
                              <div className="flex justify-end gap-1">
                                <button type="button" onClick={() => setEditingSessionId(null)} className="rounded px-1.5 py-0.5 text-[9px]" style={{ color: th.textMuted }}>
                                  {lang === "ko" ? "취소" : lang === "ja" ? "キャンセル" : "Cancel"}
                                </button>
                                <button
                                  type="button"
                                  disabled={updateSessionTitleMutation.isPending || !editingSessionTitle.trim()}
                                  onClick={async () => {
                                    try {
                                      const result = await updateSessionTitleMutation.mutateAsync({ sessionId: session.id, title: editingSessionTitle.trim() });
                                      if (!result.success) throw new Error("Session was not found");
                                      chatUtils.semiguard.getChatSessions.invalidate();
                                      setEditingSessionId(null);
                                      toast.success(lang === "ko" ? "상담 기록 제목을 수정했습니다." : lang === "ja" ? "相談履歴のタイトルを変更しました。" : "Consultation title updated.");
                                    } catch (error) {
                                      console.error("Failed to update consultation title:", error);
                                      toast.error(lang === "ko" ? "상담 기록 제목을 수정하지 못했습니다." : lang === "ja" ? "相談履歴のタイトルを変更できませんでした。" : "Could not update the consultation title.");
                                    }
                                  }}
                                  className="rounded bg-cyan-600 px-1.5 py-0.5 text-[9px] font-bold text-white disabled:opacity-45">
                                  {updateSessionTitleMutation.isPending ? "…" : (lang === "ko" ? "저장" : lang === "ja" ? "保存" : "Save")}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="font-bold truncate">{session.title}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {new Date(session.updatedAt).toLocaleString(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US")}
                                <span className="mx-1 opacity-50">·</span>
                                {session.messageCount}{lang === "ko" ? "개 메시지" : lang === "ja" ? "件のメッセージ" : " messages"}
                              </p>
                              {normalizedHistorySearch && (session as { matchedMessageExcerpt?: string | null }).matchedMessageExcerpt && (
                                <p className="mt-1 truncate text-[9px]" style={{ color: isDark ? "oklch(0.76 0.12 205)" : "oklch(0.44 0.13 205)" }} title={(session as { matchedMessageExcerpt?: string | null }).matchedMessageExcerpt ?? undefined}>
                                  🔎 {lang === "ko" ? "대화 일치:" : lang === "ja" ? "会話の一致:" : "Conversation match:"} {(session as { matchedMessageExcerpt?: string | null }).matchedMessageExcerpt}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={async (event) => {
                            event.stopPropagation();
                            try {
                              const result = await setChatSessionPinnedMutation.mutateAsync({ sessionId: session.id, isPinned: session.isPinned !== 1 });
                              if (!result.success) throw new Error("Session was not found");
                              chatUtils.semiguard.getChatSessions.invalidate();
                              toast.success(session.isPinned === 1
                                ? (lang === "ko" ? "상담 기록 고정을 해제했습니다." : lang === "ja" ? "相談履歴の固定を解除しました。" : "Consultation unpinned.")
                                : (lang === "ko" ? "상담 기록을 상단에 고정했습니다." : lang === "ja" ? "相談履歴を上部に固定しました。" : "Consultation pinned to the top."));
                            } catch (error) {
                              console.error("Failed to update consultation pin:", error);
                              toast.error(lang === "ko" ? "상담 기록 고정을 변경하지 못했습니다." : lang === "ja" ? "相談履歴の固定を変更できませんでした。" : "Could not update consultation pin.");
                            }
                          }}
                          disabled={setChatSessionPinnedMutation.isPending}
                          className={`p-1 text-xs transition-opacity hover:opacity-75 disabled:opacity-45 ${session.isPinned === 1 ? "text-amber-400" : "opacity-60"}`}
                          title={session.isPinned === 1 ? (lang === "ko" ? "상단 고정 해제" : lang === "ja" ? "上部固定を解除" : "Unpin") : (lang === "ko" ? "상단에 고정" : lang === "ja" ? "上部に固定" : "Pin to top")}
                          aria-label={session.isPinned === 1 ? (lang === "ko" ? "상담 기록 상단 고정 해제" : lang === "ja" ? "相談履歴の上部固定を解除" : "Unpin consultation") : (lang === "ko" ? "상담 기록 상단에 고정" : lang === "ja" ? "相談履歴を上部に固定" : "Pin consultation to top")}>
                          📌
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingSessionId(session.id);
                            setEditingSessionTitle(session.title);
                          }}
                          className="p-1 text-xs hover:opacity-75"
                          title={lang === "ko" ? "제목 수정" : lang === "ja" ? "タイトルを編集" : "Edit title"}
                          aria-label={lang === "ko" ? "상담 기록 제목 수정" : lang === "ja" ? "相談履歴のタイトルを編集" : "Edit consultation title"}>
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void exportChatSessionMarkdown(session);
                          }}
                          className="p-1 text-xs hover:opacity-75"
                          title={lang === "ko" ? "Markdown으로 내보내기" : lang === "ja" ? "Markdownでエクスポート" : "Export as Markdown"}
                          aria-label={lang === "ko" ? "상담 기록 Markdown 내보내기" : lang === "ja" ? "相談履歴をMarkdownでエクスポート" : "Export consultation history as Markdown"}>
                          ⬇️
                        </button>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm(lang === "ko" ? "이 상담 기록을 삭제하시겠습니까?" : lang === "ja" ? "この相談履歴を削除しますか？" : "Delete this consultation history?")) {
                              await deleteSessionMutation.mutateAsync({ sessionId: session.id });
                              chatUtils.semiguard.getChatSessions.invalidate();
                              if (activeSessionId === session.id) {
                                handleResetChat();
                              }
                            }
                          }}
                          className="text-red-400 hover:text-red-500 p-1 text-xs"
                          title={lang === "ko" ? "삭제" : lang === "ja" ? "削除" : "Delete"}
                          aria-label={lang === "ko" ? "상담 기록 삭제" : lang === "ja" ? "相談履歴を削除" : "Delete consultation history"}>
                          🗑️
                        </button>
                      </div>
                    ));
                    })()
                  ) : (
                    <p className="text-[11px] text-muted-foreground text-center py-6">
                      {lang === "ko" ? "저장된 상담 기록이 없습니다." : lang === "ja" ? "保存された相談履歴がありません。" : "No saved consultations."}
                    </p>
                  )}
                </div>
                {filteredAndSortedChatSessions.length > historySessionPageSize && (
                  <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2" style={{ borderColor: th.border }}>
                    <button
                      type="button"
                      onClick={() => setHistorySessionPage(Math.max(1, activeHistorySessionPage - 1))}
                      disabled={activeHistorySessionPage === 1}
                      className="rounded border px-2 py-1 text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-35"
                      style={{ borderColor: th.border2, color: th.textMuted }}
                      aria-label={lang === "ko" ? "상담 기록 이전 페이지" : lang === "ja" ? "相談履歴の前のページ" : "Previous consultation history page"}>
                      {lang === "ko" ? "이전" : lang === "ja" ? "前へ" : "Previous"}
                    </button>
                    <span className="text-[10px] font-medium" style={{ color: th.textMuted }}>
                      {activeHistorySessionPage} / {historySessionTotalPages}
                      <span className="ml-1 text-[9px]">({filteredAndSortedChatSessions.length}{lang === "ko" ? "건" : lang === "ja" ? "件" : ""})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setHistorySessionPage(Math.min(historySessionTotalPages, activeHistorySessionPage + 1))}
                      disabled={activeHistorySessionPage === historySessionTotalPages}
                      className="rounded border px-2 py-1 text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-35"
                      style={{ borderColor: th.border2, color: th.textMuted }}
                      aria-label={lang === "ko" ? "상담 기록 다음 페이지" : lang === "ja" ? "相談履歴の次のページ" : "Next consultation history page"}>
                      {lang === "ko" ? "다음" : lang === "ja" ? "次へ" : "Next"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 피드백·재생성 답변 히스토리 사이드 패널 */}
            {showFeedbackHistoryPanel && (
              <div className="absolute inset-0 z-[570] flex flex-col border p-3 shadow-2xl backdrop-blur-md animate-fadeIn sm:inset-x-auto sm:right-4 sm:top-14 sm:bottom-2 sm:w-80 sm:rounded-xl"
                style={{
                  background: isDark ? "oklch(0.14 0.02 240 / 0.95)" : "oklch(0.98 0.005 240 / 0.95)",
                  borderColor: "oklch(0.62 0.20 300 / 0.45)",
                  color: isDark ? "oklch(0.92 0.01 240)" : "oklch(0.12 0.01 240)",
                }}>
                <div className="flex items-start justify-between gap-2 pb-2 mb-2 border-b" style={{ borderColor: th.border }}>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold flex items-center gap-1.5">
                      ✨ {lang === "ko" ? "피드백·재생성 히스토리" : lang === "ja" ? "フィードバック・再生成履歴" : "Feedback & Regeneration History"}
                    </h4>
                    <p className="mt-0.5 text-[10px] leading-relaxed" style={{ color: th.textMuted }}>
                      {lang === "ko"
                        ? "남긴 평가와 사유, 그에 따라 다시 생성된 답변을 최신순으로 모아 봅니다."
                        : lang === "ja"
                          ? "残した評価と理由、それに応じて再生成された回答を新しい順に表示します。"
                          : "Your ratings, reasons, and the answers regenerated from them, newest first."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFeedbackHistoryPanel(false)}
                    className="shrink-0 text-xs text-muted-foreground hover:opacity-70"
                    aria-label={lang === "ko" ? "피드백 이력 닫기" : lang === "ja" ? "フィードバック履歴を閉じる" : "Close feedback history"}>
                    ✕
                  </button>
                </div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1 rounded-lg border p-1" style={{ borderColor: th.border2, background: th.bgCard }}>
                    {([
                      { id: "all", ko: "전체", ja: "すべて", en: "All", icon: "☷" },
                      { id: "like", ko: "긍정", ja: "肯定", en: "Positive", icon: "👍" },
                      { id: "dislike", ko: "부정", ja: "否定", en: "Negative", icon: "👎" },
                    ] as const).map(filter => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setFeedbackHistoryFilter(filter.id)}
                        className="rounded-md px-2 py-1 text-[9px] font-bold transition-all active:scale-95"
                        style={{
                          background: feedbackHistoryFilter === filter.id ? "oklch(0.62 0.20 300 / 0.20)" : "transparent",
                          color: feedbackHistoryFilter === filter.id ? (isDark ? "oklch(0.86 0.14 300)" : "oklch(0.42 0.20 300)") : th.textMuted,
                        }}>
                        {filter.icon} {lang === "ko" ? filter.ko : lang === "ja" ? filter.ja : filter.en}
                      </button>
                    ))}
                  </div>
                  {!!allFeedbackHistory.length && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={exportFilteredFeedbackCsv}
                        disabled={filteredFeedbackHistory.length === 0}
                        title={lang === "ko" ? "현재 필터 결과를 CSV로 내보내기" : lang === "ja" ? "現在のフィルター結果をCSVでエクスポート" : "Export current filtered results as CSV"}
                        className="rounded-lg border px-2 py-1 text-[9px] font-bold transition-all hover:opacity-80 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ borderColor: "oklch(0.65 0.18 200 / 0.40)", background: "oklch(0.65 0.18 200 / 0.10)", color: isDark ? "oklch(0.78 0.14 200)" : "oklch(0.42 0.17 200)" }}>
                        ⬇️ CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteAllFeedbackConfirm(true)}
                        className="rounded-lg border border-red-500/35 bg-red-500/10 px-2 py-1 text-[9px] font-bold text-red-400 transition-all hover:bg-red-500/20 active:scale-95">
                        🗑️ {lang === "ko" ? "전체 삭제" : lang === "ja" ? "すべて削除" : "Clear all"}
                      </button>
                    </div>
                  )}
                </div>
                <div className="relative mb-2">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px]">🔎</span>
                  <input
                    type="search"
                    value={feedbackHistorySearch}
                    onChange={event => setFeedbackHistorySearch(event.target.value)}
                    placeholder={lang === "ko" ? "답변·사유·재생성 내용 검색..." : lang === "ja" ? "回答・理由・再生成内容を検索..." : "Search answers, reasons, or regenerations..."}
                    className="w-full rounded-lg border py-1.5 pl-7 pr-7 text-[10px] outline-none transition-all focus:ring-1 focus:ring-fuchsia-500"
                    style={{ background: th.bgCard, borderColor: th.border2, color: th.text }}
                  />
                  {feedbackHistorySearch && (
                    <button
                      type="button"
                      onClick={() => setFeedbackHistorySearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[10px] transition-opacity hover:opacity-70"
                      style={{ color: th.textMuted }}
                      aria-label="Clear search">
                      ✕
                    </button>
                  )}
                </div>
                <div className="mb-2 grid grid-cols-2 gap-1.5">
                  <label className="min-w-0">
                    <span className="mb-0.5 block text-[9px] font-bold" style={{ color: th.textMuted }}>{lang === "ko" ? "시작일" : lang === "ja" ? "開始日" : "From"}</span>
                    <input
                      type="date"
                      value={feedbackHistoryStartDate}
                      max={feedbackHistoryEndDate || undefined}
                      onChange={event => setFeedbackHistoryStartDate(event.target.value)}
                      className="w-full rounded-lg border px-1.5 py-1 text-[10px] outline-none focus:ring-1 focus:ring-fuchsia-500"
                      style={{ background: th.bgCard, borderColor: th.border2, color: th.text }}
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="mb-0.5 block text-[9px] font-bold" style={{ color: th.textMuted }}>{lang === "ko" ? "종료일" : lang === "ja" ? "終了日" : "To"}</span>
                    <input
                      type="date"
                      value={feedbackHistoryEndDate}
                      min={feedbackHistoryStartDate || undefined}
                      onChange={event => setFeedbackHistoryEndDate(event.target.value)}
                      className="w-full rounded-lg border px-1.5 py-1 text-[10px] outline-none focus:ring-1 focus:ring-fuchsia-500"
                      style={{ background: th.bgCard, borderColor: th.border2, color: th.text }}
                    />
                  </label>
                </div>
                <div className="mb-2 flex items-center gap-1.5">
                  <select
                    value={feedbackHistorySort}
                    onChange={event => setFeedbackHistorySort(event.target.value as "newest" | "oldest")}
                    className="min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-fuchsia-500"
                    style={{ background: th.bgCard, borderColor: th.border2, color: th.text }}>
                    <option value="newest">{lang === "ko" ? "정렬: 최신순" : lang === "ja" ? "並び順: 新しい順" : "Sort: Newest first"}</option>
                    <option value="oldest">{lang === "ko" ? "정렬: 과거순" : lang === "ja" ? "並び順: 古い順" : "Sort: Oldest first"}</option>
                  </select>
                  {(feedbackHistoryStartDate || feedbackHistoryEndDate) && (
                    <button
                      type="button"
                      onClick={() => { setFeedbackHistoryStartDate(""); setFeedbackHistoryEndDate(""); }}
                      title={lang === "ko" ? "날짜 필터 초기화" : lang === "ja" ? "日付フィルターをリセット" : "Reset date filter"}
                      className="rounded-lg border px-2 py-1.5 text-[10px] font-bold transition-all hover:opacity-80"
                      style={{ borderColor: th.border2, color: th.textMuted }}>
                      ↺
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void analyzeCurrentFeedbackKeywords()}
                    disabled={sortedFeedbackHistory.length === 0 || analyzeFeedbackKeywordsMutation.isPending}
                    className="rounded-lg border px-2 py-1.5 text-[10px] font-bold transition-all hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ borderColor: "oklch(0.72 0.15 75 / 0.45)", background: "oklch(0.72 0.15 75 / 0.12)", color: isDark ? "oklch(0.86 0.14 80)" : "oklch(0.46 0.16 75)" }}>
                    {analyzeFeedbackKeywordsMutation.isPending ? "✨…" : `✨ ${lang === "ko" ? "AI 키워드" : lang === "ja" ? "AIキーワード" : "AI keywords"}`}
                  </button>
                </div>
                {!feedbackHistoryQuery.isLoading && allFeedbackHistory.length > 0 && (
                  <div className="mb-2 rounded-xl border p-2" style={{ borderColor: th.border2, background: isDark ? "oklch(0.16 0.02 240)" : "oklch(0.97 0.006 240)" }}>
                    <div className="mb-1.5 flex items-center justify-between text-[9px] font-bold" style={{ color: th.textMuted }}>
                      <span>{lang === "ko" ? "전체 피드백 평가 요약" : lang === "ja" ? "全フィードバック評価の要約" : "All feedback summary"}</span>
                      <span>{allFeedbackHistory.length}{lang === "ko" ? "건" : lang === "ja" ? "件" : " total"}</span>
                    </div>
                    <div className="flex h-2.5 overflow-hidden rounded-full shadow-inner" style={{ background: "oklch(0.60 0.05 240 / 0.18)" }}>
                      <div className="h-full transition-[width] duration-700 ease-out" style={{ width: `${animatedPositiveRatio}%`, background: "linear-gradient(90deg, oklch(0.60 0.19 145), oklch(0.76 0.18 145))" }} />
                      <div className="h-full transition-[width] duration-700 ease-out" style={{ width: `${allFeedbackHistory.length ? 100 - animatedPositiveRatio : 0}%`, background: "linear-gradient(90deg, oklch(0.78 0.16 35), oklch(0.60 0.20 20))" }} />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[9px]">
                      <span className="font-bold" style={{ color: "oklch(0.70 0.18 145)" }}>👍 {lang === "ko" ? "긍정" : lang === "ja" ? "肯定" : "Positive"} {positiveFeedbackCount} ({animatedPositiveRatio}%)</span>
                      <span className="font-bold" style={{ color: "oklch(0.65 0.20 20)" }}>👎 {lang === "ko" ? "부정" : lang === "ja" ? "否定" : "Negative"} {negativeFeedbackCount} ({allFeedbackHistory.length ? 100 - animatedPositiveRatio : 0}%)</span>
                    </div>
                  </div>
                )}
                {feedbackKeywordSummary && (
                  <div className="mb-2 rounded-xl border p-2.5 animate-fadeIn" style={{ borderColor: "oklch(0.72 0.15 75 / 0.45)", background: "oklch(0.72 0.15 75 / 0.09)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold" style={{ color: isDark ? "oklch(0.86 0.14 80)" : "oklch(0.46 0.16 75)" }}>
                        {feedbackKeywordSummary.mode === "ai" ? "✨" : "🔎"} {feedbackKeywordSummary.mode === "ai"
                          ? (lang === "ko" ? "AI 핵심 키워드 요약" : lang === "ja" ? "AI主要キーワード要約" : "AI key-term summary")
                          : (lang === "ko" ? "기본 핵심 키워드 분석" : lang === "ja" ? "基本キーワード分析" : "Basic key-term analysis")}
                      </p>
                      <button type="button" onClick={() => setFeedbackKeywordSummary(null)} className="text-[10px] hover:opacity-70" style={{ color: th.textMuted }} aria-label="Close">✕</button>
                    </div>
                    {feedbackKeywordSummary.keywords.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {feedbackKeywordSummary.keywords.map((keyword, index) => (
                          <span key={`${keyword}-${index}`} className="rounded-full border px-1.5 py-0.5 text-[9px] font-bold" style={{ borderColor: "oklch(0.72 0.15 75 / 0.38)", color: isDark ? "oklch(0.86 0.14 80)" : "oklch(0.46 0.16 75)" }}>
                            #{keyword}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-[10px] leading-relaxed" style={{ color: th.text }}>{feedbackKeywordSummary.summary}</p>
                    {feedbackKeywordSummary.improvement && (
                      <p className="mt-1.5 border-t pt-1.5 text-[10px] leading-relaxed" style={{ borderColor: th.border2, color: th.textMuted }}>
                        <strong style={{ color: th.text }}>{lang === "ko" ? "개선 방향" : lang === "ja" ? "改善方向" : "Improvement"}:</strong> {feedbackKeywordSummary.improvement}
                      </p>
                    )}
                  </div>
                )}
                {feedbackToDelete !== null && (
                  <div className="absolute inset-0 z-[590] flex flex-col items-center justify-center rounded-xl bg-black/80 p-4 text-center backdrop-blur-md animate-fadeIn">
                    <p className="text-xs font-bold text-red-300">
                      ⚠️ {lang === "ko" ? "이 피드백 기록을 삭제할까요?" : lang === "ja" ? "このフィードバック履歴を削除しますか？" : "Delete this feedback record?"}
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                      {lang === "ko" ? "연결된 재생성 답변도 함께 삭제되며 되돌릴 수 없습니다." : lang === "ja" ? "関連する再生成回答も一緒に削除され、元に戻せません。" : "Its linked regenerated answer will also be removed permanently."}
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <button type="button" onClick={() => setFeedbackToDelete(null)} className="rounded-lg border px-3 py-1.5 text-xs font-bold" style={{ borderColor: th.border2, color: th.textMuted }}>
                        {lang === "ko" ? "취소" : lang === "ja" ? "キャンセル" : "Cancel"}
                      </button>
                      <button
                        type="button"
                        disabled={deleteChatFeedbackMutation.isPending}
                        onClick={async () => {
                          try {
                            const result = await deleteChatFeedbackMutation.mutateAsync({ feedbackId: feedbackToDelete });
                            if (result.deleted) {
                              toast.success(lang === "ko" ? "피드백 기록을 삭제했습니다." : lang === "ja" ? "フィードバック履歴を削除しました。" : "Feedback record deleted.");
                              chatUtils.semiguard.getFeedbackHistory.invalidate();
                            }
                          } catch (error) {
                            console.error("Failed to delete feedback:", error);
                            toast.error(lang === "ko" ? "피드백 기록을 삭제하지 못했습니다." : lang === "ja" ? "フィードバック履歴を削除できませんでした。" : "Could not delete feedback record.");
                          } finally {
                            setFeedbackToDelete(null);
                          }
                        }}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                        {deleteChatFeedbackMutation.isPending ? (lang === "ko" ? "삭제 중" : lang === "ja" ? "削除中" : "Deleting") : (lang === "ko" ? "삭제" : lang === "ja" ? "削除" : "Delete")}
                      </button>
                    </div>
                  </div>
                )}
                {feedbackContextItem && (
                  <div className="absolute inset-0 z-[600] flex flex-col rounded-xl bg-black/80 p-3 backdrop-blur-md animate-fadeIn" role="dialog" aria-modal="true" aria-label={lang === "ko" ? "피드백 상담 맥락" : lang === "ja" ? "フィードバックの会話文脈" : "Feedback conversation context"}>
                    <div className="flex items-start justify-between gap-3 border-b pb-2" style={{ borderColor: th.border2 }}>
                      <div>
                        <h5 className="text-xs font-bold" style={{ color: th.text }}>
                          💬 {lang === "ko" ? "피드백 상담 맥락" : lang === "ja" ? "フィードバックの会話文脈" : "Feedback conversation context"}
                        </h5>
                        <p className="mt-0.5 text-[9px] leading-relaxed" style={{ color: th.textMuted }}>
                          {lang === "ko" ? "평가한 답변은 강조 표시됩니다. 현재 사용자 소유 세션의 메시지만 표시합니다." : lang === "ja" ? "評価した回答は強調表示されます。現在のユーザー所有セッションのメッセージのみ表示します。" : "The rated response is highlighted. Only messages from your current-user-owned session are shown."}
                        </p>
                      </div>
                      <button type="button" onClick={() => setFeedbackContextItem(null)} className="shrink-0 rounded-md border px-2 py-1 text-[10px] font-bold transition-opacity hover:opacity-70" style={{ borderColor: th.border2, color: th.textMuted }} aria-label={lang === "ko" ? "상담 맥락 닫기" : lang === "ja" ? "会話文脈を閉じる" : "Close conversation context"}>✕</button>
                    </div>
                    <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                      {feedbackContextMessagesQuery.isLoading ? (
                        <div className="flex items-center justify-center gap-2 py-8 text-[10px]" style={{ color: th.textMuted }}>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-fuchsia-400 border-t-transparent" />
                          {lang === "ko" ? "상담 맥락을 불러오는 중..." : lang === "ja" ? "会話文脈を読み込み中..." : "Loading conversation context..."}
                        </div>
                      ) : feedbackContextMessagesQuery.isError ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-[10px]" style={{ color: th.textMuted }}>
                          <span className="text-base">⚠️</span>
                          <p>{lang === "ko" ? "상담 맥락을 불러오지 못했습니다." : lang === "ja" ? "会話文脈を読み込めませんでした。" : "Could not load the conversation context."}</p>
                          <button type="button" onClick={() => void feedbackContextMessagesQuery.refetch()} disabled={feedbackContextMessagesQuery.isFetching} className="rounded-lg border px-2.5 py-1 text-[10px] font-bold disabled:opacity-45" style={{ borderColor: "oklch(0.62 0.20 300 / 0.45)", color: isDark ? "oklch(0.82 0.16 300)" : "oklch(0.45 0.20 300)" }}>
                            ↻ {feedbackContextMessagesQuery.isFetching ? (lang === "ko" ? "다시 불러오는 중..." : lang === "ja" ? "再読み込み中..." : "Retrying...") : (lang === "ko" ? "다시 시도" : lang === "ja" ? "再試行" : "Retry")}
                          </button>
                        </div>
                      ) : feedbackContextMessagesQuery.data && feedbackContextMessagesQuery.data.length > 0 ? (
                        feedbackContextMessagesQuery.data.map(message => {
                          const isRatedAnswer = (feedbackContextItem.messageId !== null && message.id === feedbackContextItem.messageId)
                            || (message.role === "assistant" && message.content === feedbackContextItem.messageContent);
                          return (
                            <div key={message.id} className="rounded-lg border p-2 text-[10px] leading-relaxed" style={{ borderColor: isRatedAnswer ? "oklch(0.72 0.18 300 / 0.72)" : th.border2, background: isRatedAnswer ? "oklch(0.62 0.20 300 / 0.12)" : message.role === "user" ? "oklch(0.65 0.18 200 / 0.10)" : th.bgCard }}>
                              <div className="mb-1 flex items-center justify-between gap-2 text-[9px] font-bold" style={{ color: isRatedAnswer ? (isDark ? "oklch(0.84 0.16 300)" : "oklch(0.45 0.20 300)") : th.textMuted }}>
                                <span>{message.role === "user" ? (lang === "ko" ? "사용자" : lang === "ja" ? "ユーザー" : "User") : "SemiGuard AI"}{isRatedAnswer ? ` · ${lang === "ko" ? "평가한 답변" : lang === "ja" ? "評価した回答" : "Rated response"}` : ""}</span>
                                <span>{new Date(message.createdAt).toLocaleString(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                              <p className="whitespace-pre-wrap" style={{ color: th.text }}>{message.content}</p>
                            </div>
                          );
                        })
                      ) : (
                        <p className="py-8 text-center text-[10px] leading-relaxed" style={{ color: th.textMuted }}>
                          {lang === "ko" ? "보거나 접근할 수 있는 저장된 상담 메시지가 없습니다." : lang === "ja" ? "表示またはアクセスできる保存済み会話メッセージがありません。" : "There are no saved consultation messages available to view."}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {showDeleteAllFeedbackConfirm && (
                  <div className="absolute inset-0 z-[590] flex flex-col items-center justify-center rounded-xl bg-black/80 p-4 text-center backdrop-blur-md animate-fadeIn">
                    <p className="text-xs font-bold text-red-300">
                      ⚠️ {lang === "ko" ? "모든 피드백 기록을 삭제할까요?" : lang === "ja" ? "すべてのフィードバック履歴を削除しますか？" : "Delete all feedback records?"}
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                      {lang === "ko" ? "좋아요·아쉬워요·사유와 재생성 답변을 포함한 모든 피드백 기록이 영구 삭제됩니다." : lang === "ja" ? "いいね・イマイチ・理由・再生成回答を含むすべての履歴が完全に削除されます。" : "All ratings, reasons, and regenerated answers will be permanently deleted."}
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <button type="button" onClick={() => setShowDeleteAllFeedbackConfirm(false)} className="rounded-lg border px-3 py-1.5 text-xs font-bold" style={{ borderColor: th.border2, color: th.textMuted }}>
                        {lang === "ko" ? "취소" : lang === "ja" ? "キャンセル" : "Cancel"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDeleteAllFeedbackConfirm(false);
                          setShowDeleteAllFeedbackFinalConfirm(true);
                        }}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white">
                        {lang === "ko" ? "다음 확인" : lang === "ja" ? "次の確認" : "Continue"}
                      </button>
                    </div>
                  </div>
                )}
                {showDeleteAllFeedbackFinalConfirm && (
                  <div className="absolute inset-0 z-[595] flex flex-col items-center justify-center rounded-xl bg-black/90 p-4 text-center backdrop-blur-md animate-fadeIn">
                    <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-red-500/20 text-lg">🛑</span>
                    <p className="text-xs font-bold text-red-300">
                      {lang === "ko" ? "최종 확인: 모든 피드백을 영구 삭제할까요?" : lang === "ja" ? "最終確認：すべてのフィードバックを完全に削除しますか？" : "Final confirmation: permanently delete all feedback?"}
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                      {lang === "ko" ? "이 동작은 취소할 수 없습니다. 계속하려면 아래 '영구 삭제'를 눌러주세요." : lang === "ja" ? "この操作は取り消せません。続行するには下の「完全に削除」を押してください。" : "This cannot be undone. Press 'Delete permanently' below to continue."}
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <button type="button" onClick={() => setShowDeleteAllFeedbackFinalConfirm(false)} className="rounded-lg border px-3 py-1.5 text-xs font-bold" style={{ borderColor: th.border2, color: th.textMuted }}>
                        {lang === "ko" ? "취소" : lang === "ja" ? "キャンセル" : "Cancel"}
                      </button>
                      <button
                        type="button"
                        disabled={deleteAllChatFeedbacksMutation.isPending}
                        onClick={async () => {
                          try {
                            const result = await deleteAllChatFeedbacksMutation.mutateAsync();
                            toast.success(lang === "ko" ? `${result.deletedCount}개 피드백 기록을 삭제했습니다.` : lang === "ja" ? `${result.deletedCount}件のフィードバック履歴を削除しました。` : `Deleted ${result.deletedCount} feedback records.`);
                            chatUtils.semiguard.getFeedbackHistory.invalidate();
                            setFeedbackHistoryFilter("all");
                          } catch (error) {
                            console.error("Failed to delete all feedback:", error);
                            toast.error(lang === "ko" ? "전체 피드백 기록을 삭제하지 못했습니다." : lang === "ja" ? "すべてのフィードバック履歴を削除できませんでした。" : "Could not delete all feedback records.");
                          } finally {
                            setShowDeleteAllFeedbackFinalConfirm(false);
                          }
                        }}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                        {deleteAllChatFeedbacksMutation.isPending ? (lang === "ko" ? "삭제 중" : lang === "ja" ? "削除中" : "Deleting") : (lang === "ko" ? "영구 삭제" : lang === "ja" ? "完全に削除" : "Delete permanently")}
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {feedbackHistoryQuery.isLoading ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                      <div className="w-4 h-4 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>{lang === "ko" ? "피드백 이력 불러오는 중..." : lang === "ja" ? "フィードバック履歴を読み込み中..." : "Loading feedback history..."}</span>
                    </div>
                  ) : feedbackHistoryQuery.isError ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-[11px]" style={{ color: th.textMuted }}>
                      <span className="text-base">⚠️</span>
                      <p>{lang === "ko" ? "피드백 이력을 불러오지 못했습니다." : lang === "ja" ? "フィードバック履歴を読み込めませんでした。" : "Could not load feedback history."}</p>
                      <button type="button" onClick={() => void feedbackHistoryQuery.refetch()} disabled={feedbackHistoryQuery.isFetching} className="rounded-lg border px-2.5 py-1 text-[10px] font-bold disabled:opacity-45" style={{ borderColor: "oklch(0.62 0.20 300 / 0.45)", color: isDark ? "oklch(0.82 0.16 300)" : "oklch(0.45 0.20 300)" }}>
                        ↻ {feedbackHistoryQuery.isFetching ? (lang === "ko" ? "다시 불러오는 중..." : lang === "ja" ? "再読み込み中..." : "Retrying...") : (lang === "ko" ? "다시 시도" : lang === "ja" ? "再試行" : "Retry")}
                      </button>
                    </div>
                  ) : paginatedFeedbackHistory.length > 0 ? (
                    paginatedFeedbackHistory.map(item => {
                      const reasonLabelMap: Record<string, { ko: string; ja: string; en: string }> = {
                        inaccurate: { ko: "정확하지 않음", ja: "正確ではない", en: "Inaccurate" },
                        insufficient: { ko: "설명 및 근거 부족", ja: "説明・根拠が不足", en: "Insufficient details" },
                        irrelevant: { ko: "질문과 관련 없음", ja: "質問と関係ない", en: "Irrelevant" },
                        other: { ko: "기타 사유", ja: "その他", en: "Other" },
                      };
                      const reasonLabel = item.reasonCode ? reasonLabelMap[item.reasonCode] : undefined;
                      const isLike = item.feedbackType === "like";
                      return (
                        <div key={item.id} className="rounded-xl border p-2.5 transition-all hover:-translate-y-0.5 hover:shadow-md"
                          style={{ borderColor: th.border2, background: isDark ? "oklch(0.17 0.015 240)" : "oklch(0.99 0.003 240)" }}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                              style={{
                                background: isLike ? "oklch(0.65 0.20 145 / 0.15)" : "oklch(0.60 0.20 20 / 0.15)",
                                color: isLike ? "oklch(0.70 0.18 145)" : "oklch(0.65 0.20 20)",
                                border: `1px solid ${isLike ? "oklch(0.65 0.20 145 / 0.35)" : "oklch(0.60 0.20 20 / 0.35)"}`,
                              }}>
                              {isLike
                                ? `👍 ${lang === "ko" ? "좋아요" : lang === "ja" ? "いいね" : "Helpful"}`
                                : `👎 ${lang === "ko" ? "아쉬워요" : lang === "ja" ? "イマイチ" : "Not helpful"}`}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px]" style={{ color: th.textMuted }}>
                                {new Date(item.createdAt).toLocaleString(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <button
                                type="button"
                                onClick={() => setFeedbackToDelete(item.id)}
                                title={lang === "ko" ? "이 피드백 삭제" : lang === "ja" ? "このフィードバックを削除" : "Delete feedback"}
                                className="rounded p-0.5 text-[10px] text-red-400 transition-all hover:bg-red-500/15 hover:text-red-300 active:scale-95">
                                🗑️
                              </button>
                            </div>
                          </div>
                          {reasonLabel && (
                            <p className="mt-1.5 text-[10px] font-bold" style={{ color: isDark ? "oklch(0.82 0.16 300)" : "oklch(0.45 0.20 300)" }}>
                              {lang === "ko" ? "사유" : lang === "ja" ? "理由" : "Reason"}: {lang === "ko" ? reasonLabel.ko : lang === "ja" ? reasonLabel.ja : reasonLabel.en}
                            </p>
                          )}
                          {item.reasonText && (
                            <p className="mt-1 text-[10px] leading-relaxed line-clamp-3" style={{ color: th.textMuted }}>
                              “{item.reasonText}”
                            </p>
                          )}
                          <p className="mt-1.5 text-[10px] leading-relaxed line-clamp-3" style={{ color: th.text }}>
                            {lang === "ko" ? "평가한 답변" : lang === "ja" ? "評価した回答" : "Rated answer"}: {item.messageContent.slice(0, 160)}
                            {item.messageContent.length > 160 ? "..." : ""}
                          </p>
                          <button
                            type="button"
                            onClick={() => setFeedbackContextItem({ id: item.id, sessionId: item.sessionId, messageId: item.messageId ?? null, messageContent: item.messageContent })}
                            className="mt-2 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-bold transition-all hover:opacity-85 active:scale-95"
                            style={{ borderColor: "oklch(0.62 0.20 300 / 0.45)", background: "oklch(0.62 0.20 300 / 0.10)", color: isDark ? "oklch(0.82 0.16 300)" : "oklch(0.45 0.20 300)" }}>
                            💬 {lang === "ko" ? "상담 맥락 보기" : lang === "ja" ? "会話文脈を見る" : "View context"}
                          </button>
                          {item.regeneratedContent ? (
                            <div className="mt-2 rounded-lg border p-2"
                              style={{ borderColor: "oklch(0.65 0.18 200 / 0.35)", background: "oklch(0.65 0.18 200 / 0.10)" }}>
                              <p className="text-[9px] font-bold" style={{ color: "oklch(0.70 0.18 200)" }}>
                                ✨ {lang === "ko" ? "피드백 반영 재생성 답변" : lang === "ja" ? "フィードバック反映の再生成回答" : "Regenerated with feedback"}
                              </p>
                              <p className="mt-1 text-[10px] leading-relaxed line-clamp-4" style={{ color: th.text }}>
                                {item.regeneratedContent.slice(0, 220)}
                                {item.regeneratedContent.length > 220 ? "..." : ""}
                              </p>
                            </div>
                          ) : (
                            !isLike && (
                              <p className="mt-2 text-[9px]" style={{ color: th.textMuted }}>
                                {lang === "ko" ? "아직 재생성된 답변이 없습니다." : lang === "ja" ? "まだ再生成された回答はありません。" : "No regenerated answer yet."}
                              </p>
                            )
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="py-8 text-center text-[11px] text-muted-foreground leading-relaxed">
                      {feedbackHistoryQuery.data && feedbackHistoryQuery.data.length > 0
                        ? (lang === "ko" ? "선택한 평가 유형의 피드백 기록이 없습니다." : lang === "ja" ? "選択した評価タイプのフィードバック履歴はありません。" : "No feedback records match this filter.")
                        : (lang === "ko"
                          ? "저장된 피드백 이력이 없습니다. AI 답변에 좋아요·아쉬워요를 남기면 여기에 모입니다."
                          : lang === "ja"
                          ? "保存されたフィードバック履歴がありません。AIの回答に評価を残すとここに表示されます。"
                            : "No feedback yet. Rate an AI answer and it will appear here.")}
                    </p>
                  )}
                  {filteredFeedbackHistory.length > FEEDBACK_PAGE_SIZE && (
                    <div className="flex items-center justify-between gap-2 border-t pt-2" style={{ borderColor: th.border2 }}>
                      <button
                        type="button"
                        onClick={() => setFeedbackHistoryPage(page => Math.max(1, page - 1))}
                        disabled={feedbackHistoryPage === 1}
                        className="rounded-md border px-2 py-1 text-[9px] font-bold disabled:opacity-35"
                        style={{ borderColor: th.border2, color: th.textMuted }}>
                        ← {lang === "ko" ? "이전" : lang === "ja" ? "前へ" : "Prev"}
                      </button>
                      <span className="text-[9px] font-bold" style={{ color: th.textMuted }}>
                        {feedbackHistoryPage} / {feedbackHistoryTotalPages} · {filteredFeedbackHistory.length}{lang === "ko" ? "건" : lang === "ja" ? "件" : " items"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFeedbackHistoryPage(page => Math.min(feedbackHistoryTotalPages, page + 1))}
                        disabled={feedbackHistoryPage === feedbackHistoryTotalPages}
                        className="rounded-md border px-2 py-1 text-[9px] font-bold disabled:opacity-35"
                        style={{ borderColor: th.border2, color: th.textMuted }}>
                        {lang === "ko" ? "다음" : lang === "ja" ? "次へ" : "Next"} →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 대화 메시지 영역 */}
            <div className="min-h-0 flex-1 overflow-y-auto space-y-3 p-3 sm:p-4 custom-scrollbar">
              {/* 여기서부터 메시지 목록 */}
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex items-end gap-1.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role !== "user" && (
                    <span className="text-[9px] text-muted-foreground pb-1 shrink-0">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <div className="min-w-0 max-w-[88%] flex flex-col gap-1.5 sm:max-w-[80%]">
                    <div
                      className={`rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                        msg.role === "user" ? "rounded-tr-none" : "rounded-tl-none border"
                      }`}
                      style={
                        msg.role === "user"
                          ? { background: "oklch(0.65 0.18 200)", color: "white" }
                          : {
                              background: isDark ? "oklch(0.17 0.015 240)" : "oklch(0.95 0.005 240)",
                              borderColor: th.border2,
                              color: isDark ? "oklch(0.90 0.01 240)" : "oklch(0.15 0.01 240)",
                            }
                      }>
                      {msg.feedbackApplied && (
                        <div className="mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
                          style={{ background: "oklch(0.65 0.18 200 / 0.14)", color: "oklch(0.68 0.18 200)", border: "1px solid oklch(0.65 0.18 200 / 0.30)" }}>
                          ✨ {lang === "ko" ? "피드백이 반영된 답변입니다" : lang === "ja" ? "フィードバックを反映した回答です" : "Feedback-informed response"}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      {msg.role === "assistant" && msg.recoveryPrompt && (
                        <button
                          type="button"
                          onClick={() => void handleSendChatMessage(msg.recoveryPrompt)}
                          disabled={isChatLoading}
                          className="mt-3 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition-all hover:opacity-85 disabled:opacity-45"
                          style={{ borderColor: "oklch(0.65 0.18 200 / 0.45)", background: "oklch(0.65 0.18 200 / 0.12)", color: isDark ? "oklch(0.78 0.14 200)" : "oklch(0.42 0.16 220)" }}>
                          ↻ {lang === "ko" ? "같은 질문 다시 시도" : lang === "ja" ? "同じ質問をもう一度試す" : "Try the same question again"}
                        </button>
                      )}
                      {msg.role === "assistant" && msg.manualSources && msg.manualSources.length > 0 && (
                        <div className="mt-3 border-t pt-2" style={{ borderColor: th.border2 }}>
                          <p className="mb-1.5 text-[9px] font-bold" style={{ color: th.textMuted }}>
                            📘 {lang === "ko" ? "참고한 설비 매뉴얼 출처 (클릭하면 원문 확인)" : lang === "ja" ? "参照した設備マニュアル出典（クリックで原文確認）" : "Referenced manual sources (click to view original)"}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.manualSources.map(source => (
                              <button
                                key={`${source.documentId}-${source.chunkIndex}`}
                                type="button"
                                onClick={() => setActiveManualSource(source)}
                                title={source.content.slice(0, 120)}
                                className="max-w-[200px] truncate rounded-full border px-2 py-0.5 text-[9px] font-bold transition-all hover:opacity-80 active:scale-95"
                                style={{ borderColor: "oklch(0.72 0.15 75 / 0.45)", background: "oklch(0.72 0.15 75 / 0.12)", color: isDark ? "oklch(0.86 0.14 80)" : "oklch(0.42 0.16 75)" }}>
                                [{source.label}] {source.documentTitle} · {lang === "ko" ? `구간 ${source.chunkIndex + 1}` : lang === "ja" ? `区間 ${source.chunkIndex + 1}` : `Chunk ${source.chunkIndex + 1}`}{typeof source.relevanceScore === "number" ? ` · ${source.relevanceScore}%` : ""}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-2 pl-1">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(msg.content);
                              setCopiedIndex(idx);
                              setTimeout(() => setCopiedIndex(null), 2000);
                            } catch (err) {
                              console.error("Clipboard write failed:", err);
                            }
                          }}
                          className="px-2 py-0.5 rounded text-[10px] border transition-all flex items-center gap-1 opacity-70 hover:opacity-100 shadow-sm"
                          style={{ background: th.bgCard, borderColor: th.border2, color: th.textMuted }}>
                          <span>{copiedIndex === idx ? "✅" : "📋"}</span>
                          <span>{copiedIndex === idx ? (lang === "ko" ? "복사됨" : lang === "ja" ? "コピー済" : "Copied") : (lang === "ko" ? "복사" : lang === "ja" ? "コピー" : "Copy")}</span>
                        </button>
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (messageFeedbacks[idx] === "like") {
                                setMessageFeedbacks(previous => {
                                  const next = { ...previous };
                                  delete next[idx];
                                  return next;
                                });
                                return;
                              }
                              void persistChatFeedback(idx, "like");
                            }}
                            title={lang === "ko" ? "좋아요" : lang === "ja" ? "いいね" : "Helpful"}
                            className={`px-1.5 py-0.5 rounded text-[10px] border transition-all ${
                              messageFeedbacks[idx] === "like" ? "bg-emerald-500/20 border-emerald-500 text-emerald-500 font-bold" : "opacity-60 hover:opacity-100"
                            }`}
                            style={{ borderColor: messageFeedbacks[idx] === "like" ? undefined : th.border2, background: messageFeedbacks[idx] === "like" ? undefined : th.bgCard, color: messageFeedbacks[idx] === "like" ? undefined : th.textMuted }}>
                            👍 {messageFeedbacks[idx] === "like" && "1"}
                          </button>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                const nextState = messageFeedbacks[idx] === "dislike" ? undefined : "dislike";
                                setMessageFeedbacks(prev => ({
                                  ...prev,
                                  [idx]: nextState as any,
                                }));
                                if (nextState === "dislike") {
                                  setActiveDislikeIdx(idx);
                                } else {
                                  setActiveDislikeIdx(null);
                                  setMessageReasons(prev => {
                                    const copy = { ...prev };
                                    delete copy[idx];
                                    return copy;
                                  });
                                }
                              }}
                              title={lang === "ko" ? "아쉬워요" : lang === "ja" ? "イマイチ" : "Not helpful"}
                              className={`px-1.5 py-0.5 rounded text-[10px] border transition-all ${
                                messageFeedbacks[idx] === "dislike" ? "bg-rose-500/20 border-rose-500 text-rose-500 font-bold" : "opacity-60 hover:opacity-100"
                              }`}
                              style={{ borderColor: messageFeedbacks[idx] === "dislike" ? undefined : th.border2, background: messageFeedbacks[idx] === "dislike" ? undefined : th.bgCard, color: messageFeedbacks[idx] === "dislike" ? undefined : th.textMuted }}>
                              👎 {messageFeedbacks[idx] === "dislike" && "1"}
                            </button>

                            {/* 싫어요 사유 선택 소형 팝업 */}
                            {activeDislikeIdx === idx && (
                              <div className="absolute left-0 bottom-full mb-2 z-50 w-64 p-2.5 rounded-xl shadow-xl border animate-fadeIn"
                                style={{ background: isDark ? "oklch(0.15 0.02 240)" : "oklch(0.98 0.005 240)", borderColor: th.border2 }}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-bold" style={{ color: th.text }}>
                                    {lang === "ko" ? "어떤 점이 아쉬우셨나요?" : lang === "ja" ? "どの点が物足りなかったですか？" : "What was missing?"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setActiveDislikeIdx(null)}
                                    className="text-[10px] hover:opacity-70 px-1" style={{ color: th.textMuted }}>
                                    ✕
                                  </button>
                                </div>
                                <div className="flex flex-col gap-1">
                                  {[
                                    { id: "inaccurate", ko: "정확하지 않음", ja: "正確ではない", en: "Inaccurate" },
                                    { id: "insufficient", ko: "설명 및 근거 부족", ja: "説明・根拠が不足", en: "Insufficient details" },
                                    { id: "irrelevant", ko: "질문과 관련 없음", ja: "質問と関係ない", en: "Irrelevant" },
                                    { id: "other", ko: "기타 사유", ja: "その他", en: "Other" },
                                  ].map((reasonItem) => (
                                    <button
                                      key={reasonItem.id}
                                      type="button"
                                      onClick={() => {
                                        const label = lang === "ko" ? reasonItem.ko : lang === "ja" ? reasonItem.ja : reasonItem.en;
                                        if (reasonItem.id === "other") {
                                          setOtherReasonIdx(idx);
                                          setOtherFeedbackText("");
                                          return;
                                        }
                                        void persistChatFeedback(idx, "dislike", reasonItem.id as "inaccurate" | "insufficient" | "irrelevant", label);
                                        setOtherReasonIdx(null);
                                        setActiveDislikeIdx(null);
                                        toast.success(lang === "ko"
                                          ? "피드백이 반영되었습니다. 아래 버튼으로 답변을 다시 생성할 수 있습니다."
                                          : lang === "ja"
                                            ? "フィードバックを反映しました。下のボタンから回答を再生成できます。"
                                            : "Feedback saved. You can regenerate the answer below.");
                                      }}
                                      className={`text-left px-2 py-1 rounded text-[10px] border transition-all ${
                                        messageReasons[idx] === (lang === "ko" ? reasonItem.ko : lang === "ja" ? reasonItem.ja : reasonItem.en)
                                          ? "bg-rose-500/20 border-rose-500 font-bold"
                                          : "hover:opacity-80"
                                      }`}
                                      style={{ borderColor: th.border2, background: th.bgCard, color: th.text }}>
                                      {lang === "ko" ? reasonItem.ko : lang === "ja" ? reasonItem.ja : reasonItem.en}
                                    </button>
                                  ))}
                                  {otherReasonIdx === idx && (
                                    <div className="mt-1.5 border-t pt-2" style={{ borderColor: th.border2 }}>
                                      <textarea
                                        value={otherFeedbackText}
                                        onChange={(event) => setOtherFeedbackText(event.target.value)}
                                        maxLength={300}
                                        rows={3}
                                        placeholder={lang === "ko" ? "부족했던 점을 직접 적어 주세요." : lang === "ja" ? "改善してほしい点を入力してください。" : "Tell us what should be improved."}
                                        className="w-full resize-none rounded-lg border px-2 py-1.5 text-[10px] outline-none focus:ring-1"
                                        style={{ background: th.bgCard, borderColor: th.border2, color: th.text }}
                                      />
                                      <div className="mt-1.5 flex justify-end gap-1">
                                        <button type="button" onClick={() => setOtherReasonIdx(null)} className="px-2 py-1 text-[10px]" style={{ color: th.textMuted }}>
                                          {lang === "ko" ? "취소" : lang === "ja" ? "キャンセル" : "Cancel"}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={!otherFeedbackText.trim()}
                                          onClick={() => {
                                            const reasonText = `${lang === "ko" ? "기타" : lang === "ja" ? "その他" : "Other"}: ${otherFeedbackText.trim()}`;
                                            void persistChatFeedback(idx, "dislike", "other", reasonText);
                                            setOtherReasonIdx(null);
                                            setActiveDislikeIdx(null);
                                            toast.success(lang === "ko"
                                              ? "구체적인 피드백이 반영되었습니다."
                                              : lang === "ja"
                                                ? "具体的なフィードバックを反映しました。"
                                                : "Detailed feedback saved.");
                                          }}
                                          className="rounded-md px-2 py-1 text-[10px] font-bold text-white disabled:opacity-40"
                                          style={{ background: "oklch(0.58 0.20 20)" }}>
                                          {lang === "ko" ? "제출" : lang === "ja" ? "送信" : "Submit"}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          {messageFeedbacks[idx] === "dislike" && messageReasons[idx] && (
                            <button
                              type="button"
                              disabled={isChatLoading || isFeedbackRegenerating}
                              onClick={() => regenerateWithFeedback(idx)}
                              className="rounded px-2 py-0.5 text-[10px] font-bold transition-all hover:opacity-90 disabled:opacity-50"
                              style={{ background: "oklch(0.65 0.18 200 / 0.15)", color: "oklch(0.70 0.18 200)", border: "1px solid oklch(0.65 0.18 200 / 0.35)" }}>
                              ✨ {isFeedbackRegenerating ? (lang === "ko" ? "생성 중" : lang === "ja" ? "生成中" : "Generating") : (lang === "ko" ? "답변 다시 생성하기" : lang === "ja" ? "回答を再生成" : "Regenerate answer")}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <span className="text-[9px] text-muted-foreground pb-1 shrink-0">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start items-end gap-1.5 animate-fadeIn">
                  <div className="rounded-2xl rounded-tl-none px-4 py-3 border text-xs flex items-center gap-2.5 shadow-sm" style={{ background: isDark ? "oklch(0.17 0.015 240)" : "oklch(0.95 0.005 240)", borderColor: th.border2 }}>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-chat-bounce-1"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-chat-bounce-2"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-chat-bounce-3"></div>
                    </div>
                    <span className="text-muted-foreground font-medium">
                      {lang === "ko"
                        ? "수석 엔지니어 AI가 답변을 작성 중입니다..."
                        : lang === "ja"
                        ? "シニアエンジニアAIが回答を作成中です..."
                        : "Expert AI engineer is typing..."}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 빠른 질문 칩 영역 */}
            <div className="flex gap-1.5 overflow-x-auto border-t px-3 py-2 sm:px-4" style={{ borderColor: th.border, background: th.bgCard2 }}>
              <span className="flex shrink-0 items-center px-1 text-[9px] font-bold whitespace-nowrap" style={{ color: RISK_COLORS[riskLevel] }}>
                {lang === "ko" ? `${t[riskLevel]} 상태 추천` : lang === "ja" ? `${t[riskLevel]}状態の推奨` : `${t[riskLevel]} recommendations`}
              </span>
              {quickChatPrompts.map((chip, cIdx) => (
                <button
                  key={cIdx}
                  type="button"
                  onClick={() => handleSendChatMessage(chip)}
                  disabled={isChatLoading}
                  aria-label={lang === "ko" ? `${t[riskLevel]} 상태 추천 질문: ${chip}` : lang === "ja" ? `${t[riskLevel]}状態の推奨質問: ${chip}` : `${t[riskLevel]} recommendation: ${chip}`}
                  className="whitespace-nowrap px-2.5 py-1 rounded-full border text-[11px] transition-all hover:opacity-80 disabled:opacity-50"
                  style={{ borderColor: RISK_BORDER[riskLevel], color: RISK_COLORS[riskLevel], background: RISK_BG[riskLevel] }}>
                  💡 {chip}
                </button>
              ))}
            </div>

            {/* 입력 폼 영역 */}
            <div className="flex flex-col gap-2 border-t p-2.5 sm:flex-row sm:items-end sm:p-4" style={{ borderColor: th.border, background: th.bgCard }}>
              <textarea
                rows={1}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendChatMessage();
                  }
                }}
                placeholder={
                  lang === "ko"
                    ? "설비 이상 상태에 대해 질문해 주세요... (Enter: 전송, Shift + Enter: 줄바꿈)"
                    : lang === "ja"
                    ? "設備の状態について質問してください... (Enter: 送信, Shift + Enter: 改行)"
                    : "Ask about equipment anomaly... (Enter: Send, Shift + Enter: Newline)"
                }
                className="min-h-11 w-full flex-1 resize-none rounded-xl border px-3.5 py-2 text-xs outline-none transition-all focus:ring-2 focus:ring-cyan-500/40 max-h-24 custom-scrollbar"
                style={{ borderColor: th.border2, background: th.bgCard2, color: th.text }}
              />
              <button
                type="button"
                onClick={() => void handleSendChatMessage()}
                disabled={isChatLoading || !chatInput.trim()}
                className="flex w-full shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-xs font-bold text-white transition-all hover:opacity-95 active:scale-95 disabled:opacity-40 sm:w-auto sm:py-2"
                style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 200), oklch(0.55 0.22 240))" }}>
                <span>{lang === "ko" ? "전송" : lang === "ja" ? "送信" : "Send"}</span>
                <span>📤</span>
              </button>
            </div>

            {/* 매뉴얼 출처 원문 확인 모달 */}
            {activeManualSource && (
              <div className="absolute inset-0 z-[575] flex items-center justify-center p-3 bg-black/55 backdrop-blur-sm animate-fadeIn"
                onClick={() => setActiveManualSource(null)}>
                <div className="w-full max-w-md max-h-[85%] overflow-hidden rounded-2xl border shadow-2xl flex flex-col"
                  style={{ background: isDark ? "oklch(0.15 0.02 240)" : "oklch(0.99 0.003 240)", borderColor: "oklch(0.72 0.15 75 / 0.45)" }}
                  onClick={event => event.stopPropagation()}>
                  <div className="flex items-start justify-between gap-2 border-b px-4 py-3" style={{ borderColor: th.border2 }}>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold" style={{ color: isDark ? "oklch(0.86 0.14 80)" : "oklch(0.46 0.16 75)" }}>
                        📘 {lang === "ko" ? "설비 매뉴얼 원문" : lang === "ja" ? "設備マニュアル原文" : "Manual Source"} [{activeManualSource.label}]
                      </p>
                      <h4 className="mt-1 truncate text-sm font-bold" style={{ color: th.text }}>{activeManualSource.documentTitle}</h4>
                      <p className="text-[10px]" style={{ color: th.textMuted }}>
                        {lang === "ko" ? `구간 ${activeManualSource.chunkIndex + 1}` : lang === "ja" ? `区間 ${activeManualSource.chunkIndex + 1}` : `Chunk ${activeManualSource.chunkIndex + 1}`}
                      </p>
                      {typeof activeManualSource.relevanceScore === "number" && (
                        <p className="mt-1 text-[9px] font-medium" style={{ color: isDark ? "oklch(0.84 0.12 210)" : "oklch(0.42 0.15 210)" }}>
                          {lang === "ko" ? `질문 관련도 ${activeManualSource.relevanceScore}%` : lang === "ja" ? `質問関連度 ${activeManualSource.relevanceScore}%` : `Question relevance ${activeManualSource.relevanceScore}%`}
                          {activeManualSource.matchedTerms && activeManualSource.matchedTerms.length > 0 ? ` · ${lang === "ko" ? "일치" : lang === "ja" ? "一致" : "Matched"}: ${activeManualSource.matchedTerms.join(", ")}` : ""}
                        </p>
                      )}
                    </div>
                    <button type="button" onClick={() => setActiveManualSource(null)} className="shrink-0 text-sm hover:opacity-70" style={{ color: th.textMuted }} aria-label={lang === "ko" ? "매뉴얼 원문 닫기" : lang === "ja" ? "マニュアル原文を閉じる" : "Close manual source"}>✕</button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
                    <p className="whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: th.text }}>{activeManualSource.content}</p>
                  </div>
                  <div className="flex justify-end gap-2 border-t px-4 py-2.5" style={{ borderColor: th.border2 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(activeManualSource.content);
                          toast.success(lang === "ko" ? "매뉴얼 원문을 복사했습니다." : lang === "ja" ? "マニュアル原文をコピーしました。" : "Manual text copied.");
                        } catch (error) {
                          console.error("Manual copy failed:", error);
                        }
                      }}
                      className="rounded-lg border px-3 py-1 text-[11px] font-bold transition-all hover:opacity-80"
                      style={{ borderColor: th.border2, background: th.bgCard, color: th.textMuted }}>
                      📋 {lang === "ko" ? "원문 복사" : lang === "ja" ? "原文コピー" : "Copy text"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveManualSource(null)}
                      className="rounded-lg px-3 py-1 text-[11px] font-bold text-white transition-all hover:opacity-90"
                      style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 200), oklch(0.55 0.22 240))" }}>
                      {lang === "ko" ? "닫기" : lang === "ja" ? "閉じる" : "Close"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 탭 ── */}
      <div className="flex border-b px-5" style={{ borderColor: th.border }}>
        {(["dashboard", "log"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 mr-1"
            style={{
              borderColor: activeTab === tab ? "oklch(0.65 0.18 200)" : "transparent",
              color: activeTab === tab ? "oklch(0.65 0.18 200)" : "oklch(0.50 0.01 240)",
            }}>
            {tab === "dashboard" ? t.dashboard : t.anomalyLog}
          </button>
        ))}
      </div>

      <main className="flex-1 p-3 sm:p-5">
        {activeTab === "dashboard" ? (
          <>
            {/* 임팩트 통계 섹션 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <ImpactCard label={t.totalVisitors} value={getStats.data?.totalVisitors ?? 0} icon="👥" color="#38bdf8" />
              <ImpactCard label={t.totalDetections} value={getStats.data?.totalDetections ?? 0} icon="📊" color="#a78bfa" />
              <ImpactCard label={t.dangerCount} value={getStats.data?.dangerCount ?? 0} icon="⚠️" color="#ef4444" />
              <ImpactCard label={t.uptimePct} value={`${getStats.data?.uptimePct ?? 100}%`} icon="✅" color="#22c55e" />
            </div>

            {/* 절감 비용 카드 */}
            <div className="rounded-xl border p-4 sm:p-5 mb-6 flex flex-col gap-2"
              style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.10), rgba(34,197,94,0.05))", borderColor: "rgba(34,197,94,0.30)" }}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{t.savedCost}</p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold font-mono" style={{ color: "#22c55e" }}>
                  ₩{displayedSavedCost.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{t.impactDesc}</p>
            </div>

            {/* 메인 대시보드 그리드 */}
            <div id="pdf-capture-area" className="grid grid-cols-12 gap-4">
              {/* ── 임계값 설정 패널 (전체 너비) ── */}
              <div className="col-span-12 mb-2">
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "oklch(0.20 0.02 240)" }}>
                  <button
                    onClick={() => setShowThresholdPanel(p => !p)}
                    className="w-full flex items-center justify-between px-5 py-3 text-left transition-all hover:opacity-80"
                    style={{ background: th.bgCard }}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚙️</span>
                      <span className="text-xs font-semibold">{lang === "ko" ? "위험도 임계값 설정" : "Risk Threshold Settings"}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">
                        {lang === "ko"
                          ? `정상 ≤${thresholds.normal} / 주의 ≤${thresholds.caution} / 경고 ≤${thresholds.warning} / 위험 >${thresholds.warning}`
                          : `Normal ≤${thresholds.normal} / Caution ≤${thresholds.caution} / Warning ≤${thresholds.warning} / Danger >${thresholds.warning}`}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{showThresholdPanel ? "▲" : "▼"}</span>
                  </button>
                  {showThresholdPanel && (
                    <div className="px-5 py-4 border-t grid grid-cols-1 md:grid-cols-3 gap-5"
                      style={{ background: th.bgCard2, borderColor: th.border }}>
                      {/* 정상 임계값 */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#22c55e" }}>
                            {lang === "ko" ? "정상 최대 점수" : "Normal Max"}
                          </label>
                          <span className="text-xs font-mono font-bold" style={{ color: "#22c55e" }}>{thresholds.normal}</span>
                        </div>
                        <input type="range" min={10} max={thresholds.caution - 1} value={thresholds.normal}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                          style={{ accentColor: "#22c55e" }}
                          onChange={e => {
                            const v = Number(e.target.value);
                            setThresholds(p => {
                              const n = { ...p, normal: v };
                              saveThresholdsMutation.mutate(n);
                              return n;
                            });
                          }} />
                        <p className="text-[9px] text-muted-foreground">{lang === "ko" ? "이 점수 이하 → 정상" : "Score ≤ this → Normal"}</p>
                      </div>
                      {/* 주의 임계값 */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#eab308" }}>
                            {lang === "ko" ? "주의 최대 점수" : "Caution Max"}
                          </label>
                          <span className="text-xs font-mono font-bold" style={{ color: "#eab308" }}>{thresholds.caution}</span>
                        </div>
                        <input type="range" min={thresholds.normal + 1} max={thresholds.warning - 1} value={thresholds.caution}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                          style={{ accentColor: "#eab308" }}
                          onChange={e => {
                            const v = Number(e.target.value);
                            setThresholds(p => {
                              const n = { ...p, caution: v };
                              saveThresholdsMutation.mutate(n);
                              return n;
                            });
                          }} />
                        <p className="text-[9px] text-muted-foreground">{lang === "ko" ? "이 점수 이하 → 주의" : "Score ≤ this → Caution"}</p>
                      </div>
                      {/* 경고 임계값 */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#f97316" }}>
                            {lang === "ko" ? "경고 최대 점수" : "Warning Max"}
                          </label>
                          <span className="text-xs font-mono font-bold" style={{ color: "#f97316" }}>{thresholds.warning}</span>
                        </div>
                        <input type="range" min={thresholds.caution + 1} max={89} value={thresholds.warning}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                          style={{ accentColor: "#f97316" }}
                          onChange={e => {
                            const v = Number(e.target.value);
                            setThresholds(p => {
                              const n = { ...p, warning: v };
                              saveThresholdsMutation.mutate(n);
                              return n;
                            });
                          }} />
                        <p className="text-[9px] text-muted-foreground">{lang === "ko" ? `이 점수 초과 → 위험 (현재 >${thresholds.warning})` : `Score > this → Danger (now >${thresholds.warning})`}</p>
                      </div>
                      {/* 초기화 버튼 */}
                      <div className="col-span-1 md:col-span-3 flex justify-end">
                        <button
                          onClick={() => {
                            const def = { normal: 29, caution: 49, warning: 69 };
                            setThresholds(def);
                            saveThresholdsMutation.mutate(def);
                          }}
                          className="text-[10px] px-3 py-1.5 rounded-lg border transition-all hover:opacity-80 active:scale-95"
                          style={{ borderColor: th.border2, color: th.textMuted }}>
                          {lang === "ko" ? "기본값으로 초기화" : "Reset to Default"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── 센서별 임계값 설정 패널 ── */}
              <div className="col-span-12 mb-2">
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "oklch(0.20 0.02 240)" }}>
                  <button
                    onClick={() => setShowSensorPanel(p => !p)}
                    className="w-full flex items-center justify-between px-5 py-3 text-left transition-all hover:opacity-80"
                    style={{ background: th.bgCard }}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔬</span>
                      <span className="text-xs font-semibold">{lang === "ko" ? "센서별 임계값 설정" : "Per-Sensor Threshold Settings"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{showSensorPanel ? "▲" : "▼"}</span>
                  </button>
                  {showSensorPanel && (
                    <div className="px-5 py-4 border-t grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5"
                      style={{ background: th.bgCard2, borderColor: th.border }}>
                      {/* 전류 */}
                      {[
                        { key: "current" as const, label: lang === "ko" ? "전류 (A)" : "Current (A)", color: "#38bdf8", step: 0.1,
                          caution: sensorThresh.currentCaution, warning: sensorThresh.currentWarning, danger: sensorThresh.currentDanger,
                          setCaution: (v: number) => { const n = { ...sensorThresh, currentCaution: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setWarning: (v: number) => { const n = { ...sensorThresh, currentWarning: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setDanger:  (v: number) => { const n = { ...sensorThresh, currentDanger: v };  setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          min: 5, max: 20 },
                        { key: "temp" as const, label: lang === "ko" ? "온도 (°C)" : "Temperature (°C)", color: "#fb923c", step: 1,
                          caution: sensorThresh.tempCaution, warning: sensorThresh.tempWarning, danger: sensorThresh.tempDanger,
                          setCaution: (v: number) => { const n = { ...sensorThresh, tempCaution: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setWarning: (v: number) => { const n = { ...sensorThresh, tempWarning: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setDanger:  (v: number) => { const n = { ...sensorThresh, tempDanger: v };  setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          min: 40, max: 120 },
                        { key: "vib" as const, label: lang === "ko" ? "진동 (mm/s)" : "Vibration (mm/s)", color: "#a78bfa", step: 0.05,
                          caution: sensorThresh.vibCaution, warning: sensorThresh.vibWarning, danger: sensorThresh.vibDanger,
                          setCaution: (v: number) => { const n = { ...sensorThresh, vibCaution: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setWarning: (v: number) => { const n = { ...sensorThresh, vibWarning: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setDanger:  (v: number) => { const n = { ...sensorThresh, vibDanger: v };  setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          min: 1.5, max: 5.0 },
                        { key: "noise" as const, label: lang === "ko" ? "소음 (dB)" : "Noise (dB)", color: "#34d399", step: 1,
                          caution: sensorThresh.noiseCaution, warning: sensorThresh.noiseWarning, danger: sensorThresh.noiseDanger,
                          setCaution: (v: number) => { const n = { ...sensorThresh, noiseCaution: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setWarning: (v: number) => { const n = { ...sensorThresh, noiseWarning: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setDanger:  (v: number) => { const n = { ...sensorThresh, noiseDanger: v };  setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          min: 50, max: 100 },
                      ].map(s => (
                        <div key={s.key} className="flex flex-col gap-3 p-3 rounded-lg border" style={{ borderColor: `${s.color}30`, background: `${s.color}08` }}>
                          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: s.color }}>{s.label}</p>
                          {[
                            { label: lang === "ko" ? "주의" : "Caution", val: s.caution, set: s.setCaution, color: "#eab308" },
                            { label: lang === "ko" ? "경고" : "Warning", val: s.warning, set: s.setWarning, color: "#f97316" },
                            { label: lang === "ko" ? "위험" : "Danger",  val: s.danger,  set: s.setDanger,  color: "#ef4444" },
                          ].map(row => (
                            <div key={row.label} className="flex flex-col gap-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-semibold" style={{ color: row.color }}>{row.label}</span>
                                <span className="text-[9px] font-mono" style={{ color: row.color }}>{row.val.toFixed(s.step < 1 ? 2 : 0)}</span>
                              </div>
                              <input type="range" min={s.min} max={s.max} step={s.step} value={row.val}
                                className="w-full h-1 rounded-full appearance-none cursor-pointer"
                                style={{ accentColor: row.color }}
                                onChange={e => row.set(Number(e.target.value))} />
                            </div>
                          ))}
                        </div>
                      ))}
                      <div className="col-span-1 md:col-span-2 xl:col-span-4 flex justify-end">
                        <button
                          onClick={() => {
                            const def = {
                              currentCaution: 7.0, currentWarning: 9.0, currentDanger: 11.0,
                              tempCaution: 55.0, tempWarning: 70.0, tempDanger: 85.0,
                              vibCaution: 2.3, vibWarning: 2.6, vibDanger: 3.0,
                              noiseCaution: 65.0, noiseWarning: 75.0, noiseDanger: 85.0,
                            };
                            setSensorThresh(def);
                            saveSensorThresholdsMutation.mutate(def);
                          }}
                          className="text-[10px] px-3 py-1.5 rounded-lg border transition-all hover:opacity-80 active:scale-95"
                          style={{ borderColor: th.border2, color: th.textMuted }}>
                          {lang === "ko" ? "기본값으로 초기화" : "Reset to Default"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── 왼쪽: 센서 카드 (재배치) ── */}
              <div className="col-span-12 lg:col-span-3">
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                {[
                  { label: t.current,     value: sensorData?.current     ?? 5.0,  unit: t.unitA,   color: "#38bdf8", icon: "⚡", sensorKey: "current" },
                  { label: t.temperature, value: sensorData?.temperature ?? 45.0, unit: t.unitC,   color: "#fb923c", icon: "🌡", sensorKey: "temp" },
                  { label: t.vibration,   value: sensorData?.vibration   ?? 2.0,  unit: t.unitMms, color: "#a78bfa", icon: "📳", sensorKey: "vib" },
                  { label: t.noise,       value: sensorData?.noise       ?? 55.0, unit: t.unitDb,  color: "#34d399", icon: "🔊", sensorKey: "noise" },
                ].map(card => {
                  const alertLevel = (() => {
                    const v = card.value;
                    const k = card.sensorKey;
                    const danger = sensorThresh[`${k}Danger` as keyof typeof sensorThresh];
                    const warning = sensorThresh[`${k}Warning` as keyof typeof sensorThresh];
                    const caution = sensorThresh[`${k}Caution` as keyof typeof sensorThresh];
                    if (v >= danger) return "danger";
                    if (v >= warning) return "warning";
                    if (v >= caution) return "caution";
                    return "normal";
                  })();
                  const blinkBorderColor = alertLevel === "danger" ? "#ef4444" : alertLevel === "warning" ? "#f97316" : alertLevel === "caution" ? "#eab308" : `${card.color}35`;
                  const blinkAnim = alertLevel !== "normal" ? "sensorBlink 1s ease-in-out infinite" : "none";
                  return (
                  <div key={card.label} className="rounded-xl p-4 border flex flex-col gap-2 transition-all duration-300"
                    style={{ background: "rgba(255,255,255,0.025)", borderColor: blinkBorderColor, animation: blinkAnim, borderWidth: alertLevel !== "normal" ? "2px" : "1px" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{card.label}</span>
                      <span className="text-base opacity-70">{card.icon}</span>
                    </div>
                    <div className="flex items-end gap-1.5">
                      <span className="text-3xl font-bold font-mono leading-none" style={{ color: card.color }}>{card.value.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground mb-0.5">{card.unit}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[9px] text-muted-foreground opacity-60">{lang === "ko" ? "점수 추이" : "Score trend"}</span>
                      <Sparkline data={scoreHistory} color={card.color} />
                    </div>
                  </div>
                  );
                })}
              </div>
              </div>

              {/* ── 가운데: 차트 ── */}
              <div className="col-span-12 lg:col-span-6 flex flex-col gap-4">
                {/* 전류 + 온도 */}
                <div className="rounded-xl border p-4" style={{ background: th.bgCard, borderColor: th.border }}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    {t.current} <span className="text-[#38bdf8]">●</span> / {t.temperature} <span className="text-[#fb923c]">●</span>
                  </p>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#4b5563" }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9, fill: "#4b5563" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="current"     stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} name={t.current} />
                      <Line type="monotone" dataKey="temperature" stroke="#fb923c" strokeWidth={2} dot={false} isAnimationActive={false} name={t.temperature} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {/* 진동 + 소음 */}
                <div className="rounded-xl border p-4" style={{ background: th.bgCard, borderColor: th.border }}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    {t.vibration} <span className="text-[#a78bfa]">●</span> / {t.noise} <span className="text-[#34d399]">●</span>
                  </p>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#4b5563" }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9, fill: "#4b5563" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="vibration" stroke="#a78bfa" strokeWidth={2} dot={false} isAnimationActive={false} name={t.vibration} />
                      <Line type="monotone" dataKey="noise"     stroke="#34d399" strokeWidth={2} dot={false} isAnimationActive={false} name={t.noise} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ── 오른쪽: 위험도 + 시뮬레이터 ── */}
              <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
                {/* 위험도 게이지 */}
                <div className="rounded-xl border p-5 flex flex-col items-center gap-4 transition-all duration-500"
                  style={{
                    background: RISK_BG[riskLevel],
                    borderColor: RISK_BORDER[riskLevel],
                    boxShadow: riskLevel === "danger" ? `0 0 30px ${RISK_COLORS.danger}25` : "none",
                  }}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest self-start">{t.riskLevel}</p>
                  <RiskGauge score={anomalyScore} riskLevel={riskLevel} t={t} />
                </div>

                {/* 시뮬레이터 - 4단계 버튼 */}
                <div className="rounded-xl border p-4 flex flex-col gap-2.5"
                  style={{ background: th.bgCard, borderColor: th.border }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-xs font-semibold">{t.simulatorTitle}</p>
                    {lastInjectedMode && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{
                          background: lastInjectedMode === "normal" ? "rgba(34,197,94,0.15)" : lastInjectedMode === "caution" ? "rgba(234,179,8,0.15)" : lastInjectedMode === "warning" ? "rgba(249,115,22,0.15)" : "rgba(239,68,68,0.15)",
                          color: lastInjectedMode === "normal" ? "#22c55e" : lastInjectedMode === "caution" ? "#eab308" : lastInjectedMode === "warning" ? "#f97316" : "#ef4444",
                        }}>
                        {t[lastInjectedMode]}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{t.simulatorDesc}</p>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button onClick={handleInjectNormal} disabled={injectNormal.isPending}
                      className="py-2 rounded-lg text-xs font-semibold border transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                      style={{ background: "rgba(34,197,94,0.10)", borderColor: "#22c55e45", color: "#22c55e" }}>
                      {injectNormal.isPending
                        ? <span className="flex items-center justify-center gap-1.5"><ButtonSpinner color="#22c55e" /><span>처리 중...</span></span>
                        : `▶ ${t.injectNormal}`}
                    </button>
                    <button onClick={handleInjectCaution} disabled={injectCaution.isPending}
                      className="py-2 rounded-lg text-xs font-semibold border transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                      style={{ background: "rgba(234,179,8,0.10)", borderColor: "#eab30845", color: "#eab308" }}>
                      {injectCaution.isPending
                        ? <span className="flex items-center justify-center gap-1.5"><ButtonSpinner color="#eab308" /><span>처리 중...</span></span>
                        : `⚡ ${t.injectCaution}`}
                    </button>
                    <button onClick={handleInjectWarning} disabled={injectWarning.isPending}
                      className="py-2 rounded-lg text-xs font-semibold border transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                      style={{ background: "rgba(249,115,22,0.10)", borderColor: "#f9731645", color: "#f97316" }}>
                      {injectWarning.isPending
                        ? <span className="flex items-center justify-center gap-1.5"><ButtonSpinner color="#f97316" /><span>처리 중...</span></span>
                        : `🔶 ${t.injectWarning}`}
                    </button>
                    <button onClick={handleInjectAnomaly} disabled={injectAnomaly.isPending}
                      className="py-2 rounded-lg text-xs font-semibold border transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                      style={{ background: "rgba(239,68,68,0.10)", borderColor: "#ef444445", color: "#ef4444" }}>
                      {injectAnomaly.isPending
                        ? <span className="flex items-center justify-center gap-1.5"><ButtonSpinner color="#ef4444" /><span>처리 중...</span></span>
                        : `⚠ ${t.injectAnomaly}`}
                    </button>
                  </div>
                </div>
                {/* 절감 비용 리셋 버튼 */}
                <button onClick={handleResetCost} disabled={resetCostMutation.isPending}
                  className="w-full py-2 rounded-lg text-xs font-semibold border transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                  style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", borderColor: th.border2, color: th.textMuted }}>
                  {resetCostMutation.isPending
                    ? <span className="flex items-center justify-center gap-1.5"><ButtonSpinner color="#6b7280" /><span>{t.processing}</span></span>
                    : `↺ ${t.resetCost}`}
                </button>
              </div>
            </div>
            {/* ── 월간 히트맵 캘린더 ── */}
            <div className="mt-4">
              {/* ── 위험도 점수 라인 차트 ── */}
              <div className="rounded-xl border p-4 mb-4" style={{ background: th.bgCard, borderColor: th.border }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                    {lang === "ko" ? "위험도 점수 추이 (최근 50개)" : "Risk Score Trend (Last 50)"}
                  </p>
                  <div className="flex gap-3 text-[9px]">
                    {(["normal","caution","warning","danger"] as const).map(r => (
                      <span key={r} className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ background: RISK_COLOR_MAP[r] }} />
                        <span className="text-muted-foreground capitalize">{r}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <ScoreLineChart data={getRecentScoresQuery.data ?? []} lang={lang} isDark={isDark} />
              </div>
              <MonthlyHeatmap
                dailyData={getDailyMaxRisk.data ?? []}
                lang={lang}
                t={t}
                isDark={isDark}
                onDateClick={(date) => {
                  setSelectedDate(date);
                  setLogFilter("all");
                  setLogPage(1);
                  setActiveTab("log");
                }}
              />
              </div>
          </>
        ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: th.border }}>{/* 이상 이력 로그 탭 */}
          {/* 새 기록 알림 배너 */}
          {newLogCount > 0 && (
            <div
              className="flex items-center justify-between px-4 py-2 text-sm font-semibold cursor-pointer"
              style={{ background: "rgba(34,197,94,0.15)", borderBottom: "1px solid rgba(34,197,94,0.3)", color: "#22c55e" }}
              onClick={() => setNewLogCount(0)}
            >
              <span>🔔 {lang === "ko" ? `새 기록 ${newLogCount}건이 추가되었습니다` : `${newLogCount} new record${newLogCount > 1 ? "s" : ""} added`}</span>
              <span className="text-xs opacity-70">{lang === "ko" ? "클릭하여 닫기" : "Click to dismiss"}</span>
            </div>
          )}
          {/* 탭 헤더 - 2행 구조 */}
          <div className="px-5 py-3 border-b flex flex-col gap-2"
            style={{ background: th.bgCard, borderColor: th.border }}>
          {/* 0행: 통계 요약 카드 */}
          <div className="grid grid-cols-3 gap-2 mb-1">
            {(() => {
              // 날짜 범위 기준 필터된 로그
              const rangedLogs = logs.filter(l =>
                (dateStart ? l.timestamp.slice(0,10) >= dateStart : true) &&
                (dateEnd   ? l.timestamp.slice(0,10) <= dateEnd   : true)
              );
              const totalAbnormal = rangedLogs.filter(l => l.riskLevel !== "normal").length;
              const stats = [
                { label: lang === "ko" ? "위험" : "Danger",  count: rangedLogs.filter(l => l.riskLevel === "danger").length,  color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)",   icon: "🔴" },
                { label: lang === "ko" ? "경고" : "Warning", count: rangedLogs.filter(l => l.riskLevel === "warning").length, color: "#f97316", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.25)",  icon: "🟠" },
                { label: lang === "ko" ? "주의" : "Caution", count: rangedLogs.filter(l => l.riskLevel === "caution").length, color: "#eab308", bg: "rgba(234,179,8,0.08)",   border: "rgba(234,179,8,0.25)",   icon: "🟡" },
              ];
              return stats.map(s => {
                const pct = totalAbnormal > 0 ? Math.round(s.count / totalAbnormal * 100) : 0;
                return (
                  <div key={s.label} className="rounded-lg p-2.5 border flex flex-col gap-1"
                    style={{ background: s.bg, borderColor: s.border }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-xs">{s.icon}</span>
                        <span className="text-[10px] font-semibold" style={{ color: s.color }}>{s.label}</span>
                      </div>
                      <span className="text-base font-bold font-mono" style={{ color: s.color }}>{s.count}</span>
                    </div>
                    {/* 비율 바 */}
                    <div className="w-full h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div className="h-1 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: s.color }} />
                    </div>
                    <span className="text-[9px] font-mono text-right" style={{ color: s.color, opacity: 0.75 }}>
                      {totalAbnormal > 0 ? `${pct}%` : "-"}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
          {/* 날짜 범위 필터 */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold" style={{ color: th.textMuted }}>{lang === "ko" ? "기간 (연-월-일)" : "Period (YYYY-MM-DD)"}:</span>
            <input type="date" value={dateStart}
              onChange={e => { setDateStart(e.target.value); setLogPage(1); }}
              className="text-[10px] px-2 py-1 rounded-lg border outline-none"
              style={{ background: th.bgCard2, borderColor: th.border, color: th.text, colorScheme: isDark ? "dark" : "light" }} />
            <span className="text-[10px]" style={{ color: th.textMuted }}>~</span>
            <input type="date" value={dateEnd}
              onChange={e => { setDateEnd(e.target.value); setLogPage(1); }}
              className="text-[10px] px-2 py-1 rounded-lg border outline-none"
              style={{ background: th.bgCard2, borderColor: th.border, color: th.text, colorScheme: isDark ? "dark" : "light" }} />
            {(dateStart || dateEnd) && (
              <button onClick={() => { setDateStart(""); setDateEnd(""); setLogPage(1); }}
                className="text-[10px] px-2 py-1 rounded-lg border transition-all hover:opacity-70"
                style={{ borderColor: th.border2, color: th.textMuted }}>
                {lang === "ko" ? "초기화" : "Reset"}
              </button>
            )}
            <span className="text-[10px] ml-auto" style={{ color: th.textMuted }}>
              {lang === "ko" ? `${filteredLogs.length}건 표시` : `${filteredLogs.length} records`}
            </span>
          </div>
          {/* 1행: 제목 + CSV/클리어 버튼 */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{t.anomalyLog}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!filteredLogs || filteredLogs.length === 0) {
                    toast.info(lang === "ko" ? "내보낼 로그가 없습니다." : lang === "ja" ? "エクスポートするログがありません。" : "No logs to export.");
                    return;
                  }
                  exportLogsToCSV(filteredLogs, lang);
                  toast.success(t.exportCsvSuccess);
                }}
                className="text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 hover:opacity-80 active:scale-95"
                style={{ borderColor: "oklch(0.65 0.18 200 / 0.4)", color: "oklch(0.65 0.18 200)", background: "oklch(0.65 0.18 200 / 0.08)" }}>
                ⬇ {t.exportCsv}
              </button>
              <button onClick={handleClearLogs}
                className="text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 hover:opacity-70"
                style={{ borderColor: th.border2, color: th.textMuted }}>
                {t.clearLogs}
              </button>
            </div>
          </div>
          {/* 2행: 필터 버튼 */}
          <div className="flex items-center gap-1.5 flex-wrap">
              {/* 날짜 필터 chip */}
              {selectedDate && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border"
                  style={{ borderColor: "oklch(0.65 0.18 200 / 0.6)", color: "oklch(0.65 0.18 200)", background: "oklch(0.65 0.18 200 / 0.12)" }}>
                  📅 {selectedDate}
                  <button onClick={() => setSelectedDate(null)} className="ml-1 hover:opacity-70 transition-opacity" title={lang === "ko" ? "날짜 필터 해제" : lang === "ja" ? "日付フィルター解除" : "Clear date filter"}>✕</button>
                </div>
              )}
              {(["all", "normal", "caution", "warning", "danger"] as const).map(f => {
                const labelMap: Record<typeof f, string> = {
                  all:     lang === "ko" ? "전체" : "All",
                  normal:  lang === "ko" ? "정상" : "Normal",
                  caution: lang === "ko" ? "주의" : "Caution",
                  warning: lang === "ko" ? "경고" : "Warning",
                  danger:  lang === "ko" ? "위험" : "Danger",
                };
                const colorMap: Record<typeof f, string> = {
                  all:     "oklch(0.65 0.18 200)",
                  normal:  "#22c55e",
                  caution: "#eab308",
                  warning: "#f97316",
                  danger:  "#ef4444",
                };
                const isActive = logFilter === f;
                return (
                  <button key={f}
                    onClick={() => { setLogFilter(f); setLogPage(1); }}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all duration-150 hover:opacity-90 active:scale-95"
                    style={{
                      borderColor: isActive ? `${colorMap[f]}80` : "oklch(0.22 0.02 240)",
                      color: isActive ? colorMap[f] : "oklch(0.45 0.01 240)",
                      background: isActive ? `${colorMap[f]}18` : "transparent",
                    }}>
                    {labelMap[f]}
                    {f !== "all" && (
                      <span className="ml-1 opacity-60">
                        ({logs.filter(l => l.riskLevel === f).length})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: th.bgCard2, borderBottom: `1px solid ${th.border}` }}>
                    {[t.logTime, t.logCurrent, t.logTemp, t.logVib, t.logNoise, t.logScore, t.logLevel, lang === "ko" ? "AI 분석" : lang === "ja" ? "AI分析" : "AI Analysis"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-muted-foreground font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logsLoading ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Loading...</td></tr>
                  ) : !logs || logs.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">{t.noLogs}</td></tr>
                  ) : pagedLogs.map(log => {
                    const lvl = log.riskLevel as RiskLevel;
                    const color = RISK_COLORS[lvl];
                    return (
                      <tr key={log.id}
                        className="border-b transition-colors hover:bg-white/[0.04] cursor-pointer"
                        style={{ borderColor: "oklch(0.17 0.015 240)" }}
                        onClick={() => setSelectedLog(log)}
                        title={lang === "ko" ? "클릭하여 상세 보기" : lang === "ja" ? "クリックして詳細を表示" : "Click for details"}>
                        <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", { hour12: false })}
                        </td>
                        <td className="px-4 py-3 font-mono">{log.current.toFixed(2)}</td>
                        <td className="px-4 py-3 font-mono">{log.temperature.toFixed(1)}</td>
                        <td className="px-4 py-3 font-mono">{log.vibration.toFixed(2)}</td>
                        <td className="px-4 py-3 font-mono">{log.noise.toFixed(1)}</td>
                        <td className="px-4 py-3 font-mono font-bold" style={{ color }}>{log.anomalyScore}</td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
                            style={{ color, background: RISK_BG[lvl], borderColor: RISK_BORDER[lvl] }}>
                            {t[lvl]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {(log.llmAnalysisKo || log.llmAnalysisEn) ? (
                            <span title={(() => { try { const raw = lang === "ko" ? log.llmAnalysisKo : lang === "ja" ? log.llmAnalysisJa : log.llmAnalysisEn; const a = JSON.parse(raw ?? log.llmAnalysisKo ?? log.llmAnalysisEn ?? ""); return a.primaryCause; } catch { return ""; } })()}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border"
                              style={{ color: "oklch(0.75 0.18 200)", background: "oklch(0.75 0.18 200 / 0.10)", borderColor: "oklch(0.75 0.18 200 / 0.30)" }}>
                              🤖 AI
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground opacity-40">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* ── 페이지네이션 ── */}
            {logs.length > LOG_PAGE_SIZE && (
              <div className="flex items-center justify-between px-5 py-3 border-t"
                style={{ borderColor: th.border, background: th.bgCard2 }}>
                <span className="text-[11px] text-muted-foreground">
                  {lang === "ko"
                    ? `총 ${filteredLogs.length}개 중 ${(logPage - 1) * LOG_PAGE_SIZE + 1}–${Math.min(logPage * LOG_PAGE_SIZE, filteredLogs.length)}개`
                    : `${(logPage - 1) * LOG_PAGE_SIZE + 1}–${Math.min(logPage * LOG_PAGE_SIZE, filteredLogs.length)} of ${filteredLogs.length}`}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setLogPage(p => Math.max(1, p - 1))}
                    disabled={logPage === 1}
                    className="px-2.5 py-1 rounded-lg text-xs border transition-all duration-150 disabled:opacity-30 hover:opacity-80 active:scale-95"
                    style={{ borderColor: "oklch(0.25 0.02 240)", color: "oklch(0.60 0.01 240)" }}>
                    ‹ {lang === "ko" ? "이전" : "Prev"}
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - logPage) <= 1)
                    .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && typeof arr[idx - 1] === "number" && (p as number) - (arr[idx - 1] as number) > 1) acc.push("…");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "…"
                        ? <span key={`ell-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                        : <button key={p}
                            onClick={() => setLogPage(p as number)}
                            className="w-7 h-7 rounded-lg text-xs border transition-all duration-150 hover:opacity-80 active:scale-95"
                            style={{
                              borderColor: logPage === p ? "oklch(0.65 0.18 200 / 0.6)" : "oklch(0.25 0.02 240)",
                              color: logPage === p ? "oklch(0.65 0.18 200)" : "oklch(0.55 0.01 240)",
                              background: logPage === p ? "oklch(0.65 0.18 200 / 0.12)" : "transparent",
                              fontWeight: logPage === p ? 700 : 400,
                            }}>
                            {p}
                          </button>
                    )}
                  <button
                    onClick={() => setLogPage(p => Math.min(totalPages, p + 1))}
                    disabled={logPage === totalPages}
                    className="px-2.5 py-1 rounded-lg text-xs border transition-all duration-150 disabled:opacity-30 hover:opacity-80 active:scale-95"
                    style={{ borderColor: "oklch(0.25 0.02 240)", color: "oklch(0.60 0.01 240)" }}>
                    {lang === "ko" ? "다음" : "Next"} ›
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes sensorBlink {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); opacity: 1; }
          50% { box-shadow: 0 0 12px 4px currentColor; opacity: 0.75; }
        }
        @keyframes dangerFlashAnim {
          0%   { opacity: 1; }
          30%  { opacity: 0.8; }
          60%  { opacity: 0.4; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
