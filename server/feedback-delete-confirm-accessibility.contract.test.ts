import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("individual feedback deletion confirmation accessibility contract", () => {
  it("declares an irreversible feedback deletion prompt as a labelled alert dialog", () => {
    expect(dashboardSource).toContain('ref={feedbackDeleteDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="feedback-delete-confirm-title" aria-describedby="feedback-delete-confirm-description"');
  });

  it("records the clicked deletion trigger, focuses cancel, and restores focus safely", () => {
    expect(dashboardSource).toContain("feedbackDeleteTriggerRef.current = event.currentTarget");
    expect(dashboardSource).toContain("feedbackDeleteCancelRef.current?.focus()");
    expect(dashboardSource).toContain("feedbackDeleteTriggerRef.current?.isConnected ? feedbackDeleteTriggerRef.current : feedbackPanelCloseRef.current");
  });

  it("gives the individual confirmation priority in the shared Tab trap and preserves Escape cancellation", () => {
    expect(dashboardSource).toContain("feedbackToDelete !== null");
    expect(dashboardSource).toContain("? feedbackDeleteDialogRef.current");
    expect(dashboardSource).toContain("if (feedbackToDelete !== null) return setFeedbackToDelete(null);");
  });
});
