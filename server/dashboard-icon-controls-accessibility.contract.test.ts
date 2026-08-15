import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard icon controls accessibility contract", () => {
  it("localizes accessible names for history, feedback summary, and date filter icon controls", () => {
    expect(dashboardSource).toContain('"AI 분석 이력 닫기" : lang === "ja" ? "AI分析履歴を閉じる" : "Close AI analysis history"');
    expect(dashboardSource).toContain('"핵심 키워드 요약 닫기" : lang === "ja" ? "主要キーワード要約を閉じる" : "Close key-term summary"');
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "날짜 필터 해제" : lang === "ja" ? "日付フィルター解除" : "Clear date filter"}');
  });
});
