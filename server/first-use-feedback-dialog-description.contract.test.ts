import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("first use feedback dialog description accessibility contract", () => {
  it("connects the visible privacy subtitle directly to the feedback dialog", () => {
    expect(dashboardSource).toContain('aria-labelledby="first-use-feedback-title" aria-describedby="first-use-feedback-description"');
    expect(dashboardSource).toContain('id="first-use-feedback-description"');
  });
});
