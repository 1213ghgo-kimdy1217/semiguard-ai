import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("virtual fab controls busy accessibility contract", () => {
  it("announces busy state for every injection mode and expected-savings reset", () => {
    expect(dashboardSource).toContain('aria-busy={injectNormal.isPending || undefined}');
    expect(dashboardSource).toContain('aria-busy={injectCaution.isPending || undefined}');
    expect(dashboardSource).toContain('aria-busy={injectWarning.isPending || undefined}');
    expect(dashboardSource).toContain('aria-busy={injectAnomaly.isPending || undefined}');
    expect(dashboardSource).toContain('aria-busy={resetCostMutation.isPending || undefined}');
    expect(dashboardSource).toContain('role="status" aria-live="polite" aria-atomic="true"');
  });
});
