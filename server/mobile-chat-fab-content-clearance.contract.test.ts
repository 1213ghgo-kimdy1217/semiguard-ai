import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("mobile chat FAB content clearance contract", () => {
  it("reserves bottom scroll clearance for the floating chat entry and mobile safe area", () => {
    expect(dashboardSource).toContain('pb-[calc(7rem+env(safe-area-inset-bottom))]');
    expect(dashboardSource).toContain('sm:pb-5');
  });
});
