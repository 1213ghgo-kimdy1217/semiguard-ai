import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeJwt } from "jose";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { trainingAttempts, trainingDrafts } from "../drizzle/schema";
import { emptyEtchAttempt } from "../shared/etchScenario";
import { emptyProcessAttempt, processScenarios } from "../shared/processScenarios";
import { restoreTrainingDraft, toTrainingDraft } from "../shared/trainingDraft";
import { toProcessTrainingSubmission, toTrainingSubmission } from "../shared/trainingRecord";
import { appRouter } from "./routers";

const mock = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => mock);
vi.mock("./_core/env", () => ({ ENV: {
  cookieSecret: "synthetic-account-flow-signing-key-not-for-deployment",
} }));

type Stored = Record<string, unknown>;

/**
 * In-memory DB boundary only. The router, input schemas, persistence modules,
 * checkpoint serializers, criteria calculation and signed share reader are real.
 * This does not establish live MySQL, HTTP authentication or physical-device sync.
 */
function memoryStorage() {
  const drafts = new Map<string, Stored>();
  const attempts = new Map<string, Stored>();
  const dialect = new MySqlDialect();
  const index = [
    { name: "owner_scenario", position: 1, col: "user_id", nonUnique: 0, prefix: null },
    { name: "owner_scenario", position: 2, col: "scenario_id", nonUnique: 0, prefix: null },
  ];
  const database = {
    execute: vi.fn(async (statement: Parameters<MySqlDialect["sqlToQuery"]>[0]) =>
      dialect.sqlToQuery(statement).sql.includes("information_schema.STATISTICS") ? [index] : []),
    insert: vi.fn((table: unknown) => ({ values: (value: Stored) => ({
      onDuplicateKeyUpdate: async ({ set }: { set: Stored }) => {
        if (table === trainingDrafts) {
          const key = `${value.userId}:${value.scenarioId}`;
          const current = drafts.get(key);
          drafts.set(key, current ? { ...current, ...set } : { ...value, updatedAt: new Date() });
        } else if (table === trainingAttempts) {
          const key = `${value.userId}:${value.attemptKey}`;
          const current = attempts.get(key);
          attempts.set(key, current ? { ...current, ...set }
            : { ...value, id: attempts.size + 1, createdAt: new Date() });
        } else throw new Error("Unexpected table in synthetic storage");
      },
    }) })),
    select: vi.fn((fields: Record<string, unknown>) => ({ from: (table: unknown) => ({
      where: (condition: Parameters<MySqlDialect["sqlToQuery"]>[0]) => {
        const { params, sql } = dialect.sqlToQuery(condition);
        const isDraft = table === trainingDrafts;
        expect(sql).toContain(isDraft ? "`training_drafts`.`user_id` = ?" : "`training_attempts`.`user_id` = ?");
        const rows = [...(isDraft ? drafts : attempts).values()]
          .filter(row => row.userId === params[0] && (params.length === 1 || row.id === params[1]));
        const limit = async (count: number) => rows.slice(0, count).map(row =>
          Object.fromEntries(Object.keys(fields).map(field => [field, row[field]])));
        return { limit, orderBy: () => ({ limit }) };
      },
    }) })),
  };
  mock.getDb.mockResolvedValue(database);
  return { drafts, attempts, database };
}

