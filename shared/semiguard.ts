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
}

export const RISK_THRESHOLDS = {
  normal: 29,
  caution: 49,
  warning: 69,
  danger: 100,
} as const;

export function getRiskLevel(score: number): RiskLevel {
  if (score <= RISK_THRESHOLDS.normal) return "normal";
  if (score <= RISK_THRESHOLDS.caution) return "caution";
  if (score <= RISK_THRESHOLDS.warning) return "warning";
  return "danger";
}
