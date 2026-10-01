import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { trainingAttempts } from "../drizzle/schema";
import { getTrainingAttempts, saveTrainingAttempt } from "./trainingRecords";

const dbMock = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => dbMock);
const submission = { elapsed: 180, submitted: true, marker: 82, signal: "pressure",
  onset: 70, comparison: "same-phase", certainty: "uncertain" };

describe("training record persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the session owner and only validated choices, with an idempotent retry", async () => {
    const onDuplicateKeyUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onDuplicateKeyUpdate });
    const insert = vi.fn().mockReturnValue({ values });
    dbMock.getDb.mockResolvedValue({ insert });
    await expect(saveTrainingAttempt(27, "attempt-a", submission)).resolves.toEqual({ saved: true });
    expect(insert).toHaveBeenCalledWith(trainingAttempts);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ userId: 27, attemptKey: "attempt-a", signalMatched: 1 }));
    expect(values.mock.calls[0][0]).not.toHaveProperty("facts");
    expect(onDuplicateKeyUpdate).toHaveBeenCalledWith({ set: { attemptKey: "attempt-a" } });
  });

  it("does not insert invalid submissions", async () => {
    const insert = vi.fn();
    dbMock.getDb.mockResolvedValue({ insert });
    await expect(saveTrainingAttempt(27, "attempt-a", { ...submission, elapsed: 10 })).rejects.toThrow();
    expect(insert).not.toHaveBeenCalled();
  });

  it("scopes history to the current owner and limits the latest results", async () => {
    const limit = vi.fn().mockResolvedValue([{ id: 3 }]);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    dbMock.getDb.mockResolvedValue({ select });
    await expect(getTrainingAttempts(27)).resolves.toEqual([{ id: 3 }]);
    const query = new MySqlDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(query.sql).toContain("`training_attempts`.`user_id` = ?");
    expect(query.params).toEqual([27]);
    expect(limit).toHaveBeenCalledWith(20);
    expect(select.mock.calls[0][0]).not.toHaveProperty("userId");
  });

  it("reports unavailable storage instead of pretending a result was saved", async () => {
    dbMock.getDb.mockResolvedValue(null);
    await expect(saveTrainingAttempt(27, "attempt-a", submission)).rejects.toThrow();
    await expect(getTrainingAttempts(27)).rejects.toThrow();
  });
});
