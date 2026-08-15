import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("anomaly detail Japanese-only analysis contract", () => {
  it("renders the analysis section when a stored anomaly only has Japanese AI analysis", () => {
    expect(dashboardSource).toContain("(log.llmAnalysisKo || log.llmAnalysisEn || log.llmAnalysisJa)");
    expect(dashboardSource).toContain('const raw = lang === "ko" ? log.llmAnalysisKo : lang === "ja" ? log.llmAnalysisJa : log.llmAnalysisEn;');
    expect(dashboardSource).toContain("const fallback = log.llmAnalysisKo || log.llmAnalysisEn || log.llmAnalysisJa;");
  });
});
