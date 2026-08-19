import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("AI analysis history dialog accessibility contract", () => {
  it("exposes the AI history panel as a labelled modal dialog", () => {
    expect(dashboardSource).toContain(
      'ref={aiHistoryDialogRef} id="ai-analysis-history-panel" role="dialog" aria-modal="true" aria-labelledby="ai-analysis-history-title" aria-describedby="ai-analysis-history-description"'
    );
  });

  it("moves focus to close on open and returns focus to the trigger on dismissal", () => {
    expect(dashboardSource).toContain("aiHistoryCloseRef.current?.focus()");
    expect(dashboardSource).toContain("aiHistoryTriggerRef.current?.focus()");
  });

  it("supports Escape and keeps Tab navigation inside the history dialog", () => {
    expect(dashboardSource).toContain(
      "if (showAiHistory) return closeAiHistory();"
    );
    expect(dashboardSource).toContain(
      "const dialog = aiHistoryDialogRef.current;"
    );
    expect(dashboardSource).toContain('if (event.key !== "Tab") return;');
  });

  it("provides a localized accessible name for the AI history close control", () => {
    expect(dashboardSource).toContain(
      'aria-label={lang === "ko" ? "AI 분석 이력 닫기" : lang === "ja" ? "AI分析履歴を閉じる" : "Close AI analysis history"}'
    );
    expect(dashboardSource).toContain("onClick={closeAiHistory}");
  });
});
