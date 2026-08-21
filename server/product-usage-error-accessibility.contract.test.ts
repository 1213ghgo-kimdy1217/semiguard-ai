import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("product usage metrics error accessibility contract", () => {
  it("announces the localized metrics failure as an atomic alert", () => {
    expect(dashboardSource).toMatch(
      /productUsageMetricsQuery\.isError \? <p[^>]*role="alert"[^>]*aria-atomic="true"/
    );
    expect(dashboardSource).toContain("제품 사용 지표를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    expect(dashboardSource).toContain("Could not load product usage metrics. Please try again shortly.");
  });
});
