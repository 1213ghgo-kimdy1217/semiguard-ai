import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("AI 상담 대기 시간 탭 가시성 계약", () => {
  it("백그라운드에서는 갱신을 중지하고 다시 보이면 누적 대기 시간을 즉시 동기화한다", () => {
    expect(dashboardSource).toContain("const updateElapsed = () =>");
    expect(dashboardSource).toContain("const stopElapsedTimer = () =>");
    expect(dashboardSource).toContain("const startElapsedTimer = () =>");
    expect(dashboardSource).toContain('document.addEventListener("visibilitychange", handleChatLoadingVisibilityChange)');
    expect(dashboardSource).toContain('document.removeEventListener("visibilitychange", handleChatLoadingVisibilityChange)');
    expect(dashboardSource).toContain("intervalId = window.setInterval(updateElapsed, 1000)");
  });
});
