import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("RAG manual deletion confirmation accessibility contract", () => {
  it("declares irreversible manual deletion as a labelled alert dialog", () => {
    expect(dashboardSource).toContain('ref={manualDeleteDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="manual-delete-confirm-title" aria-describedby="manual-delete-confirm-description"');
  });

  it("remembers the clicked deletion control, focuses cancel, and restores focus safely", () => {
    expect(dashboardSource).toContain("manualDeleteTriggerRef.current = event.currentTarget");
    expect(dashboardSource).toContain("manualDeleteCancelRef.current?.focus()");
    expect(dashboardSource).toContain("manualDeleteTriggerRef.current?.isConnected ? manualDeleteTriggerRef.current : manualPanelCloseRef.current");
  });

  it("gives the manual deletion confirmation priority in the shared Tab trap and preserves Escape cancellation", () => {
    expect(dashboardSource).toContain("manualDocumentToDelete !== null");
    expect(dashboardSource).toContain("? manualDeleteDialogRef.current");
    expect(dashboardSource).toContain("if (manualDocumentToDelete !== null) return setManualDocumentToDelete(null);");
  });
});
