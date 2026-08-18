import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const i18nSource = readFileSync(resolve(process.cwd(), "client/src/lib/i18n.ts"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");
const loginSource = readFileSync(resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");

describe("product-scope copy contract", () => {
  it("does not represent the read-only product as automatic equipment control", () => {
    expect(i18nSource).not.toContain("릴레이를 자동 차단합니다");
    expect(i18nSource).not.toContain("automatically tripping relays");
    expect(i18nSource).not.toContain("リレーを自動遮断します");
    expect(i18nSource).toContain("읽기 전용 예지안전 시스템");
    expect(i18nSource).toContain("read-only predictive-safety system");
    expect(i18nSource).toContain("読み取り専用の予知安全システム");
  });

  it("labels estimated cost and the dynamic page description as unverified simulation scope", () => {
    expect(i18nSource).toContain("시연 가정:");
    expect(i18nSource).toContain("actual savings are not yet validated");
    expect(i18nSource).toContain("実際の削減額は未検証です");
    expect(dashboardSource).toContain("z-score 기반 위험 점수");
    expect(dashboardSource).not.toContain("Isolation Forest AI");
    expect(loginSource).toContain("z-score 기반 위험 신호");
    expect(loginSource).toContain("z-score risk signals");
    expect(loginSource).toContain("z-scoreベースの危険信号");
    expect(loginSource).not.toContain("Isolation Forest AI");
  });
});
