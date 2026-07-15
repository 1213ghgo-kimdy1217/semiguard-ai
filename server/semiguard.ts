// SemiGuard AI - Isolation Forest 기반 이상탐지 엔진
import { getRiskLevel, type RiskLevel, type SensorData } from "../shared/semiguard";

// ─── 정상 데이터 기준값 (학습된 기준) ───────────────────────────────────────
const NORMAL_BASELINE = {
  current:     { mean: 5.0,  std: 0.5 },
  temperature: { mean: 45.0, std: 3.0 },
  vibration:   { mean: 2.0,  std: 0.3 },
  noise:       { mean: 55.0, std: 4.0 },
};

// ─── Isolation Forest 간소화 구현 (서버 사이드) ──────────────────────────────
// 실제 Isolation Forest의 핵심 아이디어: 이상값일수록 더 적은 분기로 고립됨
// 여기서는 Mahalanobis 거리 기반 근사 구현 (라이브러리 없이 동작)
function computeAnomalyScore(data: SensorData): number {
  const fields: (keyof typeof NORMAL_BASELINE)[] = ["current", "temperature", "vibration", "noise"];
  let totalScore = 0;

  for (const field of fields) {
    const { mean, std } = NORMAL_BASELINE[field];
    const value = data[field];
    // z-score 절댓값 계산
    const z = Math.abs((value - mean) / std);
    // 각 센서의 기여도 합산 (최대 25점씩, 총 100점)
    totalScore += Math.min(z * 8, 25);
  }

  return Math.min(Math.round(totalScore), 100);
}

// ─── 센서 데이터 생성기 ──────────────────────────────────────────────────────
export function generateNormalData(): SensorData {
  const rand = (mean: number, std: number) =>
    mean + (Math.random() - 0.5) * std * 2;

  return {
    current:     parseFloat(rand(NORMAL_BASELINE.current.mean,     NORMAL_BASELINE.current.std).toFixed(2)),
    temperature: parseFloat(rand(NORMAL_BASELINE.temperature.mean, NORMAL_BASELINE.temperature.std).toFixed(1)),
    vibration:   parseFloat(rand(NORMAL_BASELINE.vibration.mean,   NORMAL_BASELINE.vibration.std).toFixed(2)),
    noise:       parseFloat(rand(NORMAL_BASELINE.noise.mean,       NORMAL_BASELINE.noise.std).toFixed(1)),
    timestamp:   Date.now(),
  };
}

export function generateAnomalyData(): SensorData {
  // 이상 상태: 기준값에서 3~5 표준편차 벗어남
  const rand = (mean: number, std: number, factor: number) =>
    mean + std * factor * (Math.random() > 0.5 ? 1 : -1);

  return {
    current:     parseFloat(rand(NORMAL_BASELINE.current.mean,     NORMAL_BASELINE.current.std,     4.0).toFixed(2)),
    temperature: parseFloat(rand(NORMAL_BASELINE.temperature.mean, NORMAL_BASELINE.temperature.std, 4.5).toFixed(1)),
    vibration:   parseFloat(rand(NORMAL_BASELINE.vibration.mean,   NORMAL_BASELINE.vibration.std,   5.0).toFixed(2)),
    noise:       parseFloat(rand(NORMAL_BASELINE.noise.mean,       NORMAL_BASELINE.noise.std,       4.0).toFixed(1)),
    timestamp:   Date.now(),
  };
}

export function analyzeData(data: SensorData) {
  const anomalyScore = computeAnomalyScore(data);
  const riskLevel: RiskLevel = getRiskLevel(anomalyScore);
  const isAnomaly = anomalyScore >= 50;
  return { sensorData: data, anomalyScore, riskLevel, isAnomaly };
}
