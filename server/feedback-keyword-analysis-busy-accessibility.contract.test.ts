import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("feedback keyword analysis busy accessibility contract", () => {
  it("announces busy state while extracting feedback keywords", () => {
    expect(dashboardSource).toContain('aria-busy={analyzeFeedbackKeywordsMutation.isPending || undefined}');
    expect(dashboardSource).toContain("analyzeCurrentFeedbackKeywords");
    expect(dashboardSource).toContain("AI 키워드");
    expect(dashboardSource).toContain("AIキーワード");
    expect(dashboardSource).toContain("AI keywords");
  });
});
