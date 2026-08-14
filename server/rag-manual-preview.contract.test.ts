import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("RAG manual source preview contract", () => {
  it("limits preview queries to the signed-in user's document", () => {
    expect(dbSource).toContain("getManualDocumentPreviewForUser");
    expect(dbSource).toContain("eq(manualDocuments.userId, input.userId)");
    expect(routerSource).toContain("getManualDocumentPreview: protectedProcedure");
  });

  it("offers multilingual source preview controls in the manual manager", () => {
    expect(dashboardSource).toContain("previewManualDocumentId");
    expect(dashboardSource).toContain("매뉴얼 원문 보기");
    expect(dashboardSource).toContain("マニュアルの原文を見る");
    expect(dashboardSource).toContain("Stored source sections");
  });

  it("keeps whole-source copy and Markdown export actions in the preview", () => {
    expect(dashboardSource).toContain("Manual source copied.");
    expect(dashboardSource).toContain('"semiguard-manual"');
    expect(dashboardSource).toContain('lang === "ja" ? "セミガード_マニュアル"');
    expect(dashboardSource).toContain("text/markdown;charset=utf-8");
  });
});
