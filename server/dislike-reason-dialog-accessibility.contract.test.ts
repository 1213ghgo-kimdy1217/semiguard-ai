import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dislike reason dialog accessibility contract", () => {
  it("declares the reason picker as a modal dialog with a labelled heading", () => {
    expect(dashboardSource).toContain("ref={dislikeReasonDialogRef}");
    expect(dashboardSource).toContain('role="dialog"\n                                aria-modal="true"\n                                aria-labelledby={`feedback-reason-title-${idx}`}');
  });

  it("records the active dislike trigger, focuses close, and restores focus after dismissal", () => {
    expect(dashboardSource).toContain("dislikeReasonTriggerRef.current = event.currentTarget");
    expect(dashboardSource).toContain("dislikeReasonCloseRef.current?.focus()");
    expect(dashboardSource).toContain("dislikeReasonTriggerRef.current?.focus()");
  });

  it("uses the reason picker as the active Tab boundary and retains Escape dismissal", () => {
    expect(dashboardSource).toContain("activeDislikeIdx !== null");
    expect(dashboardSource).toContain("? dislikeReasonDialogRef.current");
    expect(dashboardSource).toContain("if (activeDislikeIdx !== null) return setActiveDislikeIdx(null);");
  });
});
