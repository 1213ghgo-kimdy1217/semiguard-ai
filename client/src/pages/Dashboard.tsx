import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import { translations, type Lang, type Translation } from "@/lib/i18n";
import type { RiskLevel, SensorData, AnomalyResult, AnomalyLogEntry } from "../../../shared/semiguard";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { toast } from "sonner";

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
function exportLogsToCSV(logs: AnomalyLogEntry[], lang: "ko" | "en") {
  const headers = lang === "ko"
    ? ["발생 시각", "전류(A)", "온도(°C)", "진동(mm/s)", "소음(dB)", "이상 점수", "위험도", "이상 여부"]
    : ["Time", "Current(A)", "Temp(°C)", "Vib(mm/s)", "Noise(dB)", "Score", "Level", "Anomaly"];
  // 쉼표·따옴표·줄바꿈이 포함된 셀을 RFC 4180 방식으로 이스케이프
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = logs.map(log => [
    escape(new Date(log.timestamp).toLocaleString(lang === "ko" ? "ko-KR" : "en-US", { hour12: false })),
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
  lang: "ko" | "en";
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
  lang: "ko" | "en";
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

  const monthLabel = calMonth.toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "long" });

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
  const [lang, setLang] = useState<Lang>("ko");
  const t = translations[lang] as Translation;
  const [isDark, setIsDark] = useState<boolean>(() => {
    try { return localStorage.getItem("semiguard_theme") !== "light"; } catch { return true; }
  });
  const isMobile = useIsMobile();
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
  const [selectedLog, setSelectedLog] = useState<import("../../../shared/semiguard").AnomalyLogEntry | null>(null);
  const [logPage, setLogPage] = useState(1);
  const LOG_PAGE_SIZE = 10;
  const [scoreHistory, setScoreHistory] = useState<number[]>([10]);
  const [logFilter, setLogFilter] = useState<RiskLevel | "all">("all");

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
  const resetCostMutation = trpc.semiguard.resetSavedCost.useMutation();
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
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── 센서별 임계값 tRPC 훅 ──────────────────────────────────────────────────
  const getSensorThresholdsQuery = trpc.semiguard.getSensorThresholds.useQuery(undefined, { staleTime: Infinity });
  const saveSensorThresholdsMutation = trpc.semiguard.saveSensorThresholds.useMutation();

  const sensorData = current?.sensorData;
  const anomalyScore = current?.anomalyScore ?? 0;
  const riskLevel = current?.riskLevel ?? "normal";
  const logs = logsData ?? [];
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
      }
    }, 4000);

    return () => {
      if (autoPollingRef.current) clearInterval(autoPollingRef.current);
    };
  }, [initialized]);

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
                    {lang === "ko" ? "이상 이력 상세" : "Anomaly Detail"}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: isDark ? "oklch(0.50 0.01 240)" : "oklch(0.45 0.01 240)" }}>
                    {new Date(log.timestamp).toLocaleString(lang === "ko" ? "ko-KR" : "en-US", { hour12: false })}
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
                  {lang === "ko" ? "이상 점수" : "Anomaly Score"}
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
                {lang === "ko" ? "위험 단계 도달!" : "DANGER LEVEL REACHED!"}
              </h2>
              <p className="text-center text-sm" style={{ color: "rgb(220,38,38)" }}>
                {lang === "ko"
                  ? "장비가 위험 상태에 도달했습니다. 즉시 점검이 필요합니다."
                  : "Equipment has reached a dangerous state. Immediate inspection required."}
              </p>
              <div className="w-full h-1 rounded-full" style={{ background: "rgb(239,68,68)" }}>
                <div className="h-full rounded-full" style={{
                  background: "rgb(239,68,68)",
                  animation: "pulse 1s ease-in-out infinite"
                }} />
              </div>
              <button
                onClick={() => setDangerAlert(false)}
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
            <p className="text-[10px] text-muted-foreground leading-tight">{t.appSubtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {!isMobile && <HeartbeatIndicator alive={heartbeatAlive} t={t} />}
          {!isMobile && <div className="w-px h-5 bg-border" />}
          <AlertPanel riskLevel={riskLevel} relayTripped={relayTripped} t={t} />
          {!isMobile && <div className="w-px h-5 bg-border" />}
          <button onClick={() => setLang(l => l === "ko" ? "en" : "ko")}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 hover:opacity-80 active:scale-95"
            style={{ borderColor: "oklch(0.65 0.18 200 / 0.4)", color: "oklch(0.65 0.18 200)", background: "oklch(0.65 0.18 200 / 0.08)" }}>
            {lang === "ko" ? "EN" : "한국어"}
          </button>
          {/* 다크/라이트 모드 전환 */}
          <button
            onClick={() => setIsDark(d => {
              const next = !d;
              try { localStorage.setItem("semiguard_theme", next ? "dark" : "light"); } catch {}
              return next;
            })}
            title={isDark ? (lang === "ko" ? "라이트 모드" : "Light Mode") : (lang === "ko" ? "다크 모드" : "Dark Mode")}
            className="w-8 h-8 flex items-center justify-center rounded-lg border transition-all duration-200 hover:opacity-80 active:scale-95 text-base"
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
            className="w-8 h-8 flex items-center justify-center rounded-lg border transition-all duration-200 hover:opacity-80 active:scale-95 text-base"
            style={{
              borderColor: muted ? "oklch(0.35 0.01 240)" : "oklch(0.65 0.18 200 / 0.4)",
              color: muted ? "oklch(0.45 0.01 240)" : "oklch(0.65 0.18 200)",
              background: muted ? (isDark ? "oklch(0.15 0.01 240)" : "oklch(0.88 0.01 240)") : "oklch(0.65 0.18 200 / 0.08)",
            }}>
            {muted ? "🔕" : "🔔"}
          </button>
          {/* 볼륨 슬라이더 - 모바일 숨김 */}
          {!muted && !isMobile && (
            <div className="flex items-center gap-1.5" title={lang === "ko" ? "볼륨 조절" : "Volume"}>
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-200 hover:opacity-80 active:scale-95"
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
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs"
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-200 hover:opacity-80 active:scale-95 disabled:opacity-50"
            style={{ borderColor: th.border2, color: "oklch(0.65 0.18 200)", background: th.bgCard }}>
            {pdfExporting ? <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid oklch(0.65 0.18 200)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> : "📄"} {lang === "ko" ? "PDF" : "PDF"}
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
                  ₩{(getStats.data?.savedCost ?? 0).toLocaleString()}
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
                    toast.info(lang === "ko" ? "내보낼 로그가 없습니다." : "No logs to export.");
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
                  <button onClick={() => setSelectedDate(null)} className="ml-1 hover:opacity-70 transition-opacity" title={lang === "ko" ? "날짜 필터 해제" : "Clear date filter"}>✕</button>
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
                    {[t.logTime, t.logCurrent, t.logTemp, t.logVib, t.logNoise, t.logScore, t.logLevel].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-muted-foreground font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logsLoading ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Loading...</td></tr>
                  ) : !logs || logs.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">{t.noLogs}</td></tr>
                  ) : pagedLogs.map(log => {
                    const lvl = log.riskLevel as RiskLevel;
                    const color = RISK_COLORS[lvl];
                    return (
                      <tr key={log.id}
                        className="border-b transition-colors hover:bg-white/[0.04] cursor-pointer"
                        style={{ borderColor: "oklch(0.17 0.015 240)" }}
                        onClick={() => setSelectedLog(log)}
                        title={lang === "ko" ? "클릭하여 상세 보기" : "Click for details"}>
                        <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString(lang === "ko" ? "ko-KR" : "en-US", { hour12: false })}
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
