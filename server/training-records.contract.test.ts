import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const records = readFileSync(resolve(process.cwd(), "server/trainingRecords.ts"), "utf8");
const page = readFileSync(resolve(process.cwd(), "client/src/pages/EtchTraining.tsx"), "utf8");
const migration = readFileSync(resolve(process.cwd(), "drizzle/0017_whole_silver_centurion.sql"), "utf8");

describe("training records user isolation", () => {
  it("keeps the table migration additive and compatible with approved manual creation", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS `training_attempts`");
    expect(migration).toContain("INDEX `training_attempt_user_created_idx` (`user_id`,`created_at`)");
    expect(migration).toContain("UNIQUE(`user_id`,`attempt_key`)");
    expect(migration).not.toMatch(/\b(?:ALTER|DROP|DELETE|UPDATE|INSERT)\b/i);
    expect(migration).not.toContain("CREATE INDEX");
  });

  it("protects saving and reading and derives the owner from the authenticated session", () => {
    expect(router).toMatch(/training: router\(\{[\s\S]*?history: protectedProcedure/);
    expect(router).toMatch(/saveAttempt: protectedProcedure/);
    expect(router).toContain("getTrainingAttempts(ctx.user.id)");
    expect(router).toContain("saveTrainingAttempt(ctx.user.id, input.attemptKey, input.attempt)");
    expect(records).toContain("eq(trainingAttempts.userId, userId)");
  });

  it("does not persist or return written answers", () => {
    expect(records).toContain("toTrainingRecord(attempt)");
    expect(records).not.toMatch(/facts:|checks:/);
    expect(page).toContain("toTrainingSubmission(completed)");
  });

  it("keeps in-progress drafts separate by account", () => {
    expect(page).toContain('`${ETCH_STORAGE_KEY}.${auth.data?.id ?? "guest"}`');
    expect(page).toContain("sessionStorage.getItem(expectedStorageKey)");
    expect(page).not.toContain("sessionStorage.getItem(ETCH_STORAGE_KEY)");
    expect(page).toContain("history.data?.userId === auth.data?.id");
    expect(router).toContain("userId: ctx.user.id");
  });
});
