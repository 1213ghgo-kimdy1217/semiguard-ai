import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import { translations, type Lang, type Translation } from "@/lib/i18n";
import type { RiskLevel, SensorData, AnomalyResult, AnomalyLogEntry } from "../../../shared/semiguard";
import { MANUAL_CHUNK_LIMIT, MANUAL_CHUNK_WARNING_THRESHOLD, splitManualTextIntoChunks } from "../../../shared/ragManual";
import { Brush, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { toast } from "sonner";
import { startGoogleLink, startNaverLink, startKakaoLink } from "@/const";
import { Tooltip as AppTooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const FALLBACK_DIAGNOSTIC_MARKERS = ["[기본 안전 진단]", "[基本安全診断]", "[Baseline Safety Diagnosis]"] as const;
const CUSTOM_PERIOD_PRESETS_KEY = "semiguard_custom_period_presets";
const MAX_CUSTOM_PERIOD_PRESETS = 8;
const FIRST_USE_FEEDBACK_PROMPT_DISMISSED_KEY = "semiguard_first_use_feedback_prompt_dismissed";

type CustomPeriodPreset = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

function readDashboardPreference(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function persistDashboardPreference(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 저장소가 제한된 경우에도 현재 세션의 대시보드 상태는 계속 유지합니다.
  }
}

async function copyTextWithFallback(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Permission-denied clipboard calls use the legacy copy path below.
  }

  const temporaryInput = document.createElement("textarea");
  temporaryInput.value = value;
  temporaryInput.setAttribute("readonly", "");
  temporaryInput.style.position = "fixed";
  temporaryInput.style.opacity = "0";
  document.body.appendChild(temporaryInput);
  try {
    temporaryInput.select();
    return document.execCommand("copy");
  } finally {
    temporaryInput.remove();
  }
}

function getKeyboardScrollBehavior(): ScrollBehavior {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function readCustomPeriodPresets(): CustomPeriodPreset[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_PERIOD_PRESETS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((preset): preset is CustomPeriodPreset => typeof preset?.id === "string" && typeof preset?.name === "string" && /^\d{4}-\d{2}-\d{2}$/.test(preset?.startDate ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(preset?.endDate ?? "")).slice(0, MAX_CUSTOM_PERIOD_PRESETS);
  } catch {
    return [];
  }
}

function persistCustomPeriodPresets(presets: CustomPeriodPreset[]) {
  persistDashboardPreference(CUSTOM_PERIOD_PRESETS_KEY, JSON.stringify(presets.slice(0, MAX_CUSTOM_PERIOD_PRESETS)));
}

// ─── 위험도 색상 매핑 ────────────────────────────────────────────────────────
// ─── 버튼 스피너 ─────────────────────────────────────────────────────────────
// ─── 미니 스파크라인 ──────────────────────────────────────────────────────────
function Sparkline({ data, color, label }: { data: number[]; color: string; label: string }) {
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
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }} role="img" aria-label={label}>
      <title>{label}</title>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <circle cx={lx} cy={ly} r="2.5" fill={color} />
    </svg>
  );
}

// ─── CSV 내보내기 ─────────────────────────────────────────────────────────────
function exportLogsToCSV(logs: AnomalyLogEntry[], lang: Lang) {
  const headers = lang === "ko"
    ? ["관측 로그 ID", "발생 시각", "전류(A)", "온도(°C)", "진동(mm/s)", "소음(dB)", "이상 점수", "위험도", "이상 여부"]
    : lang === "ja"
      ? ["観測ログID", "発生時刻", "電流(A)", "温度(°C)", "振動(mm/s)", "騒音(dB)", "異常スコア", "リスクレベル", "異常判定"]
      : ["Observation log ID", "Time", "Current(A)", "Temp(°C)", "Vib(mm/s)", "Noise(dB)", "Score", "Level", "Anomaly"];
  // 쉼표·따옴표·줄바꿈이 포함된 셀을 RFC 4180 방식으로 이스케이프
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = logs.map(log => [
    escape(log.id),
    escape(new Date(log.timestamp).toLocaleString(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", { hour12: false })),
    escape(log.current.toFixed(2)),
    escape(log.temperature.toFixed(1)),
    escape(log.vibration.toFixed(2)),
    escape(log.noise.toFixed(1)),
    escape(log.anomalyScore),
    escape(localizeRiskLevel(log.riskLevel, lang)),
    escape(log.isAnomaly ? (lang === "ko" ? "이상" : lang === "ja" ? "異常" : "Anomaly") : (lang === "ko" ? "정상" : lang === "ja" ? "正常" : "Normal")),
  ]);
  const csv = [headers.map(h => escape(h)), ...rows].map(r => r.join(",")).join("\n");
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const filenamePrefix = lang === "ko" ? "세미가드_이상기록" : lang === "ja" ? "セミガード_異常履歴" : "semiguard_logs";
  a.download = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type DownloadableLlmAnalysis = {
  primaryCause: string;
  details: string;
  recommendation: string;
  score: number;
  riskLevel: string;
};

function buildLlmAnalysisText(analysis: DownloadableLlmAnalysis, lang: Lang) {
  const title = lang === "ko" ? "SemiGuard AI 이상 분석 결과" : lang === "ja" ? "SemiGuard AI 異常分析結果" : "SemiGuard AI Anomaly Analysis";
  const labels = lang === "ko"
    ? { risk: "위험 단계", score: "위험도 점수", cause: "주요 원인", evidence: "분석 근거", action: "권장 점검 순서", note: "본 결과는 점검 판단을 돕는 참고 자료이며 설비 제어 명령이 아닙니다." }
    : lang === "ja"
      ? { risk: "リスクレベル", score: "リスクスコア", cause: "主な原因", evidence: "分析根拠", action: "推奨点検順序", note: "本結果は点検判断を支援する参考情報であり、設備制御命令ではありません。" }
      : { risk: "Risk level", score: "Risk score", cause: "Primary cause", evidence: "Analysis evidence", action: "Recommended inspection order", note: "This result supports inspection judgment and is not an equipment control command." };
  return `${title}\n${"=".repeat(title.length)}\n\n${labels.risk}: ${localizeRiskLevel(analysis.riskLevel, lang)}\n${labels.score}: ${analysis.score.toFixed(0)}\n${labels.cause}: ${analysis.primaryCause}\n\n${labels.evidence}\n${analysis.details}\n\n${labels.action}\n${analysis.recommendation}\n\n${labels.note}\n`;
}

function downloadLlmAnalysisText(analysis: DownloadableLlmAnalysis, lang: Lang) {
  const blob = new Blob(["\uFEFF", buildLlmAnalysisText(analysis, lang)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const filenamePrefix = lang === "ko" ? "세미가드_AI분석결과" : lang === "ja" ? "セミガード_AI分析結果" : "semiguard_ai_analysis";
  anchor.download = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function openLlmAnalysisPdf(analysis: DownloadableLlmAnalysis, lang: Lang) {
  const reportWindow = window.open("", "_blank", "width=900,height=760");
  if (!reportWindow) {
    const errorMessage = lang === "ko"
      ? "분석 보고서 창을 열 수 없습니다."
      : lang === "ja"
        ? "分析レポートウィンドウを開けませんでした。"
        : "Could not open the analysis report window.";
    throw new Error(errorMessage);
  }
  const title = lang === "ko" ? "SemiGuard AI 이상 분석 결과" : lang === "ja" ? "SemiGuard AI 異常分析結果" : "SemiGuard AI Anomaly Analysis";
  const text = buildLlmAnalysisText(analysis, lang);
  reportWindow.document.open();
  reportWindow.document.write(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"/><title>${title}</title><style>body{font-family:Arial,sans-serif;color:#102a43;max-width:760px;margin:48px auto;padding:0 24px;line-height:1.65}h1{font-size:24px}pre{white-space:pre-wrap;font:14px/1.7 Arial,sans-serif;border:1px solid #d9e2ec;border-radius:12px;padding:22px;background:#f8fafc}@media print{body{margin:0 auto}}</style></head><body><h1>${title}</h1><pre>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre><script>setTimeout(() => window.print(), 250)</script></body></html>`);
  reportWindow.document.close();
}

type PeriodOverviewData = {
  period: "day" | "week" | "month" | "custom";
  startAt: string;
  endAt: string;
  totalDetections: number;
  dangerCount: number;
  anomalyCount: number;
  uptimePct: number;
  savedCost: number;
  totalVisitors: number;
  sensors: {
    average: { current: number; temperature: number; vibration: number; noise: number };
    peak: { current: number; temperature: number; vibration: number; noise: number };
  };
  scoreHistory: Array<{ timestamp: string; score: number; riskLevel: string; current: number; temperature: number; vibration: number; noise: number }>;
};

type PeriodReportAiSummary = {
  headline: string;
  summary: string;
  recommendation: string;
  forecastLevel: "normal" | "caution" | "warning" | "danger";
  confidence: "low" | "medium" | "high";
  evidence: string;
  alert: boolean;
  source: "ai" | "fallback";
};

function escapeCsvCell(value: string | number) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function localizeRiskLevel(level: string, lang: Lang) {
  const labels = lang === "ko"
    ? { normal: "정상", caution: "주의", warning: "경고", danger: "위험" }
    : lang === "ja"
      ? { normal: "正常", caution: "注意", warning: "警告", danger: "危険" }
      : { normal: "Normal", caution: "Caution", warning: "Warning", danger: "Danger" };
  return labels[level as keyof typeof labels] ?? level;
}

function toLocalDateBoundaryIso(dateValue: string, isEndOfDay = false) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day, isEndOfDay ? 23 : 0, isEndOfDay ? 59 : 0, isEndOfDay ? 59 : 0, isEndOfDay ? 999 : 0).toISOString();
}

function buildSensorTrendChartImage(history: PeriodOverviewData["scoreHistory"], lang: Lang) {
  if (history.length === 0) return null;
  const copy = lang === "ko"
    ? { title: "센서 데이터 추이", noData: "표시할 센서 데이터가 없습니다.", current: "전류", temperature: "온도", vibration: "진동", noise: "소음" }
    : lang === "ja"
      ? { title: "センサーデータ推移", noData: "表示するセンサーデータがありません。", current: "電流", temperature: "温度", vibration: "振動", noise: "騒音" }
      : { title: "Sensor data trends", noData: "No sensor data is available.", current: "Current", temperature: "Temperature", vibration: "Vibration", noise: "Noise" };
  const points = history.slice(-120);
  const dimensions = { width: 740, height: 270, left: 42, right: 22, top: 42, bottom: 36 };
  const plotWidth = dimensions.width - dimensions.left - dimensions.right;
  const plotHeight = dimensions.height - dimensions.top - dimensions.bottom;
  const series = [
    { key: "current" as const, label: copy.current, color: "#1d9bf0" },
    { key: "temperature" as const, label: copy.temperature, color: "#f97316" },
    { key: "vibration" as const, label: copy.vibration, color: "#a855f7" },
    { key: "noise" as const, label: copy.noise, color: "#16a34a" },
  ];
  const x = (index: number) => dimensions.left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const grid = Array.from({ length: 5 }, (_, index) => {
    const y = dimensions.top + (index / 4) * plotHeight;
    return `<line x1="${dimensions.left}" y1="${y.toFixed(1)}" x2="${dimensions.width - dimensions.right}" y2="${y.toFixed(1)}" stroke="#d9e2ec" stroke-width="1"/>`;
  }).join("");
  const lines = series.map(({ key, label, color }) => {
    const values = points.map(point => Number(point[key]));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const polyline = values.map((value, index) => `${x(index).toFixed(1)},${(dimensions.top + plotHeight - ((value - min) / range) * plotHeight).toFixed(1)}`).join(" ");
    return `<polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><text x="${dimensions.left}" y="${dimensions.top + 15 + series.findIndex(item => item.key === key) * 15}" fill="${color}" font-size="11" font-weight="700">${escapeReportHtml(label)} ${escapeReportHtml(min.toFixed(1))}–${escapeReportHtml(max.toFixed(1))}</text>`;
  }).join("");
  const locale = lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US";
  const startLabel = new Date(points[0].timestamp).toLocaleString(locale, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  const endLabel = new Date(points[points.length - 1].timestamp).toLocaleString(locale, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.width}" height="${dimensions.height}" viewBox="0 0 ${dimensions.width} ${dimensions.height}" role="img" aria-label="${escapeReportHtml(copy.title)}"><rect width="100%" height="100%" rx="12" fill="#f8fafc"/><text x="${dimensions.left}" y="24" fill="#102a43" font-family="Arial, sans-serif" font-size="15" font-weight="700">${escapeReportHtml(copy.title)}</text>${grid}${lines}<line x1="${dimensions.left}" y1="${dimensions.top + plotHeight}" x2="${dimensions.width - dimensions.right}" y2="${dimensions.top + plotHeight}" stroke="#9fb3c8" stroke-width="1"/><text x="${dimensions.left}" y="${dimensions.height - 13}" fill="#627d98" font-family="Arial, sans-serif" font-size="10">${escapeReportHtml(startLabel)}</text><text x="${dimensions.width - dimensions.right}" y="${dimensions.height - 13}" text-anchor="end" fill="#627d98" font-family="Arial, sans-serif" font-size="10">${escapeReportHtml(endLabel)}</text></svg>`;
  return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, alt: copy.title };
}

async function downloadSensorTrendChartImage(history: PeriodOverviewData["scoreHistory"], lang: Lang, format: "png" | "jpeg") {
  const chart = buildSensorTrendChartImage(history, lang);
  const errorCopy = lang === "ko"
    ? { noData: "내보낼 센서 데이터가 없습니다.", render: "센서 차트 이미지를 렌더링할 수 없습니다.", canvas: "브라우저에서 차트 이미지를 렌더링할 수 없습니다.", file: "센서 차트 이미지 파일을 만들 수 없습니다." }
    : lang === "ja"
      ? { noData: "出力するセンサーデータがありません。", render: "センサーチャート画像を描画できませんでした。", canvas: "ブラウザーでチャート画像を描画できませんでした。", file: "センサーチャート画像ファイルを作成できませんでした。" }
      : { noData: "No sensor points are available for image export.", render: "Could not render the sensor chart image.", canvas: "Canvas rendering is unavailable.", file: "Could not create the sensor chart image file." };
  if (!chart) throw new Error(errorCopy.noData);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(errorCopy.render));
    image.src = chart.src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 1480;
  canvas.height = 540;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(errorCopy.canvas);
  if (format === "jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const mimeType = format === "png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mimeType, 0.94));
  if (!blob) throw new Error(errorCopy.file);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const filenamePrefix = lang === "ko" ? "세미가드_센서구간" : lang === "ja" ? "セミガード_センサー区間" : "semiguard_sensor_range";
  anchor.download = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.${format === "jpeg" ? "jpg" : "png"}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportPeriodOverviewToCsv(overview: PeriodOverviewData, lang: Lang, periodLabel: string) {
  const locale = lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US";
  const labels = lang === "ko"
    ? { metric: "지표", value: "값", period: "분석 기간", visitors: "방문 수", detections: "총 탐지", anomalies: "이상 탐지", danger: "위험 탐지", uptime: "정상 가동률", savings: "예상 절감 비용(시연 가정·미검증)", sourceScope: "출처 범위", sourceScopeNote: "기간별 집계이며 개별 관측 로그 ID는 이상 이력 CSV에서 확인할 수 있습니다.", sensor: "센서", average: "평균", peak: "최고", time: "시각", score: "위험도 점수", level: "위험 단계" }
    : lang === "ja"
      ? { metric: "指標", value: "値", period: "分析期間", visitors: "訪問数", detections: "総検知", anomalies: "異常検知", danger: "危険検知", uptime: "稼働率", savings: "予想削減コスト（デモ仮定・未検証）", sourceScope: "出典範囲", sourceScopeNote: "期間別の集計であり、個別の観測ログIDは異常履歴CSVで確認できます。", sensor: "センサー", average: "平均", peak: "最大", time: "時刻", score: "リスクスコア", level: "リスクレベル" }
      : { metric: "Metric", value: "Value", period: "Analysis period", visitors: "Visitors", detections: "Total detections", anomalies: "Anomalies", danger: "Danger detections", uptime: "Uptime", savings: "Expected savings (demo assumption; unvalidated)", sourceScope: "Source scope", sourceScopeNote: "This is a period aggregate; individual observation log IDs are available in the anomaly-history CSV.", sensor: "Sensor", average: "Average", peak: "Peak", time: "Time", score: "Risk score", level: "Risk level" };
  const metrics = [
    [labels.period, periodLabel], [labels.visitors, overview.totalVisitors], [labels.detections, overview.totalDetections],
    [labels.anomalies, overview.anomalyCount], [labels.danger, overview.dangerCount], [labels.uptime, `${overview.uptimePct}%`], [labels.savings, `₩${overview.savedCost.toLocaleString(locale)}`], [labels.sourceScope, labels.sourceScopeNote],
  ];
  const sensors = [
    [lang === "ko" ? "전류 (A)" : lang === "ja" ? "電流 (A)" : "Current (A)", overview.sensors.average.current, overview.sensors.peak.current],
    [lang === "ko" ? "온도 (°C)" : lang === "ja" ? "温度 (°C)" : "Temperature (°C)", overview.sensors.average.temperature, overview.sensors.peak.temperature],
    [lang === "ko" ? "진동 (mm/s)" : lang === "ja" ? "振動 (mm/s)" : "Vibration (mm/s)", overview.sensors.average.vibration, overview.sensors.peak.vibration],
    [lang === "ko" ? "소음 (dB)" : lang === "ja" ? "騒音 (dB)" : "Noise (dB)", overview.sensors.average.noise, overview.sensors.peak.noise],
  ];
  const rows: Array<Array<string | number>> = [
    [labels.metric, labels.value],
    ...metrics,
    [],
    [labels.sensor, labels.average, labels.peak],
    ...sensors.map(([sensor, average, peak]) => [sensor, Number(average).toFixed(2), Number(peak).toFixed(2)]),
    [],
    [labels.time, labels.score, labels.level, lang === "ko" ? "전류(A)" : lang === "ja" ? "電流(A)" : "Current(A)", lang === "ko" ? "온도(°C)" : lang === "ja" ? "温度(°C)" : "Temp(°C)", lang === "ko" ? "진동(mm/s)" : lang === "ja" ? "振動(mm/s)" : "Vibration(mm/s)", lang === "ko" ? "소음(dB)" : lang === "ja" ? "騒音(dB)" : "Noise(dB)"],
    ...overview.scoreHistory.map(point => [new Date(point.timestamp).toLocaleString(locale, { hour12: false }), point.score, localizeRiskLevel(point.riskLevel, lang), point.current.toFixed(2), point.temperature.toFixed(1), point.vibration.toFixed(2), point.noise.toFixed(1)]),
  ];
  const csv = rows.map(row => row.map(escapeCsvCell).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const filenamePrefix = lang === "ko" ? "세미가드_기간분석" : lang === "ja" ? "セミガード_期間分析" : "semiguard_period";
  const periodFilenameSegment = lang === "ko"
    ? { day: "일간", week: "주간", month: "월간", custom: "사용자정의" }[overview.period]
    : lang === "ja"
      ? { day: "日次", week: "週次", month: "月次", custom: "任意期間" }[overview.period]
      : overview.period;
  anchor.download = `${filenamePrefix}_${periodFilenameSegment}_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeReportHtml(value: string | number) {
  return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function openStructuredPeriodReport(overview: PeriodOverviewData, lang: Lang, periodLabel: string, aiSummary?: PeriodReportAiSummary, preparedWindow?: Window | null) {
  const locale = lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US";
  const copy = lang === "ko"
    ? { title: "SemiGuard AI 기간별 안전 운영 보고서", subtitle: "반도체 장비 예지안전 분석", generated: "생성 시각", period: "분석 기간", metrics: "핵심 운영 통계", sensors: "센서 요약", trend: "최근 위험도 추이", aiSummary: "AI 센서 추세 요약", aiFallback: "근거 기반 대체 요약", outlook: "다음 기간 위험 전망", confidence: "신뢰도", evidence: "판단 근거", alert: "주의 알림", recommendation: "권장 조치", visitors: "방문 수", detections: "총 탐지", anomalies: "이상 탐지", danger: "위험 탐지", uptime: "정상 가동률", savings: "예상 절감 비용(시연 가정)", savingsNote: "위험 탐지 건수를 기준으로 산정한 참고값이며, 실제 절감액은 아직 검증되지 않았습니다.", sourceScope: "출처 범위", sourceScopeNote: "이 보고서는 기간별 집계입니다. 개별 관측 로그 ID는 이상 이력 CSV에서 확인할 수 있습니다.", average: "평균", peak: "최고", time: "시각", score: "점수", level: "단계", printHint: "브라우저 인쇄 창에서 ‘PDF로 저장’을 선택하면 구조화된 보고서를 파일로 저장할 수 있습니다." }
    : lang === "ja"
      ? { title: "SemiGuard AI 期間別安全運用レポート", subtitle: "半導体装置の予知安全分析", generated: "作成時刻", period: "分析期間", metrics: "主要運用統計", sensors: "センサー要約", trend: "直近のリスクスコア推移", aiSummary: "AIセンサー傾向サマリー", aiFallback: "根拠ベースの代替サマリー", outlook: "次期間のリスク見通し", confidence: "信頼度", evidence: "判断根拠", alert: "注意アラート", recommendation: "推奨措置", visitors: "訪問数", detections: "総検知", anomalies: "異常検知", danger: "危険検知", uptime: "稼働率", savings: "予想削減コスト（デモ仮定）", savingsNote: "危険検知件数を基準に算定した参考値であり、実際の削減額は未検証です。", sourceScope: "出典範囲", sourceScopeNote: "このレポートは期間別の集計です。個別の観測ログIDは異常履歴CSVで確認できます。", average: "平均", peak: "最大", time: "時刻", score: "スコア", level: "レベル", printHint: "ブラウザーの印刷画面で「PDFに保存」を選択すると、構造化されたレポートを保存できます。" }
      : { title: "SemiGuard AI Period Safety Operations Report", subtitle: "Semiconductor equipment predictive safety analysis", generated: "Generated", period: "Analysis period", metrics: "Key operating statistics", sensors: "Sensor summary", trend: "Recent risk score trend", aiSummary: "AI sensor trend summary", aiFallback: "Evidence-based fallback summary", outlook: "Next-period risk outlook", confidence: "Confidence", evidence: "Evidence", alert: "Caution alert", recommendation: "Recommended action", visitors: "Visitors", detections: "Total detections", anomalies: "Anomalies", danger: "Danger detections", uptime: "Uptime", savings: "Expected savings (demo assumption)", savingsNote: "This is a reference estimate based on danger detections; actual savings have not yet been validated.", sourceScope: "Source scope", sourceScopeNote: "This report is a period aggregate. Individual observation log IDs are available in the anomaly-history CSV.", average: "Average", peak: "Peak", time: "Time", score: "Score", level: "Level", printHint: "Choose ‘Save as PDF’ in the browser print dialog to save this structured report." };
  const reportWindow = preparedWindow ?? window.open("", "_blank", "width=1000,height=800");
  if (!reportWindow) throw new Error(copy.printHint);
  const riskColor = (level: string) => level === "danger" ? "#b91c1c" : level === "warning" ? "#c2410c" : level === "caution" ? "#a16207" : "#15803d";
  const metricRows = [
    [copy.visitors, overview.totalVisitors.toLocaleString(locale)], [copy.detections, overview.totalDetections.toLocaleString(locale)], [copy.anomalies, overview.anomalyCount.toLocaleString(locale)],
    [copy.danger, overview.dangerCount.toLocaleString(locale)], [copy.uptime, `${overview.uptimePct}%`], [copy.savings, `₩${overview.savedCost.toLocaleString(locale)}`],
  ];
  const sensorRows = [
    [lang === "ko" ? "전류 (A)" : lang === "ja" ? "電流 (A)" : "Current (A)", overview.sensors.average.current, overview.sensors.peak.current],
    [lang === "ko" ? "온도 (°C)" : lang === "ja" ? "温度 (°C)" : "Temperature (°C)", overview.sensors.average.temperature, overview.sensors.peak.temperature],
    [lang === "ko" ? "진동 (mm/s)" : lang === "ja" ? "振動 (mm/s)" : "Vibration (mm/s)", overview.sensors.average.vibration, overview.sensors.peak.vibration],
    [lang === "ko" ? "소음 (dB)" : lang === "ja" ? "騒音 (dB)" : "Noise (dB)", overview.sensors.average.noise, overview.sensors.peak.noise],
  ];
  const sensorTrendChart = buildSensorTrendChartImage(overview.scoreHistory, lang);
  const scoreRows = overview.scoreHistory.slice(-24).map(point => `<tr><td>${escapeReportHtml(new Date(point.timestamp).toLocaleString(locale, { hour12: false }))}</td><td>${escapeReportHtml(point.score)}</td><td><span class="risk" style="color:${riskColor(point.riskLevel)}">${escapeReportHtml(localizeRiskLevel(point.riskLevel, lang))}</span></td></tr>`).join("");
  const confidenceLabel = aiSummary?.confidence === "high" ? (lang === "ko" ? "높음" : lang === "ja" ? "高" : "High") : aiSummary?.confidence === "medium" ? (lang === "ko" ? "보통" : lang === "ja" ? "中" : "Medium") : (lang === "ko" ? "낮음" : lang === "ja" ? "低" : "Low");
  const aiSection = aiSummary ? `<section class="section"><h2>${escapeReportHtml(aiSummary.source === "ai" ? copy.aiSummary : copy.aiFallback)}</h2><article class="analysis-card"><strong>${escapeReportHtml(aiSummary.headline)}</strong><p>${escapeReportHtml(aiSummary.summary)}</p><p><b>${escapeReportHtml(copy.outlook)}:</b> ${escapeReportHtml(localizeRiskLevel(aiSummary.forecastLevel, lang))} · <b>${escapeReportHtml(copy.confidence)}:</b> ${escapeReportHtml(confidenceLabel)}</p><p><b>${escapeReportHtml(copy.evidence)}:</b> ${escapeReportHtml(aiSummary.evidence)}</p>${aiSummary.alert ? `<p class="alert-note"><b>${escapeReportHtml(copy.alert)}:</b> ${escapeReportHtml(lang === "ko" ? "상승 위험 징후가 있어 점검 절차를 우선하세요." : lang === "ja" ? "リスク上昇の兆候があるため、点検手順を優先してください。" : "Risk-rise indicators are present; prioritize the inspection procedure.")}</p>` : ""}<p><b>${escapeReportHtml(copy.recommendation)}:</b> ${escapeReportHtml(aiSummary.recommendation)}</p></article></section>` : "";
  reportWindow.document.write(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"/><title>${escapeReportHtml(copy.title)}</title><style>@page{size:A4;margin:15mm}*{box-sizing:border-box}body{margin:0;color:#172033;background:#fff;font-family:Inter,"Noto Sans KR","Noto Sans JP",Arial,sans-serif;font-size:11px;line-height:1.45}.report{max-width:780px;margin:0 auto}.hero{padding:20px 22px;background:linear-gradient(135deg,#0f2c4c,#0b7a91);color:#fff;border-radius:14px}.eyebrow{font-size:10px;letter-spacing:.12em;text-transform:uppercase;opacity:.78}.hero h1{font-size:23px;line-height:1.2;margin:6px 0}.hero p{margin:0;opacity:.9}.metadata{display:flex;gap:20px;margin-top:15px;font-size:10px;flex-wrap:wrap}.metadata strong{display:block;color:#0b7a91}.section{margin-top:22px}.section h2{font-size:14px;margin:0 0 9px;color:#102a43}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.metric{border:1px solid #d9e2ec;border-radius:9px;padding:10px;background:#f8fafc}.metric span{display:block;color:#627d98;font-size:10px}.metric strong{display:block;font-size:17px;margin-top:2px;color:#102a43}.scope-note{margin:10px 0 0;padding:9px 10px;border-left:3px solid #0b7a91;background:#edf8f9;color:#31506b;font-size:10px}table{width:100%;border-collapse:collapse;border:1px solid #d9e2ec;border-radius:8px;overflow:hidden}th{background:#eaf4f7;color:#102a43;text-align:left;font-size:10px}th,td{padding:7px 9px;border-bottom:1px solid #e6edf3}tr:last-child td{border-bottom:0}.risk{font-weight:700;text-transform:capitalize}.chart-image{display:block;width:100%;border:1px solid #d9e2ec;border-radius:10px}.analysis-card{border:1px solid #b7d7df;border-radius:10px;background:#f1fbfd;padding:12px}.analysis-card strong{color:#0b7a91}.analysis-card p{margin:7px 0 0}.alert-note{color:#9f1239;font-weight:600}.footer{margin-top:20px;padding-top:10px;border-top:1px solid #d9e2ec;color:#627d98;font-size:9px}@media print{.report{max-width:none}.hero{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><main class="report"><header class="hero"><div class="eyebrow">SemiGuard AI</div><h1>${escapeReportHtml(copy.title)}</h1><p>${escapeReportHtml(copy.subtitle)}</p></header><div class="metadata"><div><strong>${escapeReportHtml(copy.period)}</strong>${escapeReportHtml(periodLabel)}</div><div><strong>${escapeReportHtml(copy.generated)}</strong>${escapeReportHtml(new Date().toLocaleString(locale, { hour12: false }))}</div></div><section class="section"><h2>${escapeReportHtml(copy.metrics)}</h2><div class="metrics">${metricRows.map(([label, value]) => `<article class="metric"><span>${escapeReportHtml(label)}</span><strong>${escapeReportHtml(value)}</strong></article>`).join("")}</div><p class="scope-note"><b>${escapeReportHtml(copy.savings)}</b> ${escapeReportHtml(copy.savingsNote)}</p><p class="scope-note"><b>${escapeReportHtml(copy.sourceScope)}</b> ${escapeReportHtml(copy.sourceScopeNote)}</p></section>${aiSection}<section class="section"><h2>${escapeReportHtml(copy.sensors)}</h2><table><thead><tr><th>${lang === "ko" ? "센서" : lang === "ja" ? "センサー" : "Sensor"}</th><th>${escapeReportHtml(copy.average)}</th><th>${escapeReportHtml(copy.peak)}</th></tr></thead><tbody>${sensorRows.map(([sensor, average, peak]) => `<tr><td>${escapeReportHtml(sensor)}</td><td>${escapeReportHtml(Number(average).toFixed(2))}</td><td>${escapeReportHtml(Number(peak).toFixed(2))}</td></tr>`).join("")}</tbody></table></section>${sensorTrendChart ? `<section class="section"><h2>${escapeReportHtml(sensorTrendChart.alt)}</h2><img class="chart-image" src="${sensorTrendChart.src}" alt="${escapeReportHtml(sensorTrendChart.alt)}"/></section>` : ""}<section class="section"><h2>${escapeReportHtml(copy.trend)}</h2><table><thead><tr><th>${escapeReportHtml(copy.time)}</th><th>${escapeReportHtml(copy.score)}</th><th>${escapeReportHtml(copy.level)}</th></tr></thead><tbody>${scoreRows || `<tr><td colspan="3">—</td></tr>`}</tbody></table></section><footer class="footer">${escapeReportHtml(copy.printHint)}</footer></main></body></html>`);
  reportWindow.document.close();
  window.setTimeout(() => { reportWindow.focus(); reportWindow.print(); }, 250);
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

function SensorFreshnessIndicator({ timestamp, lang }: { timestamp?: number; lang: Lang }) {
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    let intervalId: number | null = null;
    const updateClock = () => setClock(Date.now());
    const stopClock = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };
    const startClock = () => {
      if (document.visibilityState === "hidden" || intervalId !== null) return;
      updateClock();
      intervalId = window.setInterval(updateClock, 1000);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopClock();
      } else {
        updateClock();
        startClock();
      }
    };

    startClock();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      stopClock();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const ageSeconds = timestamp ? Math.max(0, Math.floor((clock - timestamp) / 1000)) : null;
  const freshness = ageSeconds === null ? "waiting" : ageSeconds <= 5 ? "fresh" : ageSeconds <= 12 ? "delayed" : "stale";
  const label = freshness === "fresh"
    ? (lang === "ko" ? `갱신 ${ageSeconds}초 전` : lang === "ja" ? `${ageSeconds}秒前に更新` : `Updated ${ageSeconds}s ago`)
    : freshness === "delayed"
      ? (lang === "ko" ? `갱신 지연 ${ageSeconds}초` : lang === "ja" ? `更新遅延 ${ageSeconds}秒` : `Update delayed ${ageSeconds}s`)
      : freshness === "stale"
        ? (lang === "ko" ? `데이터 지연 ${ageSeconds}초` : lang === "ja" ? `データ遅延 ${ageSeconds}秒` : `Data stale ${ageSeconds}s`)
        : (lang === "ko" ? "센서 데이터 대기 중" : lang === "ja" ? "センサーデータ待機中" : "Waiting for sensor data");
  const color = freshness === "fresh" ? "oklch(0.70 0.18 145)" : freshness === "delayed" ? "oklch(0.78 0.17 85)" : freshness === "stale" ? "oklch(0.72 0.18 30)" : "oklch(0.75 0.18 200)";

  return (
    <>
      <div className="hidden xl:flex items-center gap-1.5 text-[10px] font-semibold" role="img" aria-label={label} title={label} style={{ color }}>
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${freshness === "waiting" ? "animate-pulse" : ""}`} style={{ background: color }} />
        {label}
      </div>
      <div className="flex h-7 min-w-10 shrink-0 items-center justify-center gap-1 rounded-full border px-2 xl:hidden" role="img" aria-label={label} title={label} style={{ borderColor: `${color}80`, color, background: `${color}1A` }}>
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${freshness === "waiting" ? "animate-pulse" : ""}`} style={{ background: color }} />
        <span className="text-[10px] font-bold">{ageSeconds === null ? "…" : `${ageSeconds}s`}</span>
      </div>
    </>
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
        <span className="text-base opacity-70" aria-hidden="true">{icon}</span>
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
  const detail = `${t.riskScore}: ${animatedScore}/100 · ${t[riskLevel]}`;

  return (
    <AppTooltip delayDuration={160}>
      <TooltipTrigger asChild>
        <div tabIndex={0} className="flex w-full cursor-default flex-col items-center gap-3 rounded-2xl p-2 transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/[0.025] hover:shadow-[0_14px_28px_rgba(0,0,0,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 motion-reduce:transform-none motion-reduce:transition-none">
          <div className="relative w-40 h-40">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" aria-hidden="true">
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
          <div className="flex gap-1.5 w-full px-1" aria-hidden="true">
            {(["normal","caution","warning","danger"] as RiskLevel[]).map(lvl => (
              <div key={lvl} className="flex-1 h-1.5 rounded-full transition-all duration-300"
                style={{ background: riskLevel === lvl ? RISK_COLORS[lvl] : "rgba(255,255,255,0.05)" }} />
            ))}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[17rem] border-cyan-400/30 bg-slate-950 px-3 py-2 text-xs text-slate-100 shadow-xl">
        {detail}
      </TooltipContent>
    </AppTooltip>
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

// ─── 경고 패널 ──────────────────────────────────────────────────────────────
function AlertPanel({ riskLevel, relayTripped, t }: { riskLevel: RiskLevel; relayTripped: boolean; t: Translation }) {
  const isDanger = riskLevel === "danger";
  const hasAttention = isDanger || relayTripped;
  if (!hasAttention) return null;
  const label = `${t.alertLight}: ${isDanger ? t.danger : t.normal}. ${relayTripped ? t.relayActive : t.relayInactive}.`;
  return (
    <div className="flex h-7 shrink-0 items-center gap-1 rounded-full border px-2 whitespace-nowrap sm:h-auto sm:gap-2 sm:border-0 sm:px-0" role="img" aria-label={label} title={label}>
      <div className="flex items-center gap-1.5">
        <div aria-hidden="true" className="hidden h-2.5 w-2.5 rounded-full sm:block" style={{
          background: isDanger ? "#ef4444" : "#22c55e",
          animation: isDanger ? "pulse 0.5s infinite" : "none",
        }} />
        <span className="whitespace-nowrap text-[10px] font-semibold sm:text-xs" style={{ color: isDanger ? "#ef4444" : "#22c55e" }}>{isDanger ? t.danger : t.normal}</span>
        <span className="hidden text-xs font-semibold text-muted-foreground sm:inline">{t.alertLight}</span>
      </div>
      <div className="hidden h-4 w-px bg-border sm:block" />
      <div className="hidden items-center gap-1.5 sm:flex">
        <span className="h-2.5 w-2.5 rounded-full" aria-hidden="true" style={{ background: relayTripped ? "#ef4444" : "#22c55e" }} />
        <span className="text-xs font-semibold" style={{ color: relayTripped ? "#ef4444" : "#22c55e" }}>{relayTripped ? t.relayActive : t.relayInactive}</span>
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
function ImpactCard({ label, value, unit, icon, color, isLoading = false, loadingLabel, detail }: {
  label: string; value: string | number; unit?: string; icon: string; color: string; isLoading?: boolean; loadingLabel?: string; detail?: string;
}) {
  const accessibleDetail = detail ?? `${label}: ${isLoading ? loadingLabel ?? "—" : `${typeof value === "number" ? value.toLocaleString() : value}${unit ? ` ${unit}` : ""}`}`;
  return (
    <AppTooltip delayDuration={160}>
      <TooltipTrigger asChild>
        <div tabIndex={0} className="flex cursor-default flex-col gap-2 rounded-xl border p-4 transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(0,0,0,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 motion-reduce:transform-none motion-reduce:transition-none" aria-busy={isLoading || undefined}
          style={{ background: "rgba(255,255,255,0.025)", borderColor: `${color}35` }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
            <span className="text-lg" aria-hidden="true">{icon}</span>
          </div>
          <div className="flex items-end gap-1.5">
            <span className="text-2xl font-bold font-mono leading-none" style={{ color }}>
              {isLoading ? "—" : (typeof value === "number" ? value.toLocaleString() : value)}
            </span>
            {unit && <span className="text-xs text-muted-foreground mb-0.5">{unit}</span>}
          </div>
          {isLoading && loadingLabel && <span className="text-[10px] text-muted-foreground">{loadingLabel}</span>}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[17rem] border-slate-600 bg-slate-950 px-3 py-2 text-xs text-slate-100 shadow-xl">
        {accessibleDetail}
      </TooltipContent>
    </AppTooltip>
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
  const pointRefs = useRef<(SVGCircleElement | null)[]>([]);
  const [activePointIndex, setActivePointIndex] = useState(0);
  const W = 800, H = 200, PAD = { top: 16, right: 16, bottom: 32, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">
        {lang === "ko" ? "데이터가 쌓이면 차트가 표시됩니다." : lang === "ja" ? "データが蓄積されるとグラフが表示されます。" : "Chart will appear as data accumulates."}
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
  const focusedPointIndex = Math.min(activePointIndex, data.length - 1);
  const riskLabel = (risk: string) => lang === "ko"
    ? risk === "danger" ? "위험" : risk === "warning" ? "경고" : risk === "caution" ? "주의" : "정상"
    : lang === "ja"
      ? risk === "danger" ? "危険" : risk === "warning" ? "警告" : risk === "caution" ? "注意" : "正常"
      : risk.charAt(0).toUpperCase() + risk.slice(1);
  const timeLocale = lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US";
  const formatPointTime = (timestamp: string) => new Date(timestamp).toLocaleTimeString(timeLocale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const setPointTooltip = (d: { timestamp: string; score: number; riskLevel: string }, index: number) => {
    setTooltip({
      x: xScale(index),
      y: yScale(d.score),
      score: d.score,
      time: formatPointTime(d.timestamp),
      risk: d.riskLevel,
    });
  };
  const pointLabel = (d: { timestamp: string; score: number; riskLevel: string }, index: number) => {
    const position = `${index + 1}/${data.length}`;
    const navigationHint = lang === "ko"
      ? "왼쪽 또는 오른쪽 화살표 키로 인접한 점으로 이동"
      : lang === "ja"
        ? "左右の矢印キーで隣のデータ点へ移動"
        : "Use Left or Right Arrow to move to an adjacent point";
    return lang === "ko"
      ? `위험도 데이터 ${position}, 점수 ${d.score}점, ${riskLabel(d.riskLevel)}, ${formatPointTime(d.timestamp)}. ${navigationHint}`
      : lang === "ja"
        ? `リスクデータ ${position}、スコア ${d.score}、${riskLabel(d.riskLevel)}、${formatPointTime(d.timestamp)}。${navigationHint}`
        : `Risk data ${position}, score ${d.score}, ${riskLabel(d.riskLevel)}, ${formatPointTime(d.timestamp)}. ${navigationHint}`;
  };
  const handlePointKeyDown = (event: React.KeyboardEvent<SVGCircleElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = Math.min(index + 1, data.length - 1);
    if (event.key === "ArrowLeft") nextIndex = Math.max(index - 1, 0);
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = data.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    setActivePointIndex(nextIndex);
    pointRefs.current[nextIndex]?.focus();
  };

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
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 200 }}
      role="group"
      aria-label={lang === "ko" ? "최근 위험도 점수 추이 차트" : lang === "ja" ? "最近のリスクスコア推移グラフ" : "Recent risk score trend chart"}
    >
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
          ref={(node) => { pointRefs.current[i] = node; }}
          fill={RISK_COLOR_MAP[d.riskLevel] ?? "#38bdf8"}
          stroke={chartDotStroke} strokeWidth={1}
          style={{ cursor: "crosshair" }}
          role="button"
          tabIndex={i === focusedPointIndex ? 0 : -1}
          aria-label={pointLabel(d, i)}
          onFocus={() => {
            setActivePointIndex(i);
            setPointTooltip(d, i);
          }}
          onBlur={() => setTooltip(null)}
          onKeyDown={(event) => handlePointKeyDown(event, i)}
          onMouseEnter={() => setPointTooltip(d, i)}
          onMouseLeave={() => {
            if (document.activeElement !== pointRefs.current[i]) setTooltip(null);
          }}
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
            <text x={tx + 8} y={ty + 15} fontSize={10} fill={riskColor} fontWeight="600">{`${lang === "ko" ? "점수" : lang === "ja" ? "スコア" : "Score"}: ${tooltip.score}`}</text>
            <text x={tx + 8} y={ty + 30} fontSize={9} fill={tooltipTime}>{tooltip.time}</text>
            <text x={tx + 8} y={ty + 42} fontSize={9} fill={riskColor} opacity={0.8}>{
              riskLabel(tooltip.risk)
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
    : lang === "ja"
      ? ["日", "月", "火", "水", "木", "金", "土"]
      : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const monthLabel = calMonth.toLocaleDateString(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", { year: "numeric", month: "long" });

  // 범례 항목
  const legend: { level: RiskLevel; label: string }[] = [
    { level: "normal",  label: lang === "ko" ? "정상" : lang === "ja" ? "正常" : "Normal" },
    { level: "caution", label: lang === "ko" ? "주의" : lang === "ja" ? "注意" : "Caution" },
    { level: "warning", label: lang === "ko" ? "경고" : lang === "ja" ? "警告" : "Warning" },
    { level: "danger",  label: lang === "ko" ? "위험" : lang === "ja" ? "危険" : "Danger" },
  ];
  const riskLabelByLevel = Object.fromEntries(legend.map(({ level, label }) => [level, label])) as Record<RiskLevel, string>;
  const noDataLabel = lang === "ko" ? "데이터 없음" : lang === "ja" ? "データなし" : "No data";

  return (
    <div className="rounded-xl border p-5" style={{ background: th.bgCard, borderColor: th.border }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          {lang === "ko" ? "월간 위험도 히트맵" : lang === "ja" ? "月間リスクヒートマップ" : "Monthly Risk Heatmap"}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" aria-label={lang === "ko" ? "이전 달" : lang === "ja" ? "前の月" : "Previous month"} onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="w-6 h-6 flex items-center justify-center rounded text-xs border transition-all hover:opacity-80 active:scale-95"
            style={{ borderColor: th.border2, color: th.textMuted }}>‹</button>
          <span className="text-xs font-semibold min-w-[90px] text-center">{monthLabel}</span>
          <button type="button" aria-label={lang === "ko" ? "다음 달" : lang === "ja" ? "次の月" : "Next month"} onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
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
          const cellLabel = `${key}: ${lvl ? riskLabelByLevel[lvl] : noDataLabel}`;
          return (
            <button key={day} type="button" disabled={!onDateClick}
              aria-label={cellLabel}
              title={cellLabel}
              onClick={() => onDateClick?.(key)}
              className="aspect-square flex items-center justify-center rounded border-0 p-0 text-[10px] font-mono transition-all duration-200 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 disabled:cursor-default"
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
            </button>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-3 mt-4 flex-wrap">
        <span className="text-[9px] text-muted-foreground">{lang === "ko" ? "범례:" : lang === "ja" ? "凡例:" : "Legend:"}</span>
        {legend.map(({ level, label }) => (
          <div key={level} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ background: CELL_COLOR[level], border: `1px solid ${CELL_BORDER[level]}` }} />
            <span className="text-[9px] text-muted-foreground">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }} />
          <span className="text-[9px] text-muted-foreground">{lang === "ko" ? "데이터 없음" : lang === "ja" ? "データなし" : "No data"}</span>
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
  const trpcUtils = trpc.useUtils();
  const authMeQuery = trpc.auth.me.useQuery(undefined, { staleTime: 60_000 });
  const isUsageMetricsAdmin = authMeQuery.data?.role === "admin";
  const onboardingProgressQuery = trpc.semiguard.getOnboardingProgress.useQuery(undefined, { staleTime: 60_000 });
  const saveOnboardingProgressMutation = trpc.semiguard.saveOnboardingProgress.useMutation();
  const firstUseFeedbackQuery = trpc.semiguard.getFirstUseFeedback.useQuery(undefined, { staleTime: 60_000 });
  const saveFirstUseFeedbackMutation = trpc.semiguard.saveFirstUseFeedback.useMutation();
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 3>(1);
  const [isFirstUseFeedbackOpen, setIsFirstUseFeedbackOpen] = useState(false);
  const [firstUseEaseRating, setFirstUseEaseRating] = useState(0);
  const [firstUseDifficultStep, setFirstUseDifficultStep] = useState<"none" | "orientation" | "risk_review" | "analysis_review">("none");
  const [firstUseFeedbackSaveError, setFirstUseFeedbackSaveError] = useState<string | null>(null);
  const [isFirstUseFeedbackPromptDismissed, setIsFirstUseFeedbackPromptDismissed] = useState(() => readDashboardPreference(FIRST_USE_FEEDBACK_PROMPT_DISMISSED_KEY) === "true");
  const onboardingInitializedRef = useRef(false);
  const feedbackPromptedRef = useRef(false);
  const onboardingTriggerRef = useRef<HTMLButtonElement>(null);
  const onboardingCloseButtonRef = useRef<HTMLButtonElement>(null);
  const onboardingDialogRef = useRef<HTMLElement>(null);
  const firstUseFeedbackTriggerRef = useRef<HTMLButtonElement>(null);
  const firstUseFeedbackCloseButtonRef = useRef<HTMLButtonElement>(null);
  const firstUseFeedbackDialogRef = useRef<HTMLElement>(null);
  const onboardingCopy = lang === "ko"
    ? { title: "첫 안전 분석 안내", subtitle: "3단계로 위험 신호부터 점검 순서까지 확인해 보세요.", steps: ["위험 신호", "AI 근거", "점검 순서"], risk: "대시보드 상단의 위험도 점수와 센서 카드에서 먼저 주의가 필요한 신호를 확인합니다.", evidence: "AI 분석 결과에서는 수치 편차와 확인이 필요한 근거를 함께 읽습니다. AI 판단만으로 고장을 단정하지 않습니다.", action: "권장 점검 순서를 확인하고, 실제 설비 작업은 승인된 현장 안전 절차에 따라 담당자가 진행합니다.", later: "나중에", previous: "이전", next: "다음", finish: "안내 완료", review: "첫 분석 안내 다시 보기", progress: "진행" }
    : lang === "ja"
      ? { title: "初回安全分析ガイド", subtitle: "3段階で危険信号から点検順序まで確認できます。", steps: ["危険信号", "AI根拠", "点検順序"], risk: "ダッシュボード上部のリスクスコアとセンサーカードから、注意が必要な信号を確認します。", evidence: "AI分析結果では数値の偏差と確認すべき根拠を併せて読みます。AIの判断だけで故障を断定しません。", action: "推奨点検順序を確認し、実際の設備作業は承認された現場安全手順に従って担当者が進めます。", later: "後で", previous: "前へ", next: "次へ", finish: "ガイド完了", review: "初回分析ガイドを再表示", progress: "進行" }
      : { title: "First safety analysis guide", subtitle: "Use three steps to move from a risk signal to an inspection sequence.", steps: ["Risk signal", "AI evidence", "Inspection order"], risk: "Start with the risk score and sensor cards at the top of the dashboard to see which signal needs attention.", evidence: "Read measured deviations and evidence in the AI analysis. An AI assessment alone does not confirm a failure.", action: "Review the recommended inspection order. A responsible operator performs real equipment work under approved on-site safety procedures.", later: "Later", previous: "Previous", next: "Next", finish: "Finish guide", review: "Review first analysis guide", progress: "Progress" };
  const firstUseFeedbackCopy = lang === "ko"
    ? { title: "첫 사용 경험", subtitle: "선택 항목만 저장합니다. 이름·연락처·설비 데이터·자유 입력은 수집하지 않습니다.", ease: "첫 분석 안내를 사용하기 쉬웠나요?", difficult: "가장 확인하기 어려웠던 단계는 무엇이었나요?", ratings: ["매우 어려움", "어려움", "보통", "쉬움", "매우 쉬움"], steps: { none: "없음", orientation: "위험 신호 확인", risk_review: "위험도·센서 읽기", analysis_review: "AI 근거·점검 순서" }, later: "나중에", submit: "선택 응답 저장", saved: "첫 사용 피드백을 저장했습니다. 최신 응답으로 언제든 바꿀 수 있습니다.", edit: "첫 사용 경험 수정", response: "응답", average: "평균 편의" }
    : lang === "ja"
      ? { title: "初回利用の体験", subtitle: "選択項目のみを保存します。氏名・連絡先・設備データ・自由記述は収集しません。", ease: "初回分析ガイドは使いやすかったですか？", difficult: "最も確認しにくかった段階は何ですか？", ratings: ["とても難しい", "難しい", "普通", "簡単", "とても簡単"], steps: { none: "なし", orientation: "リスク信号の確認", risk_review: "リスク・センサーの確認", analysis_review: "AI根拠・点検順序" }, later: "後で", submit: "選択回答を保存", saved: "初回利用フィードバックを保存しました。いつでも最新の回答に更新できます。", edit: "初回利用の体験を編集", response: "回答", average: "平均の使いやすさ" }
      : { title: "First-use experience", subtitle: "Only selected answers are stored. No name, contact details, equipment data, or free text is collected.", ease: "How easy was the first analysis guide to use?", difficult: "Which step was the hardest to review?", ratings: ["Very difficult", "Difficult", "Neutral", "Easy", "Very easy"], steps: { none: "None", orientation: "Finding risk signals", risk_review: "Reading risk and sensors", analysis_review: "AI evidence and inspection order" }, later: "Later", submit: "Save selected response", saved: "Saved your first-use feedback. You can update your latest response at any time.", edit: "Edit first-use experience", response: "Responses", average: "Average ease" };
  useEffect(() => {
    if (!onboardingProgressQuery.data || onboardingInitializedRef.current) return;
    onboardingInitializedRef.current = true;
    const currentStep = Math.min(3, Math.max(1, onboardingProgressQuery.data.currentStep)) as 1 | 2 | 3;
    setOnboardingStep(currentStep);
    if (!onboardingProgressQuery.data.completedAt) setIsOnboardingOpen(true);
  }, [onboardingProgressQuery.data]);
  useEffect(() => {
    if (!onboardingProgressQuery.data?.completedAt || firstUseFeedbackQuery.isLoading || firstUseFeedbackQuery.data || feedbackPromptedRef.current || isFirstUseFeedbackPromptDismissed) return;
    feedbackPromptedRef.current = true;
    setIsFirstUseFeedbackOpen(true);
  }, [firstUseFeedbackQuery.data, firstUseFeedbackQuery.isLoading, isFirstUseFeedbackPromptDismissed, onboardingProgressQuery.data?.completedAt]);
  const closeOnboarding = () => {
    setIsOnboardingOpen(false);
    requestAnimationFrame(() => onboardingTriggerRef.current?.focus());
  };
  useEffect(() => {
    if (!isOnboardingOpen) return;
    onboardingCloseButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeOnboarding();
        return;
      }
      if (event.key !== "Tab") return;
      const focusableControls = Array.from(onboardingDialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
      const firstControl = focusableControls[0];
      const lastControl = focusableControls.at(-1);
      if (!firstControl || !lastControl) return;
      if (event.shiftKey && document.activeElement === firstControl) {
        event.preventDefault();
        lastControl.focus();
      } else if (!event.shiftKey && document.activeElement === lastControl) {
        event.preventDefault();
        firstControl.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOnboardingOpen]);

  const closeFirstUseFeedback = () => {
    persistDashboardPreference(FIRST_USE_FEEDBACK_PROMPT_DISMISSED_KEY, "true");
    setIsFirstUseFeedbackPromptDismissed(true);
    setFirstUseFeedbackSaveError(null);
    setIsFirstUseFeedbackOpen(false);
    requestAnimationFrame(() => firstUseFeedbackTriggerRef.current?.focus());
  };
  useEffect(() => {
    if (!isFirstUseFeedbackOpen) return;
    firstUseFeedbackCloseButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeFirstUseFeedback();
      if (event.key !== "Tab") return;
      const focusableControls = Array.from(firstUseFeedbackDialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
      if (focusableControls.length === 0) return;
      const firstControl = focusableControls[0];
      const lastControl = focusableControls[focusableControls.length - 1];
      if (event.shiftKey && document.activeElement === firstControl) {
        event.preventDefault();
        lastControl?.focus();
      } else if (!event.shiftKey && document.activeElement === lastControl) {
        event.preventDefault();
        firstControl?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFirstUseFeedbackOpen]);

  useEffect(() => {
    const dialog = firstUseFeedbackDialogRef.current;
    if (!dialog) return;
    dialog.setAttribute("aria-busy", saveFirstUseFeedbackMutation.isPending ? "true" : "false");
  }, [isFirstUseFeedbackOpen, saveFirstUseFeedbackMutation.isPending]);

  useEffect(() => {
    if (!isFirstUseFeedbackOpen) return;
    const dialog = firstUseFeedbackDialogRef.current;
    if (!dialog) return;
    const moveRadioSelection = (event: KeyboardEvent) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
      const target = event.target;
      if (!(target instanceof HTMLButtonElement) || target.getAttribute("role") !== "radio") return;
      const group = target.closest('[role="radiogroup"]');
      const radios = Array.from(group?.querySelectorAll<HTMLButtonElement>('[role="radio"]:not([disabled])') ?? []);
      const currentIndex = radios.indexOf(target);
      if (currentIndex < 0 || radios.length === 0) return;
      event.preventDefault();
      const nextIndex = event.key === "Home" ? 0
        : event.key === "End" ? radios.length - 1
          : (currentIndex + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + radios.length) % radios.length;
      radios[nextIndex]?.click();
      radios[nextIndex]?.focus();
    };
    dialog.addEventListener("keydown", moveRadioSelection);
    return () => dialog.removeEventListener("keydown", moveRadioSelection);
  }, [isFirstUseFeedbackOpen]);

  useEffect(() => {
    if (!isFirstUseFeedbackOpen || !firstUseFeedbackSaveError) return;
    const dialog = firstUseFeedbackDialogRef.current;
    if (!dialog) return;
    const errorNode = document.createElement("p");
    errorNode.id = "first-use-feedback-save-error";
    errorNode.setAttribute("role", "alert");
    errorNode.className = "mt-4 rounded-lg border border-rose-400/55 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300";
    errorNode.textContent = firstUseFeedbackSaveError;
    dialog.insertBefore(errorNode, dialog.lastElementChild);
    return () => errorNode.remove();
  }, [firstUseFeedbackSaveError, isFirstUseFeedbackOpen]);

  const persistOnboardingStep = async (nextStep: 1 | 2 | 3, completed = false) => {
    setOnboardingStep(nextStep);
    try {
      await saveOnboardingProgressMutation.mutateAsync({ currentStep: nextStep, completed });
      await onboardingProgressQuery.refetch();
      if (completed) toast.success(lang === "ko" ? "첫 분석 안내를 완료했습니다." : lang === "ja" ? "初回分析ガイドを完了しました。" : "First analysis guide completed.");
    } catch {
      toast.error(lang === "ko" ? "안내 진행 상태를 저장하지 못했습니다." : lang === "ja" ? "ガイドの進行状況を保存できませんでした。" : "Could not save guide progress.");
    }
  };
  const submitFirstUseFeedback = async () => {
    if (firstUseEaseRating < 1) return;
    setFirstUseFeedbackSaveError(null);
    try {
      await saveFirstUseFeedbackMutation.mutateAsync({ easeRating: firstUseEaseRating, difficultStep: firstUseDifficultStep });
      await firstUseFeedbackQuery.refetch();
      await trpcUtils.semiguard.getProductUsageMetrics.invalidate();
      closeFirstUseFeedback();
      toast.success(firstUseFeedbackCopy.saved);
    } catch {
      const errorMessage = lang === "ko" ? "첫 사용 피드백을 저장하지 못했습니다. 다시 시도해 주세요." : lang === "ja" ? "初回利用フィードバックを保存できませんでした。もう一度お試しください。" : "Could not save first-use feedback. Please try again.";
      setFirstUseFeedbackSaveError(errorMessage);
      toast.error(errorMessage);
    }
  };
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      void trpcUtils.auth.me.invalidate();
      setLocation("/login");
    },
    onError: () => toast.error(lang === "ko" ? "로그아웃 실패" : lang === "ja" ? "ログアウトに失敗しました" : "Logout failed"),
  });
  const [isDark, setIsDark] = useState<boolean>(() => {
    try { return localStorage.getItem("semiguard_theme") !== "light"; } catch { return true; }
  });
  const toggleDashboardTheme = () => setIsDark(current => {
    const next = !current;
    try { localStorage.setItem("semiguard_theme", next ? "dark" : "light"); } catch {}
    return next;
  });
  const isMobile = useIsMobile();
  const hasCompletedFirstAnalysis = Boolean(onboardingProgressQuery.data?.completedAt);
  const aiHistoryBottom = hasCompletedFirstAnalysis
    ? (isMobile ? "max(8rem, calc(env(safe-area-inset-bottom) + 7.25rem))" : "7.5rem")
    : (isMobile ? "max(1.25rem, calc(env(safe-area-inset-bottom) + 0.5rem))" : undefined);
  const [menuOpen, setMenuOpen] = useState(() =>
    import.meta.env.DEV && new URLSearchParams(window.location.search).get("menu") === "open",
  );
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuCloseButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLElement>(null);
  const wasMenuOpenRef = useRef(menuOpen);

  useEffect(() => {
    try {
      localStorage.setItem("semiguard_lang", lang);
    } catch {
      // 저장 공간 제한 또는 개인정보 보호 모드에서는 기본 언어로 계속 동작한다.
    }
  }, [lang]);

  useEffect(() => {
    document.documentElement.lang = lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US";
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
      toast.success(lang === "ko" ? "소셜 계정 연결을 해제했습니다." : lang === "ja" ? "ソーシャルアカウントの連携を解除しました。" : "Social account unlinked.");
    },
    onError: () => toast.error(lang === "ko" ? "소셜 계정 연결 해제에 실패했습니다." : lang === "ja" ? "ソーシャルアカウントの連携解除に失敗しました。" : "Failed to unlink social account."),
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
  const [autoPollingRetryPending, setAutoPollingRetryPending] = useState(false);
  const lastUpdateRef = useRef<number>(Date.now());
  const [relayTripped, setRelayTripped] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "log">("dashboard");
  const [initialized, setInitialized] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const autoPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [dangerAlert, setDangerAlert] = useState(false);
  const dangerAlertConfirmRef = useRef<HTMLButtonElement>(null);
  const dangerAlertCooldownUntilRef = useRef(0);
  const requestDangerAlert = useCallback((force = false) => {
    if (!force && Date.now() < dangerAlertCooldownUntilRef.current) return;
    setShowResetConfirmModal(false);
    setActiveDislikeIdx(null);
    setOtherReasonIdx(null);
    setShowAiHistory(false);
    setIsOnboardingOpen(false);
    setIsFirstUseFeedbackOpen(false);
    setDangerAlert(true);
  }, []);
  const acknowledgeDangerAlert = useCallback(() => {
    dangerAlertCooldownUntilRef.current = Date.now() + 30_000;
    setDangerAlert(false);
  }, []);
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

  useEffect(() => {
    if (!dangerAlert) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => dangerAlertConfirmRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        acknowledgeDangerAlert();
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        dangerAlertConfirmRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [acknowledgeDangerAlert, dangerAlert]);
  const prevLogCountRef = useRef(0);
  const [selectedLog, setSelectedLog] = useState<import("../../../shared/semiguard").AnomalyLogEntry | null>(null);
  const [openingSourceLogId, setOpeningSourceLogId] = useState<number | null>(null);
  const selectedLogCloseRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!selectedLog) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => selectedLogCloseRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedLog(null);
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        selectedLogCloseRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [selectedLog]);
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
  const aiHistoryTriggerRef = useRef<HTMLButtonElement>(null);
  const aiHistoryCloseRef = useRef<HTMLButtonElement>(null);
  const aiHistoryDialogRef = useRef<HTMLDivElement>(null);
  const llmHistoryQuery = trpc.semiguard.getLlmHistory.useQuery(undefined, { refetchInterval: 10000 });
  const closeAiHistory = () => {
    setShowAiHistory(false);
    requestAnimationFrame(() => aiHistoryTriggerRef.current?.focus());
  };

  useEffect(() => {
    if (!showAiHistory) return;

    const focusTimer = window.setTimeout(() => aiHistoryCloseRef.current?.focus(), 0);
    const handleHistoryKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAiHistory();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = aiHistoryDialogRef.current;
      const focusable = dialog
        ? Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((element) => element.offsetParent !== null)
        : [];
      if (focusable.length === 0) return;

      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey
        ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
        : (currentIndex === -1 || currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
      event.preventDefault();
      focusable[nextIndex]?.focus();
    };

    window.addEventListener("keydown", handleHistoryKeys);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleHistoryKeys);
    };
  }, [showAiHistory]);

  // 대화형 AI 상담 챗봇 상태 및 세션 보관 관리
  const [isChatOpen, setIsChatOpen] = useState(() =>
    import.meta.env.DEV && new URLSearchParams(window.location.search).get("chat") === "open",
  );
  const chatLaunchButtonRef = useRef<HTMLButtonElement>(null);
  const chatCloseButtonRef = useRef<HTMLButtonElement>(null);
  const chatDialogRef = useRef<HTMLDivElement>(null);
  const chatMessageListRef = useRef<HTMLDivElement>(null);
  const isChatNearBottomRef = useRef(true);
  const [isChatAwayFromLatest, setIsChatAwayFromLatest] = useState(false);
  const previousChatMessageCountRef = useRef(0);
  const [unreadChatMessageCount, setUnreadChatMessageCount] = useState(0);
  const historyPanelTriggerRef = useRef<HTMLButtonElement>(null);
  const historyPanelCloseRef = useRef<HTMLButtonElement>(null);
  const deleteAllConfirmTriggerRef = useRef<HTMLButtonElement>(null);
  const deleteAllConfirmCancelRef = useRef<HTMLButtonElement>(null);
  const deleteAllConfirmDialogRef = useRef<HTMLDivElement>(null);
  const feedbackPanelTriggerRef = useRef<HTMLButtonElement>(null);
  const feedbackPanelCloseRef = useRef<HTMLButtonElement>(null);
  const deleteAllFeedbackTriggerRef = useRef<HTMLButtonElement>(null);
  const deleteAllFeedbackConfirmCancelRef = useRef<HTMLButtonElement>(null);
  const deleteAllFeedbackConfirmDialogRef = useRef<HTMLDivElement>(null);
  const deleteAllFeedbackFinalCancelRef = useRef<HTMLButtonElement>(null);
  const deleteAllFeedbackFinalDialogRef = useRef<HTMLDivElement>(null);
  const feedbackDeleteTriggerRef = useRef<HTMLButtonElement>(null);
  const feedbackDeleteCancelRef = useRef<HTMLButtonElement>(null);
  const feedbackDeleteDialogRef = useRef<HTMLDivElement>(null);
  const feedbackContextTriggerRef = useRef<HTMLButtonElement>(null);
  const feedbackContextCloseRef = useRef<HTMLButtonElement>(null);
  const feedbackContextDialogRef = useRef<HTMLDivElement>(null);
  const manualDeleteTriggerRef = useRef<HTMLButtonElement>(null);
  const manualDeleteCancelRef = useRef<HTMLButtonElement>(null);
  const manualDeleteDialogRef = useRef<HTMLDivElement>(null);
  const dislikeReasonTriggerRef = useRef<HTMLButtonElement>(null);
  const dislikeReasonCloseRef = useRef<HTMLButtonElement>(null);
  const dislikeReasonDialogRef = useRef<HTMLDivElement>(null);
  const manualSourceTriggerRef = useRef<HTMLButtonElement>(null);
  const manualSourceCloseRef = useRef<HTMLButtonElement>(null);
  const manualSourceDialogRef = useRef<HTMLDivElement>(null);
  const manualPanelTriggerRef = useRef<HTMLButtonElement>(null);
  const manualPanelCloseRef = useRef<HTMLButtonElement>(null);
  const manualPanelDialogRef = useRef<HTMLDivElement>(null);
  const resetConfirmTriggerRef = useRef<HTMLButtonElement>(null);
  const resetConfirmCancelRef = useRef<HTMLButtonElement>(null);
  const resetConfirmDialogRef = useRef<HTMLDivElement>(null);
  const wasHistoryPanelOpenRef = useRef(false);
  const wasFeedbackPanelOpenRef = useRef(false);
  const wasDeleteAllFeedbackConfirmOpenRef = useRef(false);
  const wasDeleteAllFeedbackFinalConfirmOpenRef = useRef(false);
  const wasFeedbackDeleteOpenRef = useRef(false);
  const wasFeedbackContextOpenRef = useRef(false);
  const wasManualDeleteOpenRef = useRef(false);
  const wasDislikeReasonOpenRef = useRef(false);
  const wasManualSourceOpenRef = useRef(false);
  const wasManualPanelOpenRef = useRef(false);
  const wasResetConfirmOpenRef = useRef(false);
  const wasDeleteAllConfirmOpenRef = useRef(false);
  const wasChatOpenRef = useRef(isChatOpen);
  const [showHistoryPanel, setShowHistoryPanel] = useState(() =>
    import.meta.env.DEV && new URLSearchParams(window.location.search).get("history") === "open",
  );
  const [loadingHistorySessionId, setLoadingHistorySessionId] = useState<number | null>(null);
  const [historySessionLoadError, setHistorySessionLoadError] = useState<{ id: number; title: string } | null>(null);
  const [showManualRagModal, setShowManualRagModal] = useState(() =>
    import.meta.env.DEV && new URLSearchParams(window.location.search).get("manual") === "open",
  );
  const [manualTitle, setManualTitle] = useState("");
  const [manualContent, setManualContent] = useState("");
  const [manualSearchQuery, setManualSearchQuery] = useState("");
  const [manualDocumentSort, setManualDocumentSort] = useState<"newest" | "oldest" | "title">(() => {
    const stored = readDashboardPreference("semiguard_manual_sort");
    return stored === "oldest" || stored === "title" ? stored : "newest";
  });
  const [debouncedManualSearch, setDebouncedManualSearch] = useState("");
  const [manualDocumentToDelete, setManualDocumentToDelete] = useState<number | null>(null);
  const [previewManualDocumentId, setPreviewManualDocumentId] = useState<number | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [showFeedbackHistoryPanel, setShowFeedbackHistoryPanel] = useState(() =>
    import.meta.env.DEV && new URLSearchParams(window.location.search).get("feedback") === "open",
  );
  const [messageFeedbackIds, setMessageFeedbackIds] = useState<Record<number, number>>({});
  const [feedbackHistoryFilter, setFeedbackHistoryFilter] = useState<"all" | "like" | "dislike">(() => {
    const stored = readDashboardPreference("semiguard_feedback_type");
    return stored === "like" || stored === "dislike" ? stored : "all";
  });
  const [feedbackReasonFilter, setFeedbackReasonFilter] = useState<"all" | "inaccurate" | "insufficient" | "irrelevant" | "other">(() => {
    const stored = readDashboardPreference("semiguard_feedback_reason");
    return stored === "inaccurate" || stored === "insufficient" || stored === "irrelevant" || stored === "other" ? stored : "all";
  });
  const [feedbackHistorySearch, setFeedbackHistorySearch] = useState(() => readDashboardPreference("semiguard_feedback_search") ?? "");
  const [feedbackHistoryStartDate, setFeedbackHistoryStartDate] = useState("");
  const [feedbackHistoryEndDate, setFeedbackHistoryEndDate] = useState("");
  const [feedbackHistoryDatePreset, setFeedbackHistoryDatePreset] = useState<"all" | "today" | "week" | "month" | "custom">(() => {
    const stored = readDashboardPreference("semiguard_feedback_date_preset");
    return stored === "today" || stored === "week" || stored === "month" ? stored : "all";
  });
  const [feedbackDatePresetRestored, setFeedbackDatePresetRestored] = useState(false);
  const [feedbackHistorySort, setFeedbackHistorySort] = useState<"newest" | "oldest">(() => {
    return readDashboardPreference("semiguard_feedback_sort") === "oldest" ? "oldest" : "newest";
  });
  const [feedbackHistoryPage, setFeedbackHistoryPage] = useState(1);
  const [animatedPositiveRatio, setAnimatedPositiveRatio] = useState(0);
  const [feedbackKeywordSummary, setFeedbackKeywordSummary] = useState<{ mode: "ai" | "fallback"; keywords: string[]; summary: string; improvement: string } | null>(null);
  const [feedbackContextItem, setFeedbackContextItem] = useState<{ id: number; sessionId: number; messageId: number | null; messageContent: string } | null>(null);
  const [feedbackToDelete, setFeedbackToDelete] = useState<number | null>(null);
  const [showDeleteAllFeedbackConfirm, setShowDeleteAllFeedbackConfirm] = useState(false);
  const [showDeleteAllFeedbackFinalConfirm, setShowDeleteAllFeedbackFinalConfirm] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState(() => readDashboardPreference("semiguard_history_search") ?? "");
  const [debouncedHistorySearch, setDebouncedHistorySearch] = useState("");
  const [historySessionFilter, setHistorySessionFilter] = useState<"all" | "pinned">(() => readDashboardPreference("semiguard_history_filter") === "pinned" ? "pinned" : "all");
  const [historySessionSort, setHistorySessionSort] = useState<"newest" | "oldest" | "title">(() => {
    const stored = readDashboardPreference("semiguard_history_sort");
    return stored === "oldest" || stored === "title" ? stored : "newest";
  });
  const [historySessionPage, setHistorySessionPage] = useState(1);
  const [historySessionStartDate, setHistorySessionStartDate] = useState("");
  const [historySessionEndDate, setHistorySessionEndDate] = useState("");
  const [historySessionDatePreset, setHistorySessionDatePreset] = useState<"all" | "today" | "week" | "month" | "custom">(() => {
    const stored = readDashboardPreference("semiguard_history_date_preset");
    return stored === "today" || stored === "week" || stored === "month" ? stored : "all";
  });

  const chatUtils = trpc.useUtils();
  const chatSessionsQuery = trpc.semiguard.getChatSessions.useQuery(undefined, { enabled: isChatOpen });
  const normalizedHistorySearch = searchKeyword.trim();
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedHistorySearch(normalizedHistorySearch), 250);
    return () => window.clearTimeout(timer);
  }, [normalizedHistorySearch]);
  useEffect(() => {
    persistDashboardPreference("semiguard_history_search", searchKeyword);
  }, [searchKeyword]);
  useEffect(() => {
    persistDashboardPreference("semiguard_history_filter", historySessionFilter);
  }, [historySessionFilter]);
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
    persistDashboardPreference("semiguard_history_sort", historySessionSort);
  }, [historySessionSort]);
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
  useEffect(() => {
    persistDashboardPreference("semiguard_history_date_preset", historySessionDatePreset);
  }, [historySessionDatePreset]);
  useEffect(() => {
    if (historySessionDatePreset !== "all" && historySessionDatePreset !== "custom") {
      applyHistoryDatePreset(historySessionDatePreset);
    }
  // Restore a stored relative date range only once on first mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const hasActiveHistoryFilters = normalizedHistorySearch.length > 0
    || historySessionFilter !== "all"
    || historySessionSort !== "newest"
    || historySessionDatePreset !== "all"
    || historySessionStartDate.length > 0
    || historySessionEndDate.length > 0;
  const resetHistoryFilters = () => {
    setSearchKeyword("");
    setDebouncedHistorySearch("");
    setHistorySessionFilter("all");
    setHistorySessionSort("newest");
    setHistorySessionStartDate("");
    setHistorySessionEndDate("");
    setHistorySessionDatePreset("all");
    setHistorySessionPage(1);
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
  const sortedManualDocuments = useMemo(() => [...filteredManualDocuments].sort((a, b) => {
    if (manualDocumentSort === "title") return a.title.localeCompare(b.title);
    const direction = manualDocumentSort === "newest" ? -1 : 1;
    return direction * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
  }), [filteredManualDocuments, manualDocumentSort]);
  const hasActiveManualFilters = normalizedManualSearch.length > 0 || manualDocumentSort !== "newest";
  useEffect(() => {
    persistDashboardPreference("semiguard_manual_sort", manualDocumentSort);
  }, [manualDocumentSort]);
  const resetManualFilters = () => {
    setManualSearchQuery("");
    setDebouncedManualSearch("");
    setManualDocumentSort("newest");
  };
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedManualSearch(normalizedManualSearch), 250);
    return () => window.clearTimeout(timer);
  }, [normalizedManualSearch]);
  const deleteSessionMutation = trpc.semiguard.deleteChatSession.useMutation();
  const deleteAllSessionsMutation = trpc.semiguard.deleteAllChatSessions.useMutation();
  const isClearingAllSessions = deleteAllSessionsMutation.isPending || createSessionMutation.isPending;
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
  const [quickPromptStatus, setQuickPromptStatus] = useState("");

  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string; timestamp: number; feedbackApplied?: boolean; manualSources?: ManualSource[]; recoveryPrompt?: string; usedFallback?: boolean }>>([
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
  const chatTimeLocale = lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US";
  const chatDraftStorageKey = `semiguard_chat_draft_${activeSessionId ?? "pending"}`;
  const activeChatDraftKeyRef = useRef<string | null>(null);
  const isRestoringChatDraftRef = useRef(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatLoadingElapsedSeconds, setChatLoadingElapsedSeconds] = useState(0);
  const chatMutation = trpc.semiguard.chatWithAi.useMutation();
  const FEEDBACK_PAGE_SIZE = 5;
  const allFeedbackHistory = feedbackHistoryQuery.data ?? [];
  const normalizedFeedbackSearch = feedbackHistorySearch.trim().toLocaleLowerCase();
  const feedbackStartAt = feedbackHistoryStartDate ? new Date(`${feedbackHistoryStartDate}T00:00:00`).getTime() : null;
  const feedbackEndAt = feedbackHistoryEndDate ? new Date(`${feedbackHistoryEndDate}T23:59:59.999`).getTime() : null;
  const filteredFeedbackHistory = allFeedbackHistory.filter(item => {
    const matchesType = feedbackHistoryFilter === "all" || item.feedbackType === feedbackHistoryFilter;
    const matchesReason = feedbackReasonFilter === "all"
      || (item.feedbackType === "dislike" && item.reasonCode === feedbackReasonFilter);
    const searchable = [item.reasonCode, item.reasonText, item.messageContent, item.regeneratedContent].filter(Boolean).join(" ").toLocaleLowerCase();
    const createdAt = new Date(item.createdAt).getTime();
    const matchesDate = (feedbackStartAt === null || createdAt >= feedbackStartAt) && (feedbackEndAt === null || createdAt <= feedbackEndAt);
    return matchesType && matchesReason && matchesDate && (!normalizedFeedbackSearch || searchable.includes(normalizedFeedbackSearch));
  });
  const sortedFeedbackHistory = [...filteredFeedbackHistory].sort((a, b) => {
    const delta = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return feedbackHistorySort === "newest" ? delta : -delta;
  });
  const positiveFeedbackCount = allFeedbackHistory.filter(item => item.feedbackType === "like").length;
  const negativeFeedbackCount = allFeedbackHistory.filter(item => item.feedbackType === "dislike").length;
  const feedbackReasonCountScope = allFeedbackHistory.filter(item => {
    const searchable = [item.reasonCode, item.reasonText, item.messageContent, item.regeneratedContent].filter(Boolean).join(" ").toLocaleLowerCase();
    const createdAt = new Date(item.createdAt).getTime();
    const matchesDate = (feedbackStartAt === null || createdAt >= feedbackStartAt) && (feedbackEndAt === null || createdAt <= feedbackEndAt);
    return item.feedbackType === "dislike" && matchesDate && (!normalizedFeedbackSearch || searchable.includes(normalizedFeedbackSearch));
  });
  const feedbackReasonCounts = feedbackReasonCountScope.reduce<Record<"inaccurate" | "insufficient" | "irrelevant" | "other", number>>((counts, item) => {
    if (item.feedbackType === "dislike" && item.reasonCode && item.reasonCode in counts) {
      counts[item.reasonCode as keyof typeof counts] += 1;
    }
    return counts;
  }, { inaccurate: 0, insufficient: 0, irrelevant: 0, other: 0 });
  const positiveFeedbackRatio = allFeedbackHistory.length ? Math.round((positiveFeedbackCount / allFeedbackHistory.length) * 100) : 0;
  const negativeFeedbackRatio = allFeedbackHistory.length ? 100 - positiveFeedbackRatio : 0;
  const feedbackHistoryTotalPages = Math.max(1, Math.ceil(sortedFeedbackHistory.length / FEEDBACK_PAGE_SIZE));
  const paginatedFeedbackHistory = sortedFeedbackHistory.slice((feedbackHistoryPage - 1) * FEEDBACK_PAGE_SIZE, feedbackHistoryPage * FEEDBACK_PAGE_SIZE);

  useEffect(() => {
    setFeedbackHistoryPage(1);
    setFeedbackKeywordSummary(null);
  }, [feedbackHistoryFilter, feedbackReasonFilter, feedbackHistorySearch, feedbackHistoryStartDate, feedbackHistoryEndDate, feedbackHistorySort]);
  useEffect(() => {
    persistDashboardPreference("semiguard_feedback_sort", feedbackHistorySort);
  }, [feedbackHistorySort]);
  useEffect(() => {
    persistDashboardPreference("semiguard_feedback_reason", feedbackReasonFilter);
  }, [feedbackReasonFilter]);
  useEffect(() => {
    persistDashboardPreference("semiguard_feedback_type", feedbackHistoryFilter);
  }, [feedbackHistoryFilter]);
  useEffect(() => {
    persistDashboardPreference("semiguard_feedback_search", feedbackHistorySearch);
  }, [feedbackHistorySearch]);
  useEffect(() => {
    persistDashboardPreference("semiguard_feedback_date_preset", feedbackHistoryDatePreset);
  }, [feedbackHistoryDatePreset]);

  const hasActiveFeedbackFilters = feedbackHistoryFilter !== "all"
    || feedbackReasonFilter !== "all"
    || feedbackHistorySearch.trim().length > 0
    || feedbackHistoryStartDate.length > 0
    || feedbackHistoryEndDate.length > 0
    || feedbackHistorySort !== "newest";
  const resetFeedbackHistoryFilters = () => {
    setFeedbackHistoryFilter("all");
    setFeedbackReasonFilter("all");
    setFeedbackHistorySearch("");
    setFeedbackHistoryStartDate("");
    setFeedbackHistoryEndDate("");
    setFeedbackHistoryDatePreset("all");
    setFeedbackHistorySort("newest");
    setFeedbackHistoryPage(1);
    setFeedbackKeywordSummary(null);
  };
  const applyFeedbackDatePreset = (preset: "all" | "today" | "week" | "month") => {
    setFeedbackHistoryDatePreset(preset);
    if (preset === "all") {
      setFeedbackHistoryStartDate("");
      setFeedbackHistoryEndDate("");
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
    setFeedbackHistoryStartDate(formatDateInput(start));
    setFeedbackHistoryEndDate(formatDateInput(end));
  };
  useEffect(() => {
    if (feedbackDatePresetRestored) return;
    if (feedbackHistoryDatePreset === "today" || feedbackHistoryDatePreset === "week" || feedbackHistoryDatePreset === "month") {
      applyFeedbackDatePreset(feedbackHistoryDatePreset);
    }
    setFeedbackDatePresetRestored(true);
  }, [feedbackDatePresetRestored, feedbackHistoryDatePreset]);

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
    const filterName = feedbackHistoryFilter === "all"
      ? (lang === "ko" ? "전체" : lang === "ja" ? "すべて" : "all")
      : feedbackHistoryFilter === "like"
        ? (lang === "ko" ? "긍정" : lang === "ja" ? "肯定" : "positive")
        : (lang === "ko" ? "부정" : lang === "ja" ? "否定" : "negative");
    const reasonName = feedbackReasonFilter === "all"
      ? ""
      : `_${feedbackReasonFilter === "inaccurate"
        ? (lang === "ko" ? "정확성" : lang === "ja" ? "正確性" : "accuracy")
        : feedbackReasonFilter === "insufficient"
          ? (lang === "ko" ? "설명부족" : lang === "ja" ? "説明不足" : "insufficient")
          : feedbackReasonFilter === "irrelevant"
            ? (lang === "ko" ? "관련없음" : lang === "ja" ? "関連なし" : "irrelevant")
            : (lang === "ko" ? "기타" : lang === "ja" ? "その他" : "other")}`;
    const filenamePrefix = lang === "ko" ? "세미가드_피드백" : lang === "ja" ? "セミガード_フィードバック" : "semiguard-feedback";
    anchor.href = url;
    anchor.download = `${filenamePrefix}_${filterName}${reasonName}_${new Date().toISOString().slice(0, 10)}.csv`;
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
    const filenamePrefix = lang === "ko" ? "세미가드_상담기록" : lang === "ja" ? "セミガード_相談履歴" : "semiguard-consultations";
    anchor.href = url;
    anchor.download = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`;
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
      const filenamePrefix = lang === "ko" ? "세미가드_현재상담" : lang === "ja" ? "セミガード_現在の相談" : "semiguard-current";
      anchor.href = url;
      anchor.download = `${filenamePrefix}_${safeTitle}_${new Date().toISOString().slice(0, 10)}.md`;
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
      const filenamePrefix = lang === "ko" ? "세미가드_상담기록" : lang === "ja" ? "セミガード_相談履歴" : "semiguard";
      anchor.href = url;
      anchor.download = `${filenamePrefix}_${safeTitle}_${new Date().toISOString().slice(0, 10)}.md`;
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

  const loadHistorySession = async (session: { id: number; title: string }) => {
    if (loadingHistorySessionId === session.id) return;
    setLoadingHistorySessionId(session.id);
    setHistorySessionLoadError(null);
    try {
      const res = await chatUtils.client.semiguard.getChatMessages.query({ sessionId: session.id });
      setActiveSessionId(session.id);
      setShowHistoryPanel(false);
      if (res && res.length > 0) {
        setChatMessages(res.map(message => ({
          role: message.role as "user" | "assistant",
          content: message.content,
          timestamp: message.createdAt ? new Date(message.createdAt).getTime() : Date.now(),
          usedFallback: message.role === "assistant" && FALLBACK_DIAGNOSTIC_MARKERS.some(marker => message.content.includes(marker)),
        })));
      } else {
        setChatMessages([{
          role: "assistant",
          content: lang === "ko" ? "저장된 대화가 없는 세션입니다." : lang === "ja" ? "保存された会話のないセッションです。" : "Empty session.",
          timestamp: Date.now(),
        }]);
      }
    } catch (error) {
      console.error("Failed to load session messages:", error);
      setHistorySessionLoadError({ id: session.id, title: session.title });
      toast.error(lang === "ko" ? "상담 기록을 열지 못했습니다." : lang === "ja" ? "相談履歴を開けませんでした。" : "Could not open the consultation history.");
    } finally {
      setLoadingHistorySessionId(null);
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

  useEffect(() => {
    if (!isChatOpen) return;

    const handleChatEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();

      if (showAiHistory) return closeAiHistory();
      if (activeManualSource) return setActiveManualSource(null);
      if (showDeleteAllFeedbackFinalConfirm) return setShowDeleteAllFeedbackFinalConfirm(false);
      if (showDeleteAllFeedbackConfirm) return setShowDeleteAllFeedbackConfirm(false);
      if (feedbackToDelete !== null) return setFeedbackToDelete(null);
      if (activeDislikeIdx !== null) return setActiveDislikeIdx(null);
      if (feedbackContextItem) return setFeedbackContextItem(null);
      if (showFeedbackHistoryPanel) return setShowFeedbackHistoryPanel(false);
      if (manualDocumentToDelete !== null) return setManualDocumentToDelete(null);
      if (showManualRagModal) return setShowManualRagModal(false);
      if (showDeleteAllConfirm) return setShowDeleteAllConfirm(false);
      if (showHistoryPanel) return setShowHistoryPanel(false);
      if (showResetConfirmModal) return setShowResetConfirmModal(false);

      setIsChatOpen(false);
    };

    window.addEventListener("keydown", handleChatEscape);
    return () => window.removeEventListener("keydown", handleChatEscape);
  }, [
    activeManualSource,
    activeDislikeIdx,
    feedbackContextItem,
    feedbackToDelete,
    isChatOpen,
    manualDocumentToDelete,
    showDeleteAllConfirm,
    showDeleteAllFeedbackConfirm,
    showDeleteAllFeedbackFinalConfirm,
    showFeedbackHistoryPanel,
    showHistoryPanel,
    showAiHistory,
    showManualRagModal,
    showResetConfirmModal,
  ]);

  useEffect(() => {
    if (isChatOpen) {
      wasChatOpenRef.current = true;
      const focusTimer = window.setTimeout(() => chatCloseButtonRef.current?.focus(), 0);
      return () => window.clearTimeout(focusTimer);
    }

    if (wasChatOpenRef.current) {
      chatLaunchButtonRef.current?.focus();
      wasChatOpenRef.current = false;
    }
  }, [isChatOpen]);

  useEffect(() => {
    if (!isChatOpen) return;

    const trapChatFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const dialog = activeManualSource
        ? manualSourceDialogRef.current
        : manualDocumentToDelete !== null
          ? manualDeleteDialogRef.current
          : showDeleteAllFeedbackFinalConfirm
            ? deleteAllFeedbackFinalDialogRef.current
            : showDeleteAllFeedbackConfirm
              ? deleteAllFeedbackConfirmDialogRef.current
              : feedbackToDelete !== null
                ? feedbackDeleteDialogRef.current
                : activeDislikeIdx !== null
                  ? dislikeReasonDialogRef.current
                  : feedbackContextItem
                    ? feedbackContextDialogRef.current
                    : showManualRagModal
                      ? manualPanelDialogRef.current
                      : showResetConfirmModal
                        ? resetConfirmDialogRef.current
                        : showDeleteAllConfirm
                          ? deleteAllConfirmDialogRef.current
                          : chatDialogRef.current;
      if (!dialog) return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter(element => !element.hasAttribute("aria-hidden") && element.getClientRects().length > 0);
      if (focusable.length === 0) return;

      const firstFocusable = focusable[0];
      const lastFocusable = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === firstFocusable || !dialog.contains(activeElement))) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && (activeElement === lastFocusable || !dialog.contains(activeElement))) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    window.addEventListener("keydown", trapChatFocus);
    return () => window.removeEventListener("keydown", trapChatFocus);
  }, [activeDislikeIdx, activeManualSource, feedbackContextItem, feedbackToDelete, isChatOpen, manualDocumentToDelete, showDeleteAllConfirm, showDeleteAllFeedbackConfirm, showDeleteAllFeedbackFinalConfirm, showManualRagModal, showResetConfirmModal]);

  useEffect(() => {
    if (!isChatOpen || !isChatNearBottomRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      const messageList = chatMessageListRef.current;
      if (messageList) messageList.scrollTo({ top: messageList.scrollHeight, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chatMessages.length, isChatLoading, isChatOpen]);

  useEffect(() => {
    const addedMessageCount = chatMessages.length - previousChatMessageCountRef.current;
    previousChatMessageCountRef.current = chatMessages.length;

    if (!isChatOpen) {
      setUnreadChatMessageCount(0);
      return;
    }

    if (addedMessageCount > 0 && !isChatNearBottomRef.current) {
      setUnreadChatMessageCount(count => count + addedMessageCount);
    }
  }, [chatMessages.length, isChatOpen]);

  useEffect(() => {
    if (activeChatDraftKeyRef.current === chatDraftStorageKey) return;
    activeChatDraftKeyRef.current = chatDraftStorageKey;
    isRestoringChatDraftRef.current = true;

    try {
      setChatInput(sessionStorage.getItem(chatDraftStorageKey) ?? "");
    } catch {
      setChatInput("");
    }
  }, [chatDraftStorageKey]);

  useEffect(() => {
    if (activeChatDraftKeyRef.current !== chatDraftStorageKey) return;
    if (isRestoringChatDraftRef.current) {
      isRestoringChatDraftRef.current = false;
      return;
    }

    try {
      if (chatInput.trim()) {
        sessionStorage.setItem(chatDraftStorageKey, chatInput.slice(0, 4000));
      } else {
        sessionStorage.removeItem(chatDraftStorageKey);
      }
    } catch {
      // 저장소를 사용할 수 없는 환경에서는 입력 UX만 유지합니다.
    }
  }, [chatDraftStorageKey, chatInput]);

  useEffect(() => {
    if (!isChatLoading) {
      setChatLoadingElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    let intervalId: number | null = null;
    const updateElapsed = () => {
      setChatLoadingElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    };
    const stopElapsedTimer = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };
    const startElapsedTimer = () => {
      if (document.visibilityState === "hidden" || intervalId !== null) return;
      updateElapsed();
      intervalId = window.setInterval(updateElapsed, 1000);
    };
    const handleChatLoadingVisibilityChange = () => {
      if (document.visibilityState === "hidden") stopElapsedTimer();
      else startElapsedTimer();
    };

    startElapsedTimer();
    document.addEventListener("visibilitychange", handleChatLoadingVisibilityChange);
    return () => {
      stopElapsedTimer();
      document.removeEventListener("visibilitychange", handleChatLoadingVisibilityChange);
    };
  }, [isChatLoading]);

  useEffect(() => {
    const focusTimer = window.setTimeout(() => {
      if (activeManualSource) {
        wasManualSourceOpenRef.current = true;
        manualSourceCloseRef.current?.focus();
      } else if (wasManualSourceOpenRef.current) {
        manualSourceTriggerRef.current?.focus();
        wasManualSourceOpenRef.current = false;
      } else if (manualDocumentToDelete !== null) {
        wasManualDeleteOpenRef.current = true;
        manualDeleteCancelRef.current?.focus();
      } else if (wasManualDeleteOpenRef.current) {
        (manualDeleteTriggerRef.current?.isConnected ? manualDeleteTriggerRef.current : manualPanelCloseRef.current)?.focus();
        wasManualDeleteOpenRef.current = false;
      } else if (activeDislikeIdx !== null) {
        wasDislikeReasonOpenRef.current = true;
        dislikeReasonCloseRef.current?.focus();
      } else if (wasDislikeReasonOpenRef.current) {
        dislikeReasonTriggerRef.current?.focus();
        wasDislikeReasonOpenRef.current = false;
      } else if (showDeleteAllFeedbackFinalConfirm) {
        wasDeleteAllFeedbackFinalConfirmOpenRef.current = true;
        deleteAllFeedbackFinalCancelRef.current?.focus();
      } else if (wasDeleteAllFeedbackFinalConfirmOpenRef.current) {
        (deleteAllFeedbackTriggerRef.current?.isConnected ? deleteAllFeedbackTriggerRef.current : feedbackPanelCloseRef.current)?.focus();
        wasDeleteAllFeedbackFinalConfirmOpenRef.current = false;
      } else if (showDeleteAllFeedbackConfirm) {
        wasDeleteAllFeedbackConfirmOpenRef.current = true;
        deleteAllFeedbackConfirmCancelRef.current?.focus();
      } else if (wasDeleteAllFeedbackConfirmOpenRef.current) {
        (deleteAllFeedbackTriggerRef.current?.isConnected ? deleteAllFeedbackTriggerRef.current : feedbackPanelCloseRef.current)?.focus();
        wasDeleteAllFeedbackConfirmOpenRef.current = false;
      } else if (feedbackToDelete !== null) {
        wasFeedbackDeleteOpenRef.current = true;
        feedbackDeleteCancelRef.current?.focus();
      } else if (wasFeedbackDeleteOpenRef.current) {
        (feedbackDeleteTriggerRef.current?.isConnected ? feedbackDeleteTriggerRef.current : feedbackPanelCloseRef.current)?.focus();
        wasFeedbackDeleteOpenRef.current = false;
      } else if (feedbackContextItem) {
        wasFeedbackContextOpenRef.current = true;
        feedbackContextCloseRef.current?.focus();
      } else if (wasFeedbackContextOpenRef.current) {
        (feedbackContextTriggerRef.current?.isConnected ? feedbackContextTriggerRef.current : feedbackPanelCloseRef.current)?.focus();
        wasFeedbackContextOpenRef.current = false;
      } else if (showDeleteAllConfirm) {
        wasDeleteAllConfirmOpenRef.current = true;
        deleteAllConfirmCancelRef.current?.focus();
      } else if (wasDeleteAllConfirmOpenRef.current) {
        (showHistoryPanel ? deleteAllConfirmTriggerRef.current : historyPanelTriggerRef.current)?.focus();
        wasDeleteAllConfirmOpenRef.current = false;
      } else if (showHistoryPanel) {
        wasHistoryPanelOpenRef.current = true;
        historyPanelCloseRef.current?.focus();
      } else if (wasHistoryPanelOpenRef.current) {
        historyPanelTriggerRef.current?.focus();
        wasHistoryPanelOpenRef.current = false;
      } else if (showFeedbackHistoryPanel) {
        wasFeedbackPanelOpenRef.current = true;
        feedbackPanelCloseRef.current?.focus();
      } else if (wasFeedbackPanelOpenRef.current) {
        feedbackPanelTriggerRef.current?.focus();
        wasFeedbackPanelOpenRef.current = false;
      } else if (showManualRagModal) {
        wasManualPanelOpenRef.current = true;
        manualPanelCloseRef.current?.focus();
      } else if (wasManualPanelOpenRef.current) {
        manualPanelTriggerRef.current?.focus();
        wasManualPanelOpenRef.current = false;
      } else if (showResetConfirmModal) {
        wasResetConfirmOpenRef.current = true;
        resetConfirmCancelRef.current?.focus();
      } else if (wasResetConfirmOpenRef.current) {
        resetConfirmTriggerRef.current?.focus();
        wasResetConfirmOpenRef.current = false;
      }
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [activeDislikeIdx, activeManualSource, feedbackContextItem, feedbackToDelete, manualDocumentToDelete, showDeleteAllConfirm, showDeleteAllFeedbackConfirm, showDeleteAllFeedbackFinalConfirm, showFeedbackHistoryPanel, showHistoryPanel, showManualRagModal, showResetConfirmModal]);

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
    isChatNearBottomRef.current = true;
    setIsChatAwayFromLatest(false);
    setUnreadChatMessageCount(0);
    if (!textToSend) {
      setChatInput("");
      try {
        sessionStorage.removeItem(chatDraftStorageKey);
      } catch {
        // 저장소 정리가 실패해도 메시지 전송은 계속합니다.
      }
    }
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
        usedFallback: res.usedFallback ?? false,
        recoveryPrompt: isTemporaryServiceReply || res.usedFallback ? text.trim() : undefined,
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
    if (menuOpen) {
      wasMenuOpenRef.current = true;
      const focusTimer = window.setTimeout(() => menuCloseButtonRef.current?.focus(), 0);
      const previousOverflow = document.body.style.overflow;
      const closeOnEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setMenuOpen(false);
          return;
        }
        if (event.key !== "Tab") return;
        const focusable = menuPanelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;
        const firstFocusable = focusable[0];
        const lastFocusable = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable.focus();
        } else if (!event.shiftKey && document.activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable.focus();
        }
      };
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", closeOnEscape);
      return () => {
        window.clearTimeout(focusTimer);
        document.body.style.overflow = previousOverflow;
        window.removeEventListener("keydown", closeOnEscape);
      };
    }

    if (wasMenuOpenRef.current) {
      menuTriggerRef.current?.focus();
      wasMenuOpenRef.current = false;
    }
  }, [menuOpen]);

  useEffect(() => {
    const metadata = lang === "ja"
      ? {
          locale: "ja-JP",
          title: "SemiGuard AI｜半導体設備の読み取り専用予知安全ダッシュボード",
          description: "SemiGuard AIは半導体設備の電流・温度・振動・騒音の変化をz-scoreベースのリスクスコアで整理し、センサー根拠とAI補助点検説明を提供する読み取り専用の予知安全システムです。",
          keywords: "SemiGuard AI,半導体予知保全,異常検知,センサーモニタリング,予知安全システム",
        }
      : lang === "en"
        ? {
            locale: "en-US",
            title: "SemiGuard AI | Read-Only Semiconductor Safety Dashboard",
            description: "SemiGuard AI organizes current, temperature, vibration, and noise deviations into z-score risk scores, connecting sensor evidence with AI-assisted inspection guidance in a read-only semiconductor safety dashboard.",
            keywords: "SemiGuard AI, semiconductor predictive maintenance, anomaly detection, sensor monitoring, safety dashboard",
          }
        : {
            locale: "ko-KR",
            title: "SemiGuard AI - 반도체 장비 실시간 AI 예지보전 및 이상탐지 시스템",
            description: "SemiGuard AI는 반도체 장비의 전류·온도·진동·소음 편차를 z-score 기반 위험 점수로 정리하고, 센서 근거와 AI 보조 점검 설명을 제공하는 읽기 전용 예지안전 시스템입니다.",
            keywords: "SemiGuard AI, 반도체 예지보전, 이상탐지, 센서 모니터링, 예지안전 시스템",
          };

    document.title = metadata.title;
    document.documentElement.lang = metadata.locale;
    
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', metadata.description);

    let metaKw = document.querySelector('meta[name="keywords"]');
    if (!metaKw) {
      metaKw = document.createElement('meta');
      metaKw.setAttribute('name', 'keywords');
      document.head.appendChild(metaKw);
    }
    metaKw.setAttribute('content', metadata.keywords);

    const provider = new URLSearchParams(window.location.search).get("social_linked");
    if (!provider) return;
    const label = provider === "google" ? "Google" : provider === "naver" ? "Naver" : provider === "kakao" ? "Kakao" : "소셜 계정";
    toast.success(lang === "ko" ? `${label} 계정이 연결되었습니다.` : lang === "ja" ? `${label}アカウントを連携しました。` : `${label} account linked successfully.`);
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
  const trackProductActivityMutation = trpc.semiguard.trackProductActivity.useMutation();
  const summarizePeriodForReportMutation = trpc.semiguard.summarizePeriodForReport.useMutation();
  const [dashboardPeriod, setDashboardPeriod] = useState<"day" | "week" | "month" | "custom">("day");
  const todayDateValue = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [customStartDate, setCustomStartDate] = useState(() => {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return start.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState(todayDateValue);
  const [appliedCustomRange, setAppliedCustomRange] = useState(() => ({ startDate: customStartDate, endDate: todayDateValue }));
  const [customPeriodPresets, setCustomPeriodPresets] = useState<CustomPeriodPreset[]>(readCustomPeriodPresets);
  const [customPeriodPresetName, setCustomPeriodPresetName] = useState("");
  const [isPeriodChanging, setIsPeriodChanging] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedPeriod = params.get("period");
    if (requestedPeriod === "day" || requestedPeriod === "week" || requestedPeriod === "month") {
      setDashboardPeriod(requestedPeriod);
      return;
    }
    if (requestedPeriod === "custom") {
      const startDate = params.get("start");
      const endDate = params.get("end");
      if (startDate && endDate && startDate <= endDate) {
        setCustomStartDate(startDate);
        setCustomEndDate(endDate);
        setAppliedCustomRange({ startDate, endDate });
        setDashboardPeriod("custom");
      }
    }
  }, []);
  const dashboardPeriodInput = useMemo(() => dashboardPeriod === "custom"
    ? { period: "custom" as const, startAt: toLocalDateBoundaryIso(appliedCustomRange.startDate), endAt: toLocalDateBoundaryIso(appliedCustomRange.endDate, true) }
    : { period: dashboardPeriod }, [appliedCustomRange, dashboardPeriod]);
  const getStats = trpc.semiguard.getStats.useQuery(undefined, { refetchInterval: 5000 });
  const periodOverviewQuery = trpc.semiguard.getPeriodOverview.useQuery(dashboardPeriodInput, { refetchInterval: 5000 });
  const productUsageMetricsQuery = trpc.semiguard.getProductUsageMetrics.useQuery(dashboardPeriodInput, {
    enabled: isUsageMetricsAdmin,
    refetchInterval: 15_000,
  });
  const currentUsageMetrics = productUsageMetricsQuery.data;
  const previousUsageMetrics = currentUsageMetrics?.previous;
  const currentReturningRate = currentUsageMetrics && currentUsageMetrics.activeUsers > 0 ? Math.round((currentUsageMetrics.returningUsers / currentUsageMetrics.activeUsers) * 100) : 0;
  const previousReturningRate = previousUsageMetrics && previousUsageMetrics.activeUsers > 0 ? Math.round((previousUsageMetrics.returningUsers / previousUsageMetrics.activeUsers) * 100) : 0;
  const formatMetricDelta = (current: number, previous: number) => `${current - previous >= 0 ? "+" : ""}${current - previous}%p`;
  const usageComparisonHasSmallSample = !currentUsageMetrics || !previousUsageMetrics || currentUsageMetrics.activeUsers < 5 || previousUsageMetrics.activeUsers < 5;
  const getLogs = trpc.semiguard.getLogs.useQuery({ limit: 200 }, { refetchInterval: 5000 });
  const getDailyMaxRisk = trpc.semiguard.getDailyMaxRisk.useQuery(undefined, { refetchInterval: 10000 });
  const utils = trpc.useUtils();
  const getRecentScoresQuery = trpc.semiguard.getRecentScores.useQuery({ limit: 50 }, { refetchInterval: 5000 });
  const { data: logsData, isLoading: logsLoading } = getLogs;
  const safetyMonitoringHasError = getStats.isError || periodOverviewQuery.isError || getLogs.isError || getDailyMaxRisk.isError || getRecentScoresQuery.isError;
  const safetyMonitoringInitializing = getStats.isLoading || periodOverviewQuery.isLoading || getLogs.isLoading || getDailyMaxRisk.isLoading || getRecentScoresQuery.isLoading;
  const safetyMonitoringRetrying = getStats.isFetching || periodOverviewQuery.isFetching || getLogs.isFetching || getDailyMaxRisk.isFetching || getRecentScoresQuery.isFetching;
  const systemStatusKind = safetyMonitoringHasError || !heartbeatAlive ? "attention" : safetyMonitoringInitializing || autoPollingRetryPending ? "syncing" : "healthy";
  const systemStatusLabel = systemStatusKind === "attention"
    ? (lang === "ko" ? "점검 필요" : lang === "ja" ? "確認が必要" : "Needs attention")
    : systemStatusKind === "syncing"
      ? (lang === "ko" ? "동기화 중" : lang === "ja" ? "同期中" : "Syncing")
      : (lang === "ko" ? "정상 운영" : lang === "ja" ? "正常運用" : "Operational");
  const systemStatusDescription = systemStatusKind === "attention"
    ? (lang === "ko" ? "하트비트 또는 핵심 안전 데이터에 점검이 필요합니다." : lang === "ja" ? "ハートビートまたは主要な安全データの確認が必要です。" : "Heartbeat or core safety data needs attention.")
    : systemStatusKind === "syncing"
      ? (lang === "ko" ? "핵심 안전 데이터를 동기화하거나 자동 재시도 중입니다." : lang === "ja" ? "主要な安全データを同期中、または自動再試行中です。" : "Core safety data is syncing or retrying automatically.")
      : (lang === "ko" ? "하트비트와 핵심 안전 데이터가 정상입니다." : lang === "ja" ? "ハートビートと主要な安全データは正常です。" : "Heartbeat and core safety data are healthy.");
  const systemStatusColor = systemStatusKind === "attention" ? "oklch(0.72 0.18 30)" : systemStatusKind === "syncing" ? "oklch(0.75 0.18 200)" : "oklch(0.70 0.18 145)";
  const systemStatusBorder = systemStatusKind === "attention" ? "oklch(0.72 0.18 30 / 0.55)" : systemStatusKind === "syncing" ? "oklch(0.75 0.18 200 / 0.55)" : "oklch(0.70 0.18 145 / 0.55)";
  const systemStatusBackground = systemStatusKind === "attention" ? "oklch(0.72 0.18 30 / 0.10)" : systemStatusKind === "syncing" ? "oklch(0.75 0.18 200 / 0.10)" : "oklch(0.70 0.18 145 / 0.10)";
  const statsInitialLoading = periodOverviewQuery.isLoading && !periodOverviewQuery.data;
  const statsLoadingLabel = lang === "ko" ? "통계를 불러오는 중..." : lang === "ja" ? "統計を読み込み中..." : "Loading statistics...";
  const activityVisitRecordedForUserRef = useRef<number | null>(null);
  useEffect(() => {
    const userId = authMeQuery.data?.id;
    if (!userId || activityVisitRecordedForUserRef.current === userId) return;
    activityVisitRecordedForUserRef.current = userId;
    void trackProductActivityMutation.mutateAsync({ eventType: "visit" }).catch(() => undefined);
  }, [authMeQuery.data?.id, trackProductActivityMutation]);
  const retrySafetyMonitoring = () => {
    void getStats.refetch();
    void periodOverviewQuery.refetch();
    void getLogs.refetch();
    void getDailyMaxRisk.refetch();
    void getRecentScoresQuery.refetch();
  };

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
  const [virtualFabDemoActive, setVirtualFabDemoActive] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [sensorImageExporting, setSensorImageExporting] = useState<"png" | "jpeg" | null>(null);
  const selectedPeriodStats = periodOverviewQuery.data;
  const showPeriodSkeleton = isPeriodChanging || (periodOverviewQuery.isLoading && !selectedPeriodStats);
  useEffect(() => {
    const responseMatchesSelectedPeriod = selectedPeriodStats?.period === dashboardPeriod
      && (dashboardPeriod !== "custom" || selectedPeriodStats?.startAt === dashboardPeriodInput.startAt);
    if (isPeriodChanging && !periodOverviewQuery.isFetching && responseMatchesSelectedPeriod) {
      setIsPeriodChanging(false);
    }
  }, [dashboardPeriod, dashboardPeriodInput, isPeriodChanging, periodOverviewQuery.isFetching, selectedPeriodStats?.period, selectedPeriodStats?.startAt]);
  const handleDashboardPeriodChange = (nextPeriod: "day" | "week" | "month" | "custom") => {
    if (nextPeriod === dashboardPeriod) return;
    setIsPeriodChanging(true);
    setDashboardPeriod(nextPeriod);
  };
  const applyCustomPeriod = () => {
    if (!customStartDate || !customEndDate || customStartDate > customEndDate) {
      toast.error(lang === "ko" ? "시작일은 종료일보다 늦을 수 없습니다." : lang === "ja" ? "開始日は終了日より後にできません。" : "The start date cannot be after the end date.");
      return;
    }
    setIsPeriodChanging(true);
    setAppliedCustomRange({ startDate: customStartDate, endDate: customEndDate });
    setDashboardPeriod("custom");
  };
  const saveCustomPeriodPreset = () => {
    const name = customPeriodPresetName.trim().slice(0, 40);
    if (!name || !customStartDate || !customEndDate || customStartDate > customEndDate) {
      toast.error(lang === "ko" ? "저장할 기간 이름과 올바른 날짜 범위를 입력하세요." : lang === "ja" ? "保存する期間名と正しい日付範囲を入力してください。" : "Enter a preset name and a valid date range.");
      return;
    }
    const preset: CustomPeriodPreset = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, startDate: customStartDate, endDate: customEndDate };
    const next = [preset, ...customPeriodPresets.filter(item => item.name.toLocaleLowerCase() !== name.toLocaleLowerCase())].slice(0, MAX_CUSTOM_PERIOD_PRESETS);
    setCustomPeriodPresets(next);
    persistCustomPeriodPresets(next);
    setCustomPeriodPresetName("");
    toast.success(lang === "ko" ? "기간 프리셋을 저장했습니다." : lang === "ja" ? "期間プリセットを保存しました。" : "Period preset saved.");
  };
  const applyCustomPeriodPreset = (preset: CustomPeriodPreset) => {
    setCustomStartDate(preset.startDate);
    setCustomEndDate(preset.endDate);
    setAppliedCustomRange({ startDate: preset.startDate, endDate: preset.endDate });
    setIsPeriodChanging(true);
    setDashboardPeriod("custom");
    toast.success(lang === "ko" ? `‘${preset.name}’ 기간을 적용했습니다.` : lang === "ja" ? `「${preset.name}」の期間を適用しました。` : `Applied “${preset.name}”.`);
  };
  const deleteCustomPeriodPreset = (presetId: string) => {
    const next = customPeriodPresets.filter(preset => preset.id !== presetId);
    setCustomPeriodPresets(next);
    persistCustomPeriodPresets(next);
    toast.success(lang === "ko" ? "기간 프리셋을 삭제했습니다." : lang === "ja" ? "期間プリセットを削除しました。" : "Period preset deleted.");
  };
  const loadVirtualFabDemo = () => {
    const timestamp = Date.now();
    const sensorData: SensorData = { current: 11.8, temperature: 88.4, vibration: 3.24, noise: 87.1, timestamp };
    const result: AnomalyResult = { sensorData, anomalyScore: 86, riskLevel: "danger", isAnomaly: true };
    const sampleSeries = Array.from({ length: 16 }, (_, index) => ({
      current: 7.1 + index * 0.30, temperature: 57 + index * 2.05, vibration: 2.15 + index * 0.07, noise: 66 + index * 1.4, timestamp: timestamp - (15 - index) * 60_000,
    }));
    setDemoRunning(false);
    setVirtualFabDemoActive(true);
    setCurrent(result);
    setScoreHistory(sampleSeries.map((_, index) => Math.min(86, 28 + index * 4)));
    setChartData(sampleSeries.map((point, index) => ({ ...point, label: `VF-${index + 1}` })));
    const analysis = lang === "ko"
      ? { primaryCause: "가상 진공 펌프의 온도·진동 동시 상승", details: "가상 팹 시나리오에서 온도 88.4°C, 진동 3.24 mm/s, 소음 87.1 dB가 기준 범위를 함께 초과했습니다. 실제 설비 데이터가 아닌 읽기 전용 시연 값입니다.", recommendation: "실제 파일럿에서는 장비 담당자가 냉각·베어링·진공 라인 점검 절차를 현장 안전 기준에 따라 확인하세요." }
      : lang === "ja"
        ? { primaryCause: "仮想真空ポンプの温度・振動の同時上昇", details: "仮想ファブシナリオでは、温度88.4°C、振動3.24 mm/s、騒音87.1 dBが同時に基準範囲を超えています。実設備データではなく、読み取り専用のデモ値です。", recommendation: "実際のパイロットでは、担当者が現場安全基準に従って冷却・ベアリング・真空ラインの点検手順を確認してください。" }
        : { primaryCause: "Concurrent temperature and vibration rise in the virtual vacuum pump", details: "In this virtual fab scenario, temperature 88.4°C, vibration 3.24 mm/s, and noise 87.1 dB exceed their reference ranges together. These are read-only simulated values, not real equipment data.", recommendation: "For an actual pilot, the responsible operator should review cooling, bearing, and vacuum-line checks under approved on-site safety procedures." };
    setLlmAnalysis({ ...analysis, score: result.anomalyScore, riskLevel: result.riskLevel });
    toast.success(lang === "ko" ? "가상 팹 위험 시나리오를 불러왔습니다. 실제 설비 제어는 수행하지 않습니다." : lang === "ja" ? "仮想ファブのリスクシナリオを読み込みました。実設備の制御は行いません。" : "Loaded the virtual fab risk scenario. No real equipment is controlled.");
  };
  const exportCurrentLlmAnalysis = (format: "text" | "pdf") => {
    if (!llmAnalysis) {
      toast.error(lang === "ko" ? "먼저 AI 이상 분석 결과를 확인하세요." : lang === "ja" ? "先にAI異常分析結果を確認してください。" : "Review an AI anomaly analysis first.");
      return;
    }
    try {
      if (format === "text") downloadLlmAnalysisText(llmAnalysis, lang);
      else openLlmAnalysisPdf(llmAnalysis, lang);
      toast.success(format === "text"
        ? (lang === "ko" ? "AI 분석 결과를 텍스트 파일로 저장했습니다." : lang === "ja" ? "AI分析結果をテキストファイルで保存しました。" : "Saved AI analysis as a text file.")
        : (lang === "ko" ? "AI 분석 보고서를 준비했습니다. 인쇄 창에서 PDF로 저장하세요." : lang === "ja" ? "AI分析レポートを準備しました。印刷画面でPDFとして保存してください。" : "Prepared the AI analysis report. Save it as PDF from the print dialog."));
    } catch (error) {
      console.error("AI analysis export failed:", error);
      toast.error(lang === "ko" ? "AI 분석 결과를 내보내지 못했습니다." : lang === "ja" ? "AI分析結果を出力できませんでした。" : "Could not export the AI analysis.");
    }
  };
  const exportSelectedPeriodCsv = () => {
    if (!selectedPeriodStats) {
      toast.error(lang === "ko" ? "기간 통계를 준비한 뒤 CSV를 내보낼 수 있습니다." : lang === "ja" ? "期間統計を読み込んだ後にCSVを出力できます。" : "Load period statistics before exporting CSV.");
      return;
    }
    exportPeriodOverviewToCsv(selectedPeriodStats, lang, selectedPeriodLabel);
    toast.success(lang === "ko" ? "기간별 통계를 CSV로 저장했습니다." : lang === "ja" ? "期間別統計をCSVで保存しました。" : "Period statistics saved as CSV.");
  };
  const getReportShareUrl = () => {
    const params = new URLSearchParams({ period: dashboardPeriod });
    if (dashboardPeriod === "custom") {
      params.set("start", appliedCustomRange.startDate);
      params.set("end", appliedCustomRange.endDate);
    }
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  };
  const copyReportShareLink = async () => {
    try {
      const copied = await copyTextWithFallback(getReportShareUrl());
      if (!copied) throw new Error("Clipboard copy failed");
      toast.success(lang === "ko" ? "로그인 보호 분석 기간 링크를 복사했습니다." : lang === "ja" ? "ログイン保護された分析期間リンクをコピーしました。" : "Copied the login-protected analysis period link.");
    } catch (error) {
      console.error("Report share link copy failed:", error);
      toast.error(lang === "ko" ? "링크를 복사하지 못했습니다. 브라우저 권한을 확인해주세요." : lang === "ja" ? "リンクをコピーできませんでした。ブラウザーの権限を確認してください。" : "Could not copy the link. Check browser permissions.");
    }
  };
  const composeReportEmail = () => {
    const subject = lang === "ko" ? `[SemiGuard AI] ${selectedPeriodLabel} 안전 운영 보고서` : lang === "ja" ? `[SemiGuard AI] ${selectedPeriodLabel} 安全運用レポート` : `[SemiGuard AI] ${selectedPeriodLabel} safety operations report`;
    const body = lang === "ko"
      ? `SemiGuard AI 분석 기간 링크입니다.\n\n${getReportShareUrl()}\n\n로그인 후 같은 기간의 대시보드와 보고서를 확인할 수 있습니다.`
      : lang === "ja"
        ? `SemiGuard AIの分析期間リンクです。\n\n${getReportShareUrl()}\n\nログイン後、同じ期間のダッシュボードとレポートを確認できます。`
        : `Here is the SemiGuard AI analysis period link.\n\n${getReportShareUrl()}\n\nAfter signing in, you can view the dashboard and report for the same period.`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast.success(lang === "ko" ? "이메일 작성 창을 열었습니다. 수신자와 첨부 파일을 확인한 뒤 직접 전송하세요." : lang === "ja" ? "メール作成画面を開きました。宛先と添付ファイルを確認してから直接送信してください。" : "Opened your email draft. Confirm recipients and attachments before sending.");
  };
  const exportSelectedPeriodPdf = async () => {
    if (!selectedPeriodStats) {
      toast.error(lang === "ko" ? "기간 통계를 준비한 뒤 PDF 보고서를 만들 수 있습니다." : lang === "ja" ? "期間統計を読み込んだ後にPDFレポートを作成できます。" : "Load period statistics before creating the PDF report.");
      return;
    }
    const reportWindow = window.open("", "_blank", "width=1000,height=800");
    if (!reportWindow) {
      toast.error(lang === "ko" ? "보고서 창을 열지 못했습니다. 팝업 차단을 확인해주세요." : lang === "ja" ? "レポートウィンドウを開けませんでした。ポップアップブロックを確認してください。" : "Could not open the report window. Check popup blocking.");
      return;
    }
    setPdfExporting(true);
    const loadingToast = toast.loading(lang === "ko" ? "AI가 센서 추세를 분석해 보고서를 준비하고 있습니다." : lang === "ja" ? "AIがセンサー傾向を分析し、レポートを準備しています。" : "AI is analyzing sensor trends and preparing the report.");
    try {
      const aiSummary = await summarizePeriodForReportMutation.mutateAsync({
        lang,
        periodLabel: selectedPeriodLabel,
        totalDetections: selectedPeriodStats.totalDetections,
        anomalyCount: selectedPeriodStats.anomalyCount,
        dangerCount: selectedPeriodStats.dangerCount,
        uptimePct: selectedPeriodStats.uptimePct,
        sensors: selectedPeriodStats.sensors,
        scoreHistory: selectedPeriodStats.scoreHistory.map(point => ({
          score: point.score,
          riskLevel: (["normal", "caution", "warning", "danger"].includes(point.riskLevel) ? point.riskLevel : "normal") as "normal" | "caution" | "warning" | "danger",
        })),
      });
      openStructuredPeriodReport(selectedPeriodStats, lang, selectedPeriodLabel, aiSummary, reportWindow);
      toast.success(aiSummary.source === "ai"
        ? (lang === "ko" ? "AI 센서 추세 요약을 포함한 보고서를 준비했습니다. 인쇄 창에서 PDF로 저장하세요." : lang === "ja" ? "AIセンサー傾向サマリーを含むレポートを準備しました。印刷画面でPDFとして保存してください。" : "Report with AI sensor trend summary is ready. Save it as PDF from the print dialog.")
        : (lang === "ko" ? "AI 요약 대신 근거 기반 요약을 포함한 보고서를 준비했습니다." : lang === "ja" ? "AI要約の代わりに根拠ベースの要約を含むレポートを準備しました。" : "Report with an evidence-based fallback summary is ready."), { id: loadingToast });
      if (aiSummary.alert) {
        toast.warning(lang === "ko" ? `다음 기간 ${localizeRiskLevel(aiSummary.forecastLevel, lang)} 전망입니다. 보고서의 근거와 권장 조치를 우선 검토하세요.` : lang === "ja" ? `次期間は${localizeRiskLevel(aiSummary.forecastLevel, lang)}の見通しです。レポートの根拠と推奨措置を優先して確認してください。` : `Next-period outlook is ${localizeRiskLevel(aiSummary.forecastLevel, lang)}. Prioritize the report evidence and recommended action.`);
      }
    } catch (error) {
      console.error("Structured PDF report error:", error);
      const fallbackForecastLevel: PeriodReportAiSummary["forecastLevel"] = selectedPeriodStats.dangerCount > 0 ? "danger" : selectedPeriodStats.anomalyCount > 0 ? "caution" : "normal";
      const fallbackAlert = fallbackForecastLevel === "danger";
      const fallback: PeriodReportAiSummary = lang === "ko"
        ? { headline: "기간 데이터 안전 요약", summary: `AI 분석 서비스를 연결하지 못해 기간 통계로 대체했습니다. 기록 ${selectedPeriodStats.totalDetections}건 중 이상 ${selectedPeriodStats.anomalyCount}건, 위험 ${selectedPeriodStats.dangerCount}건이 확인되었습니다.`, recommendation: "관련 설비 매뉴얼과 최근 점검 이력을 함께 검토하세요.", forecastLevel: fallbackForecastLevel, confidence: "low", evidence: "AI 연결 실패 시점의 이상·위험 탐지 수를 기준으로 했습니다.", alert: fallbackAlert, source: "fallback" }
        : lang === "ja"
          ? { headline: "期間データの安全サマリー", summary: `AI分析サービスに接続できないため、期間統計で代替しました。記録${selectedPeriodStats.totalDetections}件のうち、異常${selectedPeriodStats.anomalyCount}件、危険${selectedPeriodStats.dangerCount}件が確認されました。`, recommendation: "関連設備マニュアルと直近の点検履歴を併せて確認してください。", forecastLevel: fallbackForecastLevel, confidence: "low", evidence: "AI接続失敗時点の異常・危険検知数を基準にしました。", alert: fallbackAlert, source: "fallback" }
          : { headline: "Period data safety summary", summary: `The AI analysis service could not be reached, so this uses period statistics. ${selectedPeriodStats.anomalyCount} anomalies and ${selectedPeriodStats.dangerCount} danger detections were observed across ${selectedPeriodStats.totalDetections} records.`, recommendation: "Review the relevant equipment manual and recent inspection history together.", forecastLevel: fallbackForecastLevel, confidence: "low", evidence: "Based on anomaly and danger detections when the AI connection failed.", alert: fallbackAlert, source: "fallback" };
      try {
        openStructuredPeriodReport(selectedPeriodStats, lang, selectedPeriodLabel, fallback, reportWindow);
        toast.warning(lang === "ko" ? "AI 요약 대신 근거 기반 요약으로 보고서를 준비했습니다." : lang === "ja" ? "AI要約の代わりに根拠ベースの要約でレポートを準備しました。" : "The report uses an evidence-based fallback summary.", { id: loadingToast });
        if (fallback.alert) {
          toast.warning(lang === "ko" ? `다음 기간 ${localizeRiskLevel(fallback.forecastLevel, lang)} 전망입니다. 보고서의 근거와 권장 조치를 우선 검토하세요.` : lang === "ja" ? `次期間は${localizeRiskLevel(fallback.forecastLevel, lang)}の見通しです。レポートの根拠と推奨措置を優先して確認してください。` : `Next-period outlook is ${localizeRiskLevel(fallback.forecastLevel, lang)}. Prioritize the report evidence and recommended action.`);
        }
      } catch {
        reportWindow.close();
        toast.error(lang === "ko" ? "보고서 창을 열지 못했습니다. 팝업 차단을 확인해주세요." : lang === "ja" ? "レポートウィンドウを開けませんでした。ポップアップブロックを確認してください。" : "Could not open the report window. Check popup blocking.", { id: loadingToast });
      }
    } finally {
      setPdfExporting(false);
    }
  };
  const displayedSavedCost = useCountUp(selectedPeriodStats?.savedCost ?? 0, 1000);
  const selectedPeriodLabel = dashboardPeriod === "custom"
    ? `${new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${appliedCustomRange.startDate}T00:00:00`))} – ${new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${appliedCustomRange.endDate}T00:00:00`))}`
    : dashboardPeriod === "day"
    ? (lang === "ko" ? "최근 24시간" : lang === "ja" ? "直近24時間" : "Last 24 hours")
    : dashboardPeriod === "week"
      ? (lang === "ko" ? "최근 7일" : lang === "ja" ? "直近7日間" : "Last 7 days")
      : (lang === "ko" ? "최근 30일" : lang === "ja" ? "直近30日間" : "Last 30 days");
  const savingsScope = lang === "ko"
    ? { badge: "시연 가정", note: "위험 탐지 건수를 기준으로 산정한 참고값이며, 실제 절감액은 아직 검증되지 않았습니다." }
    : lang === "ja"
      ? { badge: "デモ仮定", note: "危険検知件数を基準に算定した参考値であり、実際の削減額は未検証です。" }
      : { badge: "Demo assumption", note: "This is a reference estimate based on danger detections; actual savings have not yet been validated." };
  const periodChartData = useMemo<ChartPoint[]>(() => (selectedPeriodStats?.scoreHistory ?? []).map(point => ({
    timestamp: new Date(point.timestamp).getTime(),
    label: new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(point.timestamp)),
    current: point.current,
    temperature: point.temperature,
    vibration: point.vibration,
    noise: point.noise,
  })), [lang, selectedPeriodStats?.scoreHistory]);
  const displayedSensorChartData = periodChartData.length > 0 ? periodChartData : chartData;
  const [sensorChartRange, setSensorChartRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const resolvedSensorChartRange = useMemo(() => {
    const maxIndex = Math.max(0, displayedSensorChartData.length - 1);
    if (!sensorChartRange) return { startIndex: 0, endIndex: maxIndex };
    const startIndex = Math.min(Math.max(0, sensorChartRange.startIndex), maxIndex);
    const endIndex = Math.min(Math.max(startIndex, sensorChartRange.endIndex), maxIndex);
    return { startIndex, endIndex };
  }, [displayedSensorChartData.length, sensorChartRange]);
  const setSensorChartWindow = (startIndex: number, endIndex: number) => {
    const maxIndex = Math.max(0, displayedSensorChartData.length - 1);
    setSensorChartRange({ startIndex: Math.min(Math.max(0, startIndex), maxIndex), endIndex: Math.min(Math.max(0, endIndex), maxIndex) });
  };
  const zoomSensorChart = (direction: "in" | "out") => {
    const total = displayedSensorChartData.length;
    if (total < 3) return;
    const { startIndex, endIndex } = resolvedSensorChartRange;
    const size = endIndex - startIndex + 1;
    const nextSize = direction === "in" ? Math.max(2, Math.floor(size * 0.72)) : Math.min(total, Math.ceil(size / 0.72));
    const midpoint = (startIndex + endIndex) / 2;
    let nextStart = Math.round(midpoint - (nextSize - 1) / 2);
    nextStart = Math.min(Math.max(0, nextStart), total - nextSize);
    setSensorChartWindow(nextStart, nextStart + nextSize - 1);
  };
  const panSensorChart = (direction: "back" | "forward") => {
    const total = displayedSensorChartData.length;
    if (total < 3) return;
    const { startIndex, endIndex } = resolvedSensorChartRange;
    const size = endIndex - startIndex + 1;
    const step = Math.max(1, Math.round(size * 0.25));
    const nextStart = direction === "back" ? Math.max(0, startIndex - step) : Math.min(total - size, startIndex + step);
    setSensorChartWindow(nextStart, nextStart + size - 1);
  };
  const resetSensorChartZoom = () => setSensorChartRange(null);
  const exportCurrentSensorRangeImage = async (format: "png" | "jpeg") => {
    const { startIndex, endIndex } = resolvedSensorChartRange;
    const rangeHistory = displayedSensorChartData.slice(startIndex, endIndex + 1).map(point => ({
      timestamp: new Date(point.timestamp).toISOString(),
      score: 0,
      riskLevel: "normal",
      current: point.current,
      temperature: point.temperature,
      vibration: point.vibration,
      noise: point.noise,
    })) as PeriodOverviewData["scoreHistory"];
    if (rangeHistory.length === 0) {
      toast.error(lang === "ko" ? "저장할 센서 구간 데이터가 없습니다." : lang === "ja" ? "保存するセンサー範囲データがありません。" : "There is no sensor range data to save.");
      return;
    }
    setSensorImageExporting(format);
    try {
      await downloadSensorTrendChartImage(rangeHistory, lang, format);
      toast.success(lang === "ko" ? `확대 구간 차트를 ${format.toUpperCase()}로 저장했습니다.` : lang === "ja" ? `拡大範囲のチャートを${format.toUpperCase()}で保存しました。` : `Saved the zoomed chart as ${format.toUpperCase()}.`);
    } catch (error) {
      console.error("Sensor chart image export failed:", error);
      toast.error(lang === "ko" ? "차트 이미지를 만들지 못했습니다." : lang === "ja" ? "チャート画像を作成できませんでした。" : "Could not create the chart image.");
    } finally {
      setSensorImageExporting(null);
    }
  };
  const handleSensorChartKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomSensorChart("in"); }
    if (event.key === "-") { event.preventDefault(); zoomSensorChart("out"); }
    if (event.key === "ArrowLeft") { event.preventDefault(); panSensorChart("back"); }
    if (event.key === "ArrowRight") { event.preventDefault(); panSensorChart("forward"); }
    if (event.key.toLowerCase() === "r") { event.preventDefault(); resetSensorChartZoom(); }
  };
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
    const stopDemo = () => {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
    };

    if (!demoRunning) {
      stopDemo();
      return stopDemo;
    }

    const modes = ["normal", "caution", "warning", "danger"] as const;
    let step = 0;
    const runDemoCycle = async () => {
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
          requestDangerAlert();
          setDangerFlash(true);
          setTimeout(() => setDangerFlash(false), 600);
          playAlert();
          setTimeout(() => setRelayTripped(false), 2000);
          triggerLlmAnalysis(result);
        }
        await utils.semiguard.getStats.invalidate();
        await utils.semiguard.getLogs.invalidate();
      } catch (_) {}
    };
    const startDemo = () => {
      if (document.visibilityState === "hidden" || demoIntervalRef.current) return;
      demoIntervalRef.current = setInterval(runDemoCycle, demoSpeed * 1000);
    };
    const handleDemoVisibilityChange = () => {
      if (document.visibilityState === "hidden") stopDemo();
      else startDemo();
    };

    startDemo();
    document.addEventListener("visibilitychange", handleDemoVisibilityChange);
    return () => {
      stopDemo();
      document.removeEventListener("visibilitychange", handleDemoVisibilityChange);
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

    const runPollingCycle = () => {
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
          setAutoPollingRetryPending(false);
          utils.semiguard.getLogs.invalidate();
          utils.semiguard.getStats.invalidate();
        },
        onError: (error) => {
          // 개발 서버 재시작·일시 네트워크 지연은 다음 4초 폴링 주기에서 자동 복구한다.
          setAutoPollingRetryPending(true);
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
        requestDangerAlert();
        setDangerFlash(true);
        setTimeout(() => setDangerFlash(false), 600);
        playAlert();
        setTimeout(() => setRelayTripped(false), 2000);
        triggerLlmAnalysis(result);
      }
    };
    const stopAutoPolling = () => {
      if (autoPollingRef.current) {
        clearInterval(autoPollingRef.current);
        autoPollingRef.current = null;
      }
    };
    const startAutoPolling = () => {
      if (document.visibilityState === "hidden" || autoPollingRef.current) return;
      autoPollingRef.current = setInterval(runPollingCycle, 4000);
    };
    const handlePollingVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopAutoPolling();
      } else {
        runPollingCycle();
        startAutoPolling();
      }
    };

    startAutoPolling();
    document.addEventListener("visibilitychange", handlePollingVisibilityChange);
    return () => {
      stopAutoPolling();
      document.removeEventListener("visibilitychange", handlePollingVisibilityChange);
    };
  }, [initialized, virtualFabDemoActive]);

  // LLM 이상 원인 분석 트리거 (30초 throttle)
  const lastLlmCallRef = useRef<number>(0);
  const triggerLlmAnalysis = useCallback(async (result: AnomalyResult) => {
    if (!result.sensorData) return;
    // 30초 이내 중복 호출 방지
    const now = Date.now();
    if (now - lastLlmCallRef.current < 30_000) return;
    lastLlmCallRef.current = now;
    setLlmLoading(true);
    void trackProductActivityMutation.mutateAsync({ eventType: "analysis_started" }).catch(() => undefined);
    try {
      const analysis = await analyzeAnomalyMutation.mutateAsync({
        current: result.sensorData.current,
        temperature: result.sensorData.temperature,
        vibration: result.sensorData.vibration,
        noise: result.sensorData.noise,
        anomalyScore: result.anomalyScore,
        riskLevel: result.riskLevel,
        lang: lang,
        logId: result.logId,
      });
      const localizedAnalysis = analysis.translations?.[lang] ?? analysis;
      setLlmAnalysis({
        ...localizedAnalysis,
        score: result.anomalyScore,
        riskLevel: result.riskLevel,
      });
      void trackProductActivityMutation.mutateAsync({ eventType: "analysis_viewed" }).catch(() => undefined);
    } catch {
      // 분석 실패 시 무시
    } finally {
      setLlmLoading(false);
    }
  }, [lang, analyzeAnomalyMutation, trackProductActivityMutation]);

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
        requestDangerAlert(true);
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
      <a
        href="#dashboard-main"
        className="sr-only z-[1200] rounded-b-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 focus:not-sr-only focus:absolute focus:left-4 focus:top-0 focus:outline-none focus:ring-2 focus:ring-cyan-100"
      >
        {lang === "ko" ? "대시보드 콘텐츠로 건너뛰기" : lang === "ja" ? "ダッシュボードのコンテンツへ移動" : "Skip to dashboard content"}
      </a>
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
          { label: lang === "ko" ? "전류" : lang === "ja" ? "電流" : "Current",          value: log.current.toFixed(2),    unit: "A",    icon: "⚡", color: "#38bdf8" },
          { label: lang === "ko" ? "온도" : lang === "ja" ? "温度" : "Temperature",      value: log.temperature.toFixed(1), unit: "°C",   icon: "🌡", color: "#fb923c" },
          { label: lang === "ko" ? "진동" : lang === "ja" ? "振動" : "Vibration",        value: log.vibration.toFixed(2),   unit: "mm/s", icon: "📳", color: "#a78bfa" },
          { label: lang === "ko" ? "소음" : lang === "ja" ? "騒音" : "Noise",            value: log.noise.toFixed(1),       unit: "dB",   icon: "🔊", color: "#34d399" },
        ];
        const riskLabel = lang === "ko"
          ? lvl === "danger" ? "위험" : lvl === "warning" ? "경고" : lvl === "caution" ? "주의" : "정상"
          : lang === "ja"
            ? lvl === "danger" ? "危険" : lvl === "warning" ? "警告" : lvl === "caution" ? "注意" : "正常"
            : lvl.charAt(0).toUpperCase() + lvl.slice(1);
        const recordedAt = new Date(log.timestamp).toLocaleString(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", { hour12: false });
        return (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.65)", animation: "fadeIn 0.2s ease-out" }}
            onClick={() => setSelectedLog(null)}>
            <div className="relative w-full max-w-sm mx-4 rounded-2xl shadow-2xl overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-labelledby="anomaly-detail-modal-title"
              aria-describedby="anomaly-detail-modal-context"
              style={{ background: isDark ? "oklch(0.13 0.015 240)" : "oklch(0.99 0.003 240)", border: `1px solid ${color}40` }}
              onClick={e => e.stopPropagation()}>
              {/* 헤더 */}
              <div className="px-5 py-4 border-b flex items-center justify-between"
                style={{ borderColor: `${color}30`, background: `${color}10` }}>
                <div>
                  <p id="anomaly-detail-modal-title" className="text-xs font-semibold" style={{ color: isDark ? "oklch(0.90 0.01 240)" : "oklch(0.15 0.01 240)" }}>
                    {lang === "ko" ? "이상 이력 상세" : lang === "ja" ? "異常履歴詳細" : "Anomaly Detail"}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: isDark ? "oklch(0.50 0.01 240)" : "oklch(0.45 0.01 240)" }}>
                    {recordedAt}
                  </p>
                  <p id="anomaly-detail-modal-context" className="sr-only">
                    {lang === "ko" ? `기록 시각 ${recordedAt}, 위험 단계 ${riskLabel}` : lang === "ja" ? `記録時刻 ${recordedAt}、危険段階 ${riskLabel}` : `Recorded at ${recordedAt}, risk level ${riskLabel}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
                    style={{ color, background: RISK_BG[lvl], borderColor: RISK_BORDER[lvl] }}>
                    {riskLabel}
                  </span>
                  <button ref={selectedLogCloseRef} type="button" onClick={() => setSelectedLog(null)}
                    className="text-lg leading-none hover:opacity-60 transition-opacity"
                    style={{ color: isDark ? "oklch(0.50 0.01 240)" : "oklch(0.45 0.01 240)" }}
                    aria-label={lang === "ko" ? "이상 이력 상세 닫기" : lang === "ja" ? "異常履歴詳細を閉じる" : "Close anomaly detail"}>✕</button>
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
                <div className="w-full h-2 rounded-full" role="progressbar" aria-label={lang === "ko" ? "이상 이력 상세 위험 점수" : lang === "ja" ? "異常履歴詳細の異常スコア" : "Anomaly detail score"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(log.anomalyScore, 100)} style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
                  <div className="h-2 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(log.anomalyScore, 100)}%`, background: color }} />
                </div>
              </div>
              {/* 센서 값 그리드 */}
              <div className="px-5 pb-5 grid grid-cols-2 gap-2" role="list" aria-label={lang === "ko" ? "이상 이력 상세 센서 값" : lang === "ja" ? "異常履歴詳細のセンサー値" : "Anomaly detail sensor values"}>
                {sensorItems.map(s => (
                  <div key={s.label} role="listitem" className="rounded-xl p-3 border flex flex-col gap-1"
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
              {(log.llmAnalysisKo || log.llmAnalysisEn || log.llmAnalysisJa) && (() => {
                const raw = lang === "ko" ? log.llmAnalysisKo : lang === "ja" ? log.llmAnalysisJa : log.llmAnalysisEn;
                const fallback = log.llmAnalysisKo || log.llmAnalysisEn || log.llmAnalysisJa;
                try {
                  const a = JSON.parse(raw ?? fallback ?? "");
                  return (
                    <div className="px-5 pb-5 flex flex-col gap-2">
                      <div className="rounded-xl p-3 border" role="region" aria-labelledby="selected-log-ai-analysis-title" style={{ background: "oklch(0.75 0.18 200 / 0.06)", borderColor: "oklch(0.75 0.18 200 / 0.25)" }}>
                        <h3 id="selected-log-ai-analysis-title" className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "oklch(0.75 0.18 200)" }}>
                          🤖 {lang === "ko" ? "AI 이상 원인 분석" : lang === "ja" ? "AI異常原因分析" : "AI Anomaly Analysis"}
                        </h3>
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
          <div className="relative w-full max-w-md mx-4 rounded-2xl p-8 shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="danger-alert-title" aria-describedby="danger-alert-description"
            style={{
              background: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.10))",
              border: "2px solid rgb(239,68,68)",
              animation: "slideUp 0.4s cubic-bezier(0.23, 1, 0.32, 1)"
            }}>
            <div className="flex flex-col items-center gap-4">
              <div aria-hidden="true" className="text-6xl animate-pulse">🚨</div>
              <h2 id="danger-alert-title" className="text-2xl font-bold text-center" style={{ color: "rgb(239,68,68)" }}>
                {lang === "ko" ? "위험 단계 도달!" : lang === "ja" ? "危険レベル到達！" : "DANGER LEVEL REACHED!"}
              </h2>
              <p id="danger-alert-description" className="text-center text-sm" style={{ color: "rgb(220,38,38)" }}>
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
                <div className="w-full flex items-center gap-2 px-3 py-2 rounded-lg" role="status" aria-live="polite" aria-atomic="true"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <div className="w-4 h-4 rounded-full border-2 border-red-400 border-t-transparent animate-spin flex-shrink-0" aria-hidden="true" />
                  <span className="text-xs" style={{ color: "rgb(220,38,38)" }}>
                    {lang === "ko" ? "AI 이상 원인 분석 중..." : lang === "ja" ? "AI異常原因分析中..." : "AI analyzing anomaly cause..."}
                  </span>
                </div>
              )}
              {llmAnalysis && !llmLoading && (
                <div className="w-full rounded-xl p-4 text-left" role="region" aria-labelledby="danger-alert-ai-analysis-title"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">🤖</span>
                    <h3 id="danger-alert-ai-analysis-title" className="text-xs font-bold" style={{ color: "oklch(0.65 0.18 200)" }}>
                      {lang === "ko" ? "AI 이상 원인 분석" : lang === "ja" ? "AI異常原因分析" : "AI Anomaly Analysis"}
                    </h3>
                  </div>
                  <p className="text-sm font-bold mb-1" style={{ color: "rgb(239,68,68)" }}>
                    {llmAnalysis.primaryCause}
                  </p>
                  <p className="text-xs mb-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                    {llmAnalysis.details}
                  </p>
                  <div className="flex items-start gap-1.5">
                    <span className="text-xs mt-0.5" aria-hidden="true">💡</span>
                    <p className="text-xs" style={{ color: "rgba(255,200,100,0.9)" }}>
                      {llmAnalysis.recommendation}
                    </p>
                  </div>
                </div>
              )}
              <button
                ref={dangerAlertConfirmRef}
                type="button"
                onClick={acknowledgeDangerAlert}
                className="mt-4 px-6 py-2 rounded-lg font-bold transition-all duration-200 active:scale-95"
                style={{
                  background: "rgb(239,68,68)",
                  color: "white",
                  boxShadow: "0 0 20px rgba(239,68,68,0.5)"
                }}>
                {lang === "ko" ? "확인 · 30초 숨김" : lang === "ja" ? "確認・30秒非表示" : "OK · Hide 30s"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* LLM 분석 결과 플로팅 패널 (위험/경고 탐지 후 dangerAlert 닫혀도 유지) */}
      {llmAnalysis && !dangerAlert && (
        <div role="region" aria-live="polite" aria-atomic="true" aria-labelledby="ai-analysis-result-title" className="fixed bottom-6 right-6 z-[500] w-80 rounded-2xl shadow-2xl"
          style={{
            background: isDark ? "oklch(0.13 0.015 240)" : "oklch(0.99 0.003 240)",
            border: `1px solid ${llmAnalysis.riskLevel === "danger" ? "rgba(239,68,68,0.5)" : "rgba(249,115,22,0.5)"}`,
            animation: "slideUp 0.4s cubic-bezier(0.23, 1, 0.32, 1)"
          }}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base" aria-hidden="true">🤖</span>
                <span id="ai-analysis-result-title" className="text-xs font-bold" style={{ color: "oklch(0.65 0.18 200)" }}>
                  {lang === "ko" ? "AI 이상 원인 분석" : lang === "ja" ? "AI異常原因分析" : "AI Anomaly Analysis"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLlmAnalysis(null)}
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs transition-opacity hover:opacity-70"
                style={{ background: "rgba(128,128,128,0.2)", color: th.textMuted }}
                aria-label={lang === "ko" ? "AI 분석 패널 닫기" : lang === "ja" ? "AI分析パネルを閉じる" : "Close AI analysis panel"}>
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
                  : lang === "ja"
                    ? (llmAnalysis.riskLevel === "danger" ? "危険" : llmAnalysis.riskLevel === "warning" ? "警告" : "注意")
                    : llmAnalysis.riskLevel}
                &nbsp;{llmAnalysis.score.toFixed(0)}{lang === "ko" ? "점" : lang === "ja" ? "点" : ""}
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
              <span className="text-xs mt-0.5 flex-shrink-0" aria-hidden="true">💡</span>
              <p className="text-xs leading-relaxed" style={{ color: isDark ? "rgba(255,200,100,0.9)" : "oklch(0.40 0.10 80)" }}>
                {llmAnalysis.recommendation}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" aria-label={lang === "ko" ? "현재 AI 이상 분석 결과를 TXT 파일로 저장" : lang === "ja" ? "現在のAI異常分析結果をTXTファイルで保存" : "Save current AI anomaly analysis as a TXT file"} title={lang === "ko" ? "TXT 파일로 저장" : lang === "ja" ? "TXTファイルで保存" : "Save as TXT"} onClick={() => exportCurrentLlmAnalysis("text")} className="min-h-9 rounded-lg border text-[11px] font-bold transition-opacity hover:opacity-80" style={{ borderColor: th.border2, color: th.text, background: th.bgCard2 }}>TXT</button>
              <button type="button" aria-label={lang === "ko" ? "현재 AI 이상 분석 결과를 PDF로 저장" : lang === "ja" ? "現在のAI異常分析結果をPDFで保存" : "Save current AI anomaly analysis as a PDF"} title={lang === "ko" ? "PDF로 저장" : lang === "ja" ? "PDFで保存" : "Save as PDF"} onClick={() => exportCurrentLlmAnalysis("pdf")} className="min-h-9 rounded-lg border text-[11px] font-bold transition-opacity hover:opacity-80" style={{ borderColor: "rgba(56,189,248,0.4)", color: th.accent, background: "rgba(56,189,248,0.08)" }}>PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI 분석 히스토리 패널 ── */}
      {showAiHistory && (
        <div ref={aiHistoryDialogRef} id="ai-analysis-history-panel" role="dialog" aria-modal="true" aria-labelledby="ai-analysis-history-title" aria-describedby="ai-analysis-history-description" className="fixed bottom-6 left-4 sm:left-6 z-[490] w-[calc(100vw-2rem)] max-w-80 rounded-2xl shadow-2xl overflow-hidden"
          style={{
            background: isDark ? "oklch(0.13 0.015 240)" : "oklch(0.99 0.003 240)",
            border: "1px solid oklch(0.75 0.18 200 / 0.35)",
            bottom: aiHistoryBottom,
            animation: "slideUp 0.4s cubic-bezier(0.23, 1, 0.32, 1)"
          }}>
          <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "oklch(0.75 0.18 200 / 0.20)", background: "oklch(0.75 0.18 200 / 0.06)" }}>
            <div className="flex items-center gap-2">
              <span className="text-sm">📋</span>
              <span id="ai-analysis-history-title" className="text-xs font-bold" style={{ color: "oklch(0.75 0.18 200)" }}>
                {lang === "ko" ? "AI 분석 히스토리 (최근 5건)" : lang === "ja" ? "AI分析履歴（直近5件）" : "AI Analysis History (Last 5)"}
              </span>
            </div>
            <button type="button" ref={aiHistoryCloseRef} onClick={closeAiHistory}
              className="w-5 h-5 rounded-full flex items-center justify-center text-xs transition-opacity hover:opacity-70"
              style={{ background: "rgba(128,128,128,0.2)", color: th.textMuted }}
              aria-label={lang === "ko" ? "AI 분석 이력 닫기" : lang === "ja" ? "AI分析履歴を閉じる" : "Close AI analysis history"}>✕</button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <div id="ai-analysis-history-description" className="mx-4 mt-3 rounded-lg border px-2.5 py-2 text-[10px] leading-relaxed" style={{ borderColor: "oklch(0.75 0.18 200 / 0.28)", background: isDark ? "oklch(0.16 0.02 240 / 0.62)" : "oklch(0.96 0.025 225 / 0.76)", color: th.textMuted }}>
              {lang === "ko"
                ? "새 분석은 동일 관측 로그의 센서값·점수·위험 단계를 확인한 뒤 저장됩니다. 출처 로그 번호를 선택하면 해당 시점의 센서 상세를 확인할 수 있습니다."
                : lang === "ja"
                  ? "新しい分析は、同一観測ログのセンサー値・スコア・危険段階を確認してから保存されます。出典ログ番号を選択すると、その時点のセンサー詳細を確認できます。"
                  : "New analyses are saved after checking the sensor values, score, and risk level of the same observation log. Select a source log number to view the sensor details from that observation."}
            </div>
            {llmHistoryQuery.isLoading ? (
              <div className="px-4 py-6 flex justify-center" role="status" aria-live="polite" aria-atomic="true" aria-label={lang === "ko" ? "AI 분석 이력을 불러오는 중" : lang === "ja" ? "AI分析履歴を読み込み中" : "Loading AI analysis history"}>
                <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" aria-hidden="true" style={{ borderColor: "oklch(0.75 0.18 200)", borderTopColor: "transparent" }} />
              </div>
            ) : llmHistoryQuery.isError ? (
              <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-xs" role="alert" aria-atomic="true" style={{ color: "rgb(239,68,68)" }}>
                <p>{lang === "ko" ? "분석 이력을 불러오지 못했습니다." : lang === "ja" ? "分析履歴を取得できませんでした。" : "Failed to load analysis history."}</p>
                <button type="button" onClick={() => void llmHistoryQuery.refetch()} disabled={llmHistoryQuery.isFetching} aria-busy={llmHistoryQuery.isFetching || undefined} className="rounded border px-2.5 py-1 text-[10px] font-bold disabled:opacity-45" style={{ borderColor: "oklch(0.65 0.20 25 / 0.45)", color: isDark ? "oklch(0.82 0.14 40)" : "oklch(0.48 0.18 25)" }}>
                  ↻ {llmHistoryQuery.isFetching ? (lang === "ko" ? "다시 불러오는 중..." : lang === "ja" ? "再読み込み中..." : "Retrying...") : (lang === "ko" ? "다시 시도" : lang === "ja" ? "再試行" : "Retry")}
                </button>
              </div>
            ) : !llmHistoryQuery.data || llmHistoryQuery.data.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                {lang === "ko" ? "저장된 AI 분석 결과가 없습니다." : lang === "ja" ? "保存されたAI分析結果がありません。" : "No AI analysis results saved yet."}
              </div>
            ) : llmHistoryQuery.data.map((item) => {
              let parsed: { primaryCause?: string; recommendation?: string } = {};
              const rawItem = lang === "ko" ? item.llmAnalysisKo : lang === "ja" ? item.llmAnalysisJa : item.llmAnalysisEn;
              const fallbackItem = item.llmAnalysisKo || item.llmAnalysisEn || item.llmAnalysisJa;
              const sourceLog = logs.find((log) => log.id === item.id);
              const isOpeningSourceLog = openingSourceLogId === item.id;
              try { parsed = JSON.parse(rawItem ?? fallbackItem ?? ""); } catch {}
              const lvlColor = item.riskLevel === "danger" ? "rgb(239,68,68)" : item.riskLevel === "warning" ? "rgb(249,115,22)" : "rgb(234,179,8)";
              return (
                <div key={item.id} className="px-4 py-3 border-b last:border-0" style={{ borderColor: isDark ? "oklch(0.18 0.015 240)" : "oklch(0.90 0.005 240)" }}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="min-w-0 flex items-center gap-1.5">
                      <span className="truncate text-[9px] font-mono text-muted-foreground">
                        {new Date(item.timestamp).toLocaleString(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", { hour12: false })}
                      </span>
                      <button
                        type="button"
                        disabled={isOpeningSourceLog}
                        onClick={async () => {
                          setOpeningSourceLogId(item.id);
                          try {
                            const exactLog = sourceLog ?? await utils.semiguard.getLogById.fetch({ id: item.id });
                            if (!exactLog) {
                              toast.error(lang === "ko" ? "출처 관측 로그를 찾을 수 없습니다." : lang === "ja" ? "出典観測ログが見つかりません。" : "The source observation log could not be found.");
                              return;
                            }
                            setShowAiHistory(false);
                            setSelectedLog(exactLog);
                          } catch (error) {
                            console.error("Source observation log lookup failed:", error);
                            toast.error(lang === "ko" ? "출처 관측 로그를 불러오지 못했습니다." : lang === "ja" ? "出典観測ログを取得できませんでした。" : "Could not load the source observation log.");
                          } finally {
                            setOpeningSourceLogId(null);
                          }
                        }}
                        className="shrink-0 rounded px-1 py-0.5 text-[8px] font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-55"
                        style={{ background: isDark ? "oklch(0.23 0.025 240)" : "oklch(0.91 0.018 240)", color: th.textMuted }}
                        aria-label={lang === "ko" ? `출처 관측 로그 ${item.id} 상세 보기` : lang === "ja" ? `出典観測ログ ${item.id} の詳細を表示` : `View source observation log ${item.id} details`}
                        title={isOpeningSourceLog
                          ? (lang === "ko" ? "센서 상세 불러오는 중" : lang === "ja" ? "センサー詳細を読み込み中" : "Loading sensor details")
                          : (lang === "ko" ? "센서 상세 보기" : lang === "ja" ? "センサー詳細を表示" : "View sensor details")}
                      >
                        {isOpeningSourceLog ? "…" : (lang === "ko" ? `로그 #${item.id}` : lang === "ja" ? `ログ #${item.id}` : `Log #${item.id}`)}
                      </button>
                    </div>
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
          ref={aiHistoryTriggerRef}
          type="button"
          aria-controls="ai-analysis-history-panel"
          aria-expanded={showAiHistory}
          onClick={() => setShowAiHistory(true)}
          className="fixed bottom-6 left-4 sm:left-6 z-[490] flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg text-xs font-bold border transition-all duration-200 hover:opacity-90 active:scale-95"
          style={{ background: isDark ? "oklch(0.13 0.015 240)" : "oklch(0.99 0.003 240)", borderColor: "oklch(0.75 0.18 200 / 0.40)", color: "oklch(0.75 0.18 200)", bottom: aiHistoryBottom }}>
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
            ref={menuPanelRef}
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
                ref={menuCloseButtonRef}
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
              <p id="social-linking-hint" className="text-[10px] leading-relaxed text-muted-foreground mb-3">
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
                        aria-busy={unlinkSocialMutation.isPending}
                        aria-describedby="social-linking-hint"
                        aria-label={linked
                          ? (lang === "ko" ? `${label} 계정이 연결되어 있습니다. 연결을 해제합니다.` : lang === "ja" ? `${label}アカウントは連携済みです。連携を解除します。` : `Unlink your connected ${label} account.`)
                          : (lang === "ko" ? `${label} 계정을 연결합니다.` : lang === "ja" ? `${label}アカウントを連携します。` : `Connect a ${label} account.`)}
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
              <button type="button" onClick={() => setLang(l => l === "ko" ? "en" : l === "en" ? "ja" : "ko")} aria-label={lang === "ko" ? "현재 언어: 한국어. 영어로 전환" : lang === "en" ? "Current language: English. Switch to Japanese" : "現在の言語: 日本語。韓国語に切替"} title={lang === "ko" ? "영어로 전환" : lang === "en" ? "Switch to Japanese" : "한국어로 전환"} className="min-h-11 rounded-lg border px-3 py-2 text-xs font-bold transition-all hover:opacity-80 active:scale-95" style={{ borderColor: "oklch(0.65 0.18 200 / 0.4)", color: "oklch(0.65 0.18 200)", background: "oklch(0.65 0.18 200 / 0.08)" }}>
                {lang === "ko" ? "EN" : lang === "en" ? "日本語" : "한국어"}
              </button>
              <button type="button" onClick={() => setIsDark(d => { const next = !d; try { localStorage.setItem("semiguard_theme", next ? "dark" : "light"); } catch {} return next; })} className="min-h-11 rounded-lg border px-3 py-2 text-xs font-bold transition-all hover:opacity-80 active:scale-95" style={{ borderColor: isDark ? "oklch(0.35 0.01 240)" : "oklch(0.75 0.08 80 / 0.5)", color: isDark ? "oklch(0.65 0.15 60)" : "oklch(0.40 0.08 80)", background: isDark ? "oklch(0.15 0.01 240)" : "oklch(0.92 0.04 80 / 0.3)" }}>
                <span aria-hidden="true">{isDark ? "☀️" : "🌙"}</span>{" "}{isDark ? (lang === "ko" ? "라이트" : lang === "ja" ? "ライト" : "Light") : (lang === "ko" ? "다크" : lang === "ja" ? "ダーク" : "Dark")}
              </button>
              <button type="button" onClick={() => { setMuted(m => { const next = !m; mutedRef.current = next; try { localStorage.setItem("semiguard_muted", String(next)); } catch {} return next; }); }} className="min-h-11 rounded-lg border px-3 py-2 text-xs font-bold transition-all hover:opacity-80 active:scale-95" style={{ borderColor: muted ? "oklch(0.35 0.01 240)" : "oklch(0.65 0.18 200 / 0.4)", color: muted ? "oklch(0.45 0.01 240)" : "oklch(0.65 0.18 200)", background: muted ? (isDark ? "oklch(0.15 0.01 240)" : "oklch(0.88 0.01 240)") : "oklch(0.65 0.18 200 / 0.08)" }}>
                {muted ? "🔕" : "🔔"} {muted ? (lang === "ko" ? "음소거 해제" : lang === "ja" ? "ミュート解除" : "Unmute") : (lang === "ko" ? "음소거" : lang === "ja" ? "ミュート" : "Mute")}
              </button>
            </div>
            {!muted && (
              <div className="rounded-xl border p-3 mb-3" style={{ borderColor: th.border2, background: th.bgCard2 }}>
                <div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold">{lang === "ko" ? "볼륨" : lang === "ja" ? "音量" : "Volume"}</span><span className="text-xs font-mono" style={{ color: th.accent }}>{Math.round(volume * 100)}%</span></div>
                <input type="range" min={0} max={1} step={0.05} value={volume} aria-label={lang === "ko" ? "경고음 볼륨" : lang === "ja" ? "警告音量" : "Alert volume"} aria-valuetext={lang === "ko" ? `${Math.round(volume * 100)}퍼센트` : lang === "ja" ? `${Math.round(volume * 100)}パーセント` : `${Math.round(volume * 100)} percent`} onChange={e => { const v = parseFloat(e.target.value); setVolume(v); volumeRef.current = v; try { localStorage.setItem("semiguard_volume", String(v)); } catch {} }} className="w-full accent-cyan-400 cursor-pointer" />
              </div>
            )}
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 mt-5">{lang === "ko" ? "시연 및 보고서" : lang === "ja" ? "デモとレポート" : "Demo & report"}</p>
              <button type="button" aria-label={lang === "ko" ? "가상 팹 위험 시나리오 불러오기. 파일럿 승인 전 읽기 전용 시연 데이터이며 설비를 제어하지 않습니다. 실제 팹 파일럿 연동은 추후 지원 예정입니다." : lang === "ja" ? "仮想ファブ危険シナリオを読み込む。パイロット承認前の読み取り専用デモデータで、設備は制御しません。実ファブのパイロット連携は今後サポート予定です。" : "Load the virtual fab risk scenario. It uses pre-pilot, read-only demo data and does not control equipment. Actual fab pilot integration is planned for future support."} title={lang === "ko" ? "읽기 전용 시연 데이터 · 설비 제어 없음 · 실제 팹 파일럿 연동은 추후 지원 예정" : lang === "ja" ? "読み取り専用デモデータ・設備制御なし・実ファブのパイロット連携は今後サポート予定" : "Read-only demo data · no equipment control · actual fab pilot integration planned for future support"} onClick={loadVirtualFabDemo} className="w-full min-h-11 mb-2 flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-bold transition-all hover:opacity-80 active:scale-95" style={{ borderColor: virtualFabDemoActive ? "rgba(34,197,94,0.55)" : th.border2, color: virtualFabDemoActive ? "rgb(34,197,94)" : th.accent, background: virtualFabDemoActive ? "rgba(34,197,94,0.10)" : th.bgCard2 }}>
                <span>🏭 {lang === "ko" ? "가상 팹 위험 시나리오" : lang === "ja" ? "仮想ファブ危険シナリオ" : "Virtual fab risk scenario"}</span><span className="text-[10px]">{virtualFabDemoActive ? (lang === "ko" ? "불러옴" : lang === "ja" ? "読込済み" : "Loaded") : "▶"}</span>
              </button>
              <span tabIndex={0} role="note" title={lang === "ko" ? "협력 기관 데이터 제공·IT/OT 보안 승인·현장 담당자 협의 후 별도 검토합니다." : lang === "ja" ? "協力機関のデータ提供・IT/OTセキュリティ承認・現場担当者との協議後に個別検討します。" : "This is considered separately after partner data access, IT/OT security approval, and on-site operator alignment."} aria-label={lang === "ko" ? "실제 팹 파일럿 연동, 추후 지원 예정" : lang === "ja" ? "実ファブのパイロット連携、今後サポート予定" : "Actual fab pilot integration, planned for future support"} aria-describedby="actual-fab-pilot-help" className="mb-2 block rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300">
                <button type="button" disabled aria-disabled="true" className="w-full min-h-11 cursor-not-allowed rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2 text-left text-xs font-bold text-slate-400 grayscale opacity-75"><span>🔒 {lang === "ko" ? "실제 팹 파일럿 연동" : lang === "ja" ? "実ファブのパイロット連携" : "Actual fab pilot integration"}</span><span className="float-right text-[10px]">{lang === "ko" ? "추후 지원 예정" : lang === "ja" ? "今後サポート予定" : "Future support"}</span></button>
                <span id="actual-fab-pilot-help" className="sr-only">{lang === "ko" ? "협력 기관 데이터 제공, IT/OT 보안 승인, 현장 담당자 협의 후 별도 검토합니다." : lang === "ja" ? "協力機関のデータ提供、IT/OTセキュリティ承認、現場担当者との協議後に個別検討します。" : "This is considered separately after partner data access, IT/OT security approval, and on-site operator alignment."}</span>
              </span>
              <button type="button" onClick={() => { setVirtualFabDemoActive(false); setDemoRunning(r => !r); }} className="w-full min-h-11 flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-bold transition-all hover:opacity-80 active:scale-95" style={{ borderColor: demoRunning ? "oklch(0.65 0.20 30 / 0.6)" : th.border2, color: demoRunning ? "oklch(0.75 0.20 30)" : th.textMuted, background: demoRunning ? "oklch(0.65 0.20 30 / 0.12)" : th.bgCard2 }}>
              <span>{demoRunning ? "■" : "▶"} {demoRunning ? (lang === "ko" ? "데모 중지" : lang === "ja" ? "デモを停止" : "Stop demo") : (lang === "ko" ? "데모 자동 실행" : lang === "ja" ? "デモ自動実行" : "Auto demo")}</span><span className="text-[10px]">{demoRunning ? `${demoSpeed}s` : ""}</span>
            </button>
            {demoRunning && <div className="rounded-xl border p-3 mt-2" style={{ borderColor: th.border2, background: th.bgCard2 }}><div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold">{lang === "ko" ? "데모 간격" : lang === "ja" ? "デモ間隔" : "Demo interval"}</span><span className="text-xs font-mono" style={{ color: "oklch(0.75 0.20 30)" }}>{demoSpeed}s</span></div><input type="range" min={1} max={10} step={1} value={demoSpeed} onChange={e => setDemoSpeed(Number(e.target.value))} aria-label={lang === "ko" ? "데모 간격" : lang === "ja" ? "デモ間隔" : "Demo interval"} aria-valuetext={lang === "ko" ? `${demoSpeed}초` : lang === "ja" ? `${demoSpeed}秒` : `${demoSpeed} seconds`} className="w-full accent-orange-400 cursor-pointer" /></div>}
            <button type="button" onClick={() => document.getElementById("btn-export-pdf")?.click()} className="w-full min-h-11 mt-2 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-all hover:opacity-80 active:scale-95" style={{ borderColor: th.border2, color: th.accent, background: th.bgCard2 }}>📄 {lang === "ko" ? "PDF 보고서 내보내기" : lang === "ja" ? "PDFレポートを出力" : "Export PDF report"}</button>
            <div className="border-t mt-5 pt-5" style={{ borderColor: th.border }}>
              <button type="button" onClick={() => document.getElementById("btn-logout")?.click()} className="w-full min-h-11 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-all hover:opacity-80 active:scale-95" style={{ borderColor: "oklch(0.65 0.20 30 / 0.6)", color: "oklch(0.75 0.20 30)", background: "oklch(0.65 0.20 30 / 0.12)" }}>
                <span aria-hidden="true">🚪</span>
                {lang === "ko" ? "로그아웃" : lang === "ja" ? "ログアウト" : "Logout"}
              </button>
            </div>
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
        <div className="flex items-center gap-2 sm:gap-3">
          <span role="status" aria-live="polite" aria-atomic="true" title={systemStatusDescription} aria-label={systemStatusDescription} className={`h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-bold shadow-sm ${systemStatusKind === "healthy" ? "hidden sm:inline-flex" : "inline-flex"}`} style={{ borderColor: systemStatusBorder, color: systemStatusColor, background: systemStatusBackground }}>
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${systemStatusKind === "syncing" ? "animate-pulse" : ""}`} style={{ background: systemStatusColor }} />
            {systemStatusLabel}
          </span>
          <SensorFreshnessIndicator timestamp={sensorData?.timestamp} lang={lang} />
          <span role="status" aria-live="polite" aria-atomic="true" title={virtualFabDemoActive ? (lang === "ko" ? "실제 파일럿·보안 승인 전 시연 데이터" : lang === "ja" ? "実際のパイロット・セキュリティ承認前のデモデータ" : "Demo data before actual pilot and security approval") : undefined} className="hidden md:inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold" style={{ borderColor: virtualFabDemoActive ? "rgba(34,197,94,0.5)" : "rgba(56,189,248,0.45)", color: virtualFabDemoActive ? "rgb(34,197,94)" : "oklch(0.65 0.18 200)", background: virtualFabDemoActive ? "rgba(34,197,94,0.08)" : "rgba(56,189,248,0.08)" }} aria-label={virtualFabDemoActive ? (lang === "ko" ? "가상 팹 시연 데이터, 파일럿과 보안 승인 전, 읽기 전용, 설비 제어 없음" : lang === "ja" ? "仮想ファブのデモデータ、パイロットとセキュリ티承認前、読み取り専用、設備制御なし" : "Virtual fab demo data before pilot and security approval, read-only, no equipment control") : (lang === "ko" ? "읽기 전용 분석 상태, 설비 제어 없음" : lang === "ja" ? "読み取り専用分析状態、設備制御なし" : "Read-only analysis state, no equipment control")}>
            {virtualFabDemoActive ? (lang === "ko" ? "가상 · 승인 전 · 읽기 전용" : lang === "ja" ? "仮想・承認前・読み取り専用" : "Virtual · pre-approval · read-only") : (lang === "ko" ? "읽기 전용 분석" : lang === "ja" ? "読み取り専用分析" : "Read-only analysis")}
          </span>
          {safetyMonitoringHasError && (
            <button type="button" onClick={retrySafetyMonitoring} disabled={safetyMonitoringRetrying} aria-busy={safetyMonitoringRetrying || undefined} className="flex h-8 items-center justify-center rounded-lg border px-2 text-[10px] font-bold transition-opacity hover:opacity-80 disabled:opacity-45" style={{ borderColor: "oklch(0.72 0.18 30 / 0.55)", color: "oklch(0.78 0.18 30)", background: "oklch(0.72 0.18 30 / 0.10)" }} aria-label={safetyMonitoringRetrying ? (lang === "ko" ? "안전 모니터링 데이터 연결 중" : lang === "ja" ? "安全モニタリングデータに接続中" : "Connecting safety monitoring data") : (lang === "ko" ? "안전 모니터링 데이터 다시 연결" : lang === "ja" ? "安全モニタリングデータに再接続" : "Reconnect safety monitoring data")} title={lang === "ko" ? "안전 데이터 다시 연결" : lang === "ja" ? "安全データを再接続" : "Reconnect safety data"}>
              ↻ <span className="hidden sm:inline ml-1">{safetyMonitoringRetrying ? (lang === "ko" ? "연결 중" : lang === "ja" ? "接続中" : "Connecting") : (lang === "ko" ? "재연결" : lang === "ja" ? "再接続" : "Reconnect")}</span>
            </button>
          )}
          <AlertPanel riskLevel={riskLevel} relayTripped={relayTripped} t={t} />
          <button
            type="button"
            ref={menuTriggerRef}
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
          <button type="button" onClick={() => setLang(l => l === "ko" ? "en" : l === "en" ? "ja" : "ko")}
            aria-label={lang === "ko" ? "현재 언어: 한국어. 영어로 전환" : lang === "en" ? "Current language: English. Switch to Japanese" : "現在の言語: 日本語。韓国語に切替"}
            className="hidden px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 hover:opacity-80 active:scale-95"
            style={{ borderColor: "oklch(0.65 0.18 200 / 0.4)", color: "oklch(0.65 0.18 200)", background: "oklch(0.65 0.18 200 / 0.08)" }}
            title={lang === "ko" ? "영어로 전환" : lang === "en" ? "日本語に切替" : "한국어로 전환"}>
            {lang === "ko" ? "EN" : lang === "en" ? "日本語" : "한국어"}
          </button>
          {/* 다크/라이트 모드 전환 */}
          <button
            type="button"
            onClick={toggleDashboardTheme}
            title={isDark ? (lang === "ko" ? "라이트 모드" : lang === "ja" ? "ライトモード" : "Light Mode") : (lang === "ko" ? "다크 모드" : lang === "ja" ? "ダークモード" : "Dark Mode")}
            aria-label={isDark ? (lang === "ko" ? "라이트 모드로 전환" : lang === "ja" ? "ライトモードに切替" : "Switch to light mode") : (lang === "ko" ? "다크 모드로 전환" : lang === "ja" ? "ダークモードに切替" : "Switch to dark mode")}
            aria-pressed={isDark}
            className="flex w-8 h-8 items-center justify-center rounded-lg border transition-all duration-200 hover:opacity-80 active:scale-95 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            style={{
              borderColor: isDark ? "oklch(0.35 0.01 240)" : "oklch(0.75 0.08 80 / 0.5)",
              color: isDark ? "oklch(0.65 0.15 60)" : "oklch(0.40 0.08 80)",
              background: isDark ? "oklch(0.15 0.01 240)" : "oklch(0.92 0.04 80 / 0.3)",
            }}>
            {isDark ? "☀️" : "🌙"}
          </button>
          {/* 음소거 토글 */}
          <button
            type="button"
            onClick={() => {
              setMuted(m => {
                const next = !m;
                mutedRef.current = next;
                try { localStorage.setItem("semiguard_muted", String(next)); } catch {}
                return next;
              });
            }}
            title={muted ? (lang === "ko" ? "소리 켜기" : lang === "ja" ? "音声をオン" : "Unmute") : (lang === "ko" ? "소리 끄기" : lang === "ja" ? "音声をオフ" : "Mute")}
            aria-label={lang === "ko" ? "알림 음소거" : lang === "ja" ? "通知音をミュート" : "Mute alerts"}
            aria-pressed={muted}
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
            <div className="hidden flex items-center gap-1.5" title={lang === "ko" ? "볼륨 조절" : lang === "ja" ? "音量調節" : "Volume"}>
              <span aria-hidden="true" style={{ fontSize: 11, color: "oklch(0.50 0.01 240)" }}>🔉</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                aria-label={lang === "ko" ? "알림 음량" : lang === "ja" ? "通知音量" : "Alert volume"}
                aria-valuetext={lang === "ko" ? `${Math.round(volume * 100)}퍼센트` : lang === "ja" ? `${Math.round(volume * 100)}パーセント` : `${Math.round(volume * 100)} percent`}
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
            type="button"
            onClick={() => { setVirtualFabDemoActive(false); setDemoRunning(r => !r); }}
            title={demoRunning ? (lang === "ko" ? "데모 중지" : lang === "ja" ? "デモを停止" : "Stop Demo") : (lang === "ko" ? "데모 자동 실행" : lang === "ja" ? "デモ自動実行" : "Auto Demo")}
            aria-label={lang === "ko" ? "데모 자동 실행" : lang === "ja" ? "デモ自動実行" : "Demo auto-run"}
            aria-pressed={demoRunning}
            className="hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-200 hover:opacity-80 active:scale-95"
            style={{
              borderColor: demoRunning ? "oklch(0.65 0.20 30 / 0.6)" : "oklch(0.35 0.01 240)",
              color: demoRunning ? "oklch(0.75 0.20 30)" : "oklch(0.50 0.01 240)",
              background: demoRunning ? "oklch(0.65 0.20 30 / 0.12)" : th.bgCard,
            }}>
            {demoRunning ? (
              <><span aria-hidden="true" className="inline-block w-2 h-2 rounded-sm" style={{ background: "oklch(0.75 0.20 30)", animation: "pulse 1s ease-in-out infinite" }} /> {lang === "ko" ? "데모 중" : lang === "ja" ? "デモ実行中" : "Demo ON"}</>
            ) : (
              <><span aria-hidden="true">▶</span> {lang === "ko" ? "데모" : lang === "ja" ? "デモ" : "Demo"}</>
            )}
          </button>
          {/* 데모 속도 슬라이더 - 모바일 숨김 */}
          {demoRunning && !isMobile && (
            <div className="hidden flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs"
              style={{ borderColor: th.border2, background: th.bgCard }}>
              <span style={{ color: "oklch(0.50 0.01 240)" }}>{lang === "ko" ? "속도" : lang === "ja" ? "速度" : "Speed"}</span>
              <input
                type="range" min={1} max={10} step={1}
                value={demoSpeed}
                aria-label={lang === "ko" ? "데모 실행 간격" : lang === "ja" ? "デモ実行間隔" : "Demo interval"}
                aria-valuetext={lang === "ko" ? `${demoSpeed}초` : lang === "ja" ? `${demoSpeed}秒` : `${demoSpeed} seconds`}
                onChange={e => setDemoSpeed(Number(e.target.value))}
                className="w-20 h-1 accent-orange-400 cursor-pointer"
              />
              <span style={{ color: "oklch(0.65 0.18 200)", fontWeight: 700 }}>{demoSpeed}s</span>
            </div>
          )}
          {/* PDF 내보내기 버튼 */}
          <button
            type="button"
            id="btn-export-pdf"
            disabled={pdfExporting}
            aria-busy={pdfExporting || undefined}
            onClick={exportSelectedPeriodPdf}
            title={lang === "ko" ? "구조화 PDF 보고서 내보내기" : lang === "ja" ? "構造化PDFレポートを出力" : "Export structured PDF report"}
            className="hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-200 hover:opacity-80 active:scale-95 disabled:opacity-50"
            style={{ borderColor: th.border2, color: "oklch(0.65 0.18 200)", background: th.bgCard }}>
            {pdfExporting ? <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid oklch(0.65 0.18 200)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> : "📄"} {lang === "ko" ? "보고서" : lang === "ja" ? "レポート" : "Report"}
          </button>
          {/* 로그아웃 버튼 */}
          <button
            type="button"
            id="btn-logout"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            aria-busy={logoutMutation.isPending || undefined}
            title={lang === "ko" ? "로그아웃" : lang === "ja" ? "ログアウト" : "Logout"}
            className="hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-200 hover:opacity-80 active:scale-95 disabled:opacity-50"
            style={{ borderColor: "oklch(0.65 0.20 30 / 0.6)", color: "oklch(0.75 0.20 30)", background: "oklch(0.65 0.20 30 / 0.12)" }}>
            {logoutMutation.isPending ? <span aria-hidden="true" style={{ display: "inline-block", width: 12, height: 12, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> : "🚪"} {logoutMutation.isPending ? (lang === "ko" ? "로그아웃 중…" : lang === "ja" ? "ログアウト中…" : "Logging out…") : (lang === "ko" ? "로그아웃" : lang === "ja" ? "ログアウト" : "Logout")}
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
            <button type="button" onClick={() => setShowLanding(false)}
              aria-label={lang === "ko" ? "서비스 소개 닫기" : lang === "ja" ? "サービス紹介を閉じる" : "Close service introduction"}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 hover:opacity-70"
              style={{ borderColor: th.border2, color: th.textMuted }}>
              <span aria-hidden="true">✕</span>
              <span className="hidden sm:inline">{lang === "ko" ? "닫기" : lang === "ja" ? "閉じる" : "Close"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 플로팅 챗봇 버튼 ── */}
      <button
        type="button"
        ref={chatLaunchButtonRef}
        onClick={() => setIsChatOpen(true)}
        aria-label={lang === "ko" ? "AI 수석 엔지니어 상담 열기" : lang === "ja" ? "AIシニアエンジニア相談を開く" : "Open AI expert chatbot"}
        className="fixed bottom-5 right-4 sm:bottom-8 sm:right-8 z-[495] flex items-center gap-2 sm:gap-3 px-4 py-3 sm:px-7 sm:py-5 rounded-full shadow-2xl font-extrabold text-sm sm:text-base transition-transform duration-200 hover:scale-[1.04] active:scale-[0.97]"
        style={{
          bottom: isMobile ? "max(1.25rem, calc(env(safe-area-inset-bottom) + 0.5rem))" : undefined,
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
          <span className="sm:hidden whitespace-nowrap">{lang === "ko" ? "AI 상담" : lang === "ja" ? "AI相談" : "AI Chat"}</span>
          <span className="hidden sm:inline whitespace-nowrap">{lang === "ko" ? "AI 수석 엔지니어 상담" : lang === "ja" ? "AIシニアエンジニア相談" : "AI Expert Chatbot"}</span>
          <span className="hidden sm:block text-xs font-semibold opacity-90 whitespace-nowrap">
            {lang === "ko" ? "LLM 진단 활성화" : lang === "ja" ? "LLM診断を起動" : "Activate LLM diagnosis"}
          </span>
        </span>
      </button>

      {/* ── AI 챗봇 대화창 모달 ── */}
      {isChatOpen && (
        <div className="fixed inset-0 z-[550] flex items-stretch justify-center bg-black/60 backdrop-blur-sm animate-fadeIn sm:items-center sm:p-4">
          <div
            ref={chatDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-dialog-title"
            className="relative flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden border shadow-2xl sm:h-[min(600px,90vh)] sm:w-[95vw] sm:max-w-lg sm:rounded-2xl"
            style={{
              background: isDark ? "oklch(0.13 0.015 240)" : "oklch(0.99 0.003 240)",
              borderColor: "oklch(0.75 0.18 200 / 0.4)",
            }}>
            {/* 챗봇 헤더 */}
            <div className="flex flex-col gap-2 border-b px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:py-4" style={{ borderColor: th.border, background: "oklch(0.75 0.18 200 / 0.08)" }}>
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-base sm:text-lg font-bold shrink-0" style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 200), oklch(0.55 0.22 240))", color: "white" }}>
                  🤖
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 id="chat-dialog-title" className="text-xs sm:text-sm font-bold truncate" style={{ color: isDark ? "oklch(0.92 0.01 240)" : "oklch(0.12 0.01 240)" }}>
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
                <button
                  type="button"
                  ref={chatCloseButtonRef}
                  onClick={() => setIsChatOpen(false)}
                  aria-label={lang === "ko" ? "상담 닫기" : lang === "ja" ? "相談を閉じる" : "Close consultation"}
                  className="ml-auto w-7 h-7 rounded-full flex items-center justify-center text-xs transition-opacity hover:opacity-70 border shrink-0"
                  style={{ borderColor: th.border2, color: th.textMuted }}>
                  ✕
                </button>
              </div>
              <div className="-mb-1 flex w-full flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                <button
                  type="button"
                  ref={historyPanelTriggerRef}
                  onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                  aria-expanded={showHistoryPanel}
                  aria-controls="chat-history-panel"
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
                  ref={feedbackPanelTriggerRef}
                  onClick={() => {
                    setShowFeedbackHistoryPanel(previous => !previous);
                    setShowHistoryPanel(false);
                  }}
                  aria-expanded={showFeedbackHistoryPanel}
                  aria-controls="chat-feedback-panel"
                  title={lang === "ko" ? "피드백·재생성 답변 히스토리 보기" : lang === "ja" ? "フィードバック・再生成回答の履歴を見る" : "View feedback and regenerated answer history"}
                  className="px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold border transition-all duration-150 hover:opacity-80 active:scale-95 whitespace-nowrap shrink-0 flex items-center gap-1"
                  style={{ borderColor: "oklch(0.62 0.20 300 / 0.45)", background: "oklch(0.62 0.20 300 / 0.12)", color: isDark ? "oklch(0.82 0.16 300)" : "oklch(0.45 0.20 300)" }}>
                  ✨ {lang === "ko" ? "피드백" : lang === "ja" ? "フィードバック" : "Feedback"}
                </button>
                <button
                  type="button"
                  ref={manualPanelTriggerRef}
                  onClick={() => setShowManualRagModal(true)}
                  aria-expanded={showManualRagModal}
                  aria-controls="chat-manual-panel"
                  title={lang === "ko" ? "설비 매뉴얼을 RAG 지식으로 등록" : lang === "ja" ? "設備マニュアルをRAG知識として登録" : "Add equipment manual as RAG knowledge"}
                  className="px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold border transition-all duration-150 hover:opacity-80 active:scale-95 whitespace-nowrap shrink-0 flex items-center gap-1"
                  style={{ borderColor: "oklch(0.72 0.15 75 / 0.45)", background: "oklch(0.72 0.15 75 / 0.12)", color: isDark ? "oklch(0.86 0.14 80)" : "oklch(0.46 0.16 75)" }}>
                  📘 {lang === "ko" ? "매뉴얼" : lang === "ja" ? "マニュアル" : "Manual"}{manualDocumentsQuery.data?.length ? ` ${manualDocumentsQuery.data.length}` : ""}
                </button>
                <button
                  type="button"
                  ref={resetConfirmTriggerRef}
                  onClick={() => setShowResetConfirmModal(true)}
                  aria-expanded={showResetConfirmModal}
                  aria-controls="chat-reset-confirm"
                  title={lang === "ko" ? "새 상담 시작 (이전 대화 보관)" : lang === "ja" ? "新しい相談 (会話保存)" : "New Consultation"}
                  className="px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold border transition-all duration-150 hover:opacity-80 active:scale-95 whitespace-nowrap shrink-0"
                  style={{ borderColor: "oklch(0.75 0.18 200 / 0.4)", background: "oklch(0.75 0.18 200 / 0.10)", color: "oklch(0.75 0.18 200)" }}>
                  🔄 {lang === "ko" ? "새 상담" : lang === "ja" ? "新規相談" : "New Chat"}
                </button>
              </div>
            </div>

            {/* 새 상담 초기화 확인 모달 */}
            {showResetConfirmModal && (
              <div id="chat-reset-confirm" className="absolute inset-0 z-[560] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn" role="alertdialog" aria-modal="true" aria-labelledby="chat-reset-confirm-title" aria-describedby="chat-reset-confirm-description">
                <div
                  ref={resetConfirmDialogRef}
                  className="w-full max-w-sm rounded-xl p-5 shadow-2xl border space-y-4"
                  style={{
                    background: isDark ? "oklch(0.15 0.02 240)" : "oklch(0.98 0.005 240)",
                    borderColor: "oklch(0.75 0.18 200 / 0.5)",
                    color: isDark ? "oklch(0.92 0.01 240)" : "oklch(0.12 0.01 240)"
                  }}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden="true">⚠️</span>
                    <div>
                      <h4 id="chat-reset-confirm-title" className="text-sm font-bold">
                        {lang === "ko" ? "새 상담을 시작하시겠습니까?" : lang === "ja" ? "新しい相談を開始しますか？" : "Start a New Consultation?"}
                      </h4>
                      <p id="chat-reset-confirm-description" className="text-[11px] text-muted-foreground mt-0.5">
                        {lang === "ko"
                          ? "이전 대화는 상담 기록에 보관되고, 현재 창만 새 상담으로 전환됩니다. 계속하시겠습니까?"
                          : lang === "ja"
                          ? "これまでの会話は相談履歴に保存され、現在の画面だけが新しい相談に切り替わります。続行しますか？"
                          : "Previous messages stay in Consultation History. Only this chat window switches to a new consultation. Continue?"}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      ref={resetConfirmCancelRef}
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
              <div id="chat-manual-panel" className="absolute inset-0 z-[565] flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md animate-fadeIn" role="dialog" aria-modal="true" aria-labelledby="rag-manual-dialog-title" aria-describedby="rag-manual-dialog-description">
                <div ref={manualPanelDialogRef} className="w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border p-4 sm:p-5 shadow-2xl space-y-3 custom-scrollbar" style={{ background: isDark ? "oklch(0.15 0.02 240)" : "oklch(0.98 0.005 240)", borderColor: "oklch(0.72 0.15 75 / 0.45)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 id="rag-manual-dialog-title" className="text-sm font-bold" style={{ color: th.text }}>📘 {lang === "ko" ? "설비 매뉴얼 RAG 등록" : lang === "ja" ? "設備マニュアルRAG登録" : "Add Manual to RAG"}</h4>
                      <p id="rag-manual-dialog-description" className="mt-1 text-[10px] leading-relaxed" style={{ color: th.textMuted }}>
                        {lang === "ko" ? "매뉴얼·점검표의 텍스트를 등록하면, AI가 질문과 관련된 부분을 찾아 근거로 제시합니다. 민감정보는 제외해 주세요." : lang === "ja" ? "マニュアル・点検表のテキストを登録すると、AIが質問に関連する箇所を根拠として提示します。機密情報は除外してください。" : "Add manual or checklist text. The AI retrieves relevant sections as evidence. Exclude confidential information."}
                      </p>
                    </div>
                    <button type="button" ref={manualPanelCloseRef} onClick={() => setShowManualRagModal(false)} className="text-sm shrink-0 hover:opacity-70" style={{ color: th.textMuted }} aria-label={lang === "ko" ? "매뉴얼 등록 닫기" : lang === "ja" ? "マニュアル登録を閉じる" : "Close manual registration"}>✕</button>
                  </div>
                  <label htmlFor="rag-manual-title" className="sr-only">
                    {lang === "ko" ? "RAG 매뉴얼 제목" : lang === "ja" ? "RAGマニュアルのタイトル" : "RAG manual title"}
                  </label>
                  <input
                    id="rag-manual-title"
                    value={manualTitle}
                    onChange={event => setManualTitle(event.target.value)}
                    enterKeyHint="next"
                    maxLength={255}
                    placeholder={lang === "ko" ? "예: 식각 장비 일일 점검 매뉴얼" : lang === "ja" ? "例: エッチング装置の日常点検マニュアル" : "e.g. Etcher daily inspection manual"}
                    className="w-full rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2"
                    style={{ background: isDark ? "oklch(0.18 0.02 240)" : "white", borderColor: th.border, color: th.text }}
                  />
                  <label htmlFor="rag-manual-content" className="sr-only">
                    {lang === "ko" ? "RAG 매뉴얼 본문" : lang === "ja" ? "RAGマニュアルの本文" : "RAG manual content"}
                  </label>
                  <textarea
                    id="rag-manual-content"
                    value={manualContent}
                    onChange={event => setManualContent(event.target.value)}
                    enterKeyHint="done"
                    minLength={50}
                    maxLength={60000}
                    placeholder={lang === "ko" ? "매뉴얼 또는 점검표 본문을 붙여넣어 주세요. 문단으로 나누면 더 정확하게 검색됩니다." : lang === "ja" ? "マニュアルまたは点検表の本文を貼り付けてください。段落で区切ると検索精度が向上します。" : "Paste manual or checklist text. Separate paragraphs for more accurate retrieval."}
                    className="custom-scrollbar min-h-40 w-full resize-y rounded-lg border px-3 py-2 text-xs leading-relaxed outline-none focus:ring-2"
                    style={{ background: isDark ? "oklch(0.18 0.02 240)" : "white", borderColor: th.border, color: th.text }}
                  />
                  <div id="rag-manual-chunk-status" className="rounded-lg border px-2.5 py-2 text-[10px] leading-relaxed" role="status" aria-live="polite" aria-atomic="true" style={{ borderColor: isManualChunkWarning ? "oklch(0.72 0.16 75 / 0.55)" : th.border, background: isManualChunkWarning ? "oklch(0.72 0.16 75 / 0.10)" : "transparent", color: isManualChunkWarning ? (isDark ? "oklch(0.86 0.14 80)" : "oklch(0.45 0.16 75)") : th.textMuted }}>
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
                        aria-busy={addManualTextMutation.isPending || undefined}
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
                      <p className="py-2 text-center text-[10px]" role="status" aria-live="polite" aria-atomic="true" style={{ color: th.textMuted }}>
                        {lang === "ko" ? "매뉴얼 목록을 불러오는 중..." : lang === "ja" ? "マニュアル一覧を読み込み中..." : "Loading manuals..."}
                      </p>
                    ) : manualDocumentsQuery.isError ? (
                      <div className="flex flex-col items-center gap-1.5 py-3 text-center text-[10px]" role="alert" aria-atomic="true" style={{ color: th.textMuted }}>
                        <p><span aria-hidden="true">⚠️</span>{" "}{lang === "ko" ? "매뉴얼 목록을 불러오지 못했습니다." : lang === "ja" ? "マニュアル一覧を読み込めませんでした。" : "Could not load manuals."}</p>
                        <button type="button" onClick={() => void manualDocumentsQuery.refetch()} disabled={manualDocumentsQuery.isFetching} aria-busy={manualDocumentsQuery.isFetching || undefined} className="rounded border px-2 py-1 text-[9px] font-bold disabled:opacity-45" style={{ borderColor: "oklch(0.72 0.15 75 / 0.45)", color: isDark ? "oklch(0.86 0.14 80)" : "oklch(0.46 0.16 75)" }}>
                          ↻ {manualDocumentsQuery.isFetching ? (lang === "ko" ? "다시 불러오는 중..." : lang === "ja" ? "再読み込み中..." : "Retrying...") : (lang === "ko" ? "다시 시도" : lang === "ja" ? "再試行" : "Retry")}
                        </button>
                      </div>
                    ) : allManualDocuments.length > 0 ? (
                      <>
                        <div className="relative mb-2">
                          <input
                            value={manualSearchQuery}
                            onChange={event => setManualSearchQuery(event.target.value)}
                            enterKeyHint="search"
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
                        <div className="mb-2 flex items-center justify-end gap-1.5">
                          <label className="text-[9px] font-bold" htmlFor="rag-manual-sort" style={{ color: th.textMuted }}>
                            {lang === "ko" ? "정렬" : lang === "ja" ? "並び替え" : "Sort"}
                          </label>
                          <select
                            id="rag-manual-sort"
                            value={manualDocumentSort}
                            onChange={event => setManualDocumentSort(event.target.value as "newest" | "oldest" | "title")}
                            className="rounded border px-1.5 py-1 text-[9px] outline-none focus:ring-1 focus:ring-amber-500"
                            style={{ borderColor: th.border2, background: th.bgCard, color: th.textMuted }}>
                            <option value="newest">{lang === "ko" ? "최신순" : lang === "ja" ? "新しい順" : "Newest"}</option>
                            <option value="oldest">{lang === "ko" ? "오래된순" : lang === "ja" ? "古い順" : "Oldest"}</option>
                            <option value="title">{lang === "ko" ? "제목순" : lang === "ja" ? "タイトル順" : "Title"}</option>
                          </select>
                          {hasActiveManualFilters && (
                            <button
                              type="button"
                              onClick={resetManualFilters}
                              title={lang === "ko" ? "매뉴얼 검색·정렬 필터 초기화" : lang === "ja" ? "マニュアル検索・並び替えフィルターをリセット" : "Reset manual search and sort filters"}
                              className="rounded border px-1.5 py-1 text-[9px] font-bold transition-all hover:opacity-80 active:scale-95"
                              style={{ borderColor: th.border2, background: th.bgCard2, color: th.textMuted }}>
                              ↺ {lang === "ko" ? "초기화" : lang === "ja" ? "リセット" : "Reset"}
                            </button>
                          )}
                        </div>
                        {isManualSearching ? (
                          <p className="py-3 text-center text-[10px]" role="status" aria-live="polite" aria-atomic="true" style={{ color: th.textMuted }}>
                            {isManualSearchPending
                              ? (lang === "ko" ? "입력을 확인하는 중..." : lang === "ja" ? "入力を確認中..." : "Waiting for input...")
                              : (lang === "ko" ? "매뉴얼 제목과 원문을 검색하는 중..." : lang === "ja" ? "マニュアルのタイトル・原文を検索中..." : "Searching manual titles and content...")}
                          </p>
                        ) : normalizedManualSearch && manualDocumentSearchQuery.isError ? (
                          <div className="flex flex-col items-center gap-1.5 py-3 text-center text-[10px]" role="alert" aria-atomic="true" style={{ color: th.textMuted }}>
                            <p><span aria-hidden="true">⚠️</span>{" "}{lang === "ko" ? "매뉴얼 검색 결과를 불러오지 못했습니다." : lang === "ja" ? "マニュアル検索結果を読み込めませんでした。" : "Could not load manual search results."}</p>
                            <button type="button" onClick={() => void manualDocumentSearchQuery.refetch()} disabled={manualDocumentSearchQuery.isFetching} aria-busy={manualDocumentSearchQuery.isFetching || undefined} className="rounded border px-2 py-1 text-[9px] font-bold disabled:opacity-45" style={{ borderColor: "oklch(0.72 0.15 75 / 0.45)", color: isDark ? "oklch(0.86 0.14 80)" : "oklch(0.46 0.16 75)" }}>
                              ↻ {manualDocumentSearchQuery.isFetching ? (lang === "ko" ? "다시 불러오는 중..." : lang === "ja" ? "再読み込み中..." : "Retrying...") : (lang === "ko" ? "다시 시도" : lang === "ja" ? "再試行" : "Retry")}
                            </button>
                          </div>
                        ) : sortedManualDocuments.length > 0 ? (
                        <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1 custom-scrollbar">
                        {sortedManualDocuments.map(document => (
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
                                  ref={manualDocumentToDelete === document.id ? manualDeleteTriggerRef : undefined}
                                  onClick={(event) => {
                                    manualDeleteTriggerRef.current = event.currentTarget;
                                    setManualDocumentToDelete(document.id);
                                  }}
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
                                  <p className="py-1 text-[9px]" role="status" aria-live="polite" aria-atomic="true" style={{ color: th.textMuted }}>{lang === "ko" ? "원문을 불러오는 중..." : lang === "ja" ? "原文を読み込み中..." : "Loading source..."}</p>
                                ) : manualPreviewQuery.isError ? (
                                  <div className="flex items-center justify-between gap-2 py-1 text-[9px]" role="alert" aria-atomic="true" style={{ color: th.textMuted }}>
                                    <span>⚠️ {lang === "ko" ? "원문을 불러오지 못했습니다." : lang === "ja" ? "原文を読み込めませんでした。" : "Could not load the source."}</span>
                                    <button type="button" onClick={() => void manualPreviewQuery.refetch()} disabled={manualPreviewQuery.isFetching} aria-busy={manualPreviewQuery.isFetching || undefined} className="shrink-0 rounded border px-1.5 py-0.5 font-bold disabled:opacity-45" style={{ borderColor: "oklch(0.72 0.15 75 / 0.45)", color: isDark ? "oklch(0.86 0.14 80)" : "oklch(0.46 0.16 75)" }}>
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
                                            const copied = await copyTextWithFallback(manualPreviewQuery.data.chunks.map(chunk => `[${chunk.chunkIndex + 1}] ${chunk.content}`).join("\n\n"));
                                            if (!copied) throw new Error("Clipboard copy failed");
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
                                          const safeTitle = manualPreviewQuery.data.document.title.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").slice(0, 40) || "manual";
                                          const filenamePrefix = lang === "ko" ? "세미가드_매뉴얼" : lang === "ja" ? "セミガード_マニュアル" : "semiguard-manual";
                                          anchor.href = url;
                                          anchor.download = `${filenamePrefix}_${safeTitle}_${new Date().toISOString().slice(0, 10)}.md`;
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
                              <div ref={manualDeleteDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="manual-delete-confirm-title" aria-describedby="manual-delete-confirm-description" className="mt-2 border-t pt-2" style={{ borderColor: th.border2 }}>
                                <p id="manual-delete-confirm-title" className="text-[9px] font-bold text-red-300">
                                  <span aria-hidden="true">⚠️ </span>{lang === "ko" ? "RAG 매뉴얼 삭제 확인" : lang === "ja" ? "RAGマニュアル削除の確認" : "Confirm RAG manual deletion"}
                                </p>
                                <p id="manual-delete-confirm-description" className="mt-1 text-[9px] leading-relaxed text-red-400">
                                  {lang === "ko" ? "이 매뉴얼과 연결된 모든 RAG 구간을 삭제할까요? 되돌릴 수 없습니다." : lang === "ja" ? "このマニュアルと関連するすべてのRAG区間を削除しますか？元に戻せません。" : "Delete this manual and all related RAG chunks? This cannot be undone."}
                                </p>
                                <div className="mt-1.5 flex justify-end gap-1.5">
                                  <button type="button" ref={manualDeleteCancelRef} onClick={() => setManualDocumentToDelete(null)} className="rounded px-2 py-1 text-[9px]" style={{ color: th.textMuted }}>
                                    {lang === "ko" ? "취소" : lang === "ja" ? "キャンセル" : "Cancel"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={deleteManualDocumentMutation.isPending}
                                    aria-busy={deleteManualDocumentMutation.isPending || undefined}
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
              <div id="chat-history-panel" className="absolute inset-0 z-[570] flex flex-col border p-3 shadow-2xl backdrop-blur-md animate-fadeIn sm:inset-x-auto sm:right-4 sm:top-14 sm:bottom-2 sm:w-72 sm:rounded-xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="consultation-history-panel-title"
                style={{
                  background: isDark ? "oklch(0.14 0.02 240 / 0.95)" : "oklch(0.98 0.005 240 / 0.95)",
                  borderColor: "oklch(0.75 0.18 200 / 0.4)",
                  color: isDark ? "oklch(0.92 0.01 240)" : "oklch(0.12 0.01 240)"
                }}>
                <div className="flex flex-col gap-2 pb-2 border-b mb-2" style={{ borderColor: th.border }}>
                  <div className="flex items-center justify-between">
                    <h4 id="consultation-history-panel-title" className="text-xs font-bold flex items-center gap-1.5">
                      📂 {lang === "ko" ? "과거 상담 기록" : lang === "ja" ? "過去の相談履歴" : "Consultation History"}
                    </h4>
                    <div className="flex items-center gap-2">
                      {chatSessionsQuery.data && chatSessionsQuery.data.length > 0 && (
                          <button
                            type="button"
                            ref={deleteAllConfirmTriggerRef}
                            onClick={() => setShowDeleteAllConfirm(true)}
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-all">
                          🗑️ {lang === "ko" ? "전체 초기화" : lang === "ja" ? "すべてリセット" : "Clear All"}
                        </button>
                      )}
                      <button
                        type="button"
                        ref={historyPanelCloseRef}
                        onClick={() => setShowHistoryPanel(false)}
                        className="text-xs text-muted-foreground hover:opacity-70"
                        aria-label={lang === "ko" ? "상담 기록 닫기" : lang === "ja" ? "相談履歴を閉じる" : "Close consultation history"}>
                        ✕
                      </button>
                    </div>
                  </div>
                  {/* 검색창 */}
                  <div className="relative">
                    <label className="sr-only" htmlFor="consultation-history-search">
                      {lang === "ko" ? "상담 기록 검색" : lang === "ja" ? "相談履歴を検索" : "Search consultation history"}
                    </label>
                    <input
                      id="consultation-history-search"
                      type="text"
                      placeholder={lang === "ko" ? "과거 대화 내용 검색..." : lang === "ja" ? "過去の会話を検索..." : "Search past consultations..."}
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      enterKeyHint="search"
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
                        aria-label={lang === "ko" ? "상담 기록 검색 지우기" : lang === "ja" ? "相談履歴の検索をクリア" : "Clear consultation history search"}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:opacity-70">
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1 rounded-lg border p-0.5" role="group" aria-label={lang === "ko" ? "상담 기록 표시 필터" : lang === "ja" ? "相談履歴表示フィルター" : "Consultation history display filter"} style={{ borderColor: th.border2, background: th.bgCard2 }}>
                      {(["all", "pinned"] as const).map(filter => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setHistorySessionFilter(filter)}
                          aria-pressed={historySessionFilter === filter}
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
                      {hasActiveHistoryFilters && (
                        <button
                          type="button"
                          onClick={resetHistoryFilters}
                          title={lang === "ko" ? "상담 기록 필터를 모두 초기화" : lang === "ja" ? "相談履歴フィルターをすべてリセット" : "Reset all consultation history filters"}
                          className="rounded border px-1.5 py-1 text-[9px] font-bold transition-all hover:opacity-80 active:scale-95"
                          style={{ borderColor: th.border2, background: th.bgCard2, color: th.textMuted }}>
                          ↺ {lang === "ko" ? "필터 초기화" : lang === "ja" ? "フィルターをリセット" : "Reset filters"}
                        </button>
                      )}
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
                      lang={lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US"}
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
                      lang={lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US"}
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
                  <div ref={deleteAllConfirmDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="chat-delete-all-confirm-title" aria-describedby="chat-delete-all-confirm-description" className="absolute inset-0 z-[580] rounded-xl flex flex-col items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn text-center">
                    <p id="chat-delete-all-confirm-title" className="text-xs font-bold text-red-300 mb-1">
                      ⚠️ {lang === "ko" ? "모든 상담 기록을 삭제하시겠습니까?" : lang === "ja" ? "すべての相談履歴を削除しますか？" : "Delete all consultation history?"}
                    </p>
                    <p id="chat-delete-all-confirm-description" className="text-[10px] text-muted-foreground mb-4">
                      {lang === "ko" ? "이 작업은 되돌릴 수 없으며 모든 대화가 영구 삭제됩니다." : lang === "ja" ? "この操作は取り消せません。" : "This action cannot be undone."}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        ref={deleteAllConfirmCancelRef}
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
                            chatUtils.semiguard.getChatSessions.invalidate();
                            setShowDeleteAllConfirm(false);
                            setShowHistoryPanel(false);
                          } catch (e) {
                            console.error("Failed to delete all sessions:", e);
                            toast.error(lang === "ko"
                              ? "상담 기록을 초기화하지 못했습니다. 로그인 상태를 확인한 뒤 다시 시도해 주세요."
                              : lang === "ja"
                                ? "相談履歴を初期化できませんでした。ログイン状態を確認してから再試行してください。"
                                : "Could not clear consultation history. Check your sign-in status and try again.");
                          }
                        }}
                        disabled={isClearingAllSessions}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-all disabled:cursor-wait disabled:opacity-60">
                        {isClearingAllSessions
                          ? (lang === "ko" ? "초기화 중..." : lang === "ja" ? "初期化中..." : "Clearing...")
                          : (lang === "ko" ? "전체 삭제" : lang === "ja" ? "すべて削除" : "Delete All")}
                      </button>
                    </div>
                  </div>
                )}
                {historySessionLoadError && (
                  <div className="mb-2 rounded-lg border p-2 text-[10px]" role="alert" aria-atomic="true" style={{ borderColor: "oklch(0.65 0.20 25 / 0.45)", background: "oklch(0.65 0.20 25 / 0.08)", color: th.textMuted }}>
                    <p><span aria-hidden="true">⚠️</span>{" "}{lang === "ko" ? `“${historySessionLoadError.title}” 기록을 열지 못했습니다.` : lang === "ja" ? `「${historySessionLoadError.title}」の履歴を開けませんでした。` : `Could not open “${historySessionLoadError.title}”.`}</p>
                    <div className="mt-1.5 flex justify-end gap-1.5">
                      <button type="button" onClick={() => void loadHistorySession(historySessionLoadError)} disabled={loadingHistorySessionId === historySessionLoadError.id} aria-busy={loadingHistorySessionId === historySessionLoadError.id || undefined} className="rounded border px-2 py-1 text-[9px] font-bold disabled:opacity-45" style={{ borderColor: "oklch(0.65 0.20 25 / 0.45)", color: isDark ? "oklch(0.82 0.14 40)" : "oklch(0.48 0.18 25)" }}>
                        ↻ {loadingHistorySessionId === historySessionLoadError.id ? (lang === "ko" ? "다시 여는 중..." : lang === "ja" ? "再読み込み中..." : "Retrying...") : (lang === "ko" ? "다시 시도" : lang === "ja" ? "再試行" : "Retry")}
                      </button>
                      <button type="button" onClick={() => setHistorySessionLoadError(null)} className="rounded px-2 py-1 text-[9px]" style={{ color: th.textMuted }}>
                        {lang === "ko" ? "닫기" : lang === "ja" ? "閉じる" : "Dismiss"}
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {chatSessionsQuery.isLoading || isHistorySearchPending || (debouncedHistorySearch.length > 0 && searchChatSessionsQuery.isLoading) ? (
                    <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2" role="status" aria-live="polite" aria-atomic="true">
                      <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" aria-hidden="true"></div>
                      <span>{isHistorySearchPending || debouncedHistorySearch.length > 0 ? (lang === "ko" ? "기록 검색 중..." : lang === "ja" ? "履歴を検索中..." : "Searching history...") : (lang === "ko" ? "기록 불러오는 중..." : lang === "ja" ? "履歴を読み込んでいます..." : "Loading history...")}</span>
                    </div>
                  ) : chatSessionsQuery.isError ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-[11px]" role="alert" aria-atomic="true" style={{ color: th.textMuted }}>
                      <p><span aria-hidden="true">⚠️</span>{" "}{lang === "ko" ? "상담 기록을 불러오지 못했습니다." : lang === "ja" ? "相談履歴を読み込めませんでした。" : "Could not load consultation history."}</p>
                      <button type="button" onClick={() => void chatSessionsQuery.refetch()} disabled={chatSessionsQuery.isFetching} aria-busy={chatSessionsQuery.isFetching || undefined} aria-label={chatSessionsQuery.isFetching ? (lang === "ko" ? "상담 기록 다시 불러오는 중" : lang === "ja" ? "相談履歴を再読み込み中" : "Retrying consultation history") : (lang === "ko" ? "상담 기록 다시 시도" : lang === "ja" ? "相談履歴を再試行" : "Retry consultation history")} className="rounded border px-2.5 py-1 text-[10px] font-bold disabled:opacity-45" style={{ borderColor: "oklch(0.65 0.22 200 / 0.45)", color: isDark ? "oklch(0.78 0.15 200)" : "oklch(0.42 0.17 220)" }}>
                        ↻ {chatSessionsQuery.isFetching ? (lang === "ko" ? "다시 불러오는 중..." : lang === "ja" ? "再読み込み中..." : "Retrying...") : (lang === "ko" ? "다시 시도" : lang === "ja" ? "再試行" : "Retry")}
                      </button>
                    </div>
                  ) : normalizedHistorySearch && searchChatSessionsQuery.isError ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-[11px]" role="alert" aria-atomic="true" style={{ color: th.textMuted }}>
                      <p><span aria-hidden="true">⚠️</span>{" "}{lang === "ko" ? "상담 기록 검색 결과를 불러오지 못했습니다." : lang === "ja" ? "相談履歴の検索結果を読み込めませんでした。" : "Could not load consultation search results."}</p>
                      <button type="button" onClick={() => void searchChatSessionsQuery.refetch()} disabled={searchChatSessionsQuery.isFetching} aria-busy={searchChatSessionsQuery.isFetching || undefined} aria-label={searchChatSessionsQuery.isFetching ? (lang === "ko" ? "상담 기록 검색 결과 다시 불러오는 중" : lang === "ja" ? "相談履歴の検索結果を再読み込み中" : "Retrying consultation search results") : (lang === "ko" ? "상담 기록 검색 결과 다시 시도" : lang === "ja" ? "相談履歴の検索結果を再試行" : "Retry consultation search results")} className="rounded border px-2.5 py-1 text-[10px] font-bold disabled:opacity-45" style={{ borderColor: "oklch(0.65 0.22 200 / 0.45)", color: isDark ? "oklch(0.78 0.15 200)" : "oklch(0.42 0.17 220)" }}>
                        ↻ {searchChatSessionsQuery.isFetching ? (lang === "ko" ? "다시 불러오는 중..." : lang === "ja" ? "再読み込み中..." : "Retrying...") : (lang === "ko" ? "다시 시도" : lang === "ja" ? "再試行" : "Retry")}
                      </button>
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
                        className={`p-2.5 rounded-lg border text-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex items-center justify-between ${
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
                            <div className="space-y-1.5">
                              <input
                                value={editingSessionTitle}
                                maxLength={120}
                                autoFocus
                                onChange={event => setEditingSessionTitle(event.target.value)}
                                enterKeyHint="done"
                                onKeyDown={event => {
                                  if (event.key === "Escape") {
                                    setEditingSessionId(null);
                                    return;
                                  }
                                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
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
                                  aria-busy={updateSessionTitleMutation.isPending || undefined}
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
                            <button
                              type="button"
                              onClick={() => void loadHistorySession(session)}
                              disabled={loadingHistorySessionId === session.id}
                              aria-current={activeSessionId === session.id ? "page" : undefined}
                              aria-label={lang === "ko" ? `상담 기록 열기: ${session.title}` : lang === "ja" ? `相談履歴を開く: ${session.title}` : `Open consultation history: ${session.title}`}
                              className="block w-full rounded text-left outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 disabled:cursor-wait disabled:opacity-60"
                              style={{ "--tw-ring-offset-color": isDark ? "oklch(0.17 0.015 240)" : "oklch(0.96 0.005 240)" } as React.CSSProperties}>
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
                            </button>
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
                          aria-busy={setChatSessionPinnedMutation.isPending || undefined}
                          className={`p-1 text-xs transition-opacity hover:opacity-75 disabled:opacity-45 ${session.isPinned === 1 ? "text-amber-400" : "opacity-60"}`}
                          title={session.isPinned === 1 ? (lang === "ko" ? "상단 고정 해제" : lang === "ja" ? "上部固定を解除" : "Unpin") : (lang === "ko" ? "상단에 고정" : lang === "ja" ? "上部に固定" : "Pin to top")}
                          aria-label={session.isPinned === 1 ? (lang === "ko" ? "상담 기록 상단 고정 해제" : lang === "ja" ? "相談履歴の上部固定を解除" : "Unpin consultation") : (lang === "ko" ? "상담 기록 상단에 고정" : lang === "ja" ? "相談履歴を上部に固定" : "Pin consultation to top")}>
                          aria-pressed={session.isPinned === 1}
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
                  <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2" style={{ borderColor: th.border }} role="navigation" aria-label={lang === "ko" ? "상담 기록 페이지 탐색" : lang === "ja" ? "相談履歴ページの移動" : "Consultation history pagination"}>
                    <button
                      type="button"
                      onClick={() => setHistorySessionPage(Math.max(1, activeHistorySessionPage - 1))}
                      disabled={activeHistorySessionPage === 1}
                      className="rounded border px-2 py-1 text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-35"
                      style={{ borderColor: th.border2, color: th.textMuted }}
                      aria-label={lang === "ko" ? "상담 기록 이전 페이지" : lang === "ja" ? "相談履歴の前のページ" : "Previous consultation history page"}>
                      {lang === "ko" ? "이전" : lang === "ja" ? "前へ" : "Previous"}
                    </button>
                    <span className="text-[10px] font-medium" style={{ color: th.textMuted }} role="status" aria-live="polite" aria-atomic="true" aria-label={lang === "ko" ? `상담 기록 ${activeHistorySessionPage} / ${historySessionTotalPages} 페이지` : lang === "ja" ? `相談履歴 ${activeHistorySessionPage} / ${historySessionTotalPages} ページ` : `Consultation history page ${activeHistorySessionPage} of ${historySessionTotalPages}`}>
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
              <div id="chat-feedback-panel" className="absolute inset-0 z-[570] flex flex-col border p-3 shadow-2xl backdrop-blur-md animate-fadeIn sm:inset-x-auto sm:right-4 sm:top-14 sm:bottom-2 sm:w-80 sm:rounded-xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="feedback-history-panel-title"
                aria-describedby="feedback-history-panel-description"
                style={{
                  background: isDark ? "oklch(0.14 0.02 240 / 0.95)" : "oklch(0.98 0.005 240 / 0.95)",
                  borderColor: "oklch(0.62 0.20 300 / 0.45)",
                  color: isDark ? "oklch(0.92 0.01 240)" : "oklch(0.12 0.01 240)",
                }}>
                <div className="flex items-start justify-between gap-2 pb-2 mb-2 border-b" style={{ borderColor: th.border }}>
                  <div className="min-w-0">
                    <h4 id="feedback-history-panel-title" className="text-xs font-bold flex items-center gap-1.5">
                      ✨ {lang === "ko" ? "피드백·재생성 히스토리" : lang === "ja" ? "フィードバック・再生成履歴" : "Feedback & Regeneration History"}
                    </h4>
                    <p id="feedback-history-panel-description" className="mt-0.5 text-[10px] leading-relaxed" style={{ color: th.textMuted }}>
                      {lang === "ko"
                        ? "남긴 평가와 사유, 그에 따라 다시 생성된 답변을 최신순으로 모아 봅니다."
                        : lang === "ja"
                          ? "残した評価と理由、それに応じて再生成された回答を新しい順に表示します。"
                          : "Your ratings, reasons, and the answers regenerated from them, newest first."}
                    </p>
                  </div>
                  <button
                    type="button"
                    ref={feedbackPanelCloseRef}
                    onClick={() => setShowFeedbackHistoryPanel(false)}
                    className="shrink-0 text-xs text-muted-foreground hover:opacity-70"
                    aria-label={lang === "ko" ? "피드백 이력 닫기" : lang === "ja" ? "フィードバック履歴を閉じる" : "Close feedback history"}>
                    ✕
                  </button>
                </div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1 rounded-lg border p-1" role="group" aria-label={lang === "ko" ? "피드백 이력 필터" : lang === "ja" ? "フィードバック履歴フィルター" : "Feedback history filters"} style={{ borderColor: th.border2, background: th.bgCard }}>
                    {([
                      { id: "all", ko: "전체", ja: "すべて", en: "All", icon: "☷" },
                      { id: "like", ko: "긍정", ja: "肯定", en: "Positive", icon: "👍" },
                      { id: "dislike", ko: "부정", ja: "否定", en: "Negative", icon: "👎" },
                    ] as const).map(filter => (
                      <button
                        key={filter.id}
                        type="button"
                        aria-pressed={feedbackHistoryFilter === filter.id}
                        onClick={() => {
                          setFeedbackHistoryFilter(filter.id);
                          if (filter.id !== "dislike") setFeedbackReasonFilter("all");
                        }}
                        className="rounded-md px-2 py-1 text-[9px] font-bold transition-all active:scale-95"
                        style={{
                          background: feedbackHistoryFilter === filter.id ? "oklch(0.62 0.20 300 / 0.20)" : "transparent",
                          color: feedbackHistoryFilter === filter.id ? (isDark ? "oklch(0.86 0.14 300)" : "oklch(0.42 0.20 300)") : th.textMuted,
                        }}>
                        {filter.icon} {lang === "ko" ? filter.ko : lang === "ja" ? filter.ja : filter.en}
                      </button>
                    ))}
                    {feedbackHistoryFilter !== "like" && negativeFeedbackCount > 0 && (
                      <>
                        <span className="mx-0.5 h-3 w-px" style={{ background: th.border2 }} aria-hidden="true" />
                        {([
                          { id: "all", ko: "사유 전체", ja: "理由すべて", en: "All reasons", icon: "☷", count: feedbackReasonCountScope.length },
                          { id: "inaccurate", ko: "정확성", ja: "正確性", en: "Accuracy", icon: "◎", count: feedbackReasonCounts.inaccurate },
                          { id: "insufficient", ko: "설명 부족", ja: "説明不足", en: "Detail", icon: "≡", count: feedbackReasonCounts.insufficient },
                          { id: "irrelevant", ko: "관련 없음", ja: "関連なし", en: "Relevance", icon: "↗", count: feedbackReasonCounts.irrelevant },
                          { id: "other", ko: "기타", ja: "その他", en: "Other", icon: "…", count: feedbackReasonCounts.other },
                        ] as const).map(filter => (
                          <button
                            key={`reason-${filter.id}`}
                            type="button"
                            aria-pressed={feedbackReasonFilter === filter.id}
                            onClick={() => setFeedbackReasonFilter(filter.id)}
                            title={lang === "ko" ? `부정 평가 사유: ${filter.ko}` : lang === "ja" ? `否定評価の理由: ${filter.ja}` : `Negative feedback reason: ${filter.en}`}
                            className="rounded-md px-2 py-1 text-[9px] font-bold transition-all active:scale-95"
                            style={{
                              background: feedbackReasonFilter === filter.id ? "oklch(0.62 0.20 300 / 0.20)" : "transparent",
                              color: feedbackReasonFilter === filter.id ? (isDark ? "oklch(0.86 0.14 300)" : "oklch(0.42 0.20 300)") : th.textMuted,
                            }}>
                            {filter.icon} {lang === "ko" ? filter.ko : lang === "ja" ? filter.ja : filter.en} <span className="opacity-70">{filter.count}</span>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                  {hasActiveFeedbackFilters && (
                    <button
                      type="button"
                      onClick={resetFeedbackHistoryFilters}
                      title={lang === "ko" ? "피드백 필터를 모두 초기화" : lang === "ja" ? "フィードバックフィルターをすべてリセット" : "Reset all feedback filters"}
                      className="rounded-lg border px-2 py-1 text-[9px] font-bold transition-all hover:opacity-80 active:scale-95"
                      style={{ borderColor: th.border2, color: th.textMuted, background: th.bgCard }}>
                      ↺ {lang === "ko" ? "필터 초기화" : lang === "ja" ? "フィルターをリセット" : "Reset filters"}
                    </button>
                  )}
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
                        ref={deleteAllFeedbackTriggerRef}
                        onClick={() => setShowDeleteAllFeedbackConfirm(true)}
                        className="rounded-lg border border-red-500/35 bg-red-500/10 px-2 py-1 text-[9px] font-bold text-red-400 transition-all hover:bg-red-500/20 active:scale-95">
                        🗑️ {lang === "ko" ? "전체 삭제" : lang === "ja" ? "すべて削除" : "Clear all"}
                      </button>
                    </div>
                  )}
                </div>
                <div className="relative mb-2">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px]">🔎</span>
                  <label className="sr-only" htmlFor="feedback-history-search">
                    {lang === "ko" ? "피드백 이력 검색" : lang === "ja" ? "フィードバック履歴を検索" : "Search feedback history"}
                  </label>
                  <input
                    id="feedback-history-search"
                    type="search"
                    enterKeyHint="search"
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
                      aria-label={lang === "ko" ? "피드백 검색 지우기" : lang === "ja" ? "フィードバック検索をクリア" : "Clear feedback search"}>
                      ✕
                    </button>
                  )}
                </div>
                <div className="mb-2 grid grid-cols-2 gap-1.5">
                  <label className="min-w-0">
                    <span className="mb-0.5 block text-[9px] font-bold" style={{ color: th.textMuted }}>{lang === "ko" ? "시작일" : lang === "ja" ? "開始日" : "From"}</span>
                    <input
                      type="date"
                      lang={lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US"}
                      value={feedbackHistoryStartDate}
                      max={feedbackHistoryEndDate || undefined}
                      onChange={event => { setFeedbackHistoryStartDate(event.target.value); setFeedbackHistoryDatePreset("custom"); }}
                      className="w-full rounded-lg border px-1.5 py-1 text-[10px] outline-none focus:ring-1 focus:ring-fuchsia-500"
                      style={{ background: th.bgCard, borderColor: th.border2, color: th.text }}
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="mb-0.5 block text-[9px] font-bold" style={{ color: th.textMuted }}>{lang === "ko" ? "종료일" : lang === "ja" ? "終了日" : "To"}</span>
                    <input
                      type="date"
                      lang={lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US"}
                      value={feedbackHistoryEndDate}
                      min={feedbackHistoryStartDate || undefined}
                      onChange={event => { setFeedbackHistoryEndDate(event.target.value); setFeedbackHistoryDatePreset("custom"); }}
                      className="w-full rounded-lg border px-1.5 py-1 text-[10px] outline-none focus:ring-1 focus:ring-fuchsia-500"
                      style={{ background: th.bgCard, borderColor: th.border2, color: th.text }}
                    />
                  </label>
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-1" role="group" aria-label={lang === "ko" ? "피드백 이력 빠른 기간" : lang === "ja" ? "フィードバック履歴のクイック期間" : "Feedback history quick period"}>
                  <span className="mr-0.5 text-[9px] font-bold" style={{ color: th.textMuted }}>{lang === "ko" ? "빠른 기간" : lang === "ja" ? "クイック期間" : "Quick period"}</span>
                  {([
                    { id: "all", ko: "전체", ja: "すべて", en: "All" },
                    { id: "today", ko: "오늘", ja: "今日", en: "Today" },
                    { id: "week", ko: "7일", ja: "7日", en: "7d" },
                    { id: "month", ko: "30일", ja: "30日", en: "30d" },
                  ] as const).map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={feedbackHistoryDatePreset === preset.id}
                      onClick={() => applyFeedbackDatePreset(preset.id)}
                      className="rounded border px-1.5 py-1 text-[9px] font-bold transition-all"
                      style={{
                        borderColor: feedbackHistoryDatePreset === preset.id ? "oklch(0.62 0.20 300 / 0.65)" : th.border2,
                        background: feedbackHistoryDatePreset === preset.id ? "oklch(0.62 0.20 300 / 0.16)" : "transparent",
                        color: feedbackHistoryDatePreset === preset.id ? (isDark ? "oklch(0.86 0.14 300)" : "oklch(0.42 0.20 300)") : th.textMuted,
                      }}>
                      {lang === "ko" ? preset.ko : lang === "ja" ? preset.ja : preset.en}
                    </button>
                  ))}
                </div>
                <div className="mb-2 flex items-center gap-1.5">
                  <select
                    value={feedbackHistorySort}
                    onChange={event => setFeedbackHistorySort(event.target.value as "newest" | "oldest")}
                    aria-label={lang === "ko" ? "피드백 이력 정렬" : lang === "ja" ? "フィードバック履歴の並び順" : "Feedback history sort order"}
                    className="min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-fuchsia-500"
                    style={{ background: th.bgCard, borderColor: th.border2, color: th.text }}>
                    <option value="newest">{lang === "ko" ? "정렬: 최신순" : lang === "ja" ? "並び順: 新しい順" : "Sort: Newest first"}</option>
                    <option value="oldest">{lang === "ko" ? "정렬: 과거순" : lang === "ja" ? "並び順: 古い順" : "Sort: Oldest first"}</option>
                  </select>
                  {(feedbackHistoryStartDate || feedbackHistoryEndDate) && (
                    <button
                      type="button"
                      onClick={() => applyFeedbackDatePreset("all")}
                      title={lang === "ko" ? "날짜 필터 초기화" : lang === "ja" ? "日付フィルターをリセット" : "Reset date filter"}
                      aria-label={lang === "ko" ? "피드백 이력 날짜 필터 초기화" : lang === "ja" ? "フィードバック履歴の日付フィルターをリセット" : "Reset feedback history date filter"}
                      className="rounded-lg border px-2 py-1.5 text-[10px] font-bold transition-all hover:opacity-80"
                      style={{ borderColor: th.border2, color: th.textMuted }}>
                      ↺
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void analyzeCurrentFeedbackKeywords()}
                    disabled={sortedFeedbackHistory.length === 0 || analyzeFeedbackKeywordsMutation.isPending}
                    aria-busy={analyzeFeedbackKeywordsMutation.isPending || undefined}
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
                    <div className="flex h-2.5 overflow-hidden rounded-full shadow-inner" role="progressbar" aria-label={lang === "ko" ? "피드백 긍정 비율" : lang === "ja" ? "フィードバックの肯定比率" : "Positive feedback ratio"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={animatedPositiveRatio} style={{ background: "oklch(0.60 0.05 240 / 0.18)" }}>
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
                      <button type="button" onClick={() => setFeedbackKeywordSummary(null)} className="text-[10px] hover:opacity-70" style={{ color: th.textMuted }} aria-label={lang === "ko" ? "핵심 키워드 요약 닫기" : lang === "ja" ? "主要キーワード要約を閉じる" : "Close key-term summary"}>✕</button>
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
                  <div ref={feedbackDeleteDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="feedback-delete-confirm-title" aria-describedby="feedback-delete-confirm-description" className="absolute inset-0 z-[590] flex flex-col items-center justify-center rounded-xl bg-black/80 p-4 text-center backdrop-blur-md animate-fadeIn">
                    <p id="feedback-delete-confirm-title" className="text-xs font-bold text-red-300">
                      ⚠️ {lang === "ko" ? "이 피드백 기록을 삭제할까요?" : lang === "ja" ? "このフィードバック履歴を削除しますか？" : "Delete this feedback record?"}
                    </p>
                    <p id="feedback-delete-confirm-description" className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                      {lang === "ko" ? "연결된 재생성 답변도 함께 삭제되며 되돌릴 수 없습니다." : lang === "ja" ? "関連する再生成回答も一緒に削除され、元に戻せません。" : "Its linked regenerated answer will also be removed permanently."}
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <button type="button" ref={feedbackDeleteCancelRef} onClick={() => setFeedbackToDelete(null)} className="rounded-lg border px-3 py-1.5 text-xs font-bold" style={{ borderColor: th.border2, color: th.textMuted }}>
                        {lang === "ko" ? "취소" : lang === "ja" ? "キャンセル" : "Cancel"}
                      </button>
                      <button
                        type="button"
                        disabled={deleteChatFeedbackMutation.isPending}
                        aria-busy={deleteChatFeedbackMutation.isPending || undefined}
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
                  <div ref={feedbackContextDialogRef} className="absolute inset-0 z-[600] flex flex-col rounded-xl bg-black/80 p-3 backdrop-blur-md animate-fadeIn" role="dialog" aria-modal="true" aria-labelledby="feedback-context-title" aria-describedby="feedback-context-description">
                    <div className="flex items-start justify-between gap-3 border-b pb-2" style={{ borderColor: th.border2 }}>
                      <div>
                        <h5 id="feedback-context-title" className="text-xs font-bold" style={{ color: th.text }}>
                          💬 {lang === "ko" ? "피드백 상담 맥락" : lang === "ja" ? "フィードバックの会話文脈" : "Feedback conversation context"}
                        </h5>
                        <p id="feedback-context-description" className="mt-0.5 text-[9px] leading-relaxed" style={{ color: th.textMuted }}>
                          {lang === "ko" ? "평가한 답변은 강조 표시됩니다. 현재 사용자 소유 세션의 메시지만 표시합니다." : lang === "ja" ? "評価した回答は強調表示されます。現在のユーザー所有セッションのメッセージのみ表示します。" : "The rated response is highlighted. Only messages from your current-user-owned session are shown."}
                        </p>
                      </div>
                      <button type="button" ref={feedbackContextCloseRef} onClick={() => setFeedbackContextItem(null)} className="shrink-0 rounded-md border px-2 py-1 text-[10px] font-bold transition-opacity hover:opacity-70" style={{ borderColor: th.border2, color: th.textMuted }} aria-label={lang === "ko" ? "상담 맥락 닫기" : lang === "ja" ? "会話文脈を閉じる" : "Close conversation context"}>✕</button>
                    </div>
                    <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                      {feedbackContextMessagesQuery.isLoading ? (
                        <div className="flex items-center justify-center gap-2 py-8 text-[10px]" role="status" aria-live="polite" aria-atomic="true" style={{ color: th.textMuted }}>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-fuchsia-400 border-t-transparent" aria-hidden="true" />
                          {lang === "ko" ? "상담 맥락을 불러오는 중..." : lang === "ja" ? "会話文脈を読み込み中..." : "Loading conversation context..."}
                        </div>
                      ) : feedbackContextMessagesQuery.isError ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-[10px]" role="alert" aria-atomic="true" style={{ color: th.textMuted }}>
                          <span aria-hidden="true" className="text-base">⚠️</span>
                          <p>{lang === "ko" ? "상담 맥락을 불러오지 못했습니다." : lang === "ja" ? "会話文脈を読み込めませんでした。" : "Could not load the conversation context."}</p>
                          <button type="button" onClick={() => void feedbackContextMessagesQuery.refetch()} disabled={feedbackContextMessagesQuery.isFetching} aria-busy={feedbackContextMessagesQuery.isFetching || undefined} aria-label={feedbackContextMessagesQuery.isFetching ? (lang === "ko" ? "상담 맥락 다시 불러오는 중" : lang === "ja" ? "会話文脈を再読み込み中" : "Retrying conversation context") : (lang === "ko" ? "상담 맥락 다시 시도" : lang === "ja" ? "会話文脈を再試行" : "Retry conversation context")} className="rounded-lg border px-2.5 py-1 text-[10px] font-bold disabled:opacity-45" style={{ borderColor: "oklch(0.62 0.20 300 / 0.45)", color: isDark ? "oklch(0.82 0.16 300)" : "oklch(0.45 0.20 300)" }}>
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
                  <div ref={deleteAllFeedbackConfirmDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="feedback-delete-all-confirm-title" aria-describedby="feedback-delete-all-confirm-description" className="absolute inset-0 z-[590] flex flex-col items-center justify-center rounded-xl bg-black/80 p-4 text-center backdrop-blur-md animate-fadeIn">
                    <p id="feedback-delete-all-confirm-title" className="text-xs font-bold text-red-300">
                      ⚠️ {lang === "ko" ? "모든 피드백 기록을 삭제할까요?" : lang === "ja" ? "すべてのフィードバック履歴を削除しますか？" : "Delete all feedback records?"}
                    </p>
                    <p id="feedback-delete-all-confirm-description" className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                      {lang === "ko" ? "좋아요·아쉬워요·사유와 재생성 답변을 포함한 모든 피드백 기록이 영구 삭제됩니다." : lang === "ja" ? "いいね・イマイチ・理由・再生成回答を含むすべての履歴が完全に削除されます。" : "All ratings, reasons, and regenerated answers will be permanently deleted."}
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <button type="button" ref={deleteAllFeedbackConfirmCancelRef} onClick={() => setShowDeleteAllFeedbackConfirm(false)} className="rounded-lg border px-3 py-1.5 text-xs font-bold" style={{ borderColor: th.border2, color: th.textMuted }}>
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
                  <div ref={deleteAllFeedbackFinalDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="feedback-delete-all-final-confirm-title" aria-describedby="feedback-delete-all-final-confirm-description" className="absolute inset-0 z-[595] flex flex-col items-center justify-center rounded-xl bg-black/90 p-4 text-center backdrop-blur-md animate-fadeIn">
                    <span aria-hidden="true" className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-red-500/20 text-lg">🛑</span>
                    <p id="feedback-delete-all-final-confirm-title" className="text-xs font-bold text-red-300">
                      {lang === "ko" ? "최종 확인: 모든 피드백을 영구 삭제할까요?" : lang === "ja" ? "最終確認：すべてのフィードバックを完全に削除しますか？" : "Final confirmation: permanently delete all feedback?"}
                    </p>
                    <p id="feedback-delete-all-final-confirm-description" className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                      {lang === "ko" ? "이 동작은 취소할 수 없습니다. 계속하려면 아래 '영구 삭제'를 눌러주세요." : lang === "ja" ? "この操作は取り消せません。続行するには下の「完全に削除」を押してください。" : "This cannot be undone. Press 'Delete permanently' below to continue."}
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <button type="button" ref={deleteAllFeedbackFinalCancelRef} onClick={() => setShowDeleteAllFeedbackFinalConfirm(false)} className="rounded-lg border px-3 py-1.5 text-xs font-bold" style={{ borderColor: th.border2, color: th.textMuted }}>
                        {lang === "ko" ? "취소" : lang === "ja" ? "キャンセル" : "Cancel"}
                      </button>
                      <button
                        type="button"
                        disabled={deleteAllChatFeedbacksMutation.isPending}
                        aria-busy={deleteAllChatFeedbacksMutation.isPending || undefined}
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
                    <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground" role="status" aria-live="polite" aria-atomic="true">
                      <div className="w-4 h-4 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" aria-hidden="true"></div>
                      <span>{lang === "ko" ? "피드백 이력 불러오는 중..." : lang === "ja" ? "フィードバック履歴を読み込み中..." : "Loading feedback history..."}</span>
                    </div>
                  ) : feedbackHistoryQuery.isError ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-[11px]" role="alert" aria-atomic="true" style={{ color: th.textMuted }}>
                      <span aria-hidden="true" className="text-base">⚠️</span>
                      <p>{lang === "ko" ? "피드백 이력을 불러오지 못했습니다." : lang === "ja" ? "フィードバック履歴を読み込めませんでした。" : "Could not load feedback history."}</p>
                      <button type="button" onClick={() => void feedbackHistoryQuery.refetch()} disabled={feedbackHistoryQuery.isFetching} aria-busy={feedbackHistoryQuery.isFetching || undefined} aria-label={feedbackHistoryQuery.isFetching ? (lang === "ko" ? "피드백 이력 다시 불러오는 중" : lang === "ja" ? "フィードバック履歴を再読み込み中" : "Retrying feedback history") : (lang === "ko" ? "피드백 이력 다시 시도" : lang === "ja" ? "フィードバック履歴を再試行" : "Retry feedback history")} className="rounded-lg border px-2.5 py-1 text-[10px] font-bold disabled:opacity-45" style={{ borderColor: "oklch(0.62 0.20 300 / 0.45)", color: isDark ? "oklch(0.82 0.16 300)" : "oklch(0.45 0.20 300)" }}>
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
                                ref={feedbackToDelete === item.id ? feedbackDeleteTriggerRef : undefined}
                                onClick={(event) => {
                                  feedbackDeleteTriggerRef.current = event.currentTarget;
                                  setFeedbackToDelete(item.id);
                                }}
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
                            ref={feedbackContextItem?.id === item.id ? feedbackContextTriggerRef : undefined}
                            onClick={(event) => {
                              feedbackContextTriggerRef.current = event.currentTarget;
                              setFeedbackContextItem({ id: item.id, sessionId: item.sessionId, messageId: item.messageId ?? null, messageContent: item.messageContent });
                            }}
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
                    <div className="flex items-center justify-between gap-2 border-t pt-2" style={{ borderColor: th.border2 }} role="navigation" aria-label={lang === "ko" ? "피드백 이력 페이지 탐색" : lang === "ja" ? "フィードバック履歴ページの移動" : "Feedback history pagination"}>
                      <button
                        type="button"
                        onClick={() => setFeedbackHistoryPage(page => Math.max(1, page - 1))}
                        disabled={feedbackHistoryPage === 1}
                        aria-label={lang === "ko" ? "피드백 이력 이전 페이지" : lang === "ja" ? "フィードバック履歴の前のページ" : "Previous feedback history page"}
                        className="rounded-md border px-2 py-1 text-[9px] font-bold disabled:opacity-35"
                        style={{ borderColor: th.border2, color: th.textMuted }}>
                        ← {lang === "ko" ? "이전" : lang === "ja" ? "前へ" : "Prev"}
                      </button>
                      <span className="text-[9px] font-bold" style={{ color: th.textMuted }} role="status" aria-live="polite" aria-atomic="true" aria-label={lang === "ko" ? `피드백 이력 ${feedbackHistoryPage} / ${feedbackHistoryTotalPages} 페이지` : lang === "ja" ? `フィードバック履歴 ${feedbackHistoryPage} / ${feedbackHistoryTotalPages} ページ` : `Feedback history page ${feedbackHistoryPage} of ${feedbackHistoryTotalPages}`}>
                        {feedbackHistoryPage} / {feedbackHistoryTotalPages} · {filteredFeedbackHistory.length}{lang === "ko" ? "건" : lang === "ja" ? "件" : " items"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFeedbackHistoryPage(page => Math.min(feedbackHistoryTotalPages, page + 1))}
                        disabled={feedbackHistoryPage === feedbackHistoryTotalPages}
                        aria-label={lang === "ko" ? "피드백 이력 다음 페이지" : lang === "ja" ? "フィードバック履歴の次のページ" : "Next feedback history page"}
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
            <div className="relative min-h-0 flex-1">
            <div
              ref={chatMessageListRef}
              role="log"
              aria-live="polite"
              aria-relevant="additions text"
              aria-busy={isChatLoading}
              aria-label={lang === "ko" ? "AI 상담 메시지" : lang === "ja" ? "AI相談メッセージ" : "AI consultation messages"}
              aria-describedby="chat-message-log-help"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Home") {
                  event.preventDefault();
                  event.currentTarget.scrollTo({ top: 0, behavior: getKeyboardScrollBehavior() });
                }
                if (event.key === "End") {
                  event.preventDefault();
                  event.currentTarget.scrollTo({ top: event.currentTarget.scrollHeight, behavior: getKeyboardScrollBehavior() });
                  isChatNearBottomRef.current = true;
                  setIsChatAwayFromLatest(false);
                  setUnreadChatMessageCount(0);
                }
              }}
              onScroll={(event) => {
                const element = event.currentTarget;
                const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 56;
                isChatNearBottomRef.current = isNearBottom;
                setIsChatAwayFromLatest(!isNearBottom);
                if (isNearBottom) setUnreadChatMessageCount(0);
              }}
              className="h-full overflow-y-auto space-y-3 p-3 sm:p-4 custom-scrollbar">
              <span id="chat-message-log-help" className="sr-only">
                {lang === "ko" ? "이 메시지 영역에 포커스를 둔 뒤 Home 키로 처음 메시지, End 키로 최신 메시지로 이동할 수 있습니다." : lang === "ja" ? "このメッセージ領域にフォーカスして、Homeキーで最初のメッセージ、Endキーで最新メッセージへ移動できます。" : "When this message area is focused, use Home to move to the first message and End to move to the latest message."}
              </span>
              {/* 여기서부터 메시지 목록 */}
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex items-end gap-1.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role !== "user" && (
                    <span className="text-[9px] text-muted-foreground pb-1 shrink-0">
                      {new Date(msg.timestamp).toLocaleTimeString(chatTimeLocale, { hour: '2-digit', minute: '2-digit' })}
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
                      {msg.usedFallback && (
                        <div role="status" aria-live="polite" aria-atomic="true" className="mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
                          style={{ background: "oklch(0.76 0.14 82 / 0.14)", color: isDark ? "oklch(0.84 0.13 82)" : "oklch(0.44 0.13 62)", border: "1px solid oklch(0.76 0.14 82 / 0.35)" }}>
                          🛡 {lang === "ko" ? "실시간 수치 기반 기본 안전 진단" : lang === "ja" ? "リアルタイム数値に基づく基本安全診断" : "Live-measurement safety fallback"}
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
                                ref={activeManualSource?.documentId === source.documentId && activeManualSource.chunkIndex === source.chunkIndex ? manualSourceTriggerRef : undefined}
                                onClick={(event) => {
                                  manualSourceTriggerRef.current = event.currentTarget;
                                  setActiveManualSource(source);
                                }}
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
                            const copied = await copyTextWithFallback(msg.content);
                            if (copied) {
                              setCopiedIndex(idx);
                              setTimeout(() => setCopiedIndex(null), 2000);
                            } else {
                              toast.error(lang === "ko" ? "답변을 복사하지 못했습니다. 브라우저 권한을 확인해주세요." : lang === "ja" ? "回答をコピーできませんでした。ブラウザーの権限を確認してください。" : "Could not copy the reply. Check browser permissions.");
                            }
                          }}
                          className="px-2 py-0.5 rounded text-[10px] border transition-all flex items-center gap-1 opacity-70 hover:opacity-100 shadow-sm"
                          style={{ background: th.bgCard, borderColor: th.border2, color: th.textMuted }}>
                          <span>{copiedIndex === idx ? "✅" : "📋"}</span>
                          <span>{copiedIndex === idx ? (lang === "ko" ? "복사됨" : lang === "ja" ? "コピー済" : "Copied") : (lang === "ko" ? "복사" : lang === "ja" ? "コピー" : "Copy")}</span>
                        </button>
                        <div className="flex flex-wrap items-center gap-1" role="group" aria-label={lang === "ko" ? "AI 답변 평가" : lang === "ja" ? "AI回答の評価" : "AI answer feedback"}>
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
                            aria-label={lang === "ko" ? "AI 답변이 도움이 됨" : lang === "ja" ? "AI回答が役に立った" : "AI answer was helpful"}
                            aria-pressed={messageFeedbacks[idx] === "like"}
                            className={`px-1.5 py-0.5 rounded text-[10px] border transition-all ${
                              messageFeedbacks[idx] === "like" ? "bg-emerald-500/20 border-emerald-500 text-emerald-500 font-bold" : "opacity-60 hover:opacity-100"
                            }`}
                            style={{ borderColor: messageFeedbacks[idx] === "like" ? undefined : th.border2, background: messageFeedbacks[idx] === "like" ? undefined : th.bgCard, color: messageFeedbacks[idx] === "like" ? undefined : th.textMuted }}>
                            👍 {messageFeedbacks[idx] === "like" && "1"}
                          </button>
                          <div className="relative">
                            <button
                              type="button"
                              ref={activeDislikeIdx === idx ? dislikeReasonTriggerRef : undefined}
                              onClick={(event) => {
                                const nextState = messageFeedbacks[idx] === "dislike" ? undefined : "dislike";
                                setMessageFeedbacks(prev => ({
                                  ...prev,
                                  [idx]: nextState as any,
                                }));
                                if (nextState === "dislike") {
                                  dislikeReasonTriggerRef.current = event.currentTarget;
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
                              aria-label={lang === "ko" ? "AI 답변이 도움이 되지 않음" : lang === "ja" ? "AI回答が役に立たなかった" : "AI answer was not helpful"}
                              aria-pressed={messageFeedbacks[idx] === "dislike"}
                              className={`px-1.5 py-0.5 rounded text-[10px] border transition-all ${
                                messageFeedbacks[idx] === "dislike" ? "bg-rose-500/20 border-rose-500 text-rose-500 font-bold" : "opacity-60 hover:opacity-100"
                              }`}
                              style={{ borderColor: messageFeedbacks[idx] === "dislike" ? undefined : th.border2, background: messageFeedbacks[idx] === "dislike" ? undefined : th.bgCard, color: messageFeedbacks[idx] === "dislike" ? undefined : th.textMuted }}>
                              👎 {messageFeedbacks[idx] === "dislike" && "1"}
                            </button>

                            {/* 싫어요 사유 선택 소형 팝업 */}
                            {activeDislikeIdx === idx && (
                              <div
                                ref={dislikeReasonDialogRef}
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby={`feedback-reason-title-${idx}`}
                                className="absolute left-0 bottom-full mb-2 z-50 w-64 p-2.5 rounded-xl shadow-xl border animate-fadeIn"
                                style={{ background: isDark ? "oklch(0.15 0.02 240)" : "oklch(0.98 0.005 240)", borderColor: th.border2 }}>
                                <div className="flex items-center justify-between mb-2">
                                  <span id={`feedback-reason-title-${idx}`} className="text-[10px] font-bold" style={{ color: th.text }}>
                                    {lang === "ko" ? "어떤 점이 아쉬우셨나요?" : lang === "ja" ? "どの点が物足りなかったですか？" : "What was missing?"}
                                  </span>
                                  <button
                                    type="button"
                                    ref={dislikeReasonCloseRef}
                                    onClick={() => setActiveDislikeIdx(null)}
                                    aria-label={lang === "ko" ? "피드백 사유 선택 닫기" : lang === "ja" ? "フィードバック理由の選択を閉じる" : "Close feedback reason selection"}
                                    className="text-[10px] hover:opacity-70 px-1" style={{ color: th.textMuted }}>
                                    ✕
                                  </button>
                                </div>
                                <div className="flex flex-col gap-1" role="group" aria-label={lang === "ko" ? "부정 피드백 사유" : lang === "ja" ? "否定的なフィードバックの理由" : "Negative feedback reason"}>
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
                                      aria-expanded={reasonItem.id === "other" ? otherReasonIdx === idx : undefined}
                                      aria-controls={reasonItem.id === "other" ? `feedback-other-details-${idx}` : undefined}
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
                                    <div id={`feedback-other-details-${idx}`} className="mt-1.5 border-t pt-2" style={{ borderColor: th.border2 }}>
                                      <textarea
                                        value={otherFeedbackText}
                                        onChange={(event) => setOtherFeedbackText(event.target.value)}
                                        enterKeyHint="done"
                                        aria-label={lang === "ko" ? "기타 피드백 내용" : lang === "ja" ? "その他のフィードバック内容" : "Other feedback details"}
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
                      {new Date(msg.timestamp).toLocaleTimeString(chatTimeLocale, { hour: '2-digit', minute: '2-digit' })}
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
                      {chatLoadingElapsedSeconds >= 5 && (
                        <span className="ml-1 text-[10px] opacity-75">
                          {lang === "ko" ? `${chatLoadingElapsedSeconds}초 경과` : lang === "ja" ? `${chatLoadingElapsedSeconds}秒経過` : `${chatLoadingElapsedSeconds}s elapsed`}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
            {isChatAwayFromLatest && (
              <button
                type="button"
                onClick={() => {
                  const messageList = chatMessageListRef.current;
                  if (messageList) messageList.scrollTo({ top: messageList.scrollHeight, behavior: getKeyboardScrollBehavior() });
                  isChatNearBottomRef.current = true;
                  setIsChatAwayFromLatest(false);
                  setUnreadChatMessageCount(0);
                }}
                className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-full border px-3 py-1.5 text-[10px] font-bold shadow-lg transition-all hover:opacity-85 active:scale-95"
                style={{ borderColor: "oklch(0.65 0.18 200 / 0.55)", background: isDark ? "oklch(0.20 0.03 230 / 0.96)" : "oklch(0.98 0.005 240 / 0.96)", color: isDark ? "oklch(0.78 0.14 200)" : "oklch(0.40 0.16 220)" }}
                aria-label={unreadChatMessageCount > 0
                  ? (lang === "ko" ? `최신 메시지로 이동, 새 답변 ${unreadChatMessageCount}개` : lang === "ja" ? `最新メッセージへ移動、新しい回答 ${unreadChatMessageCount}件` : `Jump to latest message, ${unreadChatMessageCount} new answers`)
                  : (lang === "ko" ? "최신 메시지로 이동" : lang === "ja" ? "最新メッセージへ移動" : "Jump to latest message")}>
                ↓ {unreadChatMessageCount > 0
                  ? (lang === "ko" ? `새 답변 ${unreadChatMessageCount}` : lang === "ja" ? `新着 ${unreadChatMessageCount}` : `New ${unreadChatMessageCount}`)
                  : (lang === "ko" ? "최신" : lang === "ja" ? "最新" : "Latest")}
              </button>
            )}
            </div>

            {/* 빠른 질문 칩 영역 */}
            <div
              className="flex gap-1.5 overflow-x-auto scroll-smooth border-t px-3 py-2 sm:px-4 custom-scrollbar"
              style={{ borderColor: th.border, background: th.bgCard2 }}
              role="region"
              tabIndex={0}
              aria-label={lang === "ko" ? "위험 상태 맞춤 빠른 질문" : lang === "ja" ? "リスク状態に合わせた推奨質問" : "Risk-aware quick questions"}
              aria-describedby="chat-quick-prompt-help"
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                  event.preventDefault();
                  event.currentTarget.scrollBy({ left: event.key === "ArrowRight" ? 180 : -180, behavior: getKeyboardScrollBehavior() });
                }
              }}>
              <span id="chat-quick-prompt-help" className="sr-only">
                {lang === "ko" ? "모바일에서는 좌우로 밀어 더 많은 추천 질문을 확인할 수 있습니다. 이 영역에 포커스한 뒤 좌우 화살표 키로도 이동할 수 있습니다." : lang === "ja" ? "モバイルでは左右にスワイプして、より多くの推奨質問を確認できます。この領域にフォーカスして左右の矢印キーでも移動できます。" : "On mobile, swipe left or right to view more suggested questions. When this region is focused, use the left and right arrow keys to scroll."}
              </span>
              <span className="flex shrink-0 items-center px-1 text-[9px] font-bold whitespace-nowrap" style={{ color: RISK_COLORS[riskLevel] }}>
                {lang === "ko" ? `${t[riskLevel]} 상태 추천` : lang === "ja" ? `${t[riskLevel]}状態の推奨` : `${t[riskLevel]} recommendations`}
              </span>
              {quickChatPrompts.map((chip, cIdx) => (
                <button
                  key={cIdx}
                  type="button"
                  onClick={() => {
                    setQuickPromptStatus(lang === "ko" ? `추천 질문을 전송합니다: ${chip}` : lang === "ja" ? `推奨質問を送信します: ${chip}` : `Sending recommended question: ${chip}`);
                    void handleSendChatMessage(chip);
                  }}
                  disabled={isChatLoading}
                  aria-label={lang === "ko" ? `${t[riskLevel]} 상태 추천 질문: ${chip}` : lang === "ja" ? `${t[riskLevel]}状態の推奨質問: ${chip}` : `${t[riskLevel]} recommendation: ${chip}`}
                  className="whitespace-nowrap px-2.5 py-1 rounded-full border text-[11px] transition-all hover:opacity-80 disabled:opacity-50"
                  style={{ borderColor: RISK_BORDER[riskLevel], color: RISK_COLORS[riskLevel], background: RISK_BG[riskLevel] }}>
                  💡 {chip}
                </button>
              ))}
              <span className="sr-only" aria-live="polite" aria-atomic="true">{quickPromptStatus}</span>
            </div>

            {/* 입력 폼 영역 */}
            <div className="flex flex-col gap-2 border-t px-2.5 pb-[max(0.625rem,calc(env(safe-area-inset-bottom)+0.5rem))] pt-2.5 sm:flex-row sm:items-end sm:p-4" style={{ borderColor: th.border, background: th.bgCard }}>
              <textarea
                rows={1}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                enterKeyHint="send"
                aria-label={lang === "ko" ? "AI 상담 메시지" : lang === "ja" ? "AI相談メッセージ" : "AI consultation message"}
                aria-describedby="chat-input-help"
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
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
              <span id="chat-input-help" className="sr-only">
                {lang === "ko" ? "Enter 키로 전송하고 Shift와 Enter 키를 함께 누르면 줄바꿈합니다." : lang === "ja" ? "Enterキーで送信し、ShiftキーとEnterキーを同時に押すと改行します。" : "Press Enter to send. Press Shift and Enter together to add a new line."}
              </span>
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
                <div ref={manualSourceDialogRef} role="dialog" aria-modal="true" aria-labelledby="manual-source-title" aria-describedby="manual-source-description" className="w-full max-w-md max-h-[85%] overflow-hidden rounded-2xl border shadow-2xl flex flex-col"
                  style={{ background: isDark ? "oklch(0.15 0.02 240)" : "oklch(0.99 0.003 240)", borderColor: "oklch(0.72 0.15 75 / 0.45)" }}
                  onClick={event => event.stopPropagation()}>
                  <div className="flex items-start justify-between gap-2 border-b px-4 py-3" style={{ borderColor: th.border2 }}>
                    <div className="min-w-0">
                      <p id="manual-source-description" className="text-[10px] font-bold" style={{ color: isDark ? "oklch(0.86 0.14 80)" : "oklch(0.46 0.16 75)" }}>
                        📘 {lang === "ko" ? "설비 매뉴얼 원문" : lang === "ja" ? "設備マニュアル原文" : "Manual Source"} [{activeManualSource.label}]
                      </p>
                      <h4 id="manual-source-title" className="mt-1 truncate text-sm font-bold" style={{ color: th.text }}>{activeManualSource.documentTitle}</h4>
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
                    <button type="button" ref={manualSourceCloseRef} onClick={() => setActiveManualSource(null)} className="shrink-0 text-sm hover:opacity-70" style={{ color: th.textMuted }} aria-label={lang === "ko" ? "매뉴얼 원문 닫기" : lang === "ja" ? "マニュアル原文を閉じる" : "Close manual source"}>✕</button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
                    <p className="whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: th.text }}>{activeManualSource.content}</p>
                  </div>
                  <div className="flex justify-end gap-2 border-t px-4 py-2.5" style={{ borderColor: th.border2 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const copied = await copyTextWithFallback(activeManualSource.content);
                          if (!copied) throw new Error("Clipboard copy failed");
                          toast.success(lang === "ko" ? "매뉴얼 원문을 복사했습니다." : lang === "ja" ? "マニュアル原文をコピーしました。" : "Manual text copied.");
                        } catch (error) {
                          console.error("Manual copy failed:", error);
                          toast.error(lang === "ko" ? "원문을 복사하지 못했습니다." : lang === "ja" ? "原文をコピーできませんでした。" : "Could not copy the source.");
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
      <div className="flex border-b px-5" role="tablist" aria-label={lang === "ko" ? "대시보드 보기 전환" : lang === "ja" ? "ダッシュボード表示の切り替え" : "Dashboard view switcher"} aria-orientation="horizontal" style={{ borderColor: th.border }}>
        {(["dashboard", "log"] as const).map(tab => (
          <button key={tab} type="button" id={`dashboard-tab-${tab}`} role="tab" aria-selected={activeTab === tab} aria-controls={`dashboard-panel-${tab}`} tabIndex={activeTab === tab ? 0 : -1} onClick={() => setActiveTab(tab)}
            onKeyDown={(event) => {
              const nextTab = event.key === "Home" ? "dashboard" : event.key === "End" ? "log" : event.key === "ArrowRight" ? (tab === "dashboard" ? "log" : "dashboard") : event.key === "ArrowLeft" ? (tab === "dashboard" ? "log" : "dashboard") : null;
              if (!nextTab) return;
              event.preventDefault();
              setActiveTab(nextTab);
              window.requestAnimationFrame(() => document.getElementById(`dashboard-tab-${nextTab}`)?.focus());
            }}
            className="px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 mr-1"
            style={{
              borderColor: activeTab === tab ? "oklch(0.65 0.18 200)" : "transparent",
              color: activeTab === tab ? "oklch(0.65 0.18 200)" : "oklch(0.50 0.01 240)",
            }}>
            {tab === "dashboard" ? t.dashboard : t.anomalyLog}
          </button>
        ))}
      </div>

      <main id="dashboard-main" tabIndex={-1} aria-busy={safetyMonitoringInitializing} className="flex-1 p-3 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:p-5 sm:pb-5 focus:outline-none">
        <div id={`dashboard-panel-${activeTab}`} role="tabpanel" aria-labelledby={`dashboard-tab-${activeTab}`}>
        {activeTab === "dashboard" ? (
          <>
            <div className="mb-4 flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between" style={{ background: th.bgCard, borderColor: th.border }}>
              <div className="min-w-0">
                <p className="text-xs font-bold" style={{ color: th.text }}>{lang === "ko" ? "기간별 운영 분석" : lang === "ja" ? "期間別の運用分析" : "Period-based operations analysis"}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{lang === "ko" ? "선택한 기간의 센서 이력, 탐지·위험 통계와 시연 가정 기반 예상 절감 비용을 표시합니다." : lang === "ja" ? "選択した期間のセンサー履歴、検知・危険統計とデモ仮定に基づく予想削減コストを表示します。" : "Shows sensor history, detection and risk statistics, and expected savings based on a demo assumption."}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs font-semibold" style={{ color: th.text }}>
                <label className="flex items-center gap-2">
                  <span>{lang === "ko" ? "분석 기간" : lang === "ja" ? "分析期間" : "Analysis period"}</span>
                  <select value={dashboardPeriod} onChange={event => handleDashboardPeriodChange(event.target.value as "day" | "week" | "month" | "custom")} disabled={periodOverviewQuery.isFetching} aria-busy={showPeriodSkeleton} className="h-9 rounded-lg border px-2 text-xs font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-wait disabled:opacity-60" style={{ color: th.text, background: th.bgCard2, borderColor: th.border2 }}>
                    <option value="day">{lang === "ko" ? "일간 · 최근 24시간" : lang === "ja" ? "日間・直近24時間" : "Daily · Last 24 hours"}</option>
                    <option value="week">{lang === "ko" ? "주간 · 최근 7일" : lang === "ja" ? "週間・直近7日間" : "Weekly · Last 7 days"}</option>
                    <option value="month">{lang === "ko" ? "월간 · 최근 30일" : lang === "ja" ? "月間・直近30日間" : "Monthly · Last 30 days"}</option>
                    <option value="custom">{lang === "ko" ? "사용자 지정 기간" : lang === "ja" ? "カスタム期間" : "Custom range"}</option>
                  </select>
                </label>
                {dashboardPeriod === "custom" && <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border p-2 sm:w-auto" style={{ borderColor: th.border2, background: th.bgCard2 }}>
                  <label className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: th.textMuted }}>
                    <span>{lang === "ko" ? "시작" : lang === "ja" ? "開始" : "Start"}</span>
                    <input type="date" lang={lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US"} value={customStartDate} max={customEndDate || todayDateValue} onChange={event => setCustomStartDate(event.target.value)} className="h-8 rounded border px-1.5 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" style={{ color: th.text, background: th.bgCard, borderColor: th.border2, colorScheme: isDark ? "dark" : "light" }} />
                  </label>
                  <span aria-hidden="true" style={{ color: th.textMuted }}>–</span>
                  <label className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: th.textMuted }}>
                    <span>{lang === "ko" ? "종료" : lang === "ja" ? "終了" : "End"}</span>
                    <input type="date" lang={lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US"} value={customEndDate} min={customStartDate} max={todayDateValue} onChange={event => setCustomEndDate(event.target.value)} className="h-8 rounded border px-1.5 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" style={{ color: th.text, background: th.bgCard, borderColor: th.border2, colorScheme: isDark ? "dark" : "light" }} />
                  </label>
                  <button type="button" onClick={applyCustomPeriod} disabled={periodOverviewQuery.isFetching || !customStartDate || !customEndDate || customStartDate > customEndDate} aria-busy={periodOverviewQuery.isFetching || undefined} aria-label={periodOverviewQuery.isFetching ? (lang === "ko" ? "사용자 지정 기간 데이터를 불러오는 중" : lang === "ja" ? "カスタム期間データを読み込み中" : "Loading custom period data") : (lang === "ko" ? "사용자 지정 기간 적용" : lang === "ja" ? "カスタム期間を適用" : "Apply custom period")} className="h-8 rounded border px-2 text-[10px] font-bold transition-all hover:opacity-85 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-45" style={{ borderColor: "oklch(0.65 0.18 200 / 0.45)", color: isDark ? "oklch(0.78 0.15 200)" : "oklch(0.38 0.16 220)", background: "oklch(0.65 0.18 200 / 0.08)" }}>
                    {lang === "ko" ? "적용" : lang === "ja" ? "適用" : "Apply"}
                  </button>
                  <span className="h-5 w-px" aria-hidden="true" style={{ background: th.border2 }} />
                  <label className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: th.textMuted }}>
                    <span className="sr-only">{lang === "ko" ? "기간 프리셋 이름" : lang === "ja" ? "期間プリセット名" : "Period preset name"}</span>
                    <input value={customPeriodPresetName} maxLength={40} onChange={event => setCustomPeriodPresetName(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); saveCustomPeriodPreset(); } }} aria-label={lang === "ko" ? "사용자 지정 기간 프리셋 이름" : lang === "ja" ? "カスタム期間プリセット名" : "Custom period preset name"} enterKeyHint="done" placeholder={lang === "ko" ? "프리셋 이름" : lang === "ja" ? "プリセット名" : "Preset name"} className="h-8 w-24 rounded border px-1.5 text-[11px] outline-none placeholder:opacity-60 focus-visible:ring-2 focus-visible:ring-cyan-300 sm:w-28" style={{ color: th.text, background: th.bgCard, borderColor: th.border2 }} />
                  </label>
                  <button type="button" onClick={saveCustomPeriodPreset} disabled={!customPeriodPresetName.trim() || !customStartDate || !customEndDate || customStartDate > customEndDate} aria-label={lang === "ko" ? "사용자 지정 기간 프리셋 저장" : lang === "ja" ? "カスタム期間プリセットを保存" : "Save custom period preset"} className="h-8 rounded border px-2 text-[10px] font-bold transition-all hover:opacity-85 active:scale-95 focus-visible:outline-none focus:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-45" style={{ borderColor: th.border2, color: th.text, background: th.bgCard }}>
                    {lang === "ko" ? "저장" : lang === "ja" ? "保存" : "Save"}
                  </button>
                  {customPeriodPresets.length > 0 && <div className="flex w-full flex-wrap items-center gap-1.5 border-t pt-2" style={{ borderColor: th.border2 }} role="group" aria-label={lang === "ko" ? "저장된 기간 프리셋" : lang === "ja" ? "保存済みの期間プリセット" : "Saved period presets"}>
                    <span className="mr-0.5 text-[10px] font-bold" style={{ color: th.textMuted }}>{lang === "ko" ? "빠른 적용" : lang === "ja" ? "クイック適用" : "Quick apply"}</span>
                    {customPeriodPresets.map(preset => <div key={preset.id} className="flex items-center overflow-hidden rounded border" style={{ borderColor: th.border2, background: th.bgCard }}>
                      <button type="button" onClick={() => applyCustomPeriodPreset(preset)} aria-label={lang === "ko" ? `${preset.name} 기간 프리셋 적용, ${preset.startDate}부터 ${preset.endDate}` : lang === "ja" ? `${preset.name} 期間プリセットを適用、${preset.startDate}から${preset.endDate}` : `Apply ${preset.name} period preset, ${preset.startDate} to ${preset.endDate}`} className="h-7 px-2 text-[10px] font-bold transition-colors hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" style={{ color: th.text }} title={`${preset.startDate} – ${preset.endDate}`}>{preset.name}</button>
                      <button type="button" onClick={() => deleteCustomPeriodPreset(preset.id)} className="h-7 border-l px-1.5 text-[11px] font-bold transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" style={{ borderColor: th.border2, color: isDark ? "oklch(0.76 0.18 25)" : "oklch(0.52 0.19 25)" }} aria-label={lang === "ko" ? `${preset.name} 프리셋 삭제` : lang === "ja" ? `${preset.name} プリセットを削除` : `Delete ${preset.name} preset`}>×</button>
                    </div>)}
                  </div>}
                </div>}
                <button type="button" onClick={exportSelectedPeriodCsv} disabled={!selectedPeriodStats || periodOverviewQuery.isFetching} aria-busy={periodOverviewQuery.isFetching || undefined} aria-label={periodOverviewQuery.isFetching ? (lang === "ko" ? "기간 분석 데이터를 불러오는 중" : lang === "ja" ? "期間分析データを読み込み中" : "Loading period analysis data") : (lang === "ko" ? "기간 분석 CSV 내보내기" : lang === "ja" ? "期間分析CSVを出力" : "Export period analysis CSV")} className="h-9 rounded-lg border px-2.5 text-[11px] font-bold transition-all hover:-translate-y-0.5 hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-45" style={{ borderColor: "oklch(0.65 0.18 200 / 0.45)", color: isDark ? "oklch(0.78 0.15 200)" : "oklch(0.38 0.16 220)", background: isDark ? "oklch(0.65 0.18 200 / 0.09)" : "oklch(0.65 0.18 200 / 0.06)" }}>
                  ↓ CSV
                </button>
                <button type="button" onClick={exportSelectedPeriodPdf} disabled={!selectedPeriodStats || periodOverviewQuery.isFetching || pdfExporting} aria-busy={pdfExporting || periodOverviewQuery.isFetching || undefined} aria-label={pdfExporting ? (lang === "ko" ? "PDF 보고서를 준비하는 중" : lang === "ja" ? "PDFレポートを準備中" : "Preparing PDF report") : periodOverviewQuery.isFetching ? (lang === "ko" ? "기간 분석 데이터를 불러오는 중" : lang === "ja" ? "期間分析データを読み込み中" : "Loading period analysis data") : (lang === "ko" ? "기간 PDF 보고서 내보내기" : lang === "ja" ? "期間PDFレポートを出力" : "Export period PDF report")} className="h-9 rounded-lg border px-2.5 text-[11px] font-bold transition-all hover:-translate-y-0.5 hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-45" style={{ borderColor: "oklch(0.68 0.16 155 / 0.45)", color: isDark ? "oklch(0.78 0.15 155)" : "oklch(0.35 0.14 155)", background: isDark ? "oklch(0.68 0.16 155 / 0.09)" : "oklch(0.68 0.16 155 / 0.06)" }}>
                  {pdfExporting ? (lang === "ko" ? "준비 중" : lang === "ja" ? "準備中" : "Preparing") : (lang === "ko" ? "PDF 보고서" : lang === "ja" ? "PDFレポート" : "PDF report")}
                </button>
                <button type="button" onClick={() => void copyReportShareLink()} className="h-9 rounded-lg border px-2.5 text-[11px] font-bold transition-all hover:-translate-y-0.5 hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" style={{ borderColor: th.border2, color: th.text, background: th.bgCard }} aria-label={lang === "ko" ? "로그인 보호 분석 기간 링크 복사" : lang === "ja" ? "ログイン保護された分析期間リンクをコピー" : "Copy login-protected analysis period link"}>
                  {lang === "ko" ? "링크 복사" : lang === "ja" ? "リンクをコピー" : "Copy link"}
                </button>
                <button type="button" onClick={composeReportEmail} className="h-9 rounded-lg border px-2.5 text-[11px] font-bold transition-all hover:-translate-y-0.5 hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" style={{ borderColor: th.border2, color: th.text, background: th.bgCard }} aria-label={lang === "ko" ? "분석 기간 링크가 포함된 이메일 작성" : lang === "ja" ? "分析期間リンクを含むメールを作成" : "Compose email with analysis period link"}>
                  {lang === "ko" ? "이메일" : lang === "ja" ? "メール" : "Email"}
                </button>
              </div>
            </div>
            {/* 임팩트 통계 섹션 */}
            {showPeriodSkeleton ? (
              <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4" role="status" aria-live="polite" aria-atomic="true" aria-label={lang === "ko" ? "선택한 기간의 통계를 불러오는 중" : lang === "ja" ? "選択した期間の統計を読み込み中" : "Loading statistics for the selected period"}>
                {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-[102px] animate-pulse rounded-xl border p-4" style={{ borderColor: th.border, background: th.bgCard }}><div className="h-2.5 w-16 rounded-full" style={{ background: th.border2 }} /><div className="mt-5 h-7 w-20 rounded-md" style={{ background: th.border2 }} /><div className="mt-3 h-2 w-24 rounded-full" style={{ background: th.border }} /></div>)}
                <span className="sr-only">{lang === "ko" ? "기간별 통계를 불러오는 중입니다." : lang === "ja" ? "期間別統計を読み込んでいます。" : "Loading period statistics."}</span>
              </div>
            ) : <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <ImpactCard label={t.totalVisitors} value={periodOverviewQuery.isError ? "—" : (selectedPeriodStats?.totalVisitors ?? 0)} icon="👥" color="#38bdf8" isLoading={statsInitialLoading} loadingLabel={statsLoadingLabel} detail={`${selectedPeriodLabel} · ${t.totalVisitors}: ${(selectedPeriodStats?.totalVisitors ?? 0).toLocaleString()}`} />
              <ImpactCard label={t.totalDetections} value={periodOverviewQuery.isError ? "—" : (selectedPeriodStats?.totalDetections ?? 0)} icon="📊" color="#a78bfa" isLoading={statsInitialLoading} loadingLabel={statsLoadingLabel} detail={`${selectedPeriodLabel} · ${t.totalDetections}: ${(selectedPeriodStats?.totalDetections ?? 0).toLocaleString()} · ${lang === "ko" ? "이상" : lang === "ja" ? "異常" : "Anomalies"}: ${(selectedPeriodStats?.anomalyCount ?? 0).toLocaleString()}`} />
              <ImpactCard label={t.dangerCount} value={periodOverviewQuery.isError ? "—" : (selectedPeriodStats?.dangerCount ?? 0)} icon="⚠️" color="#ef4444" isLoading={statsInitialLoading} loadingLabel={statsLoadingLabel} detail={`${selectedPeriodLabel} · ${t.dangerCount}: ${(selectedPeriodStats?.dangerCount ?? 0).toLocaleString()}`} />
              <ImpactCard label={t.uptimePct} value={periodOverviewQuery.isError ? "—" : `${selectedPeriodStats?.uptimePct ?? 100}%`} icon="✅" color="#22c55e" isLoading={statsInitialLoading} loadingLabel={statsLoadingLabel} detail={`${selectedPeriodLabel} · ${t.uptimePct}: ${selectedPeriodStats?.uptimePct ?? 100}%`} />
            </div>}

            {isUsageMetricsAdmin && <section className="mb-6 rounded-xl border p-3 sm:p-4" aria-labelledby="product-usage-metrics-title" style={{ borderColor: "oklch(0.64 0.15 285 / 0.40)", background: isDark ? "oklch(0.18 0.03 285 / 0.32)" : "oklch(0.97 0.02 285 / 0.38)" }}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 id="product-usage-metrics-title" className="text-xs font-bold" style={{ color: th.text }}>{lang === "ko" ? "대회용 제품 사용 지표" : lang === "ja" ? "大会向けプロダクト利用指標" : "Competition product usage metrics"}</h2>
                  <p className="mt-0.5 text-[10px]" style={{ color: th.textMuted }}>{lang === "ko" ? `${selectedPeriodLabel} · 사용자 ID·선택 이벤트·날짜만 집계, 자유 입력 없음` : lang === "ja" ? `${selectedPeriodLabel}・ユーザーID・選択イベント・日付のみを集計、自由記述なし` : `${selectedPeriodLabel} · aggregates only user ID, selected events, and date; no free text`}</p>
                </div>
                <span className="rounded-full border px-2 py-1 text-[9px] font-bold" style={{ borderColor: "oklch(0.64 0.15 285 / 0.45)", color: isDark ? "oklch(0.82 0.12 285)" : "oklch(0.45 0.16 285)" }}>{lang === "ko" ? "관리자 전용" : lang === "ja" ? "管理者専用" : "Admin only"}</span>
              </div>
              {productUsageMetricsQuery.isLoading ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-6" role="status" aria-live="polite" aria-atomic="true" aria-label={lang === "ko" ? "제품 사용 지표를 불러오는 중" : lang === "ja" ? "プロダクト利用指標を読み込み中" : "Loading product usage metrics"}>{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-lg border" style={{ borderColor: th.border, background: th.bgCard }} />)}</div> : productUsageMetricsQuery.isError ? <p className="rounded-lg border p-2 text-[10px]" role="alert" aria-atomic="true" style={{ borderColor: "oklch(0.65 0.20 25 / 0.42)", color: th.textMuted }}>{lang === "ko" ? "제품 사용 지표를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." : lang === "ja" ? "プロダクト利用指標を読み込めませんでした。しばらくしてから再試行してください。" : "Could not load product usage metrics. Please try again shortly."}</p> : <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                {[
                  { label: lang === "ko" ? "활성 사용자" : lang === "ja" ? "アクティブユーザー" : "Active users", value: productUsageMetricsQuery.data?.activeUsers ?? 0, detail: lang === "ko" ? "기간 내 방문" : lang === "ja" ? "期間内の訪問" : "Visited in range" },
                  { label: lang === "ko" ? "분석 시작" : lang === "ja" ? "分析開始" : "Analysis started", value: productUsageMetricsQuery.data?.analysisStartedUsers ?? 0, detail: lang === "ko" ? "AI 분석 요청" : lang === "ja" ? "AI分析リクエスト" : "AI analysis requested" },
                  { label: lang === "ko" ? "분석 완료율" : lang === "ja" ? "分析完了率" : "Analysis completion", value: `${productUsageMetricsQuery.data?.completionRate ?? 0}%`, detail: lang === "ko" ? "시작 대비 결과 확인" : lang === "ja" ? "開始に対する結果確認" : "Viewed after start" },
                  { label: lang === "ko" ? "재방문 사용자" : lang === "ja" ? "再訪問ユーザー" : "Returning users", value: productUsageMetricsQuery.data?.returningUsers ?? 0, detail: lang === "ko" ? "이전 방문 뒤 재방문" : lang === "ja" ? "以前の訪問後の再訪問" : "Visited before and in range" },
                  { label: lang === "ko" ? "안내 완료율" : lang === "ja" ? "ガイド完了率" : "Guide completion", value: `${productUsageMetricsQuery.data?.onboardingCompletionRate ?? 0}%`, detail: lang === "ko" ? `${productUsageMetricsQuery.data?.onboardingCompletedUsers ?? 0}명 완료` : lang === "ja" ? `${productUsageMetricsQuery.data?.onboardingCompletedUsers ?? 0}人が完了` : `${productUsageMetricsQuery.data?.onboardingCompletedUsers ?? 0} completed` },
                  { label: firstUseFeedbackCopy.response, value: productUsageMetricsQuery.data?.feedbackResponseCount ?? 0, detail: (productUsageMetricsQuery.data?.feedbackResponseCount ?? 0) > 0 ? `${firstUseFeedbackCopy.average} ${productUsageMetricsQuery.data?.averageEaseRating ?? 0}/5` : (lang === "ko" ? "선택 응답 없음" : lang === "ja" ? "選択回答なし" : "No selected response") },
                ].map(metric => <div key={metric.label} className="rounded-lg border p-2.5" style={{ borderColor: th.border2, background: th.bgCard }}><p className="text-[10px] font-bold" style={{ color: th.textMuted }}>{metric.label}</p><p className="mt-1 text-xl font-bold font-mono" style={{ color: th.text }}>{metric.value}</p><p className="mt-0.5 text-[9px]" style={{ color: th.textMuted }}>{metric.detail}</p></div>)}
              </div>}
              {!productUsageMetricsQuery.isLoading && !productUsageMetricsQuery.isError && (productUsageMetricsQuery.data?.feedbackResponseCount ?? 0) > 0 && <div className="mt-3 rounded-lg border p-2.5" role="note" style={{ borderColor: th.border2, background: th.bgCard }}><p className="text-[9px] font-bold" style={{ color: th.text }}>{lang === "ko" ? "선택 응답의 단계별 어려움 신호" : lang === "ja" ? "選択回答の段階別の難しさシグナル" : "Step-level difficulty signals from selected responses"}</p><div className="mt-2 flex flex-wrap gap-1.5">{(["orientation", "risk_review", "analysis_review"] as const).map(step => <span key={step} className="rounded-full border px-2 py-1 text-[9px]" style={{ borderColor: th.border2, color: th.textMuted }}>{firstUseFeedbackCopy.steps[step]} {productUsageMetricsQuery.data?.difficultStepCounts?.[step] ?? 0}</span>)}</div></div>}
              {!productUsageMetricsQuery.isLoading && !productUsageMetricsQuery.isError && currentUsageMetrics && previousUsageMetrics && <div className="mt-3 rounded-lg border p-3" style={{ borderColor: th.border2, background: isDark ? "oklch(0.16 0.02 240 / 0.70)" : "oklch(0.99 0.005 240)" }}>
                <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-[10px] font-bold" style={{ color: th.text }}>{lang === "ko" ? "개선 전후 비교" : lang === "ja" ? "改善前後の比較" : "Before/after comparison"}</p><p className="text-[9px]" style={{ color: th.textMuted }}>{lang === "ko" ? "선택 기간과 길이가 같은 직전 기간" : lang === "ja" ? "選択期間と同じ長さの直前期間" : "Previous period of equal length"}</p></div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {[{ label: lang === "ko" ? "분석 완료율" : lang === "ja" ? "分析完了率" : "Analysis completion", current: currentUsageMetrics.completionRate, previous: previousUsageMetrics.completionRate }, { label: lang === "ko" ? "재방문율" : lang === "ja" ? "再訪問率" : "Returning rate", current: currentReturningRate, previous: previousReturningRate }, { label: lang === "ko" ? "안내 완료율" : lang === "ja" ? "ガイド完了率" : "Guide completion", current: currentUsageMetrics.onboardingCompletionRate, previous: previousUsageMetrics.onboardingCompletionRate }].map(metric => <div key={metric.label} className="rounded-md px-2.5 py-2" style={{ background: th.bgCard }}><p className="text-[9px] font-bold" style={{ color: th.textMuted }}>{metric.label}</p><p className="mt-0.5 text-sm font-bold font-mono" style={{ color: th.text }}>{metric.current}% <span className="text-[10px]" style={{ color: metric.current >= metric.previous ? "#22c55e" : "#f97316" }}>{formatMetricDelta(metric.current, metric.previous)}</span></p><p className="text-[9px]" style={{ color: th.textMuted }}>{lang === "ko" ? `직전 ${metric.previous}%` : lang === "ja" ? `直前 ${metric.previous}%` : `Previous ${metric.previous}%`}</p></div>)}
                </div>
                <p className="mt-2 text-[9px] leading-4" role="note" style={{ color: usageComparisonHasSmallSample ? (isDark ? "oklch(0.84 0.13 82)" : "oklch(0.46 0.13 62)") : th.textMuted }}>{usageComparisonHasSmallSample ? (lang === "ko" ? `표본 수가 작습니다(현재 ${currentUsageMetrics.activeUsers}명, 직전 ${previousUsageMetrics.activeUsers}명). 증감은 참고용이며 실제 사용자 검증을 더 수집하세요.` : lang === "ja" ? `標本数が少ないです（現在${currentUsageMetrics.activeUsers}人、直前${previousUsageMetrics.activeUsers}人）。増減は参考用であり、実ユーザー検証を追加してください。` : `The sample is small (current ${currentUsageMetrics.activeUsers}, previous ${previousUsageMetrics.activeUsers}). Treat changes as directional and collect more real-user evidence.`) : (lang === "ko" ? `분모: 각 기간의 활성 사용자 수(현재 ${currentUsageMetrics.activeUsers}명, 직전 ${previousUsageMetrics.activeUsers}명). 같은 길이의 기간만 비교합니다.` : lang === "ja" ? `分母: 各期間のアクティブユーザー数（現在${currentUsageMetrics.activeUsers}人、直前${previousUsageMetrics.activeUsers}人）。同じ長さの期間のみ比較します。` : `Denominator: active users in each period (current ${currentUsageMetrics.activeUsers}, previous ${previousUsageMetrics.activeUsers}). Only equal-length periods are compared.`)}</p>
              </div>}
            </section>}

            {periodOverviewQuery.isError && (
              <div className="mb-6 flex flex-col items-start justify-between gap-2 rounded-xl border p-3 text-xs sm:flex-row sm:items-center" role="alert" aria-atomic="true" style={{ background: "oklch(0.65 0.20 25 / 0.08)", borderColor: "oklch(0.65 0.20 25 / 0.45)", color: th.textMuted }}>
                <p><span aria-hidden="true">⚠️</span>{" "}{lang === "ko" ? "운영 통계를 불러오지 못했습니다. KPI와 예상 절감 비용은 최신 값이 아닐 수 있습니다." : lang === "ja" ? "運用統計を読み込めませんでした。KPIと予想削減コストは最新値ではない可能性があります。" : "Could not load operational statistics. KPI values and expected savings may not be current."}</p>
                <button type="button" onClick={() => void periodOverviewQuery.refetch()} disabled={periodOverviewQuery.isFetching} aria-busy={periodOverviewQuery.isFetching || undefined} aria-label={periodOverviewQuery.isFetching ? (lang === "ko" ? "운영 통계 다시 불러오는 중" : lang === "ja" ? "運用統計を再読み込み中" : "Retrying operational statistics") : (lang === "ko" ? "운영 통계 다시 시도" : lang === "ja" ? "運用統計を再試行" : "Retry operational statistics")} className="shrink-0 rounded border px-2.5 py-1 text-[10px] font-bold disabled:opacity-45" style={{ borderColor: "oklch(0.65 0.20 25 / 0.45)", color: isDark ? "oklch(0.82 0.14 40)" : "oklch(0.48 0.18 25)" }}>
                  ↻ {periodOverviewQuery.isFetching ? (lang === "ko" ? "다시 불러오는 중..." : lang === "ja" ? "再読み込み中..." : "Retrying...") : (lang === "ko" ? "다시 시도" : lang === "ja" ? "再試行" : "Retry")}
                </button>
              </div>
            )}

            {/* 절감 비용 카드 */}
            <div className="rounded-xl border p-4 sm:p-5 mb-6 flex flex-col gap-2"
              style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.10), rgba(34,197,94,0.05))", borderColor: "rgba(34,197,94,0.30)" }}>
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{t.savedCost} · {selectedPeriodLabel}</p>
                <span className="rounded-full border px-1.5 py-0.5 text-[9px] font-bold" style={{ borderColor: "rgba(34,197,94,0.42)", color: isDark ? "oklch(0.81 0.14 150)" : "oklch(0.39 0.14 150)", background: "rgba(34,197,94,0.08)" }}>{savingsScope.badge}</span>
                <AppTooltip delayDuration={160}>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label={savingsScope.note} className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold transition-colors hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300" style={{ borderColor: "rgba(34,197,94,0.42)", color: isDark ? "oklch(0.81 0.14 150)" : "oklch(0.39 0.14 150)" }}>i</button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[17rem] border-emerald-400/30 bg-slate-950 px-3 py-2 text-xs text-slate-100 shadow-xl">{savingsScope.note}</TooltipContent>
                </AppTooltip>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold font-mono" style={{ color: "#22c55e" }}>
                  {periodOverviewQuery.isError || statsInitialLoading ? "—" : `₩${displayedSavedCost.toLocaleString()}`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2" role="note">{statsInitialLoading ? statsLoadingLabel : savingsScope.note}</p>
            </div>

            {/* 메인 대시보드 그리드 */}
            <div id="pdf-capture-area" className="grid grid-cols-12 gap-4">
              {/* ── 임계값 설정 패널 (전체 너비) ── */}
              <div className="col-span-12 mb-2">
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "oklch(0.20 0.02 240)" }}>
                  <button
                    type="button"
                    onClick={() => setShowThresholdPanel(p => !p)}
                    aria-expanded={showThresholdPanel}
                    aria-controls="risk-threshold-panel"
                    className="w-full flex items-center justify-between px-5 py-3 text-left transition-all hover:opacity-80"
                    style={{ background: th.bgCard }}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚙️</span>
                      <span className="text-xs font-semibold">{lang === "ko" ? "위험도 임계값 설정" : lang === "ja" ? "リスクしきい値設定" : "Risk Threshold Settings"}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">
                        {lang === "ko"
                          ? `정상 ≤${thresholds.normal} / 주의 ≤${thresholds.caution} / 경고 ≤${thresholds.warning} / 위험 >${thresholds.warning}`
                          : lang === "ja"
                            ? `正常 ≤${thresholds.normal} / 注意 ≤${thresholds.caution} / 警告 ≤${thresholds.warning} / 危険 >${thresholds.warning}`
                            : `Normal ≤${thresholds.normal} / Caution ≤${thresholds.caution} / Warning ≤${thresholds.warning} / Danger >${thresholds.warning}`}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{showThresholdPanel ? "▲" : "▼"}</span>
                  </button>
                  {showThresholdPanel && (
                    <div id="risk-threshold-panel" role="region" aria-label={lang === "ko" ? "전체 위험도 임계값 설정" : lang === "ja" ? "全体リスクしきい値設定" : "Global risk threshold settings"} className="px-5 py-4 border-t grid grid-cols-1 md:grid-cols-3 gap-5"
                      style={{ background: th.bgCard2, borderColor: th.border }}>
                      {/* 정상 임계값 */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#22c55e" }}>
                            {lang === "ko" ? "정상 최대 점수" : lang === "ja" ? "正常の最大スコア" : "Normal Max"}
                          </label>
                          <span className="text-xs font-mono font-bold" style={{ color: "#22c55e" }}>{thresholds.normal}</span>
                        </div>
                        <input type="range" min={10} max={thresholds.caution - 1} value={thresholds.normal}
                          aria-label={lang === "ko" ? "정상 최대 위험도 점수" : lang === "ja" ? "正常の最大リスクスコア" : "Normal maximum risk score"}
                          aria-valuetext={lang === "ko" ? `${thresholds.normal}점` : lang === "ja" ? `${thresholds.normal}点` : `${thresholds.normal} points`}
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
                        <p className="text-[9px] text-muted-foreground">{lang === "ko" ? "이 점수 이하 → 정상" : lang === "ja" ? "このスコア以下 → 正常" : "Score ≤ this → Normal"}</p>
                      </div>
                      {/* 주의 임계값 */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#eab308" }}>
                            {lang === "ko" ? "주의 최대 점수" : lang === "ja" ? "注意の最大スコア" : "Caution Max"}
                          </label>
                          <span className="text-xs font-mono font-bold" style={{ color: "#eab308" }}>{thresholds.caution}</span>
                        </div>
                        <input type="range" min={thresholds.normal + 1} max={thresholds.warning - 1} value={thresholds.caution}
                          aria-label={lang === "ko" ? "주의 최대 위험도 점수" : lang === "ja" ? "注意の最大リスクスコア" : "Caution maximum risk score"}
                          aria-valuetext={lang === "ko" ? `${thresholds.caution}점` : lang === "ja" ? `${thresholds.caution}点` : `${thresholds.caution} points`}
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
                        <p className="text-[9px] text-muted-foreground">{lang === "ko" ? "이 점수 이하 → 주의" : lang === "ja" ? "このスコア以下 → 注意" : "Score ≤ this → Caution"}</p>
                      </div>
                      {/* 경고 임계값 */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#f97316" }}>
                            {lang === "ko" ? "경고 최대 점수" : lang === "ja" ? "警告の最大スコア" : "Warning Max"}
                          </label>
                          <span className="text-xs font-mono font-bold" style={{ color: "#f97316" }}>{thresholds.warning}</span>
                        </div>
                        <input type="range" min={thresholds.caution + 1} max={89} value={thresholds.warning}
                          aria-label={lang === "ko" ? "경고 최대 위험도 점수" : lang === "ja" ? "警告の最大リスクスコア" : "Warning maximum risk score"}
                          aria-valuetext={lang === "ko" ? `${thresholds.warning}점` : lang === "ja" ? `${thresholds.warning}点` : `${thresholds.warning} points`}
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
                        <p className="text-[9px] text-muted-foreground">{lang === "ko" ? `이 점수 초과 → 위험 (현재 >${thresholds.warning})` : lang === "ja" ? `このスコア超過 → 危険（現在 >${thresholds.warning}）` : `Score > this → Danger (now >${thresholds.warning})`}</p>
                      </div>
                      {/* 초기화 버튼 */}
                      <div className="col-span-1 md:col-span-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const def = { normal: 29, caution: 49, warning: 69 };
                            setThresholds(def);
                            saveThresholdsMutation.mutate(def);
                          }}
                          className="text-[10px] px-3 py-1.5 rounded-lg border transition-all hover:opacity-80 active:scale-95"
                          style={{ borderColor: th.border2, color: th.textMuted }}>
                          {lang === "ko" ? "기본값으로 초기화" : lang === "ja" ? "既定値にリセット" : "Reset to Default"}
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
                    type="button"
                    onClick={() => setShowSensorPanel(p => !p)}
                    aria-expanded={showSensorPanel}
                    aria-controls="sensor-threshold-panel"
                    className="w-full flex items-center justify-between px-5 py-3 text-left transition-all hover:opacity-80"
                    style={{ background: th.bgCard }}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔬</span>
                      <span className="text-xs font-semibold">{lang === "ko" ? "센서별 임계값 설정" : lang === "ja" ? "センサー別しきい値設定" : "Per-Sensor Threshold Settings"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{showSensorPanel ? "▲" : "▼"}</span>
                  </button>
                  {showSensorPanel && (
                    <div id="sensor-threshold-panel" role="region" aria-label={lang === "ko" ? "센서별 위험도 임계값 설정" : lang === "ja" ? "センサー別リスクしきい値設定" : "Per-sensor risk threshold settings"} className="px-5 py-4 border-t grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5"
                      style={{ background: th.bgCard2, borderColor: th.border }}>
                      {/* 전류 */}
                      {[
                        { key: "current" as const, label: lang === "ko" ? "전류 (A)" : lang === "ja" ? "電流 (A)" : "Current (A)", color: "#38bdf8", step: 0.1,
                          caution: sensorThresh.currentCaution, warning: sensorThresh.currentWarning, danger: sensorThresh.currentDanger,
                          setCaution: (v: number) => { const n = { ...sensorThresh, currentCaution: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setWarning: (v: number) => { const n = { ...sensorThresh, currentWarning: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setDanger:  (v: number) => { const n = { ...sensorThresh, currentDanger: v };  setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          min: 5, max: 20 },
                        { key: "temp" as const, label: lang === "ko" ? "온도 (°C)" : lang === "ja" ? "温度 (°C)" : "Temperature (°C)", color: "#fb923c", step: 1,
                          caution: sensorThresh.tempCaution, warning: sensorThresh.tempWarning, danger: sensorThresh.tempDanger,
                          setCaution: (v: number) => { const n = { ...sensorThresh, tempCaution: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setWarning: (v: number) => { const n = { ...sensorThresh, tempWarning: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setDanger:  (v: number) => { const n = { ...sensorThresh, tempDanger: v };  setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          min: 40, max: 120 },
                        { key: "vib" as const, label: lang === "ko" ? "진동 (mm/s)" : lang === "ja" ? "振動 (mm/s)" : "Vibration (mm/s)", color: "#a78bfa", step: 0.05,
                          caution: sensorThresh.vibCaution, warning: sensorThresh.vibWarning, danger: sensorThresh.vibDanger,
                          setCaution: (v: number) => { const n = { ...sensorThresh, vibCaution: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setWarning: (v: number) => { const n = { ...sensorThresh, vibWarning: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setDanger:  (v: number) => { const n = { ...sensorThresh, vibDanger: v };  setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          min: 1.5, max: 5.0 },
                        { key: "noise" as const, label: lang === "ko" ? "소음 (dB)" : lang === "ja" ? "騒音 (dB)" : "Noise (dB)", color: "#34d399", step: 1,
                          caution: sensorThresh.noiseCaution, warning: sensorThresh.noiseWarning, danger: sensorThresh.noiseDanger,
                          setCaution: (v: number) => { const n = { ...sensorThresh, noiseCaution: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setWarning: (v: number) => { const n = { ...sensorThresh, noiseWarning: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setDanger:  (v: number) => { const n = { ...sensorThresh, noiseDanger: v };  setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          min: 50, max: 100 },
                      ].map(s => (
                        <div key={s.key} className="flex flex-col gap-3 p-3 rounded-lg border" style={{ borderColor: `${s.color}30`, background: `${s.color}08` }}>
                          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: s.color }}>{s.label}</p>
                          {[
                            { label: lang === "ko" ? "주의" : lang === "ja" ? "注意" : "Caution", val: s.caution, set: s.setCaution, color: "#eab308" },
                            { label: lang === "ko" ? "경고" : lang === "ja" ? "警告" : "Warning", val: s.warning, set: s.setWarning, color: "#f97316" },
                            { label: lang === "ko" ? "위험" : lang === "ja" ? "危険" : "Danger",  val: s.danger,  set: s.setDanger,  color: "#ef4444" },
                          ].map(row => (
                            <div key={row.label} className="flex flex-col gap-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-semibold" style={{ color: row.color }}>{row.label}</span>
                                <span className="text-[9px] font-mono" style={{ color: row.color }}>{row.val.toFixed(s.step < 1 ? 2 : 0)}</span>
                              </div>
                              <input type="range" min={s.min} max={s.max} step={s.step} value={row.val}
                                aria-label={lang === "ko" ? `${s.label} ${row.label} 임계값` : lang === "ja" ? `${s.label} ${row.label}しきい値` : `${s.label} ${row.label} threshold`}
                                aria-valuetext={lang === "ko" ? `현재 ${row.val.toFixed(s.step < 1 ? 2 : 0)}` : lang === "ja" ? `現在 ${row.val.toFixed(s.step < 1 ? 2 : 0)}` : `Current ${row.val.toFixed(s.step < 1 ? 2 : 0)}`}
                                className="w-full h-1 rounded-full appearance-none cursor-pointer"
                                style={{ accentColor: row.color }}
                                onChange={e => row.set(Number(e.target.value))} />
                            </div>
                          ))}
                        </div>
                      ))}
                      <div className="col-span-1 md:col-span-2 xl:col-span-4 flex justify-end">
                        <button
                          type="button"
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
                          {lang === "ko" ? "기본값으로 초기화" : lang === "ja" ? "既定値にリセット" : "Reset to Default"}
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
                  const currentScore = scoreHistory.at(-1) ?? 0;
                  const minScore = Math.min(...scoreHistory);
                  const maxScore = Math.max(...scoreHistory);
                  const overviewSensorKey = card.sensorKey === "temp" ? "temperature" : card.sensorKey === "vib" ? "vibration" : card.sensorKey === "noise" ? "noise" : "current";
                  const periodAverage = selectedPeriodStats?.sensors.average[overviewSensorKey];
                  const periodPeak = selectedPeriodStats?.sensors.peak[overviewSensorKey];
                  const scoreTrendSummary = lang === "ko"
                    ? `${card.label} 점수 추이. 현재 ${currentScore}, 최저 ${minScore}, 최고 ${maxScore}`
                    : lang === "ja"
                      ? `${card.label}のスコア推移。現在 ${currentScore}、最小 ${minScore}、最大 ${maxScore}`
                      : `${card.label} score trend. Current ${currentScore}, minimum ${minScore}, maximum ${maxScore}`;
                  return (
                  <div key={card.label} className="rounded-xl p-4 border flex flex-col gap-2 transition-all duration-300"
                    style={{ background: "rgba(255,255,255,0.025)", borderColor: blinkBorderColor, animation: blinkAnim, borderWidth: alertLevel !== "normal" ? "2px" : "1px" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{card.label}</span>
                      <span aria-hidden="true" className="text-base opacity-70">{card.icon}</span>
                    </div>
                    <div className="flex items-end gap-1.5">
                      <span className="text-3xl font-bold font-mono leading-none" style={{ color: card.color }}>{card.value.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground mb-0.5">{card.unit}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[9px] text-muted-foreground opacity-60">{lang === "ko" ? `점수 추이 · ${selectedPeriodLabel}` : lang === "ja" ? `スコア推移・${selectedPeriodLabel}` : `Score trend · ${selectedPeriodLabel}`}</span>
                      <Sparkline data={scoreHistory} color={card.color} label={scoreTrendSummary} />
                    </div>
                    {periodAverage !== undefined && periodPeak !== undefined && <p className="text-[9px] text-muted-foreground">{lang === "ko" ? `${selectedPeriodLabel} 평균 ${periodAverage.toFixed(1)} · 최고 ${periodPeak.toFixed(1)}` : lang === "ja" ? `${selectedPeriodLabel} 平均 ${periodAverage.toFixed(1)} · 最大 ${periodPeak.toFixed(1)}` : `${selectedPeriodLabel} avg ${periodAverage.toFixed(1)} · peak ${periodPeak.toFixed(1)}`}</p>}
                  </div>
                  );
                })}
              </div>
              </div>

              {/* ── 가운데: 차트 ── */}
              <div className="col-span-12 lg:col-span-6 flex flex-col gap-4" tabIndex={0} role="group" aria-label={lang === "ko" ? "센서 추이 차트 확대와 이동" : lang === "ja" ? "センサー推移チャートの拡大と移動" : "Sensor trend chart zoom and pan"} onKeyDown={handleSensorChartKeyDown} onWheel={event => { if (displayedSensorChartData.length > 2) { event.preventDefault(); zoomSensorChart(event.deltaY < 0 ? "in" : "out"); } }}>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2" style={{ background: th.bgCard, borderColor: th.border }}>
                  <p className="text-[10px] font-semibold" style={{ color: th.textMuted }}>{lang === "ko" ? "차트: 드래그로 구간 선택 · 휠로 확대 · ← →로 이동" : lang === "ja" ? "チャート: ドラッグで範囲選択 · ホイールで拡大 · ← →で移動" : "Chart: drag to select · wheel to zoom · ← → to pan"}</p>
                  <div className="flex items-center gap-1" role="group" aria-label={lang === "ko" ? "차트 확대 제어" : lang === "ja" ? "チャートの拡大操作" : "Chart zoom controls"}>
                    <button type="button" onClick={() => panSensorChart("back")} disabled={resolvedSensorChartRange.startIndex === 0} className="h-7 min-w-7 rounded border text-xs font-bold transition-colors hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40" style={{ color: th.text, borderColor: th.border2 }} aria-label={lang === "ko" ? "차트 이전 구간으로 이동" : lang === "ja" ? "チャートを前の範囲へ移動" : "Pan chart backward"}>←</button>
                    <button type="button" onClick={() => zoomSensorChart("out")} disabled={displayedSensorChartData.length < 3 || (resolvedSensorChartRange.startIndex === 0 && resolvedSensorChartRange.endIndex === displayedSensorChartData.length - 1)} className="h-7 min-w-7 rounded border text-xs font-bold transition-colors hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40" style={{ color: th.text, borderColor: th.border2 }} aria-label={lang === "ko" ? "차트 축소" : lang === "ja" ? "チャートを縮小" : "Zoom out chart"}>−</button>
                    <button type="button" onClick={() => zoomSensorChart("in")} disabled={displayedSensorChartData.length < 3 || resolvedSensorChartRange.endIndex - resolvedSensorChartRange.startIndex < 2} className="h-7 min-w-7 rounded border text-xs font-bold transition-colors hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40" style={{ color: th.text, borderColor: th.border2 }} aria-label={lang === "ko" ? "차트 확대" : lang === "ja" ? "チャートを拡大" : "Zoom in chart"}>+</button>
                    <button type="button" onClick={resetSensorChartZoom} disabled={resolvedSensorChartRange.startIndex === 0 && resolvedSensorChartRange.endIndex === displayedSensorChartData.length - 1} className="h-7 rounded border px-2 text-[10px] font-bold transition-colors hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40" style={{ color: th.text, borderColor: th.border2 }}>{lang === "ko" ? "초기화" : lang === "ja" ? "リセット" : "Reset"}</button>
                    <button type="button" onClick={() => panSensorChart("forward")} disabled={resolvedSensorChartRange.endIndex >= displayedSensorChartData.length - 1} className="h-7 min-w-7 rounded border text-xs font-bold transition-colors hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40" style={{ color: th.text, borderColor: th.border2 }} aria-label={lang === "ko" ? "차트 다음 구간으로 이동" : lang === "ja" ? "チャートを次の範囲へ移動" : "Pan chart forward"}>→</button>
                    <span className="mx-0.5 h-4 w-px" aria-hidden="true" style={{ background: th.border2 }} />
                    <button type="button" onClick={() => void exportCurrentSensorRangeImage("png")} disabled={sensorImageExporting !== null || displayedSensorChartData.length === 0} aria-busy={sensorImageExporting === "png" || undefined} className="h-7 rounded border px-1.5 text-[9px] font-bold transition-colors hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40" style={{ color: th.text, borderColor: th.border2 }} aria-label={sensorImageExporting === "png" ? (lang === "ko" ? "PNG 이미지 저장 준비 중" : lang === "ja" ? "PNG画像を保存する準備中" : "Preparing PNG image export") : (lang === "ko" ? "현재 확대 구간을 PNG 이미지로 저장" : lang === "ja" ? "現在の拡大範囲をPNG画像で保存" : "Save current zoom range as PNG")}>{sensorImageExporting === "png" ? "…" : "PNG"}</button>
                    <button type="button" onClick={() => void exportCurrentSensorRangeImage("jpeg")} disabled={sensorImageExporting !== null || displayedSensorChartData.length === 0} aria-busy={sensorImageExporting === "jpeg" || undefined} className="h-7 rounded border px-1.5 text-[9px] font-bold transition-colors hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40" style={{ color: th.text, borderColor: th.border2 }} aria-label={sensorImageExporting === "jpeg" ? (lang === "ko" ? "JPEG 이미지 저장 준비 중" : lang === "ja" ? "JPEG画像を保存する準備中" : "Preparing JPEG image export") : (lang === "ko" ? "현재 확대 구간을 JPEG 이미지로 저장" : lang === "ja" ? "現在の拡大範囲をJPEG画像で保存" : "Save current zoom range as JPEG")}>{sensorImageExporting === "jpeg" ? "…" : "JPEG"}</button>
                  </div>
                </div>
                {/* 전류 + 온도 */}
                <div className="rounded-xl border p-4" style={{ background: th.bgCard, borderColor: th.border }}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    {t.current} <span aria-hidden="true" className="text-[#38bdf8]">●</span> / {t.temperature} <span aria-hidden="true" className="text-[#fb923c]">●</span>
                  </p>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={displayedSensorChartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#4b5563" }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9, fill: "#4b5563" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="current"     stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} name={t.current} />
                      <Line type="monotone" dataKey="temperature" stroke="#fb923c" strokeWidth={2} dot={false} isAnimationActive={false} name={t.temperature} />
                      <Brush dataKey="label" height={22} stroke={isDark ? "#38bdf8" : "#0284c7"} fill={isDark ? "#102a43" : "#eaf4f7"} travellerWidth={9} startIndex={resolvedSensorChartRange.startIndex} endIndex={resolvedSensorChartRange.endIndex} onChange={range => { if (typeof range.startIndex === "number" && typeof range.endIndex === "number") setSensorChartWindow(range.startIndex, range.endIndex); }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {/* 진동 + 소음 */}
                <div className="rounded-xl border p-4" style={{ background: th.bgCard, borderColor: th.border }}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    {t.vibration} <span aria-hidden="true" className="text-[#a78bfa]">●</span> / {t.noise} <span aria-hidden="true" className="text-[#34d399]">●</span>
                  </p>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={displayedSensorChartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#4b5563" }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9, fill: "#4b5563" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="vibration" stroke="#a78bfa" strokeWidth={2} dot={false} isAnimationActive={false} name={t.vibration} />
                      <Line type="monotone" dataKey="noise"     stroke="#34d399" strokeWidth={2} dot={false} isAnimationActive={false} name={t.noise} />
                      <Brush dataKey="label" height={22} stroke={isDark ? "#38bdf8" : "#0284c7"} fill={isDark ? "#102a43" : "#eaf4f7"} travellerWidth={9} startIndex={resolvedSensorChartRange.startIndex} endIndex={resolvedSensorChartRange.endIndex} onChange={range => { if (typeof range.startIndex === "number" && typeof range.endIndex === "number") setSensorChartWindow(range.startIndex, range.endIndex); }} />
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
                      <span role="status" aria-live="polite" aria-atomic="true" aria-label={lang === "ko" ? `가상 팹 ${t[lastInjectedMode]} 단계 주입 완료` : lang === "ja" ? `仮想ファブに${t[lastInjectedMode]}レベルを注入しました` : `Virtual fab ${t[lastInjectedMode]} level injected`} className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{
                          background: lastInjectedMode === "normal" ? "rgba(34,197,94,0.15)" : lastInjectedMode === "caution" ? "rgba(234,179,8,0.15)" : lastInjectedMode === "warning" ? "rgba(249,115,22,0.15)" : "rgba(239,68,68,0.15)",
                          color: lastInjectedMode === "normal" ? "#22c55e" : lastInjectedMode === "caution" ? "#eab308" : lastInjectedMode === "warning" ? "#f97316" : "#ef4444",
                        }}>
                        {t[lastInjectedMode]}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{t.simulatorDesc}</p>
                  <div className="grid grid-cols-2 gap-2 mt-1" role="group" aria-label={t.simulatorTitle}>
                    <button type="button" onClick={handleInjectNormal} disabled={injectNormal.isPending} aria-busy={injectNormal.isPending || undefined}
                      className="py-2 rounded-lg text-xs font-semibold border transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                      style={{ background: "rgba(34,197,94,0.10)", borderColor: "#22c55e45", color: "#22c55e" }}>
                      {injectNormal.isPending
                        ? <span className="flex items-center justify-center gap-1.5"><ButtonSpinner color="#22c55e" /><span>{t.processing}</span></span>
                        : `▶ ${t.injectNormal}`}
                    </button>
                    <button type="button" onClick={handleInjectCaution} disabled={injectCaution.isPending} aria-busy={injectCaution.isPending || undefined}
                      className="py-2 rounded-lg text-xs font-semibold border transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                      style={{ background: "rgba(234,179,8,0.10)", borderColor: "#eab30845", color: "#eab308" }}>
                      {injectCaution.isPending
                        ? <span className="flex items-center justify-center gap-1.5"><ButtonSpinner color="#eab308" /><span>{t.processing}</span></span>
                        : `⚡ ${t.injectCaution}`}
                    </button>
                    <button type="button" onClick={handleInjectWarning} disabled={injectWarning.isPending} aria-busy={injectWarning.isPending || undefined}
                      className="py-2 rounded-lg text-xs font-semibold border transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                      style={{ background: "rgba(249,115,22,0.10)", borderColor: "#f9731645", color: "#f97316" }}>
                      {injectWarning.isPending
                        ? <span className="flex items-center justify-center gap-1.5"><ButtonSpinner color="#f97316" /><span>{t.processing}</span></span>
                        : `🔶 ${t.injectWarning}`}
                    </button>
                    <button type="button" onClick={handleInjectAnomaly} disabled={injectAnomaly.isPending} aria-busy={injectAnomaly.isPending || undefined}
                      className="py-2 rounded-lg text-xs font-semibold border transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                      style={{ background: "rgba(239,68,68,0.10)", borderColor: "#ef444445", color: "#ef4444" }}>
                      {injectAnomaly.isPending
                        ? <span className="flex items-center justify-center gap-1.5"><ButtonSpinner color="#ef4444" /><span>{t.processing}</span></span>
                        : `⚠ ${t.injectAnomaly}`}
                    </button>
                  </div>
                </div>
                {/* 절감 비용 리셋 버튼 */}
                <button type="button" onClick={handleResetCost} disabled={resetCostMutation.isPending} aria-busy={resetCostMutation.isPending || undefined}
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
                    {lang === "ko" ? "위험도 점수 추이 (최근 50개)" : lang === "ja" ? "リスクスコア推移（直近50件）" : "Risk Score Trend (Last 50)"}
                  </p>
                  <div className="flex gap-3 text-[9px]">
                    {(["normal","caution","warning","danger"] as const).map(r => (
                      <span key={r} className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ background: RISK_COLOR_MAP[r] }} />
                        <span className="text-muted-foreground capitalize">{lang === "ko" ? t[r] : lang === "ja" ? ({ normal: "正常", caution: "注意", warning: "警告", danger: "危険" } as const)[r] : r}</span>
                      </span>
                    ))}
                  </div>
                </div>
                {getRecentScoresQuery.isError ? (
                  <div className="flex h-[150px] flex-col items-center justify-center gap-2 text-center text-[10px]" role="alert" aria-atomic="true" style={{ color: th.textMuted }}>
                    <p><span aria-hidden="true">⚠️</span>{" "}{lang === "ko" ? "위험도 점수 추이를 불러오지 못했습니다." : lang === "ja" ? "リスクスコア推移を読み込めませんでした。" : "Could not load risk score trends."}</p>
                    <button type="button" onClick={() => void getRecentScoresQuery.refetch()} disabled={getRecentScoresQuery.isFetching} aria-busy={getRecentScoresQuery.isFetching || undefined} aria-label={getRecentScoresQuery.isFetching ? (lang === "ko" ? "위험도 점수 추이 다시 불러오는 중" : lang === "ja" ? "リスクスコア推移を再読み込み中" : "Retrying risk score trends") : (lang === "ko" ? "위험도 점수 추이 다시 시도" : lang === "ja" ? "リスクスコア推移を再試行" : "Retry risk score trends")} className="rounded border px-2.5 py-1 text-[9px] font-bold disabled:opacity-45" style={{ borderColor: "oklch(0.65 0.18 200 / 0.45)", color: isDark ? "oklch(0.78 0.15 200)" : "oklch(0.42 0.17 220)" }}>
                      ↻ {getRecentScoresQuery.isFetching ? (lang === "ko" ? "다시 불러오는 중..." : lang === "ja" ? "再読み込み中..." : "Retrying...") : (lang === "ko" ? "다시 시도" : lang === "ja" ? "再試行" : "Retry")}
                    </button>
                  </div>
                ) : (
                  <ScoreLineChart data={selectedPeriodStats?.scoreHistory ?? getRecentScoresQuery.data ?? []} lang={lang} isDark={isDark} />
                )}
              </div>
              {getDailyMaxRisk.isError ? (
                <div className="rounded-xl border p-4" style={{ background: th.bgCard, borderColor: th.border }}>
                  <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center text-[10px]" role="alert" aria-atomic="true" style={{ color: th.textMuted }}>
                    <p><span aria-hidden="true">⚠️</span>{" "}{lang === "ko" ? "월간 위험도 히트맵을 불러오지 못했습니다." : lang === "ja" ? "月間リスクヒートマップを読み込めませんでした。" : "Could not load the monthly risk heatmap."}</p>
                    <button type="button" onClick={() => void getDailyMaxRisk.refetch()} disabled={getDailyMaxRisk.isFetching} aria-busy={getDailyMaxRisk.isFetching || undefined} aria-label={getDailyMaxRisk.isFetching ? (lang === "ko" ? "월간 위험도 히트맵 다시 불러오는 중" : lang === "ja" ? "月間リスクヒートマップを再読み込み中" : "Retrying monthly risk heatmap") : (lang === "ko" ? "월간 위험도 히트맵 다시 시도" : lang === "ja" ? "月間リスクヒートマップを再試行" : "Retry monthly risk heatmap")} className="rounded border px-2.5 py-1 text-[9px] font-bold disabled:opacity-45" style={{ borderColor: "oklch(0.65 0.18 200 / 0.45)", color: isDark ? "oklch(0.78 0.15 200)" : "oklch(0.42 0.17 220)" }}>
                      ↻ {getDailyMaxRisk.isFetching ? (lang === "ko" ? "다시 불러오는 중..." : lang === "ja" ? "再読み込み中..." : "Retrying...") : (lang === "ko" ? "다시 시도" : lang === "ja" ? "再試行" : "Retry")}
                    </button>
                  </div>
                </div>
              ) : (
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
              )}
              </div>
          </>
        ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: th.border }}>{/* 이상 이력 로그 탭 */}
          {/* 새 기록 알림 배너 */}
          {newLogCount > 0 && (
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-2 text-left text-sm font-semibold cursor-pointer"
              style={{ background: "rgba(34,197,94,0.15)", borderBottom: "1px solid rgba(34,197,94,0.3)", color: "#22c55e" }}
              onClick={() => setNewLogCount(0)}
              aria-label={lang === "ko" ? `새 이상 이력 ${newLogCount}건 알림 닫기` : lang === "ja" ? `新しい異常履歴${newLogCount}件の通知を閉じる` : `Dismiss ${newLogCount} new anomaly record notification${newLogCount > 1 ? "s" : ""}`}
            >
              <span>🔔 {lang === "ko" ? `새 기록 ${newLogCount}건이 추가되었습니다` : lang === "ja" ? `新しい記録が${newLogCount}件追加されました` : `${newLogCount} new record${newLogCount > 1 ? "s" : ""} added`}</span>
              <span className="text-xs opacity-70">{lang === "ko" ? "선택하여 닫기" : lang === "ja" ? "選択して閉じる" : "Select to dismiss"}</span>
            </button>
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
                { label: lang === "ko" ? "위험" : lang === "ja" ? "危険" : "Danger",  count: rangedLogs.filter(l => l.riskLevel === "danger").length,  color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)",   icon: "🔴" },
                { label: lang === "ko" ? "경고" : lang === "ja" ? "警告" : "Warning", count: rangedLogs.filter(l => l.riskLevel === "warning").length, color: "#f97316", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.25)",  icon: "🟠" },
                { label: lang === "ko" ? "주의" : lang === "ja" ? "注意" : "Caution", count: rangedLogs.filter(l => l.riskLevel === "caution").length, color: "#eab308", bg: "rgba(234,179,8,0.08)",   border: "rgba(234,179,8,0.25)",   icon: "🟡" },
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
                    <div className="w-full h-1 rounded-full" role="progressbar" aria-label={lang === "ko" ? `${s.label} 위험 단계 비율` : lang === "ja" ? `${s.label}リスクレベルの割合` : `${s.label} risk level share`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} style={{ background: "rgba(255,255,255,0.08)" }}>
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
            <span className="text-[10px] font-semibold" style={{ color: th.textMuted }}>{lang === "ko" ? "기간 (연-월-일)" : lang === "ja" ? "期間（年-月-日）" : "Period (YYYY-MM-DD)"}:</span>
            <input type="date" value={dateStart}
              lang={lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US"}
              aria-label={lang === "ko" ? "이상 이력 시작일" : lang === "ja" ? "異常履歴の開始日" : "Anomaly history start date"}
              onChange={e => { setDateStart(e.target.value); setLogPage(1); }}
              className="text-[10px] px-2 py-1 rounded-lg border outline-none"
              style={{ background: th.bgCard2, borderColor: th.border, color: th.text, colorScheme: isDark ? "dark" : "light" }} />
            <span className="text-[10px]" style={{ color: th.textMuted }}>~</span>
            <input type="date" value={dateEnd}
              lang={lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US"}
              aria-label={lang === "ko" ? "이상 이력 종료일" : lang === "ja" ? "異常履歴の終了日" : "Anomaly history end date"}
              onChange={e => { setDateEnd(e.target.value); setLogPage(1); }}
              className="text-[10px] px-2 py-1 rounded-lg border outline-none"
              style={{ background: th.bgCard2, borderColor: th.border, color: th.text, colorScheme: isDark ? "dark" : "light" }} />
            {(dateStart || dateEnd) && (
              <button type="button" onClick={() => { setDateStart(""); setDateEnd(""); setLogPage(1); }}
                className="text-[10px] px-2 py-1 rounded-lg border transition-all hover:opacity-70"
                style={{ borderColor: th.border2, color: th.textMuted }}>
                {lang === "ko" ? "초기화" : lang === "ja" ? "リセット" : "Reset"}
              </button>
            )}
            <span className="text-[10px] ml-auto" style={{ color: th.textMuted }}>
              {lang === "ko" ? `${filteredLogs.length}건 표시` : lang === "ja" ? `${filteredLogs.length}件表示` : `${filteredLogs.length} records`}
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
          <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label={lang === "ko" ? "위험 이력 단계 필터" : lang === "ja" ? "異常履歴のリスクレベルフィルター" : "Anomaly history risk-level filter"}>
              {/* 날짜 필터 chip */}
              {selectedDate && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border"
                  style={{ borderColor: "oklch(0.65 0.18 200 / 0.6)", color: "oklch(0.65 0.18 200)", background: "oklch(0.65 0.18 200 / 0.12)" }}>
                  📅 {selectedDate}
                  <button onClick={() => setSelectedDate(null)} className="ml-1 hover:opacity-70 transition-opacity" title={lang === "ko" ? "날짜 필터 해제" : lang === "ja" ? "日付フィルター解除" : "Clear date filter"} aria-label={lang === "ko" ? "날짜 필터 해제" : lang === "ja" ? "日付フィルター解除" : "Clear date filter"}>✕</button>
                </div>
              )}
              {(["all", "normal", "caution", "warning", "danger"] as const).map(f => {
                const labelMap: Record<typeof f, string> = {
                  all:     lang === "ko" ? "전체" : lang === "ja" ? "すべて" : "All",
                  normal:  lang === "ko" ? "정상" : lang === "ja" ? "正常" : "Normal",
                  caution: lang === "ko" ? "주의" : lang === "ja" ? "注意" : "Caution",
                  warning: lang === "ko" ? "경고" : lang === "ja" ? "警告" : "Warning",
                  danger:  lang === "ko" ? "위험" : lang === "ja" ? "危険" : "Danger",
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
                  <button key={f} type="button"
                    onClick={() => { setLogFilter(f); setLogPage(1); }}
                    aria-pressed={isActive}
                    aria-label={lang === "ko" ? `${labelMap[f]} 위험 단계 필터${isActive ? ", 선택됨" : ""}` : lang === "ja" ? `${labelMap[f]}リスクレベルフィルター${isActive ? "、選択中" : ""}` : `${labelMap[f]} risk level filter${isActive ? ", selected" : ""}`}
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
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">{lang === "ko" ? "불러오는 중..." : lang === "ja" ? "読み込み中..." : "Loading..."}</td></tr>
                  ) : getLogs.isError ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center">
                        <div className="flex flex-col items-center gap-2 text-[11px]" role="alert" aria-atomic="true" style={{ color: th.textMuted }}>
                          <p><span aria-hidden="true">⚠️</span>{" "}{lang === "ko" ? "이상 이력을 불러오지 못했습니다." : lang === "ja" ? "異常履歴を読み込めませんでした。" : "Could not load anomaly history."}</p>
                          <button type="button" onClick={() => void getLogs.refetch()} disabled={getLogs.isFetching} aria-busy={getLogs.isFetching || undefined} aria-label={getLogs.isFetching ? (lang === "ko" ? "이상 이력 다시 불러오는 중" : lang === "ja" ? "異常履歴を再読み込み中" : "Retrying anomaly history") : (lang === "ko" ? "이상 이력 다시 시도" : lang === "ja" ? "異常履歴を再試行" : "Retry anomaly history")} className="rounded border px-2.5 py-1 text-[10px] font-bold disabled:opacity-45" style={{ borderColor: "oklch(0.65 0.18 200 / 0.45)", color: isDark ? "oklch(0.78 0.15 200)" : "oklch(0.42 0.17 220)" }}>
                            ↻ {getLogs.isFetching ? (lang === "ko" ? "다시 불러오는 중..." : lang === "ja" ? "再読み込み中..." : "Retrying...") : (lang === "ko" ? "다시 시도" : lang === "ja" ? "再試行" : "Retry")}
                          </button>
                        </div>
                      </td>
                    </tr>
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
                    : lang === "ja"
                    ? `全${filteredLogs.length}件中 ${(logPage - 1) * LOG_PAGE_SIZE + 1}～${Math.min(logPage * LOG_PAGE_SIZE, filteredLogs.length)}件`
                    : `${(logPage - 1) * LOG_PAGE_SIZE + 1}–${Math.min(logPage * LOG_PAGE_SIZE, filteredLogs.length)} of ${filteredLogs.length}`}
                </span>
                <div className="flex items-center gap-1" role="navigation" aria-label={lang === "ko" ? "이상 이력 페이지 탐색" : lang === "ja" ? "異常履歴ページの移動" : "Anomaly history pagination"}>
                  <button
                    type="button"
                    onClick={() => setLogPage(p => Math.max(1, p - 1))}
                    disabled={logPage === 1}
                    aria-label={lang === "ko" ? "이전 페이지" : lang === "ja" ? "前のページ" : "Previous page"}
                    className="px-2.5 py-1 rounded-lg text-xs border transition-all duration-150 disabled:opacity-30 hover:opacity-80 active:scale-95"
                    style={{ borderColor: "oklch(0.25 0.02 240)", color: "oklch(0.60 0.01 240)" }}>
                    ‹ {lang === "ko" ? "이전" : lang === "ja" ? "前へ" : "Prev"}
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
                        : <button key={p} type="button"
                            onClick={() => setLogPage(p as number)}
                            aria-current={logPage === p ? "page" : undefined}
                            aria-label={lang === "ko" ? `${p}페이지${logPage === p ? ", 현재 페이지" : ""}` : lang === "ja" ? `${p}ページ${logPage === p ? "、現在のページ" : ""}` : `Page ${p}${logPage === p ? ", current page" : ""}`}
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
                    type="button"
                    onClick={() => setLogPage(p => Math.min(totalPages, p + 1))}
                    disabled={logPage === totalPages}
                    aria-label={lang === "ko" ? "다음 페이지" : lang === "ja" ? "次のページ" : "Next page"}
                    className="px-2.5 py-1 rounded-lg text-xs border transition-all duration-150 disabled:opacity-30 hover:opacity-80 active:scale-95"
                    style={{ borderColor: "oklch(0.25 0.02 240)", color: "oklch(0.60 0.01 240)" }}>
                    {lang === "ko" ? "다음" : lang === "ja" ? "次へ" : "Next"} ›
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </main>

      {!isOnboardingOpen && onboardingProgressQuery.data?.completedAt && (
        <button ref={onboardingTriggerRef} type="button" onClick={() => setIsOnboardingOpen(true)} className="fixed bottom-5 left-4 z-[470] rounded-full border px-3 py-2 text-[10px] font-bold shadow-lg transition hover:-translate-y-0.5 active:scale-95 focus:outline-none focus:ring-2 focus:ring-cyan-300" style={{ borderColor: "oklch(0.65 0.18 200 / 0.55)", background: isDark ? "oklch(0.18 0.02 240 / 0.96)" : "white", color: isDark ? "oklch(0.78 0.14 200)" : "oklch(0.42 0.16 220)" }} aria-label={onboardingCopy.review}>ⓘ {onboardingCopy.review}</button>
      )}
      {!isOnboardingOpen && onboardingProgressQuery.data?.completedAt && <button ref={firstUseFeedbackTriggerRef} type="button" onClick={() => { const current = firstUseFeedbackQuery.data; setFirstUseEaseRating(current?.easeRating ?? 0); setFirstUseDifficultStep(current?.difficultStep ?? "none"); setFirstUseFeedbackSaveError(null); setIsFirstUseFeedbackOpen(true); }} className="fixed bottom-16 left-4 z-[470] rounded-full border px-3 py-2 text-[10px] font-bold shadow-lg transition hover:-translate-y-0.5 active:scale-95 focus:outline-none focus:ring-2 focus:ring-cyan-300" style={{ borderColor: "oklch(0.70 0.15 85 / 0.55)", background: isDark ? "oklch(0.18 0.02 240 / 0.96)" : "white", color: isDark ? "oklch(0.86 0.13 85)" : "oklch(0.46 0.13 62)" }} aria-label={firstUseFeedbackCopy.edit}>★ {firstUseFeedbackCopy.edit}</button>}

      {isOnboardingOpen && (
        <div className="fixed inset-0 z-[650] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="first-analysis-onboarding-title" aria-describedby="first-analysis-onboarding-description">
          <section ref={onboardingDialogRef} aria-busy={saveOnboardingProgressMutation.isPending || undefined} className="w-full max-w-lg rounded-2xl border p-5 shadow-2xl sm:p-6" style={{ borderColor: "oklch(0.65 0.18 200 / 0.45)", background: isDark ? "oklch(0.15 0.02 240)" : "oklch(0.99 0.005 240)", color: th.text }}>
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "oklch(0.68 0.15 200)" }}>{onboardingCopy.progress} {onboardingStep}/3</p><h2 id="first-analysis-onboarding-title" className="mt-1 text-lg font-black">{onboardingCopy.title}</h2><p id="first-analysis-onboarding-description" className="mt-2 text-xs leading-5" style={{ color: th.textMuted }}>{onboardingCopy.subtitle}</p></div><button ref={onboardingCloseButtonRef} type="button" onClick={closeOnboarding} className="rounded-lg border px-2 py-1 text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-cyan-300" style={{ borderColor: th.border2, color: th.textMuted }}>{onboardingCopy.later}</button></div>
            <div className="mt-5 flex gap-2" role="tablist" aria-label={`${onboardingCopy.progress} ${onboardingStep}/3`} aria-orientation="horizontal">{onboardingCopy.steps.map((label, index) => { const step = (index + 1) as 1 | 2 | 3; return <button key={label} id={`first-analysis-onboarding-tab-${step}`} type="button" role="tab" aria-selected={onboardingStep === step} aria-controls="first-analysis-onboarding-content" tabIndex={onboardingStep === step ? 0 : -1} onClick={() => void persistOnboardingStep(step)} onKeyDown={(event) => { if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return; event.preventDefault(); const nextStep = event.key === "Home" ? 1 : event.key === "End" ? 3 : (((step - 1 + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + 3) % 3) + 1) as 1 | 2 | 3; void persistOnboardingStep(nextStep); const tabs = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []); requestAnimationFrame(() => tabs[nextStep - 1]?.focus()); }} className="flex-1 rounded-lg border px-2 py-2 text-[10px] font-bold transition focus:outline-none focus:ring-2 focus:ring-cyan-300" style={{ borderColor: onboardingStep === step ? "oklch(0.65 0.18 200 / 0.65)" : th.border2, background: onboardingStep === step ? "oklch(0.65 0.18 200 / 0.12)" : "transparent", color: onboardingStep === step ? "oklch(0.75 0.14 200)" : th.textMuted }}>{step}. {label}</button>; })}</div>
            <article id="first-analysis-onboarding-content" role="tabpanel" aria-labelledby={`first-analysis-onboarding-tab-${onboardingStep}`} className="mt-4 rounded-xl border p-4" style={{ borderColor: th.border2, background: isDark ? "oklch(0.18 0.02 240)" : "oklch(0.96 0.01 240)" }}><p className="text-sm leading-6">{onboardingStep === 1 ? onboardingCopy.risk : onboardingStep === 2 ? onboardingCopy.evidence : onboardingCopy.action}</p></article>
            <div className="mt-5 flex items-center justify-between gap-3"><button type="button" disabled={onboardingStep === 1 || saveOnboardingProgressMutation.isPending} onClick={() => void persistOnboardingStep((onboardingStep - 1) as 1 | 2 | 3)} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-cyan-300" style={{ borderColor: th.border2, color: th.text }}>{onboardingCopy.previous}</button>{onboardingStep < 3 ? <button type="button" disabled={saveOnboardingProgressMutation.isPending} onClick={() => void persistOnboardingStep((onboardingStep + 1) as 1 | 2 | 3)} className="rounded-lg border border-cyan-300/60 bg-cyan-300/10 px-3 py-2 text-xs font-bold text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-200 disabled:opacity-45">{onboardingCopy.next}</button> : <button type="button" disabled={saveOnboardingProgressMutation.isPending} onClick={() => { void persistOnboardingStep(3, true); setIsOnboardingOpen(false); }} className="rounded-lg border border-emerald-300/60 bg-emerald-300/10 px-3 py-2 text-xs font-bold text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:opacity-45">{onboardingCopy.finish}</button>}</div>
          </section>
        </div>
      )}

      {isFirstUseFeedbackOpen && <div className="fixed inset-0 z-[660] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="first-use-feedback-title" aria-describedby="first-use-feedback-description"><section ref={firstUseFeedbackDialogRef} className="w-full max-w-lg rounded-2xl border p-5 shadow-2xl sm:p-6" style={{ borderColor: "oklch(0.70 0.15 85 / 0.45)", background: isDark ? "oklch(0.15 0.02 240)" : "oklch(0.99 0.005 240)", color: th.text }}><div className="flex items-start justify-between gap-2 sm:gap-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "oklch(0.78 0.14 85)" }}>{firstUseFeedbackCopy.response}</p><h2 id="first-use-feedback-title" className="mt-1 text-lg font-black">{firstUseFeedbackCopy.title}</h2><p id="first-use-feedback-description" className="mt-2 text-xs leading-5" style={{ color: th.textMuted }}>{firstUseFeedbackCopy.subtitle}</p></div><button ref={firstUseFeedbackCloseButtonRef} type="button" onClick={closeFirstUseFeedback} className="min-h-8 min-w-14 shrink-0 whitespace-nowrap rounded-lg border px-2 py-1 text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-cyan-300" style={{ borderColor: th.border2, color: th.textMuted }}>{firstUseFeedbackCopy.later}</button></div><div className="mt-5"><p className="text-xs font-bold">{firstUseFeedbackCopy.ease}</p><div className="mt-2 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={firstUseFeedbackCopy.ease}>{firstUseFeedbackCopy.ratings.map((label, index) => { const rating = index + 1; const selected = firstUseEaseRating === rating; return <button key={label} type="button" role="radio" aria-checked={selected} tabIndex={selected || (firstUseEaseRating === 0 && rating === 1) ? 0 : -1} aria-label={`${rating}/5, ${label}`} onClick={() => setFirstUseEaseRating(rating)} onKeyDown={(event) => { if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return; event.preventDefault(); const nextRating = event.key === "Home" ? 1 : event.key === "End" ? 5 : ((rating - 1 + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + 5) % 5) + 1; setFirstUseEaseRating(nextRating); const radios = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? []); requestAnimationFrame(() => radios[nextRating - 1]?.focus()); }} className="min-h-12 rounded-lg border px-1 text-center text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-cyan-300" style={{ borderColor: selected ? "oklch(0.76 0.16 85 / 0.8)" : th.border2, background: selected ? "oklch(0.76 0.16 85 / 0.15)" : th.bgCard2, color: selected ? (isDark ? "oklch(0.90 0.13 85)" : "oklch(0.42 0.13 62)") : th.textMuted }}><span className="block text-base">{rating}</span><span className="sr-only">{label}</span></button>; })}</div></div><div className="mt-5"><p className="text-xs font-bold">{firstUseFeedbackCopy.difficult}</p><div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label={firstUseFeedbackCopy.difficult}>{(["none", "orientation", "risk_review", "analysis_review"] as const).map(step => { const difficultSteps = ["none", "orientation", "risk_review", "analysis_review"] as const; const selected = firstUseDifficultStep === step; return <button key={step} type="button" role="radio" aria-checked={selected} tabIndex={selected ? 0 : -1} onClick={() => setFirstUseDifficultStep(step)} onKeyDown={(event) => { if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return; event.preventDefault(); const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? difficultSteps.length - 1 : (difficultSteps.indexOf(step) + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + difficultSteps.length) % difficultSteps.length; setFirstUseDifficultStep(difficultSteps[nextIndex]); const radios = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? []); requestAnimationFrame(() => radios[nextIndex]?.focus()); }} className="min-h-10 rounded-lg border px-3 py-2 text-left text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-cyan-300" style={{ borderColor: selected ? "oklch(0.65 0.18 200 / 0.72)" : th.border2, background: selected ? "oklch(0.65 0.18 200 / 0.12)" : th.bgCard2, color: selected ? (isDark ? "oklch(0.82 0.14 200)" : "oklch(0.38 0.16 220)") : th.textMuted }}>{firstUseFeedbackCopy.steps[step]}</button>; })}</div></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={closeFirstUseFeedback} className="rounded-lg border px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-cyan-300" style={{ borderColor: th.border2, color: th.text }}>{firstUseFeedbackCopy.later}</button><button type="button" disabled={firstUseEaseRating < 1 || saveFirstUseFeedbackMutation.isPending} onClick={() => void submitFirstUseFeedback()} className="rounded-lg border border-cyan-300/60 bg-cyan-300/10 px-3 py-2 text-xs font-bold text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-200 disabled:opacity-45">{saveFirstUseFeedbackMutation.isPending ? "…" : firstUseFeedbackCopy.submit}</button></div></section></div>}

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
