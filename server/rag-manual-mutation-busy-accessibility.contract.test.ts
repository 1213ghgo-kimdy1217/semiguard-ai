import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("RAG manual mutation busy accessibility contract", () => {
  it("announces busy state while adding or deleting a manual", () => {
    expect(dashboardSource).toContain('aria-busy={addManualTextMutation.isPending || undefined}');
    expect(dashboardSource).toContain('aria-busy={deleteManualDocumentMutation.isPending || undefined}');
    expect(dashboardSource).toContain('role="alertdialog" aria-modal="true" aria-labelledby="manual-delete-confirm-title"');
    expect(dashboardSource).toContain('<span aria-hidden="true">⚠️ </span>{lang === "ko" ? "RAG 매뉴얼 삭제 확인"');
    expect(dashboardSource).toContain("등록 중...");
    expect(dashboardSource).toContain("삭제 중...");
  });

  it("keeps the manual registration dialog title while hiding its decorative book icon", () => {
    expect(dashboardSource).toContain('<h4 id="rag-manual-dialog-title" className="text-sm font-bold" style={{ color: th.text }}><span aria-hidden="true">📘</span>{" "}{lang === "ko" ? "설비 매뉴얼 RAG 등록"');
  });
});
