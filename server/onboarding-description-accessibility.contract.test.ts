import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("first safety analysis guide description accessibility contract", () => {
  it("connects the visible guide subtitle directly to the open onboarding dialog", () => {
    expect(dashboardSource).toContain('aria-labelledby="first-analysis-onboarding-title" aria-describedby="first-analysis-onboarding-description"');
    expect(dashboardSource).toContain('id="first-analysis-onboarding-description"');
  });
});
