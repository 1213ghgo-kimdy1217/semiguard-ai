import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("four-sensor observation workspace", () => {
  it("renders the exact saved auto-fetch sample in the cards and trend instead of a second client-side draw", () => {
    expect(source).toContain("onSuccess: (result) => {");
    expect(source).toContain("setCurrent(result)");
    expect(source).toContain("setChartData(prev => [...prev, { ...result.sensorData");
    expect(source).not.toContain("function generateNormalData()");
    expect(source).not.toContain("function analyzeData(data: SensorData)");
  });

  it("keeps the primary view focused on observation while optional controls are disclosed", () => {
    expect(source).toContain('id="observation-workspace-title"');
    expect(source).toContain('href="#sensor-evidence"');
    expect(source).toContain('href="#sensor-trend"');
    expect(source).toContain('onClick={() => setActiveTab("log")}');
    expect(source).toContain("기간별 기록·보고서 도구");
    expect(source).toContain("가상 신호 주입 · 선택 도구");
    expect(source).toContain('isUsageMetricsAdmin && <details className="order-last col-span-12');
    expect(source).not.toContain("<ImpactCard label={t.totalVisitors}");
    expect(source).not.toContain('id="first-analysis-onboarding-title"');
    expect(source).not.toContain('id="first-use-feedback-title"');
  });

  it("explains the largest rule-score contribution without claiming a diagnosed cause", () => {
    expect(source).toContain("const leadingSensorEvidence = sensorData");
    expect(source).toContain("sensorScoreContribution(field, sensorData[field])");
    expect(source).toContain("관찰된 편차이며 고장 원인을 뜻하지 않습니다.");
    expect(source).toContain("AI에 관측 근거 질문하기 · 설명 보조");
  });

  it("keeps unlike sensor units on separate trend axes", () => {
    for (const sensor of ["current", "temperature", "vibration", "noise"]) {
      expect(source).toContain(`<YAxis yAxisId="${sensor}"`);
      expect(source).toContain(`<Line yAxisId="${sensor}"`);
    }
  });
});
