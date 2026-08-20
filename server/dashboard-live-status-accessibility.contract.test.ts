import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard live status accessibility contract", () => {
  it("announces complete RAG manual evidence state changes", () => {
    expect(dashboardSource).toContain('id="rag-manual-chunk-status"');
    expect(dashboardSource).toContain('role="status" aria-live="polite" aria-atomic="true" style={{ borderColor: isManualChunkWarning');
  });

  it("announces complete localized period-statistics loading states", () => {
    expect(dashboardSource).toContain('role="status" aria-live="polite" aria-atomic="true" aria-label={lang === "ko" ? "선택한 기간의 통계를 불러오는 중"');
    expect(dashboardSource).toContain('lang === "ja" ? "選択した期間の統計を読み込み中"');
    expect(dashboardSource).toContain('"Loading statistics for the selected period"');
  });
});
