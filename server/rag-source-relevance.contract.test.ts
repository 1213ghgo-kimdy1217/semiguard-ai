import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("RAG source relevance contract", () => {
  it("computes matched terms and relevance only after the user-owned manual query", () => {
    expect(dbSource).toContain("eq(manualDocuments.userId, userId)");
    expect(dbSource).toContain("const matchedTerms = terms.filter");
    expect(dbSource).toContain("relevanceScore: Math.max(1");
    expect(dbSource).toContain(".sort((a, b) => b.relevanceScore");
  });

  it("returns relevance metadata with RAG sources and renders it in the source UI", () => {
    expect(routerSource).toContain("relevanceScore: source.relevanceScore");
    expect(routerSource).toContain("matchedTerms: source.matchedTerms");
    expect(dashboardSource).toContain("질문 관련도");
    expect(dashboardSource).toContain("Question relevance");
    expect(dashboardSource).toContain("activeManualSource.matchedTerms.join");
  });
});
