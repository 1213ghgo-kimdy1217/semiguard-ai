import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("first analysis onboarding tabs keyboard contract", () => {
  it("connects the step controls and content with the tab pattern", () => {
    expect(dashboardSource).toContain('role="tablist"');
    expect(dashboardSource).toContain('aria-orientation="horizontal"');
    expect(dashboardSource).toContain('role="tab"');
    expect(dashboardSource).toContain('aria-controls="first-analysis-onboarding-content"');
    expect(dashboardSource).toContain('role="tabpanel"');
  });

  it("moves the active onboarding step with arrow and boundary keys", () => {
    expect(dashboardSource).toContain('"ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"');
    expect(dashboardSource).toContain("void persistOnboardingStep(nextStep);");
    expect(dashboardSource).toContain("tabs[nextStep - 1]?.focus()");
  });
});
