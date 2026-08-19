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
});
