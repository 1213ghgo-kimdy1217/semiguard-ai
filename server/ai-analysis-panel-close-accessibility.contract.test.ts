import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("AI analysis panel close accessibility contract", () => {
  it("provides a localized accessible name for the floating analysis close control", () => {
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "AI 분석 패널 닫기" : lang === "ja" ? "AI分析パネルを閉じる" : "Close AI analysis panel"}');
    expect(dashboardSource).toContain("onClick={() => setLlmAnalysis(null)}");
  });
});
