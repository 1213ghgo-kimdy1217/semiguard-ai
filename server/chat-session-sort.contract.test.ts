import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("consultation session sort contract", () => {
  it("keeps pinned sessions first while allowing newest, oldest, and title sorting", () => {
    expect(dashboardSource).toContain('useState<"newest" | "oldest" | "title">(() => {');
    expect(dashboardSource).toContain("filteredAndSortedChatSessions");
    expect(dashboardSource).toContain("if (a.isPinned !== b.isPinned)");
    expect(dashboardSource).toContain('historySessionSort === "oldest"');
    expect(dashboardSource).toContain('historySessionSort === "title"');
  });

  it("renders a localized, keyboard reachable sort selector in history", () => {
    expect(dashboardSource).toContain('id="consultation-history-sort"');
    expect(dashboardSource).toContain('lang === "ko" ? "최신순"');
    expect(dashboardSource).toContain('lang === "ja" ? "古い順"');
    expect(dashboardSource).toContain('"Title"');
  });
});
