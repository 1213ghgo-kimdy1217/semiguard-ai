import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("데모 자동 실행 탭 가시성 계약", () => {
  it("백그라운드에서는 데모 주입을 멈추고 다시 보이면 기존 순서로 재개한다", () => {
    expect(dashboardSource).toContain("const runDemoCycle = async () =>");
    expect(dashboardSource).toContain("const stopDemo = () =>");
    expect(dashboardSource).toContain("const startDemo = () =>");
    expect(dashboardSource).toContain('document.addEventListener("visibilitychange", handleDemoVisibilityChange)');
    expect(dashboardSource).toContain('document.removeEventListener("visibilitychange", handleDemoVisibilityChange)');
    expect(dashboardSource).toContain('demoIntervalRef.current = setInterval(runDemoCycle, demoSpeed * 1000)');
  });

  it("활성 상태 점은 장식으로 숨기고 기존 다국어 상태 이름을 유지한다", () => {
    expect(dashboardSource).toContain('<span aria-hidden="true" className="inline-block w-2 h-2 rounded-sm"');
    expect(dashboardSource).toContain('lang === "ko" ? "데모 중" : lang === "ja" ? "デモ実行中" : "Demo ON"');
  });
});
