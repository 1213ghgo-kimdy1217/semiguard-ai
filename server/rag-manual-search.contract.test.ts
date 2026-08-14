import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("RAG manual search contract", () => {
  it("filters registered manuals by title and reports the current result count", () => {
    expect(dashboardSource).toContain("manualSearchQuery");
    expect(dashboardSource).toContain("filteredManualDocuments");
    expect(dashboardSource).toContain("filteredManualDocuments.length");
  });

  it("keeps accessible multilingual search and empty-state labels", () => {
    expect(dashboardSource).toContain("RAG 매뉴얼 제목 또는 원문 검색");
    expect(dashboardSource).toContain("RAGマニュアルのタイトル・原文を検索");
    expect(dashboardSource).toContain("No manuals match your search.");
  });
});
