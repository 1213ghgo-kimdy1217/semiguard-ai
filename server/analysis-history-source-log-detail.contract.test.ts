import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("AI analysis history source-log detail contract", () => {
  it("maps an analysis item to the same observation log before opening details", () => {
    expect(dashboardSource).toContain("const sourceLog = logs.find((log) => log.id === item.id);");
    expect(dashboardSource).toContain("const exactLog = sourceLog ?? await utils.semiguard.getLogById.fetch({ id: item.id });");
    expect(dashboardSource).toContain("setSelectedLog(exactLog);");
    expect(dashboardSource).toContain("setShowAiHistory(false);");
  });

  it("keeps the source-log control accessible and prevents a missing log from opening an unrelated detail", () => {
    expect(dashboardSource).toContain("disabled={isOpeningSourceLog}");
    expect(dashboardSource).toContain("if (!exactLog)");
    expect(dashboardSource).toContain("View source observation log ${item.id} details");
  });
});
