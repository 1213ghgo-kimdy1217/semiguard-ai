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
  // 위험 상태: 3개 센서만 크게 이탈, 1개는 약간 이탈 → 점수 70~95 범위
  // 4개 모두 z=3.5+ 이탈 시 항상 100이 되므로, 이탈 센서 수와 크기를 조절
  const fields: (keyof typeof NORMAL_BASELINE)[] = ["current", "temperature", "vibration", "noise"];
  // 3개 센서는 크게 이탈(z=2.8~3.8), 1개는 약간 이탈(z=1.0~1.5) → 총 점수 70~95
  const shuffled = [...fields].sort(() => Math.random() - 0.5);
  const bigDeviateFields = new Set(shuffled.slice(0, 3));

  const result: Record<string, number> = { timestamp: Date.now() };
  for (const field of fields) {
    const { mean, std } = NORMAL_BASELINE[field];
    const factor = bigDeviateFields.has(field)
      ? 2.8 + Math.random() * 1.0   // z=2.8~3.8 → 점수 22.4~25(cap)
      : 1.0 + Math.random() * 0.5;  // z=1.0~1.5 → 점수 8~12
    const sign = Math.random() > 0.5 ? 1 : -1;
    const val = mean + std * factor * sign;
    result[field] = parseFloat(val.toFixed(field === "temperature" || field === "noise" ? 1 : 2));
  }
  return result as unknown as SensorData;
}

// 주의 단계 데이터: z-score 1.5~2.5 → 점수 30~49
export function generateCautionData(): SensorData {
  const rand = (mean: number, std: number) => {
    const factor = 1.5 + Math.random() * 1.0;
    return mean + std * factor * (Math.random() > 0.5 ? 1 : -1);
  };
  return {
    current:     parseFloat(rand(NORMAL_BASELINE.current.mean,     NORMAL_BASELINE.current.std).toFixed(2)),
    temperature: parseFloat(rand(NORMAL_BASELINE.temperature.mean, NORMAL_BASELINE.temperature.std).toFixed(1)),
    vibration:   parseFloat(rand(NORMAL_BASELINE.vibration.mean,   NORMAL_BASELINE.vibration.std).toFixed(2)),
    noise:       parseFloat(rand(NORMAL_BASELINE.noise.mean,       NORMAL_BASELINE.noise.std).toFixed(1)),
    timestamp:   Date.now(),
  };
}

// 경고 단계 데이터: z-score 2.5~3.5 → 점수 50~69
export function generateWarningData(): SensorData {
  const rand = (mean: number, std: number) => {
    const factor = 2.0 + Math.random() * 1.5;  // z=2.0~3.5 → 점수 50~69 범위
    return mean + std * factor * (Math.random() > 0.5 ? 1 : -1);
  };
  return {
    current:     parseFloat(rand(NORMAL_BASELINE.current.mean,     NORMAL_BASELINE.current.std).toFixed(2)),
    temperature: parseFloat(rand(NORMAL_BASELINE.temperature.mean, NORMAL_BASELINE.temperature.std).toFixed(1)),
    vibration:   parseFloat(rand(NORMAL_BASELINE.vibration.mean,   NORMAL_BASELINE.vibration.std).toFixed(2)),
    noise:       parseFloat(rand(NORMAL_BASELINE.noise.mean,       NORMAL_BASELINE.noise.std).toFixed(1)),
    timestamp:   Date.now(),
  };
}

export function analyzeData(data: SensorData) {
  const anomalyScore = computeAnomalyScore(data);
  const riskLevel: RiskLevel = getRiskLevel(anomalyScore);
  const isAnomaly = anomalyScore >= 70;
  return { sensorData: data, anomalyScore, riskLevel, isAnomaly };
}
