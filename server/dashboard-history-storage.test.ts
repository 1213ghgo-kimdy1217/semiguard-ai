import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDashboardSensorHistory } from "./semiguardDb";

const mock = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => mock);
beforeEach(() => vi.clearAllMocks());

describe("read-only bounded per-account dashboard history", () => {
  it("limits by owner, exact snapshot and five-minute time bounds with deterministic ordering", async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const select = vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where }) });
    mock.getDb.mockResolvedValue({ select });
    const anchorAt = new Date("2026-10-07T00:05:00Z");
    await getDashboardSensorHistory(42, 10, anchorAt);
    const query = new MySqlDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(query.sql).toContain("`anomaly_logs`.`user_id` = ?");
    expect(query.sql).toContain("`anomaly_logs`.`id` <= ?");
    expect(query.sql).toContain("`anomaly_logs`.`timestamp` >= ?");
    expect(query.sql).toContain("`anomaly_logs`.`timestamp` <= ?");
    expect(query.params).toEqual([42, 10, "2026-10-07 00:00:00.000", "2026-10-07 00:05:00.000"]);
    expect(limit).toHaveBeenCalledWith(60);
    expect(orderBy.mock.calls[0]).toHaveLength(2);
    expect(Object.keys(select.mock.calls[0][0])).toEqual(["id", "timestamp", "current", "temperature", "vibration", "noise"]);
  });

  it("distinguishes unavailable storage from a real empty history", async () => {
    mock.getDb.mockResolvedValue(null);
    await expect(getDashboardSensorHistory(42, 10, new Date())).rejects.toThrow("Dashboard history unavailable");
  });

  it("links both normal and feedback retry questions and discloses the bounded summary in three languages", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");
    expect(source.match(/logId: current\?\.logId/g)).toHaveLength(2);
    expect(source).toContain("최근 5분 저장 기록(최대 60건) 요약");
    expect(source).toContain("直近5分の保存記録（最大60件）の要約");
    expect(source).toContain("last 5 minutes of saved observations (up to 60)");
    expect(source).toContain("Records may include other tabs");
  });
});
