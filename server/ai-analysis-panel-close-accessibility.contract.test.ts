import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("AI analysis panel close accessibility contract", () => {
  it("provides a localized accessible name for the floating analysis close control", () => {
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "AI 분석 패널 닫기" : lang === "ja" ? "AI分析パネルを閉じる" : "Close AI analysis panel"}');
    expect(dashboardSource).toContain("onClick={() => setLlmAnalysis(null)}");
  });

  it("keeps the localized analysis and recommendation text while hiding decorative icons", () => {
    expect(dashboardSource).toContain('<span className="text-base" aria-hidden="true">🤖</span>');
    expect(dashboardSource).toContain('<span className="text-xs mt-0.5" aria-hidden="true">💡</span>');
    expect(dashboardSource).toContain('<span className="text-xs mt-0.5 flex-shrink-0" aria-hidden="true">💡</span>');
  });
});
