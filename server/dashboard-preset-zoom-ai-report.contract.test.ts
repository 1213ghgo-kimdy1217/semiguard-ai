import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

describe("dashboard period presets, zoom, and AI report contract", () => {
  it("stores a bounded list of named custom period presets with apply and delete controls", () => {
    expect(dashboardSource).toContain('const CUSTOM_PERIOD_PRESETS_KEY = "semiguard_custom_period_presets"');
    expect(dashboardSource).toContain("const MAX_CUSTOM_PERIOD_PRESETS = 8");
    expect(dashboardSource).toContain("function readCustomPeriodPresets()");
    expect(dashboardSource).toContain("const saveCustomPeriodPreset = () => {");
    expect(dashboardSource).toContain("const applyCustomPeriodPreset = (preset: CustomPeriodPreset)");
    expect(dashboardSource).toContain("const deleteCustomPeriodPreset = (presetId: string)");
  });

  it("provides drag selection, zoom, pan, reset, and keyboard controls for both sensor charts", () => {
    expect(dashboardSource).toContain('import { Brush, LineChart');
    expect(dashboardSource).toContain("const zoomSensorChart = (direction: \"in\" | \"out\")");
    expect(dashboardSource).toContain("const panSensorChart = (direction: \"back\" | \"forward\")");
    expect(dashboardSource).toContain("const resetSensorChartZoom");
    expect(dashboardSource.match(/<Brush dataKey="label"/g)?.length).toBe(2);
    expect(dashboardSource).toContain("onWheel={event =>");
    expect(dashboardSource).toContain("onKeyDown={handleSensorChartKeyDown}");
  });

  it("adds a data-grounded AI report summary with a server-side fallback", () => {
    expect(routerSource).toContain("summarizePeriodForReport: protectedProcedure");
    expect(routerSource).toContain('model: "gpt-5-mini"');
    expect(routerSource).toContain("Use only supplied numbers and do not diagnose a specific hardware failure.");
    expect(routerSource).toContain('source: "fallback" as const');
    expect(routerSource).toContain("const fallbackSummary = lang === \"ko\"");
    expect(routerSource).toContain("期間データの安全サマリー");
    expect(dashboardSource).toContain("summarizePeriodForReportMutation");
    expect(dashboardSource).toContain("AI 센서 추세 요약");
    expect(dashboardSource).toContain("preparedWindow?: Window | null");
  });
});
