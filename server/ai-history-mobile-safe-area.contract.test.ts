import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("AI 분석 이력 모바일 안전 영역 계약", () => {
  it("이력 패널과 토글 제어가 홈 제스처 영역을 피하고 온보딩·피드백 제어 위에 배치된다", () => {
    expect(dashboardSource).toContain("const hasCompletedFirstAnalysis = Boolean(onboardingProgressQuery.data?.completedAt)");
    expect(dashboardSource).toContain('"max(8rem, calc(env(safe-area-inset-bottom) + 7.25rem))"');
    expect(dashboardSource.match(/bottom: aiHistoryBottom/g)?.length).toBeGreaterThanOrEqual(2);
    expect(dashboardSource).toContain('w-[calc(100vw-2rem)] max-w-80');
    expect(dashboardSource).toContain('left-4 sm:left-6 z-[490]');
  });
});
