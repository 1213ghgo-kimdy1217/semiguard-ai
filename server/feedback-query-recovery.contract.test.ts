import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("feedback query recovery contract", () => {
  it("distinguishes loading failures from empty feedback history", () => {
    expect(dashboardSource).toContain("feedbackHistoryQuery.isError");
    expect(dashboardSource).toContain("피드백 이력을 불러오지 못했습니다.");
    expect(dashboardSource).toContain("フィードバック履歴を読み込めませんでした。");
  });

  it("offers independent, guarded retry controls for feedback history and conversation context", () => {
    expect(dashboardSource).toContain("feedbackContextMessagesQuery.isError");
    expect(dashboardSource).toContain("상담 맥락을 불러오지 못했습니다.");
    expect(dashboardSource).toContain("void feedbackHistoryQuery.refetch()");
    expect(dashboardSource).toContain("void feedbackContextMessagesQuery.refetch()");
    expect(dashboardSource).toContain("feedbackHistoryQuery.isFetching");
    expect(dashboardSource).toContain("feedbackContextMessagesQuery.isFetching");
  });
});
