import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("consultation history search debounce contract", () => {
  it("debounces server-side content searches for 250ms", () => {
    expect(dashboardSource).toContain("const [debouncedHistorySearch, setDebouncedHistorySearch] = useState(\"\")");
    expect(dashboardSource).toContain("window.setTimeout(() => setDebouncedHistorySearch(normalizedHistorySearch), 250)");
    expect(dashboardSource).toContain("query: debouncedHistorySearch || \"pending\"");
    expect(dashboardSource).toContain("enabled: isChatOpen && debouncedHistorySearch.length > 0");
  });

  it("shows a dedicated localized search-pending state and resets pages when the debounced query applies", () => {
    expect(dashboardSource).toContain("const isHistorySearchPending = normalizedHistorySearch !== debouncedHistorySearch");
    expect(dashboardSource).toContain("기록 검색 중...");
    expect(dashboardSource).toContain("履歴を検索中...");
    expect(dashboardSource).toContain("Searching history...");
    expect(dashboardSource).toContain("[debouncedHistorySearch, historySessionFilter, historySessionSort");
  });
});
