import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard skip link accessibility contract", () => {
  it("provides a keyboard-visible skip link to the primary dashboard landmark", () => {
    expect(dashboardSource).toContain('href="#dashboard-main"');
    expect(dashboardSource).toContain('focus:not-sr-only');
    expect(dashboardSource).toContain('<main id="dashboard-main" tabIndex={-1}');
  });

  it("labels the skip link in Korean, English, and Japanese", () => {
    expect(dashboardSource).toContain('"대시보드 콘텐츠로 건너뛰기"');
    expect(dashboardSource).toContain('"Skip to dashboard content"');
    expect(dashboardSource).toContain('"ダッシュボードのコンテンツへ移動"');
  });
});
