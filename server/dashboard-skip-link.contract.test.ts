import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard skip-link contract", () => {
  it("offers a localized keyboard shortcut past repeated dashboard chrome", () => {
    expect(dashboardSource).toContain('href="#dashboard-main"');
    expect(dashboardSource).toContain("대시보드 콘텐츠로 건너뛰기");
    expect(dashboardSource).toContain("ダッシュボードのコンテンツへ移動");
    expect(dashboardSource).toContain("Skip to dashboard content");
  });

  it("makes the dashboard's main content focusable after the skip link is used", () => {
    expect(dashboardSource).toContain('<main id="dashboard-main" tabIndex={-1}');
    expect(dashboardSource).toContain("focus:not-sr-only");
  });
});
