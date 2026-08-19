import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");
const judgeDemoSource = readFileSync(resolve(process.cwd(), "client/src/pages/JudgeDemo.tsx"), "utf8");

describe("sensor mutation authentication boundary contract", () => {
  it("protects dashboard-only sensor history mutations and AI analysis storage", () => {
    [
      "injectNormal",
      "injectAnomaly",
      "injectCaution",
      "injectWarning",
      "autoFetch",
      "clearLogs",
      "analyzeAnomaly",
    ].forEach(procedure => {
      expect(routerSource).toContain(`${procedure}: protectedProcedure`);
      expect(routerSource).not.toContain(`${procedure}: publicProcedure`);
    });
  });

  it("keeps sensor mutation controls in the protected dashboard, not the public judge demo", () => {
    expect(dashboardSource).toContain("trpc.semiguard.autoFetch.useMutation()");
    expect(dashboardSource).toContain("trpc.semiguard.injectAnomaly.useMutation()");
    ["autoFetch", "injectNormal", "injectAnomaly", "injectCaution", "injectWarning", "clearLogs", "analyzeAnomaly"].forEach(procedure => {
      expect(judgeDemoSource).not.toContain(`semiguard.${procedure}`);
    });
  });

  it("protects dashboard-only configuration and LLM-consuming mutations", () => {
    [
      "resetSavedCost",
      "saveThresholds",
      "saveSensorThresholds",
      "summarizePeriodForReport",
      "chatWithAi",
    ].forEach(procedure => {
      expect(routerSource).toContain(`${procedure}: protectedProcedure`);
      expect(routerSource).not.toContain(`${procedure}: publicProcedure`);
    });
    expect(dashboardSource).toContain("trpc.semiguard.summarizePeriodForReport.useMutation()");
    expect(dashboardSource).toContain("trpc.semiguard.chatWithAi.useMutation()");
  });

  it("protects the dashboard-only legacy visit counter from public metric inflation", () => {
    expect(routerSource).toContain("trackVisit: protectedProcedure.mutation");
    expect(routerSource).not.toContain("trackVisit: publicProcedure.mutation");
    expect(dashboardSource).toContain("trpc.semiguard.trackVisit.useMutation()");
    expect(judgeDemoSource).not.toContain("semiguard.trackVisit");
  });

  it("protects operational sensor reads while the public demo remains self-contained", () => {
    [
      "getLogs",
      "getStats",
      "getDailyMaxRisk",
      "getThresholds",
      "getRecentScores",
      "getPeriodOverview",
      "getSensorThresholds",
      "getLlmHistory",
    ].forEach(procedure => {
      expect(routerSource).toContain(`${procedure}: protectedProcedure`);
      expect(routerSource).not.toContain(`${procedure}: publicProcedure`);
    });
    expect(judgeDemoSource).not.toContain("trpc.semiguard.");
  });
});
