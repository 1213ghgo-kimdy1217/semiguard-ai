import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("AI analysis history query recovery contract", () => {
  it("marks the retry control busy while the analysis-history request is in flight", () => {
    expect(dashboardSource).toContain("void llmHistoryQuery.refetch()");
    expect(dashboardSource).toContain('aria-busy={llmHistoryQuery.isFetching || undefined}');
  });
});
