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
    expect(dashboardSource).toContain('aria-busy={loadingHistorySessionId === historySessionLoadError.id || undefined}');
  });

  it("announces localized busy retry states for history and history-search failures", () => {
    expect(dashboardSource).toContain("aria-busy={chatSessionsQuery.isFetching || undefined}");
    expect(dashboardSource).toContain('"Retrying consultation history"');
    expect(dashboardSource).toContain("aria-busy={searchChatSessionsQuery.isFetching || undefined}");
    expect(dashboardSource).toContain('"Retrying consultation search results"');
  });

  it("announces session-open, history-list, and history-search failures as atomic alerts", () => {
    expect(dashboardSource).toMatch(
      /historySessionLoadError && \(\s*<div[^>]*role="alert"[^>]*aria-atomic="true"/
    );
    expect(dashboardSource).toMatch(
      /chatSessionsQuery\.isError \? \(\s*<div[^>]*role="alert"[^>]*aria-atomic="true"/
    );
    expect(dashboardSource).toMatch(
      /searchChatSessionsQuery\.isError \? \(\s*<div[^>]*role="alert"[^>]*aria-atomic="true"/
    );
  });
});
