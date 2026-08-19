import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("consultation history clear-all confirmation accessibility contract", () => {
  it("declares the irreversible consultation deletion prompt as a labelled alert dialog", () => {
    expect(dashboardSource).toContain('ref={deleteAllConfirmDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="chat-delete-all-confirm-title" aria-describedby="chat-delete-all-confirm-description"');
    expect(dashboardSource).toContain('id="chat-delete-all-confirm-title"');
    expect(dashboardSource).toContain('id="chat-delete-all-confirm-description"');
  });

  it("moves focus to cancel on open and restores it safely after cancel or completion", () => {
    expect(dashboardSource).toContain("const deleteAllConfirmTriggerRef = useRef<HTMLButtonElement>(null)");
    expect(dashboardSource).toContain("const deleteAllConfirmCancelRef = useRef<HTMLButtonElement>(null)");
    expect(dashboardSource).toContain("deleteAllConfirmCancelRef.current?.focus()");
    expect(dashboardSource).toContain("showHistoryPanel ? deleteAllConfirmTriggerRef.current : historyPanelTriggerRef.current");
    expect(dashboardSource).toContain("} else if (showHistoryPanel) {");
  });

  it("keeps Tab and Shift+Tab inside the clear-all confirmation and supports Escape cancellation", () => {
    expect(dashboardSource).toContain("showDeleteAllConfirm");
    expect(dashboardSource).toContain("? deleteAllConfirmDialogRef.current");
    expect(dashboardSource).toContain("if (showDeleteAllConfirm) return setShowDeleteAllConfirm(false);");
  });
});
