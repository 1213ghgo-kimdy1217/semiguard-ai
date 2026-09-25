import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("AI 분석 이력 모바일 안전 영역 계약", () => {
  it("이력 패널과 토글 제어가 홈 제스처 영역을 피한다", () => {
    expect(dashboardSource).toContain('"max(1.25rem, calc(env(safe-area-inset-bottom) + 0.5rem))"');
    expect(dashboardSource.match(/bottom: aiHistoryBottom/g)?.length).toBeGreaterThanOrEqual(2);
    expect(dashboardSource).toContain('w-[calc(100vw-2rem)] max-w-80');
    expect(dashboardSource).toContain('left-4 sm:left-6 z-[490]');
  });
});
