import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("AI analysis history source-log fetch contract", () => {
  it("offers an authenticated single-log query with the same normalized fields as history logs", () => {
    expect(routerSource).toContain("getLogById: protectedProcedure");
    expect(routerSource).toContain("getAnomalyLogById(input.id)");
    expect(routerSource).toContain("timestamp: log.timestamp.toISOString()");
  });

  it("fetches a missing source log by ID instead of opening an unrelated recent log", () => {
    expect(dashboardSource).toContain("utils.semiguard.getLogById.fetch({ id: item.id })");
    expect(dashboardSource).toContain("if (!exactLog)");
    expect(dashboardSource).toContain("setSelectedLog(exactLog)");
  });
});
