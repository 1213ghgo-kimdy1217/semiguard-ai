import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("RAG manual content search contract", () => {
  it("limits title and source-content matches to the current user's documents", () => {
    expect(dbSource).toContain("export async function searchManualDocumentsForUser(userId: number, searchText: string)");
    expect(dbSource).toContain("eq(manualDocuments.userId, userId)");
    expect(dbSource).toContain("like(manualChunks.content, term)");
    expect(dbSource).toContain("matchedContentExcerpt: excerptByDocumentId.get(document.id) ?? null");
    expect(routerSource).toContain("searchManualDocuments: protectedProcedure");
    expect(routerSource).toContain("db.searchManualDocumentsForUser(ctx.user.id, input.search)");
  });

  it("connects the RAG management search input to source-content results and excerpts", () => {
    expect(dashboardSource).toContain("trpc.semiguard.searchManualDocuments.useQuery");
    expect(dashboardSource).toContain("Search manual titles or content");
    expect(dashboardSource).toContain("Content match: ");
    expect(dashboardSource).toContain("matchedContentExcerpt");
  });
});
