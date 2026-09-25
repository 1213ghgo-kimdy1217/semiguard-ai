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

  it("does not interrupt the observation workspace with the retired first-analysis guide", () => {
    expect(dashboardSource).not.toContain("getOnboardingProgress.useQuery");
    expect(dashboardSource).not.toContain('id="first-analysis-onboarding-title"');
    expect(dashboardSource).not.toContain("onboardingCompletionRate");
  });
});
