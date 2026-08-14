import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("consultation history filter summary contract", () => {
  it("aggregates filtered sessions, messages, and pinned sessions from the existing safe list", () => {
    expect(dashboardSource).toContain("const filteredHistoryMessageCount = filteredAndSortedChatSessions.reduce");
    expect(dashboardSource).toContain("const filteredHistoryPinnedCount = filteredAndSortedChatSessions.filter");
    expect(dashboardSource).toContain("session.messageCount ?? 0");
    expect(dashboardSource).toContain("session.isPinned === 1");
  });

  it("renders localized compact summary metrics", () => {
    expect(dashboardSource).toContain('lang === "ko" ? "세션"');
    expect(dashboardSource).toContain('lang === "ja" ? "メッセージ"');
    expect(dashboardSource).toContain('lang === "ko" ? "고정"');
  });
});
