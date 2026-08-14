import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

describe("dashboard lazy-loading i18n contract", () => {
  it("reads the saved dashboard language before showing the module-loading screen", () => {
    expect(appSource).toContain('localStorage.getItem("semiguard_lang")');
    expect(appSource).toContain("function getDashboardLoadingLanguage()");
    expect(appSource).toContain("const copy = dashboardLoadingCopy[getDashboardLoadingLanguage()]");
  });

  it("provides Korean, English, and Japanese pending-state copy", () => {
    expect(appSource).toContain("SemiGuard AI 대시보드를 준비하고 있습니다.");
    expect(appSource).toContain("Preparing the SemiGuard AI dashboard…");
    expect(appSource).toContain("SemiGuard AIダッシュボードを準備しています。");
  });
});
