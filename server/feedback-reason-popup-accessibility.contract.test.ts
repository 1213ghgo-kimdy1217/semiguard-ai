import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("feedback reason popup accessibility contract", () => {
  it("exposes the feedback reason picker as a labelled dialog", () => {
    expect(dashboardSource).toContain('role="dialog"');
    expect(dashboardSource).toContain('aria-labelledby={`feedback-reason-title-${idx}`}');
    expect(dashboardSource).toContain('id={`feedback-reason-title-${idx}`}');
  });

  it("closes the feedback reason picker before the parent consultation on Escape", () => {
    expect(dashboardSource).toContain('if (activeDislikeIdx !== null) return setActiveDislikeIdx(null);');
  });
});
