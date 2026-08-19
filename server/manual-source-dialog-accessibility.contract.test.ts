import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("manual source preview dialog accessibility contract", () => {
  it("declares the source preview as a labelled modal dialog", () => {
    expect(dashboardSource).toContain('ref={manualSourceDialogRef} role="dialog" aria-modal="true" aria-labelledby="manual-source-title" aria-describedby="manual-source-description"');
  });

  it("records the selected source trigger, focuses close, and restores focus on dismissal", () => {
    expect(dashboardSource).toContain("manualSourceTriggerRef.current = event.currentTarget");
    expect(dashboardSource).toContain("manualSourceCloseRef.current?.focus()");
    expect(dashboardSource).toContain("manualSourceTriggerRef.current?.focus()");
  });

  it("uses the source preview as the active Tab boundary and retains Escape dismissal", () => {
    expect(dashboardSource).toContain("activeManualSource\n        ? manualSourceDialogRef.current");
    expect(dashboardSource).toContain("if (activeManualSource) return setActiveManualSource(null);");
  });
});
