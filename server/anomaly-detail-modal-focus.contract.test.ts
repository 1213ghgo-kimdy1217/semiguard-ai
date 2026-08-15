import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("anomaly detail modal focus contract", () => {
  it("uses dialog semantics, focuses the close control, and restores focus after Escape", () => {
    expect(dashboardSource).toContain('role="dialog"');
    expect(dashboardSource).toContain('aria-modal="true"');
    expect(dashboardSource).toContain('aria-labelledby="anomaly-detail-modal-title"');
    expect(dashboardSource).toContain("selectedLogCloseRef.current?.focus()");
    expect(dashboardSource).toContain('if (event.key === "Escape")');
    expect(dashboardSource).toContain("previouslyFocused?.focus()");
  });
});
