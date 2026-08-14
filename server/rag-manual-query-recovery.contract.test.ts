import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("RAG manual query recovery contract", () => {
  it("distinguishes manual list, search, and source preview failures", () => {
    expect(dashboardSource).toContain("manualDocumentsQuery.isError");
    expect(dashboardSource).toContain("manualDocumentSearchQuery.isError");
    expect(dashboardSource).toContain("manualPreviewQuery.isError");
    expect(dashboardSource).toContain("매뉴얼 목록을 불러오지 못했습니다.");
    expect(dashboardSource).toContain("매뉴얼 검색 결과를 불러오지 못했습니다.");
    expect(dashboardSource).toContain("원문을 불러오지 못했습니다.");
  });

  it("keeps each manual request retryable without conflating it with an empty state", () => {
    expect(dashboardSource).toContain("void manualDocumentsQuery.refetch()");
    expect(dashboardSource).toContain("void manualDocumentSearchQuery.refetch()");
    expect(dashboardSource).toContain("void manualPreviewQuery.refetch()");
    expect(dashboardSource).toContain("manualDocumentsQuery.isFetching");
    expect(dashboardSource).toContain("manualDocumentSearchQuery.isFetching");
    expect(dashboardSource).toContain("manualPreviewQuery.isFetching");
  });
});
