import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("onboarding progress busy accessibility contract", () => {
  it("announces the onboarding dialog as busy while progress is being saved", () => {
    expect(dashboardSource).toContain('aria-busy={saveOnboardingProgressMutation.isPending || undefined}');
    expect(dashboardSource).toContain('role="dialog" aria-modal="true" aria-labelledby="first-analysis-onboarding-title"');
    expect(dashboardSource).toContain("onboardingCopy.previous");
    expect(dashboardSource).toContain("onboardingCopy.next");
    expect(dashboardSource).toContain("onboardingCopy.finish");
  });
});
