import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("RAG manual sort contract", () => {
  it("sorts searched and unsearched manual results by update time or title", () => {
    expect(dashboardSource).toContain('const [manualDocumentSort, setManualDocumentSort] = useState<"newest" | "oldest" | "title">("newest")');
    expect(dashboardSource).toContain("const sortedManualDocuments = useMemo(() => [...filteredManualDocuments].sort((a, b) => {");
    expect(dashboardSource).toContain('if (manualDocumentSort === "title") return a.title.localeCompare(b.title);');
    expect(dashboardSource).toContain("{sortedManualDocuments.map(document => (");
  });

  it("offers localized sort choices", () => {
    expect(dashboardSource).toContain('id="rag-manual-sort"');
    expect(dashboardSource).toContain('lang === "ja" ? "並び替え"');
    expect(dashboardSource).toContain('lang === "ja" ? "タイトル順"');
  });
});
