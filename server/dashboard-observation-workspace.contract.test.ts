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
    expect(source).toContain("기간별 기록·보고서 도구");
    expect(source).toContain("가상 신호 주입 · 선택 도구");
    expect(source).toContain('isUsageMetricsAdmin && <details className="order-last col-span-12');
    expect(source).not.toContain("<ImpactCard label={t.totalVisitors}");
  });

  it("keeps unlike sensor units on separate trend axes", () => {
    for (const sensor of ["current", "temperature", "vibration", "noise"]) {
      expect(source).toContain(`<YAxis yAxisId="${sensor}"`);
      expect(source).toContain(`<Line yAxisId="${sensor}"`);
    }
  });
});
