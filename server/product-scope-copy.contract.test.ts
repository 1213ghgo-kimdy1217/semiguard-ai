import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const i18nSource = readFileSync(resolve(process.cwd(), "client/src/lib/i18n.ts"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");
const loginSource = readFileSync(resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

describe("product-scope copy contract", () => {
  it("does not represent the read-only product as automatic equipment control", () => {
    expect(i18nSource).not.toContain("릴레이를 자동 차단합니다");
    expect(i18nSource).not.toContain("automatically tripping relays");
    expect(i18nSource).not.toContain("リレーを自動遮断します");
    expect(i18nSource).toContain("실제 설비에 연결하거나 제어하지 않습니다");
    expect(i18nSource).toContain("does not connect to or control equipment");
    expect(i18nSource).toContain("実際の設備には接続・制御しません");
  });

  it("presents rule-based synthetic observations rather than equipment uptime or savings", () => {
    expect(i18nSource).toContain('uptimePct: "이상 미판정 비율"');
    expect(i18nSource).toContain('uptimePct: "Records Without Anomaly"');
    expect(i18nSource).toContain('uptimePct: "異常未判定の割合"');
    expect(dashboardSource).toContain("실제 설비 가동률이 아닙니다");
    expect(dashboardSource).toContain("실제 가동률이나 절감액은 측정하지 않습니다");
    expect(dashboardSource).toContain('selectedPeriodStats?.totalDetections ? `${selectedPeriodStats.uptimePct}%` : "—"');
    expect(dashboardSource).not.toContain("handleResetCost");
    expect(dashboardSource).not.toContain("displayedSavedCost");
    expect(dashboardSource).not.toContain("Isolation Forest AI");
    expect(loginSource).toContain("z-score 기반 위험 신호");
    expect(loginSource).toContain("z-score risk signals");
    expect(loginSource).toContain("z-scoreベースの危険信号");
    expect(loginSource).not.toContain("Isolation Forest AI");
    expect(routerSource).toContain("위험 점수는 이미 규칙으로 계산되었으며 AI가 다시 산정하지 않습니다");
    expect(routerSource).toContain("실제 설비 제어, 정지, 분해 또는 현장 조작 방법은 제시하지 마세요");
  });
});
