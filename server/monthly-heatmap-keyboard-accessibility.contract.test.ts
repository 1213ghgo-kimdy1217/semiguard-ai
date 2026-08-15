import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("monthly heatmap keyboard accessibility contract", () => {
  it("uses native date buttons with multilingual risk labels and keyboard focus treatment", () => {
    expect(dashboardSource).toContain('<button key={day} type="button" disabled={!onDateClick}');
    expect(dashboardSource).toContain('aria-label={cellLabel}');
    expect(dashboardSource).toContain('riskLabelByLevel');
    expect(dashboardSource).toContain('focus-visible:ring-2');
  });
});
