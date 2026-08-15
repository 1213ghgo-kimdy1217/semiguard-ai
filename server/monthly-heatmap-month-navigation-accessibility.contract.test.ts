import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("monthly heatmap month navigation accessibility contract", () => {
  it("gives previous and next month icon buttons multilingual accessible labels", () => {
    expect(dashboardSource).toContain('lang === "ja" ? "前の月" : "Previous month"');
    expect(dashboardSource).toContain('lang === "ja" ? "次の月" : "Next month"');
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "이전 달"');
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "다음 달"');
  });
});
