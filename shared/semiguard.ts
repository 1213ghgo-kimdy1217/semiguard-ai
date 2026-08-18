// SemiGuard AI 공유 타입 및 상수

export type RiskLevel = "normal" | "caution" | "warning" | "danger";

export interface SensorData {
  current: number;      // 전류 (A)
  temperature: number;  // 온도 (°C)
  vibration: number;    // 진동 (mm/s)
  noise: number;        // 소음 (dB)
  timestamp: number;
}

export interface AnomalyResult {
  sensorData: SensorData;
  anomalyScore: number;   // 0~100
  riskLevel: RiskLevel;
  isAnomaly: boolean;
  /** 서버가 이 관측값을 저장한 이상 이력 ID. AI 분석을 같은 관측값에만 연결할 때 사용합니다. */
  logId?: number;
}

export interface AnomalyLogEntry {
  id: number;
  timestamp: string;
  current: number;
  temperature: number;
  vibration: number;
  noise: number;
  anomalyScore: number;
  riskLevel: RiskLevel;
  isAnomaly: boolean;
  llmAnalysisKo?: string | null;
  llmAnalysisEn?: string | null;
  llmAnalysisJa?: string | null;
}

export const RISK_THRESHOLDS = {
  normal: 29,
  caution: 49,
  warning: 69,
  danger: 100,
} as const;

export function getRiskLevel(
  score: number,
  thresholds: { normal: number; caution: number; warning: number } = RISK_THRESHOLDS
): RiskLevel {
  if (score <= thresholds.normal) return "normal";
  if (score <= thresholds.caution) return "caution";
  if (score <= thresholds.warning) return "warning";
  return "danger";
}
