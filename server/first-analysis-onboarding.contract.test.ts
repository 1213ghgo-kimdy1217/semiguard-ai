import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schemaSource = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
const dbSource = readFileSync(resolve(process.cwd(), "server/semiguardDb.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("first analysis onboarding contract", () => {
  it("stores only step and completion metadata for each user", () => {
    expect(schemaSource).toContain('mysqlTable("user_onboarding_progress"');
    expect(schemaSource).toContain('currentStep: int("current_step")');
    expect(schemaSource).toContain('completedAt: timestamp("completed_at")');
    expect(schemaSource).not.toContain('onboarding_content');
    expect(schemaSource).not.toContain('onboarding_input');
  });

  it("keeps onboarding progress behind protected procedures", () => {
    expect(routerSource).toContain("getOnboardingProgress: protectedProcedure");
    expect(routerSource).toContain("saveOnboardingProgress: protectedProcedure");
    expect(routerSource).toContain('currentStep: z.number().int().min(1).max(3)');
  });

  it("calculates the guide completion comparison from aggregate counts", () => {
    expect(dbSource).toContain("onboardingCompletedUsers");
    expect(dbSource).toContain("onboardingCompletionRate");
    expect(dbSource).toContain("COUNT(DISTINCT ${userOnboardingProgress.userId})");
  });

  it("provides three localized guidance steps, a review control, and an admin KPI", () => {
    expect(dashboardSource).toContain('title: "첫 안전 분석 안내"');
    expect(dashboardSource).toContain('title: "初回安全分析ガイド"');
    expect(dashboardSource).toContain('title: "First safety analysis guide"');
    expect(dashboardSource).toContain("onboardingCopy.review");
    expect(dashboardSource).toContain("onboardingCompletionRate");
    expect(dashboardSource).toContain('role="dialog"');
  });
});
