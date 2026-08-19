import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard document locale contract", () => {
  it("uses localized dashboard titles, descriptions, and keywords for Korean, English, and Japanese", () => {
    expect(dashboardSource).toContain('title: "SemiGuard AI - 반도체 장비 실시간 AI 예지보전 및 이상탐지 시스템"');
    expect(dashboardSource).toContain('title: "SemiGuard AI | Read-Only Semiconductor Safety Dashboard"');
    expect(dashboardSource).toContain('title: "SemiGuard AI｜半導体設備の読み取り専用予知安全ダッシュボード"');
    expect(dashboardSource).toContain("metaDesc.setAttribute('content', metadata.description);");
    expect(dashboardSource).toContain("metaKw.setAttribute('content', metadata.keywords);");
  });

  it("keeps the social-link success message in the selected language after metadata updates", () => {
    expect(dashboardSource).toContain("toast.success(lang === \"ko\"");
    expect(dashboardSource).toContain("window.history.replaceState({}, document.title, window.location.pathname);");
  });
});
