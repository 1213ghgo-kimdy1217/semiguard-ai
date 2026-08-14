import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("RAG manual search debounce contract", () => {
  it("debounces source-content search requests by 250ms", () => {
    expect(dashboardSource).toContain('const [debouncedManualSearch, setDebouncedManualSearch] = useState("")');
    expect(dashboardSource).toContain("window.setTimeout(() => setDebouncedManualSearch(normalizedManualSearch), 250)");
    expect(dashboardSource).toContain("normalizedDebouncedManualSearch");
  });

  it("keeps translated waiting and searching feedback in the RAG management panel", () => {
    expect(dashboardSource).toContain("Waiting for input...");
    expect(dashboardSource).toContain("Searching manual titles and content...");
    expect(dashboardSource).toContain("입력을 확인하는 중...");
    expect(dashboardSource).toContain("マニュアルのタイトル・原文を検索中...");
  });
});
