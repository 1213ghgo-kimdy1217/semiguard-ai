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

// 교육용 가상 센서의 비교 기준입니다. 실측 장비의 허용 범위가 아닙니다.
export const NORMAL_BASELINE = {
  current: { mean: 5.0, std: 0.5 },
  temperature: { mean: 45.0, std: 3.0 },
  vibration: { mean: 2.0, std: 0.3 },
  noise: { mean: 55.0, std: 4.0 },
} as const;

export function sensorScoreContribution(field: keyof typeof NORMAL_BASELINE, value: number): number {
  const { mean, std } = NORMAL_BASELINE[field];
  return Math.min(Math.abs((value - mean) / std) * 8, 25);
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
