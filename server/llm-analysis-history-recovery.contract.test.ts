import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("LLM analysis history recovery contract", () => {
  it("keeps a failed analysis-history request distinct from an empty history", () => {
    expect(dashboardSource).toContain("llmHistoryQuery.isError");
    expect(dashboardSource).toContain("분석 이력을 불러오지 못했습니다.");
    expect(dashboardSource).toContain("分析履歴を取得できませんでした。");
  });

  it("offers a guarded retry action for the failed analysis-history request", () => {
    expect(dashboardSource).toContain("void llmHistoryQuery.refetch()");
    expect(dashboardSource).toContain("llmHistoryQuery.isFetching");
    expect(dashboardSource).toContain("다시 시도");
  });
});
