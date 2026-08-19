import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("threshold setting accordion accessibility contract", () => {
  it("connects global risk threshold toggle state to its labelled region", () => {
    expect(dashboardSource).toContain("aria-expanded={showThresholdPanel}");
    expect(dashboardSource).toContain('aria-controls="risk-threshold-panel"');
    expect(dashboardSource).toContain('id="risk-threshold-panel" role="region" aria-label={lang === "ko"');
  });

  it("connects sensor threshold toggle state to its labelled region", () => {
    expect(dashboardSource).toContain("aria-expanded={showSensorPanel}");
    expect(dashboardSource).toContain('aria-controls="sensor-threshold-panel"');
    expect(dashboardSource).toContain('id="sensor-threshold-panel" role="region" aria-label={lang === "ko"');
  });
});
