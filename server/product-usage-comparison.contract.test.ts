import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(resolve(process.cwd(), "server/semiguardDb.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("competition usage comparison contract", () => {
  it("derives an equal-length previous period without changing the current metrics definition", () => {
    expect(dbSource).toContain("getPreviousComparableRange");
    expect(dbSource).toContain("endAt.getTime() - startAt.getTime() + 1");
    expect(dbSource).toContain("startAt.getTime() - durationMs");
  });

  it("returns current and previous aggregate metrics only to administrators", () => {
    expect(routerSource).toContain("ctx.user.role !== \"admin\"");
    expect(routerSource).toContain("previous: { ...previous");
    expect(routerSource).toContain("getPreviousComparableRange(range.startAt, range.endAt)");
  });

  it("shows completion, returning, and guide-rate changes with a small-sample warning", () => {
    expect(dashboardSource).toContain("개선 전후 비교");
    expect(dashboardSource).toContain("Before/after comparison");
    expect(dashboardSource).toContain("currentReturningRate");
    expect(dashboardSource).toContain("onboardingCompletionRate");
    expect(dashboardSource).toContain("usageComparisonHasSmallSample");
    expect(dashboardSource).toContain("같은 길이의 기간만 비교합니다");
  });
});
