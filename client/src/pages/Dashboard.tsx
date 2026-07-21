import { useEffect, useRef, useState } from "react";
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
  const [showLanding, setShowLanding] = useState(true);
  const autoPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [dangerAlert, setDangerAlert] = useState(false);

  const injectNormal = trpc.semiguard.injectNormal.useMutation();
  const injectAnomaly = trpc.semiguard.injectAnomaly.useMutation();
  const clearLogs = trpc.semiguard.clearLogs.useMutation();
  const trackVisit = trpc.semiguard.trackVisit.useMutation();
  const injectCaution = trpc.semiguard.injectCaution.useMutation();
  const injectWarning = trpc.semiguard.injectWarning.useMutation();
  const resetCostMutation = trpc.semiguard.resetSavedCost.useMutation();
  const getStats = trpc.semiguard.getStats.useQuery(undefined, { refetchInterval: 5000 });
  const getLogs = trpc.semiguard.getLogs.useQuery({ limit: 50 }, { refetchInterval: 5000 });
  const utils = trpc.useUtils();
  const { data: logsData, isLoading: logsLoading } = getLogs;

  const [lastInjectedMode, setLastInjectedMode] = useState<RiskLevel | null>(null);

  const sensorData = current?.sensorData;
  const anomalyScore = current?.anomalyScore ?? 0;
  const riskLevel = current?.riskLevel ?? "normal";
  const logs = logsData ?? [];

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
      setCurrent(result);
      setChartData(prev => {
        const updated = [...prev, { ...result.sensorData, label: `${elapsed}s` }];
        return updated.slice(-MAX_CHART_POINTS);
      });
      setHeartbeatAlive(true);
      if (result.riskLevel === "danger") {
        setRelayTripped(true);
        setDangerAlert(true);
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
      setCurrent(result);
      setChartData(prev => [...prev, { ...result.sensorData, label: `${prev.length}` }].slice(-MAX_CHART_POINTS));
      await utils.semiguard.getStats.invalidate();
      await utils.semiguard.getLogs.invalidate();
      setLastInjectedMode("normal");
      toast.success("정상 상태 주입됨");
    } catch (e) {
      toast.error(t.error);
      setHeartbeatAlive(false);
    }
  };

  const handleInjectAnomaly = async () => {
    try {
      const result = await injectAnomaly.mutateAsync();
      setCurrent(result);
      setChartData(prev => [...prev, { ...result.sensorData, label: `${prev.length}` }].slice(-MAX_CHART_POINTS));
      await utils.semiguard.getStats.invalidate();
      await utils.semiguard.getLogs.invalidate();
      setLastInjectedMode("danger");
      if (result.riskLevel === "danger") {
        setRelayTripped(true);
        setDangerAlert(true);
        setTimeout(() => setRelayTripped(false), 2000);
        toast.error("⚠️ 위험 단계 도달! 릴레이 차단됨");
      } else {
        toast.warning("이상 상태 주입됨");
      }
    } catch (e) {
      toast.error(t.error);
      setHeartbeatAlive(false);
    }
  };

  const handleInjectCaution = async () => {
    try {
      const result = await injectCaution.mutateAsync();
      setCurrent(result);
      setChartData(prev => [...prev, { ...result.sensorData, label: `${prev.length}` }].slice(-MAX_CHART_POINTS));
      await utils.semiguard.getStats.invalidate();
      await utils.semiguard.getLogs.invalidate();
      setLastInjectedMode("caution");
      toast.warning("⚡ 주의 단계 주입됨");
    } catch (e) {
      toast.error(t.error);
    }
  };

  const handleInjectWarning = async () => {
    try {
      const result = await injectWarning.mutateAsync();
      setCurrent(result);
      setChartData(prev => [...prev, { ...result.sensorData, label: `${prev.length}` }].slice(-MAX_CHART_POINTS));
      await utils.semiguard.getStats.invalidate();
      await utils.semiguard.getLogs.invalidate();
      setLastInjectedMode("warning");
      toast.warning("🔶 경고 단계 주입됨");
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
      anomalyScore: 15,
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

    const score = Math.min(100, Math.round(((zCurrent + zTemp + zVib + zNoise) / 4) * 25));
    const riskLevel: RiskLevel = score <= 29 ? "normal" : score <= 49 ? "caution" : score <= 69 ? "warning" : "danger";
    const isAnomaly = score >= 70;

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
                      {injectNormal.isPending ? "..." : `▶ ${t.injectNormal}`}
                    </button>
                    <button onClick={handleInjectCaution} disabled={injectCaution.isPending}
                      className="py-2 rounded-lg text-xs font-semibold border transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                      style={{ background: "rgba(234,179,8,0.10)", borderColor: "#eab30845", color: "#eab308" }}>
                      {injectCaution.isPending ? "..." : `⚡ ${t.injectCaution}`}
                    </button>
                    <button onClick={handleInjectWarning} disabled={injectWarning.isPending}
                      className="py-2 rounded-lg text-xs font-semibold border transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                      style={{ background: "rgba(249,115,22,0.10)", borderColor: "#f9731645", color: "#f97316" }}>
                      {injectWarning.isPending ? "..." : `🔶 ${t.injectWarning}`}
                    </button>
                    <button onClick={handleInjectAnomaly} disabled={injectAnomaly.isPending}
                      className="py-2 rounded-lg text-xs font-semibold border transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                      style={{ background: "rgba(239,68,68,0.10)", borderColor: "#ef444445", color: "#ef4444" }}>
                      {injectAnomaly.isPending ? "..." : `⚠ ${t.injectAnomaly}`}
                    </button>
                  </div>
                </div>
                {/* 절감 비용 리셋 버튼 */}
                <button onClick={handleResetCost} disabled={resetCostMutation.isPending}
                  className="w-full py-2 rounded-lg text-xs font-semibold border transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                  style={{ background: "rgba(255,255,255,0.03)", borderColor: "oklch(0.25 0.02 240)", color: "#6b7280" }}>
                  {resetCostMutation.isPending ? t.processing : `↺ ${t.resetCost}`}
                </button>
              </div>
            </div>
          </>
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
          </div>
        )}
      </main>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
