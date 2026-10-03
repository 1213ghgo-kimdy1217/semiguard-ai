import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { getTrainingDrafts, inspectDraftStorage, saveTrainingDraft } from "./trainingDrafts";
import { trainingDrafts } from "../drizzle/schema";
import { appRouter } from "./routers";
const mock = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => mock);
const draft = { version: 1 as const, scenarioId: "etch-chamber-a-01", elapsed: 70, marker: null,
  stage: "observe" as const, signal: "pressure", onset: "", comparison: "same-phase" as const, certainty: "" as const };
const index = [1, 2].map(position => ({ name: "owner", position, col: position === 1 ? "user_id" : "scenario_id", nonUnique: 0, prefix: null }));
describe("owner-bound checkpoint persistence", () => {
  beforeEach(() => vi.clearAllMocks());
  it("denies guests for read, storage checks, save and sharing", async () => {
    const caller = appRouter.createCaller({ user: null, req: {}, res: {} } as any);
    await expect(caller.training.drafts()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.training.draftStorage()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.training.saveDraft(draft)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.training.share({ id: 1, consent: true })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mock.getDb).not.toHaveBeenCalled();
  });
  it("checks no records and requires an unprefixed owner+scenario unique key", async () => {
    const execute = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([index]);
    mock.getDb.mockResolvedValue({ execute });
    await expect(inspectDraftStorage()).resolves.toEqual({ ready: true });
    const statement = new MySqlDialect().sqlToQuery(execute.mock.calls[0][0]);
    expect(statement.sql).toContain("LIMIT 0");
    for (const invalid of [[], [{ ...index[0], prefix: 2 }, index[1]], index.map(i => ({ ...i, nonUnique: 1 })),
      [...index, { name: "unsafe_global_scenario", position: 1, col: "scenario_id", nonUnique: 0, prefix: null }]]) {
      execute.mockReset().mockResolvedValueOnce([]).mockResolvedValueOnce([invalid]);
      await expect(inspectDraftStorage()).resolves.toEqual({ ready: false });
    }
  });
  it("saves only choices under the session owner and does not replace ownership", async () => {
    const execute = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([index]);
    const update = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onDuplicateKeyUpdate: update });
    const insert = vi.fn().mockReturnValue({ values });
    mock.getDb.mockResolvedValue({ execute, insert });
    await expect(saveTrainingDraft(41, draft)).resolves.toEqual({ saved: true });
    expect(insert).toHaveBeenCalledWith(trainingDrafts);
    const { version: _version, ...saved } = draft;
    expect(values.mock.calls[0][0]).toEqual({ userId: 41, ...saved });
    expect(update.mock.calls[0][0].set).not.toHaveProperty("userId");
  });
  it("returns only this owner's valid drafts, bounded to eight modules", async () => {
    const { version: _version, ...row } = draft;
    const limit = vi.fn().mockResolvedValue([{ ...row, updatedAt: new Date() }, { ...row, scenarioId: "bad" }]);
    const where = vi.fn().mockReturnValue({ orderBy: vi.fn().mockReturnValue({ limit }) });
    const select = vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where }) });
    mock.getDb.mockResolvedValue({ select });
    expect(await getTrainingDrafts(41)).toHaveLength(1);
    const statement = new MySqlDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(statement.params).toEqual([41]); expect(statement.sql).toContain("`training_drafts`.`user_id` = ?");
    expect(limit).toHaveBeenCalledWith(8); expect(select.mock.calls[0][0]).not.toHaveProperty("userId");
  });
  it("fails closed without exposing DB errors or pretending to save", async () => {
    mock.getDb.mockRejectedValue(new Error("connection-password-example"));
    await expect(inspectDraftStorage()).resolves.toEqual({ ready: false });
    await expect(saveTrainingDraft(41, draft)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });
});
