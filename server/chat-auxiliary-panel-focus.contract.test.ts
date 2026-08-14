import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat auxiliary panel focus contract", () => {
  it("focuses the close actions when history, feedback, or manual panels open", () => {
    expect(dashboardSource).toContain("historyPanelCloseRef.current?.focus()");
    expect(dashboardSource).toContain("feedbackPanelCloseRef.current?.focus()");
    expect(dashboardSource).toContain("manualPanelCloseRef.current?.focus()");
  });

  it("restores focus to the matching header trigger after a panel closes", () => {
    expect(dashboardSource).toContain("historyPanelTriggerRef.current?.focus()");
    expect(dashboardSource).toContain("feedbackPanelTriggerRef.current?.focus()");
    expect(dashboardSource).toContain("manualPanelTriggerRef.current?.focus()");
  });
});
