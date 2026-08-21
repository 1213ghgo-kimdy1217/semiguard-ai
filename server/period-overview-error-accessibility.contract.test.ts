import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("period overview load error accessibility contract", () => {
  it("announces the complete localized operational-statistics failure alert", () => {
    expect(dashboardSource).toMatch(
      /\{periodOverviewQuery\.isError && \(\s*<div[^>]*role="alert"[^>]*aria-atomic="true"/
    );
    expect(dashboardSource).toContain("운영 통계를 불러오지 못했습니다");
    expect(dashboardSource).toContain("運用統計を読み込めませんでした");
    expect(dashboardSource).toContain("Could not load operational statistics");
  });
});
