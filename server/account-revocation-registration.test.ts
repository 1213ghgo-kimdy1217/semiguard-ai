import { getTableName } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ revoked: false, values: vi.fn(), execute: vi.fn(async () => [[], []]) }));
vi.mock("./_core/env", () => ({ ENV: { cookieSecret: "synthetic-registration-secret", ownerOpenId: "owner" } }));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => ({
  execute: state.execute,
  select: () => ({ from: (table: any) => ({ where: () => ({ limit: async () => getTableName(table) === "account_revocations" ? state.revoked ? [{ hash: "revoked" }] : [] : [] }) }) }),
  insert: () => ({ values: (value: any) => { state.values(value); return { onDuplicateKeyUpdate: async () => undefined, then: (resolve: any) => Promise.resolve(undefined).then(resolve) }; } }),
}) }));
import { createLocalUser, upsertUser } from "./db";
beforeAll(() => vi.stubEnv("DATABASE_URL", "mysql://synthetic.invalid/no-network"));
beforeEach(() => { vi.clearAllMocks(); state.revoked = false; });

describe("re-registration does not inherit a withdrawn identity", () => {
  it("uses a new opaque local subject for every signup, not the badge", async () => {
    const raw = { badgeNumber: "SYNTHETIC-EMP-21", name: "QA", dateOfBirth: "2000-01-01", passwordHash: "synthetic" };
    await createLocalUser(raw); await createLocalUser(raw);
    const ids = state.values.mock.calls.map(([value]) => value.openId);
    expect(ids).toHaveLength(2); expect(ids[0]).not.toBe(ids[1]);
    for (const id of ids) { expect(id).toMatch(/^local_[a-f0-9-]{36}$/); expect(id).not.toContain(raw.badgeNumber); }
  });
  it("refuses explicit OAuth upserts of a revoked subject", async () => {
    state.revoked = true;
    await expect(upsertUser({ openId: "synthetic-revoked" })).rejects.toThrow("Account is unavailable");
    expect(state.values).not.toHaveBeenCalled();
  });
  it("keeps non-revoked existing OAuth accounts compatible", async () => {
    await expect(upsertUser({ openId: "synthetic-existing", name: "QA" })).resolves.toBeUndefined();
    expect(state.values).toHaveBeenCalledWith(expect.objectContaining({ openId: "synthetic-existing" }));
  });
});
