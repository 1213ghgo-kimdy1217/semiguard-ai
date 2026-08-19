import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("first-use feedback radio keyboard contract", () => {
  it("moves feedback radio choices with arrow and boundary keys", () => {
    expect(dashboardSource).toContain('"ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"');
    expect(dashboardSource).toContain("target.getAttribute(\"role\") !== \"radio\"");
    expect(dashboardSource).toContain("radios[nextIndex]?.click();");
    expect(dashboardSource).toContain("radios[nextIndex]?.focus();");
  });
});
