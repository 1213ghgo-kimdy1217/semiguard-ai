import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("score line chart keyboard accessibility contract", () => {
  it("exposes one roving-focus data point with multilingual labels and arrow-key navigation", () => {
    expect(dashboardSource).toContain('role="button"');
    expect(dashboardSource).toContain('tabIndex={i === focusedPointIndex ? 0 : -1}');
    expect(dashboardSource).toContain('aria-label={pointLabel(d, i)}');
    expect(dashboardSource).toContain('onKeyDown={(event) => handlePointKeyDown(event, i)}');
    expect(dashboardSource).toContain('event.key === "ArrowRight"');
    expect(dashboardSource).toContain('event.key === "ArrowLeft"');
    expect(dashboardSource).toContain('pointRefs.current[nextIndex]?.focus()');
  });
});

