import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("sensor card evidence contract", () => {
  it("shows each sensor's own value trend, reference, and rule-score contribution", () => {
    expect(dashboardSource).toContain("displayedSensorChartData.map(point => point[overviewSensorKey])");
    expect(dashboardSource).toContain("sensorScoreContribution(overviewSensorKey, card.value)");
    expect(dashboardSource).toContain('lang === "ko" ? `센서값 추이 · ${selectedPeriodLabel}` : lang === "ja" ? `センサー値推移・${selectedPeriodLabel}` : `Sensor trend · ${selectedPeriodLabel}`');
    expect(dashboardSource).not.toContain("<Sparkline data={scoreHistory} color={card.color}");
  });
});
