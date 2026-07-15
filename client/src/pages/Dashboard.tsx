import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { translations, type Lang, type Translation } from "@/lib/i18n";
import type { RiskLevel, SensorData, AnomalyResult } from "../../../shared/semiguard";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { toast } from "sonner";

// ─── 위험도 색상 매핑 ────────────────────────────────────────────────────────
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
  const circumference = 2 * Math.PI * 48;
  const offset = circumference * (1 - score / 100);

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
          <span className="text-4xl font-bold font-mono leading-none" style={{ color, transition: "color 0.4s" }}>{score}</span>
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
            style={{
              background: riskLevel === lvl ? RISK_COLORS[lvl] : "rgba(255,255,255,0.07)",
              boxShadow: riskLevel === lvl ? `0 0 8px ${RISK_COLORS[lvl]}70` : "none",
            }} />
        ))}
      </div>
    </div>
  );
}

// ─── Heartbeat ───────────────────────────────────────────────────────────────
function HeartbeatIndicator({ alive, t }: { alive: boolean; t: Translation }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${alive ? "animate-pulse-green" : "animate-pulse-red"}`}
        style={{ background: alive ? "#22c55e" : "#ef4444" }} />
      <span className="text-[11px] text-muted-foreground hidden sm:inline">{t.heartbeat}</span>
      <span className="text-[11px] font-semibold" style={{ color: alive ? "#22c55e" : "#ef4444" }}>
        {alive ? t.heartbeatOk : t.heartbeatFail}
      </span>
    </div>
  );
}

// ─── 경고등 + 부저 + 릴레이 패널 ────────────────────────────────────────────
function AlertPanel({ riskLevel, relayTripped, t }: { riskLevel: RiskLevel; relayTripped: boolean; t: Translation }) {
  const isDanger = riskLevel === "danger";
  const isWarnPlus = riskLevel === "warning" || riskLevel === "danger";
  return (
    <div className="flex items-center gap-3">
      {/* 경고등 */}
      <div className="flex flex-col items-center gap-0.5">
        <div className={`w-7 h-7 rounded-full border-2 transition-all duration-300 ${isDanger ? "animate-blink glow-red" : isWarnPlus ? "glow-orange" : ""}`}
          style={{
            background: isDanger ? "#ef4444" : isWarnPlus ? "#f97316" : "rgba(255,255,255,0.04)",
            borderColor: isDanger ? "#ef4444" : isWarnPlus ? "#f97316" : "rgba(255,255,255,0.12)",
          }} />
        <span className="text-[9px] text-muted-foreground">{t.alertLight}</span>
      </div>
      {/* 부저 */}
      <div className="flex flex-col items-center gap-0.5">
        <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs transition-all duration-300 ${isDanger ? "animate-blink" : ""}`}
          style={{
            background: isDanger ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.03)",
            borderColor: isDanger ? "#ef4444" : "rgba(255,255,255,0.12)",
            color: isDanger ? "#ef4444" : "rgba(255,255,255,0.25)",
          }}>🔔</div>
        <span className="text-[9px] text-muted-foreground">{t.buzzer}</span>
      </div>
      {/* 릴레이 */}
      <div className="flex flex-col items-center gap-0.5">
        <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all duration-300`}
          style={{
            background: relayTripped ? "rgba(239,68,68,0.18)" : "rgba(34,197,94,0.08)",
            borderColor: relayTripped ? "#ef4444" : "#22c55e50",
            color: relayTripped ? "#ef4444" : "#22c55e",
          }}>{relayTripped ? "✕" : "✓"}</div>
        <span className="text-[9px] text-muted-foreground">{t.relayStatus}</span>
      </div>
    </div>
  );
}

// ─── 커스텀 차트 툴팁 ────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border px-3 py-2 text-xs" style={{ background: "#111827", borderColor: "#1f2937" }}>
      <p className="text-muted-foreground mb-1 font-mono">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <span className="font-mono font-semibold">{Number(p.value).toFixed(2)}</span>
        </p>
      ))}
    </div>
  );
};

// ─── 메인 대시보드 ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [lang, setLang] = useState<Lang>("ko");
  const t = translations[lang] as Translation;

  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [current, setCurrent] = useState<AnomalyResult | null>(null);
  const [heartbeatAlive, setHeartbeatAlive] = useState(true);
  const lastUpdateRef = useRef<number>(Date.now());
  const [relayTripped, setRelayTripped] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "log">("dashboard");
  const [initialized, setInitialized] = useState(false);
  const autoPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const injectNormal = trpc.semiguard.injectNormal.useMutation();
  const injectAnomaly = trpc.semiguard.injectAnomaly.useMutation();
  const clearLogs = trpc.semiguard.clearLogs.useMutation();
  const utils = trpc.useUtils();

  const { data: logs, isLoading: logsLoading } = trpc.semiguard.getLogs.useQuery(
    { limit: 50 },
    { refetchInterval: 3000 }
  );

  const handleResult = useCallback((result: AnomalyResult) => {
    setCurrent(result);
    lastUpdateRef.current = Date.now();
    setHeartbeatAlive(true);
    const locale = lang === "ko" ? "ko-KR" : "en-US";
    const label = new Date(result.sensorData.timestamp).toLocaleTimeString(locale, { hour12: false });
    setChartData(prev => [...prev, { ...result.sensorData, label }].slice(-MAX_CHART_POINTS));
    if (result.riskLevel === "danger") {
      setRelayTripped(true);
    } else {
      setRelayTripped(false);
    }
    utils.semiguard.getLogs.invalidate();
  }, [utils]);

  // Heartbeat 감시
  useEffect(() => {
    const id = setInterval(() => {
      setHeartbeatAlive(Date.now() - lastUpdateRef.current < 10000);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // 초기 정상 데이터 10개 순차 주입
  useEffect(() => {
    if (initialized) return;
    setInitialized(true);
    let count = 0;
    const inject = () => {
      if (count >= 12) return;
      injectNormal.mutate(undefined, {
        onSuccess: (res) => {
          handleResult(res as AnomalyResult);
          count++;
          if (count < 12) setTimeout(inject, 150);
          else {
            autoPollingRef.current = setInterval(() => {
              injectNormal.mutate(undefined, {
                onSuccess: (r) => handleResult(r as AnomalyResult),
              });
            }, 4000);
          }
        },
      });
    };
    inject();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => { if (autoPollingRef.current) clearInterval(autoPollingRef.current); };
  }, []);

  const handleInjectNormal = () => {
    injectNormal.mutate(undefined, {
      onSuccess: (res) => handleResult(res as AnomalyResult),
      onError: () => toast.error(t.error),
    });
  };

  const handleInjectAnomaly = () => {
    injectAnomaly.mutate(undefined, {
      onSuccess: (res) => {
        handleResult(res as AnomalyResult);
        const r = res as AnomalyResult;
        if (r.riskLevel === "danger") {
          toast.error(lang === "ko" ? "⚠️ 위험 감지! 릴레이 차단 작동" : "⚠️ Danger! Relay tripped", { duration: 4000 });
        } else if (r.riskLevel === "warning") {
          toast.warning(lang === "ko" ? "⚠ 경고 상태 감지" : "⚠ Warning state detected");
        }
      },
      onError: () => toast.error(t.error),
    });
  };

  const handleClearLogs = () => {
    clearLogs.mutate(undefined, {
      onSuccess: () => {
        utils.semiguard.getLogs.invalidate();
        toast.success(lang === "ko" ? "로그가 초기화되었습니다." : "Logs cleared.");
      },
    });
  };

  const riskLevel: RiskLevel = current?.riskLevel ?? "normal";
  const anomalyScore = current?.anomalyScore ?? 0;
  const sensorData = current?.sensorData;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "oklch(0.10 0.01 240)" }}>
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
        </div>
      </header>

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
          <div className="grid grid-cols-12 gap-4">
            {/* ── 왼쪽: 센서 카드 ── */}
            <div className="col-span-12 lg:col-span-3 flex flex-col gap-3">
              <SensorCard label={t.current}     value={sensorData?.current     ?? 5.0}  unit={t.unitA}   color="#38bdf8" icon="⚡" />
              <SensorCard label={t.temperature} value={sensorData?.temperature ?? 45.0} unit={t.unitC}   color="#fb923c" icon="🌡" />
              <SensorCard label={t.vibration}   value={sensorData?.vibration   ?? 2.0}  unit={t.unitMms} color="#a78bfa" icon="📳" />
              <SensorCard label={t.noise}       value={sensorData?.noise       ?? 55.0} unit={t.unitDb}  color="#34d399" icon="🔊" />
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

              {/* 시뮬레이터 */}
              <div className="rounded-xl border p-4 flex flex-col gap-3"
                style={{ background: "oklch(0.13 0.015 240)", borderColor: "oklch(0.20 0.02 240)" }}>
                <div>
                  <p className="text-xs font-semibold">{t.simulatorTitle}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{t.simulatorDesc}</p>
                </div>
                <button onClick={handleInjectNormal} disabled={injectNormal.isPending}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold border transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                  style={{ background: "rgba(34,197,94,0.10)", borderColor: "#22c55e45", color: "#22c55e" }}>
                  {injectNormal.isPending ? t.processing : `▶ ${t.injectNormal}`}
                </button>
                <button onClick={handleInjectAnomaly} disabled={injectAnomaly.isPending}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold border transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                  style={{ background: "rgba(239,68,68,0.10)", borderColor: "#ef444445", color: "#ef4444" }}>
                  {injectAnomaly.isPending ? t.processing : `⚠ ${t.injectAnomaly}`}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ── 이상 이력 로그 탭 ── */
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "oklch(0.20 0.02 240)" }}>
            <div className="flex items-center justify-between px-5 py-3 border-b"
              style={{ background: "oklch(0.13 0.015 240)", borderColor: "oklch(0.20 0.02 240)" }}>
              <p className="text-sm font-semibold">{t.anomalyLog}</p>
              <button onClick={handleClearLogs}
                className="text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 hover:opacity-70"
                style={{ borderColor: "oklch(0.25 0.02 240)", color: "oklch(0.50 0.01 240)" }}>
                {t.clearLogs}
              </button>
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
                  ) : logs.map(log => {
                    const lvl = log.riskLevel as RiskLevel;
                    const color = RISK_COLORS[lvl];
                    return (
                      <tr key={log.id} className="border-b transition-colors hover:bg-white/[0.015]"
                        style={{ borderColor: "oklch(0.17 0.015 240)" }}>
                        <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString("ko-KR", { hour12: false })}
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
          </div>
        )}
      </main>
    </div>
  );
}
