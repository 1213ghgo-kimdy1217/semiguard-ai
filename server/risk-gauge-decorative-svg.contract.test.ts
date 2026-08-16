import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("risk gauge accessibility contract", () => {
  it("hides the decorative gauge SVG while retaining visible score and risk text", () => {
    expect(dashboardSource).toContain('<svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" aria-hidden="true">');
    expect(dashboardSource).toContain('{animatedScore}');
    expect(dashboardSource).toContain('{t[riskLevel]}');
  });
});

