import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function playDangerAlertSound() {
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
        gain.gain.setValueAtTime(0.35, startTime);
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

function MonthlyHeatmap({
  dailyData,
  lang,
  t,
  onDateClick,
}: {
  dailyData: { date: string; riskLevel: string }[];
  lang: "ko" | "en";
  t: import("@/lib/i18n").Translation;
  onDateClick?: (date: string) => void;
}) {
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
    <div className="rounded-xl border p-5" style={{ background: "oklch(0.13 0.015 240)", borderColor: "oklch(0.20 0.02 240)" }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          {lang === "ko" ? "월간 위험도 히트맵" : "Monthly Risk Heatmap"}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="w-6 h-6 flex items-center justify-center rounded text-xs border transition-all hover:opacity-80 active:scale-95"
            style={{ borderColor: "oklch(0.25 0.02 240)", color: "oklch(0.55 0.01 240)" }}>‹</button>
          <span className="text-xs font-semibold min-w-[90px] text-center">{monthLabel}</span>
          <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="w-6 h-6 flex items-center justify-center rounded text-xs border transition-all hover:opacity-80 active:scale-95"
            style={{ borderColor: "oklch(0.25 0.02 240)", color: "oklch(0.55 0.01 240)" }}>›</button>
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
                background: lvl ? CELL_COLOR[lvl] : "rgba(255,255,255,0.04)",
                border: isToday
                  ? "1.5px solid oklch(0.65 0.18 200)"
                  : lvl ? `1px solid ${CELL_BORDER[lvl]}` : "1px solid rgba(255,255,255,0.06)",
                color: lvl ? "#fff" : "oklch(0.45 0.01 240)",
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

  // ─── 위험도 임계값 state (클라이언트 전용) ───────────────────────────────────
  const [thresholds, setThresholds] = useState({ normal: 29, caution: 49, warning: 69 });
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
  const [muted, setMuted] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const LOG_PAGE_SIZE = 10;
  const [scoreHistory, setScoreHistory] = useState<number[]>([10]);
  const [logFilter, setLogFilter] = useState<RiskLevel | "all">("all");

  // ─── 경고음 콜백 ─────────────────────────────────────────────────────────
  const playAlert = useCallback(() => {
    if (!muted) playDangerAlertSound();
  }, [muted]);

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
  const { data: logsData, isLoading: logsLoading } = getLogs;

  const [lastInjectedMode, setLastInjectedMode] = useState<RiskLevel | null>(null);

  const sensorData = current?.sensorData;
  const anomalyScore = current?.anomalyScore ?? 0;
  const riskLevel = current?.riskLevel ?? "normal";
  const logs = logsData ?? [];
  const filteredLogs = useMemo(
    () => {
      let result = logs;
      if (selectedDate) result = result.filter(l => l.timestamp.slice(0, 10) === selectedDate);
      if (logFilter !== "all") result = result.filter(l => l.riskLevel === logFilter);
      return result;
    },
    [logs, logFilter, selectedDate]
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
    <div className="min-h-screen flex flex-col" style={{ background: "oklch(0.10 0.01 240)" }}>
      {/* ── 위험 상태 팝업 ── */}
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
      <header className="sticky top-0 z-50 border-b flex items-center justify-between px-5 py-3"
        style={{ background: "oklch(0.115 0.015 240)", borderColor: "oklch(0.20 0.02 240)" }}>
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
        <div className="flex items-center gap-5">
          <HeartbeatIndicator alive={heartbeatAlive} t={t} />
          <div className="w-px h-5 bg-border" />
          <AlertPanel riskLevel={riskLevel} relayTripped={relayTripped} t={t} />
          <div className="w-px h-5 bg-border" />
          <button onClick={() => setLang(l => l === "ko" ? "en" : "ko")}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 hover:opacity-80 active:scale-95"
            style={{ borderColor: "oklch(0.65 0.18 200 / 0.4)", color: "oklch(0.65 0.18 200)", background: "oklch(0.65 0.18 200 / 0.08)" }}>
            {lang === "ko" ? "EN" : "한국어"}
          </button>
          {/* 음소거 토글 */}
          <button
            onClick={() => setMuted(m => !m)}
            title={muted ? (lang === "ko" ? "소리 켜기" : "Unmute") : (lang === "ko" ? "소리 끄기" : "Mute")}
            className="w-8 h-8 flex items-center justify-center rounded-lg border transition-all duration-200 hover:opacity-80 active:scale-95 text-base"
            style={{
              borderColor: muted ? "oklch(0.35 0.01 240)" : "oklch(0.65 0.18 200 / 0.4)",
              color: muted ? "oklch(0.45 0.01 240)" : "oklch(0.65 0.18 200)",
              background: muted ? "oklch(0.15 0.01 240)" : "oklch(0.65 0.18 200 / 0.08)",
            }}>
            {muted ? "🔕" : "🔔"}
          </button>
        </div>
      </header>

      {/* ── 랜딩 섹션 ── */}
      {showLanding && (
        <div className="border-b px-5 py-6" style={{ borderColor: "oklch(0.20 0.02 240)", background: "linear-gradient(135deg, oklch(0.13 0.015 240), oklch(0.12 0.01 240))" }}>
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
              style={{ borderColor: "oklch(0.25 0.02 240)", color: "oklch(0.50 0.01 240)" }}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── 탭 ── */}
      <div className="flex border-b px-5" style={{ borderColor: "oklch(0.20 0.02 240)" }}>
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

      <main className="flex-1 p-5">
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
            <div className="rounded-xl border p-5 mb-6 flex flex-col gap-2"
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
            <div className="grid grid-cols-12 gap-4">
              {/* ── 임계값 설정 패널 (전체 너비) ── */}
              <div className="col-span-12 mb-2">
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "oklch(0.20 0.02 240)" }}>
                  <button
                    onClick={() => setShowThresholdPanel(p => !p)}
                    className="w-full flex items-center justify-between px-5 py-3 text-left transition-all hover:opacity-80"
                    style={{ background: "oklch(0.13 0.015 240)" }}>
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
                      style={{ background: "oklch(0.115 0.015 240)", borderColor: "oklch(0.20 0.02 240)" }}>
                      {/* 정상 임계값 */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#22c55e" }}>
                            {lang === "ko" ? "정상 최대 점수" : "Normal Max"}
                          </label>
                          <span className="text-xs font-mono font-bold" style={{ color: "#22c55e" }}>{thresholds.normal}</span>
                        </div>
                        <input type="range" min={10} max={thresholds.caution - 1} value={thresholds.normal}
                          onChange={e => setThresholds(p => ({ ...p, normal: Number(e.target.value) }))}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                          style={{ accentColor: "#22c55e" }} />
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
                          onChange={e => setThresholds(p => ({ ...p, caution: Number(e.target.value) }))}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                          style={{ accentColor: "#eab308" }} />
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
                          onChange={e => setThresholds(p => ({ ...p, warning: Number(e.target.value) }))}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                          style={{ accentColor: "#f97316" }} />
                        <p className="text-[9px] text-muted-foreground">{lang === "ko" ? `이 점수 초과 → 위험 (현재 >${thresholds.warning})` : `Score > this → Danger (now >${thresholds.warning})`}</p>
                      </div>
                      {/* 초기화 버튼 */}
                      <div className="col-span-1 md:col-span-3 flex justify-end">
                        <button
                          onClick={() => setThresholds({ normal: 29, caution: 49, warning: 69 })}
                          className="text-[10px] px-3 py-1.5 rounded-lg border transition-all hover:opacity-80 active:scale-95"
                          style={{ borderColor: "oklch(0.25 0.02 240)", color: "oklch(0.50 0.01 240)" }}>
                          {lang === "ko" ? "기본값으로 초기화" : "Reset to Default"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── 왼쪽: 센서 카드 ── */}
              <div className="col-span-12 lg:col-span-3 flex flex-col gap-3">
                {[
                  { label: t.current,     value: sensorData?.current     ?? 5.0,  unit: t.unitA,   color: "#38bdf8", icon: "⚡" },
                  { label: t.temperature, value: sensorData?.temperature ?? 45.0, unit: t.unitC,   color: "#fb923c", icon: "🌡" },
                  { label: t.vibration,   value: sensorData?.vibration   ?? 2.0,  unit: t.unitMms, color: "#a78bfa", icon: "📳" },
                  { label: t.noise,       value: sensorData?.noise       ?? 55.0, unit: t.unitDb,  color: "#34d399", icon: "🔊" },
                ].map(card => (
                  <div key={card.label} className="rounded-xl p-4 border flex flex-col gap-2 transition-all duration-300"
                    style={{ background: "rgba(255,255,255,0.025)", borderColor: `${card.color}35` }}>
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
                ))}
              </div>

              {/* ── 가운데: 차트 ── */}
              <div className="col-span-12 lg:col-span-6 flex flex-col gap-4">
                {/* 전류 + 온도 */}
                <div className="rounded-xl border p-4" style={{ background: "oklch(0.13 0.015 240)", borderColor: "oklch(0.20 0.02 240)" }}>
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
                <div className="rounded-xl border p-4" style={{ background: "oklch(0.13 0.015 240)", borderColor: "oklch(0.20 0.02 240)" }}>
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
                  style={{ background: "oklch(0.13 0.015 240)", borderColor: "oklch(0.20 0.02 240)" }}>
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
                  style={{ background: "rgba(255,255,255,0.03)", borderColor: "oklch(0.25 0.02 240)", color: "#6b7280" }}>
                  {resetCostMutation.isPending
                    ? <span className="flex items-center justify-center gap-1.5"><ButtonSpinner color="#6b7280" /><span>{t.processing}</span></span>
                    : `↺ ${t.resetCost}`}
                </button>
              </div>
            </div>
            {/* ── 월간 히트맵 캘린더 ── */}
            <div className="mt-4">
              <MonthlyHeatmap
                dailyData={getDailyMaxRisk.data ?? []}
                lang={lang}
                t={t}
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
          /* ── 이상 이력 로그 탭 ── */

        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "oklch(0.20 0.02 240)" }}>
          {/* 탭 헤더 - 2행 구조 */}
          <div className="px-5 py-3 border-b flex flex-col gap-2"
            style={{ background: "oklch(0.13 0.015 240)", borderColor: "oklch(0.20 0.02 240)" }}>
          {/* 1행: 제목 + CSV/클리어 버튼 */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{t.anomalyLog}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!logs || logs.length === 0) {
                    toast.info(lang === "ko" ? "내보낼 로그가 없습니다." : "No logs to export.");
                    return;
                  }
                  exportLogsToCSV(logs, lang);
                  toast.success(t.exportCsvSuccess);
                }}
                className="text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 hover:opacity-80 active:scale-95"
                style={{ borderColor: "oklch(0.65 0.18 200 / 0.4)", color: "oklch(0.65 0.18 200)", background: "oklch(0.65 0.18 200 / 0.08)" }}>
                ⬇ {t.exportCsv}
              </button>
              <button onClick={handleClearLogs}
                className="text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 hover:opacity-70"
                style={{ borderColor: "oklch(0.25 0.02 240)", color: "oklch(0.50 0.01 240)" }}>
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
                  <tr style={{ background: "oklch(0.12 0.015 240)", borderBottom: "1px solid oklch(0.20 0.02 240)" }}>
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
                      <tr key={log.id} className="border-b transition-colors hover:bg-white/[0.015]"
                        style={{ borderColor: "oklch(0.17 0.015 240)" }}>
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
                style={{ borderColor: "oklch(0.20 0.02 240)", background: "oklch(0.12 0.015 240)" }}>
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
      `}</style>
    </div>
  );
}
