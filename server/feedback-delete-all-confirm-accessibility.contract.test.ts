import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("feedback history clear-all confirmation accessibility contract", () => {
  it("declares both irreversible feedback deletion steps as labelled alert dialogs", () => {
    expect(dashboardSource).toContain('ref={deleteAllFeedbackConfirmDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="feedback-delete-all-confirm-title" aria-describedby="feedback-delete-all-confirm-description"');
    expect(dashboardSource).toContain('ref={deleteAllFeedbackFinalDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="feedback-delete-all-final-confirm-title" aria-describedby="feedback-delete-all-final-confirm-description"');
  });

  it("moves focus to each cancel control and restores it to a live feedback control", () => {
    expect(dashboardSource).toContain("deleteAllFeedbackConfirmCancelRef.current?.focus()");
    expect(dashboardSource).toContain("deleteAllFeedbackFinalCancelRef.current?.focus()");
    expect(dashboardSource).toContain("deleteAllFeedbackTriggerRef.current?.isConnected ? deleteAllFeedbackTriggerRef.current : feedbackPanelCloseRef.current");
  });

  it("gives the final and first feedback confirmation priority in the shared Tab trap and Escape path", () => {
    expect(dashboardSource).toContain("if (showDeleteAllFeedbackFinalConfirm) return setShowDeleteAllFeedbackFinalConfirm(false);");
    expect(dashboardSource).toContain("if (showDeleteAllFeedbackConfirm) return setShowDeleteAllFeedbackConfirm(false);");
    expect(dashboardSource).toContain("showDeleteAllFeedbackFinalConfirm");
    expect(dashboardSource).toContain("? deleteAllFeedbackFinalDialogRef.current");
    expect(dashboardSource).toContain("showDeleteAllFeedbackConfirm");
    expect(dashboardSource).toContain("? deleteAllFeedbackConfirmDialogRef.current");
  });
});
