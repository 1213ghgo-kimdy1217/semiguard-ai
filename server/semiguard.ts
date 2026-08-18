// SemiGuard AI - z-score 기반 규칙형 위험 점수 엔진
import { getRiskLevel, type RiskLevel, type SensorData } from "../shared/semiguard";

// ─── 현재 시뮬레이션 기준값 (실제 설비 학습값 아님) ───────────────────────────
export const NORMAL_BASELINE = {
  current:     { mean: 5.0,  std: 0.5 },
  temperature: { mean: 45.0, std: 3.0 },
  vibration:   { mean: 2.0,  std: 0.3 },
  noise:       { mean: 55.0, std: 4.0 },
};

// ─── 독립 z-score 합산 방식 (서버 사이드) ─────────────────────────────────────
// 각 센서의 정상 기준에서 벗어난 정도를 표준편차 단위(|z|)로 계산합니다.
// 센서별 기여도는 |z| × 8, 최대 25점이며 4개 센서 기여도를 100점으로 제한합니다.
// 현재 구현은 Isolation Forest 라이브러리·학습 모델·공분산 기반 Mahalanobis 거리를 사용하지 않습니다.
export function computeAnomalyScore(data: SensorData): number {
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

// 주의 단계 데이터: 점수 30~49 보장
// 4개 센서 모두 이탈 시 점수가 60+ 로 올라가므로, 2개만 중간 이탈(z=1.8~2.3), 2개는 정상
export function generateCautionData(): SensorData {
  const fields: (keyof typeof NORMAL_BASELINE)[] = ["current", "temperature", "vibration", "noise"];
  const shuffled = [...fields].sort(() => Math.random() - 0.5);
  const devFields = new Set(shuffled.slice(0, 2)); // 2개만 이탈
  const result: Record<string, number> = { timestamp: Date.now() };
  for (const field of fields) {
    const { mean, std } = NORMAL_BASELINE[field];
    if (devFields.has(field)) {
      // 이탈: z=1.8~2.3 → 점수 14.4~18.4 per sensor, 2개 합산 28~37
      const factor = 1.8 + Math.random() * 0.5;
      const sign = Math.random() > 0.5 ? 1 : -1;
      const val = mean + std * factor * sign;
      result[field] = parseFloat(val.toFixed(field === "temperature" || field === "noise" ? 1 : 2));
    } else {
      // 정상: z=0~0.5 → 점수 0~4 per sensor
      const val = mean + (Math.random() - 0.5) * std * 0.8;
      result[field] = parseFloat(val.toFixed(field === "temperature" || field === "noise" ? 1 : 2));
    }
  }
  return result as unknown as SensorData;
}

// 경고 단계 데이터: 점수 50~69 보장
// 3개 센서 이탈(z=2.0~2.5), 1개 정상 → 3*16~20 + 1*2 = 50~62
export function generateWarningData(): SensorData {
  const fields: (keyof typeof NORMAL_BASELINE)[] = ["current", "temperature", "vibration", "noise"];
  const shuffled = [...fields].sort(() => Math.random() - 0.5);
  const devFields = new Set(shuffled.slice(0, 3)); // 3개 이탈
  const result: Record<string, number> = { timestamp: Date.now() };
  for (const field of fields) {
    const { mean, std } = NORMAL_BASELINE[field];
    if (devFields.has(field)) {
      // 이탈: z=2.0~2.5 → 점수 16~20 per sensor, 3개 합산 48~60
      const factor = 2.0 + Math.random() * 0.5;
      const sign = Math.random() > 0.5 ? 1 : -1;
      const val = mean + std * factor * sign;
      result[field] = parseFloat(val.toFixed(field === "temperature" || field === "noise" ? 1 : 2));
    } else {
      // 정상: z=0~0.5 → 점수 0~4
      const val = mean + (Math.random() - 0.5) * std * 0.8;
      result[field] = parseFloat(val.toFixed(field === "temperature" || field === "noise" ? 1 : 2));
    }
  }
  return result as unknown as SensorData;
}

// 약한 주의: 1개 센서 살짝 이탈 (점수 10~25 → 주의 단계 진입)
export function generateSlightCautionData(): SensorData {
  const fields: (keyof typeof NORMAL_BASELINE)[] = ["current", "temperature", "vibration", "noise"];
  const devField = fields[Math.floor(Math.random() * fields.length)];
  const result: Record<string, number> = { timestamp: Date.now() };
  for (const field of fields) {
    const { mean, std } = NORMAL_BASELINE[field];
    if (field === devField) {
      // z=1.3~1.7 → 점수 10~14 per sensor
      const factor = 1.3 + Math.random() * 0.4;
      const sign = Math.random() > 0.5 ? 1 : -1;
      const val = mean + std * factor * sign;
      result[field] = parseFloat(val.toFixed(field === "temperature" || field === "noise" ? 1 : 2));
    } else {
      const val = mean + (Math.random() - 0.5) * std * 0.6;
      result[field] = parseFloat(val.toFixed(field === "temperature" || field === "noise" ? 1 : 2));
    }
  }
  return result as unknown as SensorData;
}

// 약한 경고: 2개 센서 이탈 (점수 30~50 → 경고 단계)
export function generateSlightWarningData(): SensorData {
  const fields: (keyof typeof NORMAL_BASELINE)[] = ["current", "temperature", "vibration", "noise"];
  const shuffled = [...fields].sort(() => Math.random() - 0.5);
  const devFields = new Set(shuffled.slice(0, 2));
  const result: Record<string, number> = { timestamp: Date.now() };
  for (const field of fields) {
    const { mean, std } = NORMAL_BASELINE[field];
    if (devFields.has(field)) {
      // z=1.5~2.0 → 점수 12~16 per sensor, 2개 합산 24~32
      const factor = 1.5 + Math.random() * 0.5;
      const sign = Math.random() > 0.5 ? 1 : -1;
      const val = mean + std * factor * sign;
      result[field] = parseFloat(val.toFixed(field === "temperature" || field === "noise" ? 1 : 2));
    } else {
      const val = mean + (Math.random() - 0.5) * std * 0.6;
      result[field] = parseFloat(val.toFixed(field === "temperature" || field === "noise" ? 1 : 2));
    }
  }
  return result as unknown as SensorData;
}

export function analyzeData(data: SensorData) {
  const anomalyScore = computeAnomalyScore(data);
  const riskLevel: RiskLevel = getRiskLevel(anomalyScore);
  const isAnomaly = anomalyScore >= 70;
  return { sensorData: data, anomalyScore, riskLevel, isAnomaly };
}