const caller = (id: number | null, context: string) => appRouter.createCaller({
  user: id === null ? null : { id }, req: { headers: { "user-agent": `synthetic-${context}` } }, res: {},
} as any);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-22T01:00:00Z"));
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("External calls are forbidden in this behavior test"); }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("account practice flow through independent request contexts", () => {
  it.each(processScenarios)("saves, resumes and retries $processId without copying prose or another account's state", async scenario => {
    const storage = memoryStorage();
    const firstContext = caller(41, "first-context");
    const secondContext = caller(41, "second-context");
    const otherAccount = caller(42, "other-account");
    const attempt = scenario.processId === "etch" ? emptyEtchAttempt() : emptyProcessAttempt(scenario);
    attempt.elapsed = Math.floor(scenario.duration / 2); attempt.marker = 10;
    attempt.answer = { signal: scenario.signals[0].id, onset: "10",
      comparison: scenario.processId === "etch" ? "same-phase" : "same-condition", certainty: "uncertain",
      facts: "private synthetic observation not for persistence", checks: "private synthetic comparison not for persistence" };
    const checkpoint = toTrainingDraft(scenario.id, attempt, "decision");

    await expect(firstContext.training.saveDraft(checkpoint)).resolves.toEqual({ saved: true });
    expect(storage.drafts.size).toBe(1);
    expect(JSON.stringify([...storage.drafts.values()])).not.toContain("private synthetic");
    expect(await otherAccount.training.drafts()).toEqual({ userId: 42, drafts: [] });
    const loaded = await secondContext.training.drafts();
    expect(loaded.userId).toBe(41); expect(loaded.drafts).toHaveLength(1);
    const { updatedAt: _updatedAt, ...savedCheckpoint } = loaded.drafts[0];
    const restored = restoreTrainingDraft(savedCheckpoint);
    expect(restored).toMatchObject({ elapsed: attempt.elapsed, marker: 10, submitted: false,
      answer: { signal: checkpoint.signal, onset: checkpoint.onset, comparison: checkpoint.comparison,
        certainty: checkpoint.certainty, facts: "", checks: "" } });
    expect(restored.answer).not.toHaveProperty("userId");

    restored.elapsed = scenario.duration; restored.submitted = true;
    const submission = scenario.processId === "etch"
      ? toTrainingSubmission(restored as ReturnType<typeof emptyEtchAttempt>)
      : toProcessTrainingSubmission(restored as ReturnType<typeof emptyProcessAttempt>);
    const request = { attemptKey: "11111111-1111-4111-8111-111111111111", attempt: submission };
    await expect(secondContext.training.saveAttempt({ ...request,
      attempt: { ...submission, elapsed: checkpoint.elapsed },
    })).rejects.toThrow();
    expect(storage.attempts.size).toBe(0);
    await expect(secondContext.training.saveAttempt(request)).resolves.toEqual({ saved: true });
    await expect(firstContext.training.saveAttempt(request)).resolves.toEqual({ saved: true });
    expect(storage.attempts.size).toBe(1);
    const history = await firstContext.training.history();
    expect(history.attempts).toHaveLength(1);
    const id = history.attempts[0].id;
    expect((await secondContext.training.detail({ id })).attempt).toMatchObject({ scenarioId: scenario.id, marker: 10 });
    expect(await otherAccount.training.detail({ id })).toEqual({ userId: 42, attempt: null });
    expect(await otherAccount.training.history()).toEqual({ userId: 42, attempts: [] });

    // Each owner can save the same module without replacing the first owner's draft.
    await otherAccount.training.saveDraft({ ...checkpoint, elapsed: 12, marker: 5, onset: "5" });
    expect(storage.drafts.size).toBe(2);
    expect((await secondContext.training.drafts()).drafts[0].elapsed).toBe(attempt.elapsed);
    expect((await otherAccount.training.drafts()).drafts[0].elapsed).toBe(12);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requires owner consent to create a link, then lets a guest review only choices until the exact expiry", async () => {
    const storage = memoryStorage();
    const owner = caller(41, "owner"); const stranger = caller(42, "stranger"); const guest = caller(null, "recipient");
    await owner.training.saveAttempt({ attemptKey: "22222222-2222-4222-8222-222222222222", attempt: {
      elapsed: 180, submitted: true, marker: 82, signal: "pressure", onset: 70, comparison: "same-phase", certainty: "uncertain",
    } });
    const id = (await owner.training.history()).attempts[0].id;
    await expect(owner.training.share({ id, consent: false } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(stranger.training.share({ id, consent: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(guest.training.share({ id, consent: true })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const link = await owner.training.share({ id, consent: true });
    expect(Object.keys(decodeJwt(link.token).choices as object).sort()).toEqual([
      "certainty", "comparison", "marker", "onset", "scenarioId", "signal",
    ]);
    const recipientView = await guest.training.shared({ token: link.token });
    expect(recipientView.record).toMatchObject({ scenarioId: "etch-chamber-a-01", signal: "pressure", onset: 70,
      signalMatched: 1, comparisonMatched: 1, certaintyMatched: 1 });
    for (const field of ["userId", "id", "createdAt", "name", "email", "facts", "checks", "feedback"]) {
      expect(recipientView.record).not.toHaveProperty(field);
    }
    await expect(guest.training.detail({ id })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    vi.setSystemTime(new Date(new Date(link.expiresAt).getTime() - 1_000));
    await expect(guest.training.shared({ token: link.token })).resolves.toEqual(recipientView);
    vi.setSystemTime(new Date(link.expiresAt));
    await expect(guest.training.shared({ token: link.token })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(storage.attempts.size).toBe(1); expect(fetch).not.toHaveBeenCalled();
  });
});
