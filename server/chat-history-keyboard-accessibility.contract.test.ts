import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("consultation history keyboard accessibility contract", () => {
  it("uses a native button to open a saved consultation from the history list", () => {
    expect(dashboardSource).toContain("onClick={() => void loadHistorySession(session)}");
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? `상담 기록 열기: ${session.title}`');
    expect(dashboardSource).toContain('aria-current={activeSessionId === session.id ? "page" : undefined}');
  });

  it("keeps the open action visibly focusable and prevents duplicate loads while pending", () => {
    expect(dashboardSource).toContain('disabled={loadingHistorySessionId === session.id}');
    expect(dashboardSource).toContain("focus-visible:ring-cyan-400");
  });

  it("offers a mobile completion keyboard hint while editing a consultation title", () => {
    expect(dashboardSource).toMatch(
      /value=\{editingSessionTitle\}[\s\S]*?enterKeyHint="done"/,
    );
  });

  it("exposes the full-screen history panel as a labeled dialog with a search label", () => {
    expect(dashboardSource).toContain('role="dialog"\n                aria-modal="true"\n                aria-labelledby="consultation-history-panel-title"');
    expect(dashboardSource).toContain('id="consultation-history-panel-title"');
    expect(dashboardSource).toContain('htmlFor="consultation-history-search"');
    expect(dashboardSource).toMatch(
      /id="consultation-history-search"[\s\S]*?enterKeyHint="search"/,
    );
  });

  it("announces the complete consultation-history page status after pagination changes", () => {
    expect(dashboardSource).toContain('role="status" aria-live="polite" aria-atomic="true" aria-label={lang === "ko" ? `상담 기록 ${activeHistorySessionPage} / ${historySessionTotalPages} 페이지`');
  });
});
