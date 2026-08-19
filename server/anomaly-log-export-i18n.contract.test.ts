import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("anomaly-log CSV localization contract", () => {
  it("localizes the exported risk level with the active language", () => {
    expect(dashboardSource).toContain("escape(localizeRiskLevel(log.riskLevel, lang))");
  });

  it("keeps localized observation headers and filenames for Korean, English, and Japanese", () => {
    expect(dashboardSource).toContain('"관측 로그 ID"');
    expect(dashboardSource).toContain('"観測ログID"');
    expect(dashboardSource).toContain('"Observation log ID"');
    expect(dashboardSource).toContain('"세미가드_이상기록"');
    expect(dashboardSource).toContain('"セミガード_異常履歴"');
    expect(dashboardSource).toContain('"semiguard_logs"');
  });
});
