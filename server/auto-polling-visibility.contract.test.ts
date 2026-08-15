import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("자동 데이터 폴링 탭 가시성 계약", () => {
  it("백그라운드에서는 폴링을 멈추고 화면 복귀 시 즉시 한 번 갱신한 뒤 재개한다", () => {
    expect(dashboardSource).toContain("const runPollingCycle = () =>");
    expect(dashboardSource).toContain("const stopAutoPolling = () =>");
    expect(dashboardSource).toContain("const startAutoPolling = () =>");
    expect(dashboardSource).toContain('document.addEventListener("visibilitychange", handlePollingVisibilityChange)');
    expect(dashboardSource).toContain("runPollingCycle();\n        startAutoPolling();");
    expect(dashboardSource).toContain('document.removeEventListener("visibilitychange", handlePollingVisibilityChange)');
  });
});
