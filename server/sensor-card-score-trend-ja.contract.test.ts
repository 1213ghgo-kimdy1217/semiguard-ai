import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("sensor card score trend Japanese locale contract", () => {
  it("localizes the score trend caption when Japanese is selected", () => {
    expect(dashboardSource).toContain('lang === "ko" ? `점수 추이 · ${selectedPeriodLabel}` : lang === "ja" ? `スコア推移・${selectedPeriodLabel}` : `Score trend · ${selectedPeriodLabel}`');
  });
});
