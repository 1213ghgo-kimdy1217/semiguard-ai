import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("sensor sparkline accessibility contract", () => {
  it("exposes each mini sensor-value trend as a labelled image with a title", () => {
    expect(dashboardSource).toContain('role="img" aria-label={label}');
    expect(dashboardSource).toContain('<title>{label}</title>');
    expect(dashboardSource).toContain('label={scoreTrendSummary}');
  });

  it("describes current, minimum, and maximum sensor values in Korean, English, and Japanese", () => {
    expect(dashboardSource).toContain('센서값 추이. 현재 ${card.value ?? "미수신"}, 최저 ${sensorTrend.length ? Math.min(...sensorTrend) : "없음"}');
    expect(dashboardSource).toContain('センサー値推移。現在 ${card.value ?? "未受信"}、最小');
    expect(dashboardSource).toContain('sensor values. Current ${card.value ?? "pending"}, minimum');
  });

  it("hides decorative sensor card icons while retaining the sensor label and trend summary", () => {
    expect(dashboardSource).toContain('<span aria-hidden="true" className="text-base opacity-70">{card.icon}</span>');
  });
});
