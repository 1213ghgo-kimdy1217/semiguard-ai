import { describe, expect, it } from "vitest";
import { analyzeData, generateNormalData, generateAnomalyData } from "./semiguard";
import { getRiskLevel } from "../shared/semiguard";

describe("SemiGuard AI - 이상탐지 엔진", () => {
  it("정상 데이터는 낮은 이상 점수를 반환해야 한다", () => {
    // 정상 기준값에 가까운 데이터
    const normalData = {
      current: 5.0,
      temperature: 45.0,
      vibration: 2.0,
      noise: 55.0,
      timestamp: Date.now(),
    };
    const result = analyzeData(normalData);
    expect(result.anomalyScore).toBeLessThan(30);
    expect(result.riskLevel).toBe("normal");
    expect(result.isAnomaly).toBe(false);
  });

  it("이상 데이터는 높은 이상 점수를 반환해야 한다", () => {
    // 기준값에서 크게 벗어난 데이터
    const anomalyData = {
      current: 25.0,   // 기준 5.0에서 크게 벗어남
      temperature: 90.0, // 기준 45.0에서 크게 벗어남
      vibration: 15.0,   // 기준 2.0에서 크게 벗어남
      noise: 90.0,       // 기준 55.0에서 크게 벗어남
      timestamp: Date.now(),
    };
    const result = analyzeData(anomalyData);
    expect(result.anomalyScore).toBeGreaterThan(50);
    expect(result.isAnomaly).toBe(true);
  });

  it("이상 점수는 0~100 범위 내에 있어야 한다", () => {
    for (let i = 0; i < 20; i++) {
      const data = Math.random() > 0.5 ? generateNormalData() : generateAnomalyData();
      const result = analyzeData(data);
      expect(result.anomalyScore).toBeGreaterThanOrEqual(0);
      expect(result.anomalyScore).toBeLessThanOrEqual(100);
    }
  });

  it("위험도 4단계 분류가 올바르게 동작해야 한다", () => {
    expect(getRiskLevel(0)).toBe("normal");
    expect(getRiskLevel(29)).toBe("normal");
    expect(getRiskLevel(30)).toBe("caution");
    expect(getRiskLevel(49)).toBe("caution");
    expect(getRiskLevel(50)).toBe("warning");
    expect(getRiskLevel(69)).toBe("warning");
    expect(getRiskLevel(70)).toBe("danger");
    expect(getRiskLevel(100)).toBe("danger");
  });

  it("generateNormalData는 정상 범위 내 데이터를 생성해야 한다", () => {
    for (let i = 0; i < 10; i++) {
      const data = generateNormalData();
      expect(data.current).toBeGreaterThan(0);
      expect(data.temperature).toBeGreaterThan(0);
      expect(data.vibration).toBeGreaterThan(0);
      expect(data.noise).toBeGreaterThan(0);
      expect(data.timestamp).toBeGreaterThan(0);
    }
  });

  it("generateAnomalyData는 이상 범위 데이터를 생성해야 한다", () => {
    let anomalyCount = 0;
    for (let i = 0; i < 10; i++) {
      const data = generateAnomalyData();
      const result = analyzeData(data);
      if (result.isAnomaly) anomalyCount++;
    }
    // 이상 데이터 10개 중 최소 7개는 이상으로 탐지되어야 함
    expect(anomalyCount).toBeGreaterThanOrEqual(7);
  });
});
