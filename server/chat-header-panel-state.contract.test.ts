import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat header panel state contract", () => {
  it("exposes expanded state for consultation history, feedback, and manual controls", () => {
    expect(dashboardSource).toContain("aria-expanded={showHistoryPanel}");
    expect(dashboardSource).toContain("aria-expanded={showFeedbackHistoryPanel}");
    expect(dashboardSource).toContain("aria-expanded={showManualRagModal}");
  });

  it("connects every header control to its conditional panel", () => {
    expect(dashboardSource).toContain('aria-controls="chat-history-panel"');
    expect(dashboardSource).toContain('aria-controls="chat-feedback-panel"');
    expect(dashboardSource).toContain('aria-controls="chat-manual-panel"');
    expect(dashboardSource).toContain('id="chat-history-panel"');
    expect(dashboardSource).toContain('id="chat-feedback-panel"');
    expect(dashboardSource).toContain('id="chat-manual-panel"');
  });
});
