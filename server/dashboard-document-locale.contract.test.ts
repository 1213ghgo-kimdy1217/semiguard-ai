import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard document locale contract", () => {
  it("uses localized dashboard titles, descriptions, and keywords for Korean, English, and Japanese", () => {
    expect(dashboardSource).toContain('locale: "ko-KR"');
    expect(dashboardSource).toContain('locale: "en-US"');
    expect(dashboardSource).toContain('locale: "ja-JP"');
    expect(dashboardSource).toContain('title: "SemiGuard AI | 4센서 관측과 판단 근거"');
    expect(dashboardSource).toContain('title: "SemiGuard AI | Four-Sensor Observation and Evidence"');
    expect(dashboardSource).toContain('title: "SemiGuard AI｜4センサー観測と判断根拠"');
    expect(dashboardSource).toContain("metaDesc.setAttribute('content', metadata.description);");
    expect(dashboardSource).toContain("metaKw.setAttribute('content', metadata.keywords);");
    expect(dashboardSource).toContain("document.documentElement.lang = metadata.locale;");
  });

  it("keeps the social-link success message in the selected language after metadata updates", () => {
    expect(dashboardSource).toContain("toast.success(lang === \"ko\"");
    expect(dashboardSource).toContain("window.history.replaceState({}, document.title, window.location.pathname);");
  });
});
