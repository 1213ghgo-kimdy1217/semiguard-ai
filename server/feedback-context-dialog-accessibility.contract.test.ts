import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("feedback conversation context accessibility contract", () => {
  it("exposes the feedback context as a labelled modal dialog", () => {
    expect(dashboardSource).toContain('ref={feedbackContextDialogRef} className="absolute inset-0 z-[600]');
    expect(dashboardSource).toContain('role="dialog" aria-modal="true" aria-labelledby="feedback-context-title" aria-describedby="feedback-context-description"');
  });

  it("moves focus to close on open and safely restores it to the context trigger", () => {
    expect(dashboardSource).toContain("feedbackContextCloseRef.current?.focus()");
    expect(dashboardSource).toContain("feedbackContextTriggerRef.current = event.currentTarget");
    expect(dashboardSource).toContain("feedbackContextTriggerRef.current?.isConnected ? feedbackContextTriggerRef.current : feedbackPanelCloseRef.current");
  });

  it("uses the context dialog as the active Tab boundary and retains Escape dismissal", () => {
    expect(dashboardSource).toContain("feedbackContextItem");
    expect(dashboardSource).toContain("? feedbackContextDialogRef.current");
    expect(dashboardSource).toContain("if (feedbackContextItem) return setFeedbackContextItem(null);");
  });
});
