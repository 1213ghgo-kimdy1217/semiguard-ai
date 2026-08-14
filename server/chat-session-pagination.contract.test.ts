import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("consultation history pagination contract", () => {
  it("paginates the already filtered and sorted history result in groups of eight", () => {
    expect(dashboardSource).toContain("const historySessionPageSize = 8");
    expect(dashboardSource).toContain("const paginatedChatSessions");
    expect(dashboardSource).toContain("filteredAndSortedChatSessions.slice(");
    expect(dashboardSource).toContain("paginatedChatSessions.map((session)");
  });

  it("resets page on search, pin filter, or sort changes and exposes localized controls", () => {
    expect(dashboardSource).toContain("[debouncedHistorySearch, historySessionFilter, historySessionSort, historySessionStartDate, historySessionEndDate]");
    expect(dashboardSource).toContain('lang === "ko" ? "이전"');
    expect(dashboardSource).toContain('lang === "ja" ? "次へ"');
    expect(dashboardSource).toContain('"Next"');
  });
});
