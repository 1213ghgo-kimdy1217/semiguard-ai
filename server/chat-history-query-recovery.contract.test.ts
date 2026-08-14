import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("consultation history query recovery contract", () => {
  it("distinguishes consultation list and search failures from empty history", () => {
    expect(dashboardSource).toContain("chatSessionsQuery.isError");
    expect(dashboardSource).toContain("searchChatSessionsQuery.isError");
    expect(dashboardSource).toContain("상담 기록을 불러오지 못했습니다.");
    expect(dashboardSource).toContain("상담 기록 검색 결과를 불러오지 못했습니다.");
    expect(dashboardSource).toContain("void chatSessionsQuery.refetch()");
    expect(dashboardSource).toContain("void searchChatSessionsQuery.refetch()");
  });

  it("keeps a failed session-open attempt visible and retryable", () => {
    expect(dashboardSource).toContain("const loadHistorySession = async");
    expect(dashboardSource).toContain("setHistorySessionLoadError({ id: session.id, title: session.title })");
    expect(dashboardSource).toContain("void loadHistorySession(historySessionLoadError)");
    expect(dashboardSource).toContain("상담 기록을 열지 못했습니다.");
  });
});
