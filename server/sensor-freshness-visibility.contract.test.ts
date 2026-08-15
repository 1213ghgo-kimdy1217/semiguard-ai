import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("센서 최신성 타이머 탭 가시성 계약", () => {
  it("백그라운드에서는 타이머를 멈추고 다시 보이면 즉시 갱신한다", () => {
    expect(dashboardSource).toContain('document.addEventListener("visibilitychange", handleVisibilityChange)');
    expect(dashboardSource).toContain('document.visibilityState === "hidden"');
    expect(dashboardSource).toContain("stopClock();");
    expect(dashboardSource).toContain("updateClock();");
    expect(dashboardSource).toContain('document.removeEventListener("visibilitychange", handleVisibilityChange)');
  });
});
