import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dashboard = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");
const observationStyles = readFileSync(resolve(process.cwd(), "client/src/pages/dashboard-observation.css"), "utf8");
const scenarioStyles = readFileSync(resolve(process.cwd(), "client/src/pages/etch-training.css"), "utf8");

describe("four-sensor dashboard visual language", () => {
  it("reuses the scenario palette without replacing dashboard behavior", () => {
    expect(dashboard).toContain('import "./dashboard-observation.css"');
    expect(dashboard).toContain('isDark ? "#101516" : "#eef1eb"');
    expect(scenarioStyles).toContain("#101516");
    for (const token of ["#18201f", "#1d2825", "#e4aa55"]) {
      expect(observationStyles).toContain(token);
      expect(scenarioStyles).toContain(token);
    }
    expect(dashboard).toContain('data-theme={isDark ? "dark" : "light"}');
    expect(dashboard).toContain('className="sg-observation-hero mb-5 overflow-hidden"');
    expect(dashboard).toContain('className="sg-score-tile flex flex-col justify-between p-5"');
    expect(dashboard).toContain('className="sg-chart-controls flex flex-wrap');
  });

  it("keeps sensor colors and separate units while giving controls an accessible focus treatment", () => {
    expect(observationStyles).toContain(':focus-visible');
    expect(observationStyles).toContain('prefers-reduced-motion: reduce');
    for (const sensor of ["current", "temperature", "vibration", "noise"]) {
      expect(dashboard).toContain(`<YAxis yAxisId="${sensor}"`);
      expect(dashboard).toContain(`<Line yAxisId="${sensor}"`);
    }
    expect(dashboard).toContain('AI에 관측 근거 질문하기 · 설명 보조');
    expect(dashboard).toContain('가상 센서 관찰 화면 · 실제 팹 장비 연결 없음');
  });
});
