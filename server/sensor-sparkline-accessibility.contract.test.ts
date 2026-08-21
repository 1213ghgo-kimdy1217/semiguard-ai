import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("sensor sparkline accessibility contract", () => {
  it("exposes each mini score trend as a labelled image with a title", () => {
    expect(dashboardSource).toContain('role="img" aria-label={label}');
    expect(dashboardSource).toContain('<title>{label}</title>');
    expect(dashboardSource).toContain('label={scoreTrendSummary}');
  });

  it("describes current, minimum, and maximum scores in Korean, English, and Japanese", () => {
    expect(dashboardSource).toContain('현재 ${currentScore}, 최저 ${minScore}, 최고 ${maxScore}');
    expect(dashboardSource).toContain('現在 ${currentScore}、最小 ${minScore}、最大 ${maxScore}');
    expect(dashboardSource).toContain('Current ${currentScore}, minimum ${minScore}, maximum ${maxScore}');
  });

  it("hides decorative sensor card icons while retaining the sensor label and trend summary", () => {
    expect(dashboardSource).toContain('<span aria-hidden="true" className="text-base opacity-70">{card.icon}</span>');
  });
});
