import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("first safety analysis guide description accessibility contract", () => {
  it("connects the visible guide subtitle to the open onboarding dialog", () => {
    expect(dashboardSource).toContain('const dialog = onboardingDialogRef.current?.closest<HTMLElement>(\'[role="dialog"]\');');
    expect(dashboardSource).toContain('description.id = "first-analysis-onboarding-description";');
    expect(dashboardSource).toContain('dialog.setAttribute("aria-describedby", description.id);');
  });
});
