import type { Express } from "express";
import { parse } from "cookie";
import { sql } from "drizzle-orm";
import { COOKIE_NAME } from "@shared/const";
import { getDb, getUserByOpenId } from "./db";
import { sdk } from "./_core/sdk";

const expectedColumns = [
  ["id", "int", false], ["user_id", "int", false],
  ["attempt_key", "varchar", false, 36], ["scenario_id", "varchar", false, 64],
  ["signal", "varchar", false, 32], ["onset", "int", false],
  ["marker", "int", true], ["comparison", "varchar", false, 32],
  ["certainty", "varchar", false, 32], ["signal_matched", "int", false],
  ["onset_matched", "int", false], ["comparison_matched", "int", false],
  ["certainty_matched", "int", false], ["created_at", "timestamp", false],
] as const;

type Column = { name: string; type: string; nullable: string; length: number | null; defaultValue: string | null; extra: string };
type Index = { name: string; position: number; column: string; nonUnique: number; prefix: number | null };
const emptyChecks = () => ({ readable: false, columns: false, primaryKey: false, retryKey: false, ownerTimeline: false });

/** Inspects only the active runtime database; never reads stored attempts or returns DB identity. */
export async function inspectTrainingStorage() {
  const checks = emptyChecks();
  try {
    const database = await getDb();
    if (!database) return { ready: false, checks };
    // LIMIT 0 checks column visibility and SELECT permission without retrieving user records.
    await database.execute(sql`SELECT id, user_id, attempt_key, scenario_id, signal, onset,
      marker, comparison, certainty, signal_matched, onset_matched, comparison_matched,
      certainty_matched, created_at FROM training_attempts LIMIT 0`);
    checks.readable = true;
    const [columnRows] = await database.execute(sql`SELECT COLUMN_NAME AS name, DATA_TYPE AS type,
      IS_NULLABLE AS nullable, CHARACTER_MAXIMUM_LENGTH AS length, COLUMN_DEFAULT AS defaultValue,
      EXTRA AS extra FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'training_attempts'`);
    const columns = columnRows as unknown as Column[];
    checks.columns = columns.length === expectedColumns.length && expectedColumns.every(([name, type, nullable, ...length]) => {
      const column = columns.find(value => value.name === name);
      return column?.type === type && column.nullable === (nullable ? "YES" : "NO")
        && (length.length === 0 || Number(column.length) === length[0]);
    }) && Boolean(columns.find(value => value.name === "id")?.extra?.includes("auto_increment"))
      && /^(?:current_timestamp|now)(?:\(\d*\))?$/i.test(
        String(columns.find(value => value.name === "created_at")?.defaultValue ?? "").replace(/^\((.*)\)$/, "$1"));
    const [indexRows] = await database.execute(sql`SELECT INDEX_NAME AS name, SEQ_IN_INDEX AS position,
      COLUMN_NAME AS \`column\`, NON_UNIQUE AS nonUnique, SUB_PART AS prefix FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'training_attempts'`);
    const indexes = indexRows as unknown as Index[];
    const hasIndex = (names: string[], nonUnique: number, primary = false) => {
      const groups = new Map<string, Index[]>();
      for (const index of indexes) groups.set(index.name, [...(groups.get(index.name) ?? []), index]);
      return Array.from(groups.entries()).some(([name, entries]) => (!primary || name === "PRIMARY")
        && entries.length === names.length && entries.every(value => Number(value.nonUnique) === nonUnique && value.prefix === null)
        && entries.sort((a, b) => Number(a.position) - Number(b.position))
          .every((value, i) => Number(value.position) === i + 1 && value.column === names[i]));
    };
    checks.primaryKey = hasIndex(["id"], 0, true);
    checks.retryKey = hasIndex(["user_id", "attempt_key"], 0);
    checks.ownerTimeline = hasIndex(["user_id", "created_at"], 1);
    return { ready: Object.values(checks).every(Boolean), checks };
  } catch {
    // Never return/log driver errors: they may contain connection details or SQL.
    return { ready: false, checks: emptyChecks() };
  }
}

export function registerTrainingStorageCheck(app: Express) {
  app.get("/api/internal/training-storage-check", async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const token = parse(req.headers.cookie ?? "")[COOKIE_NAME];
      const session = await sdk.verifySession(token);
      // Do not use authenticateRequest here: normal session checks touch lastSignedIn.
      // This endpoint must not change existing user data, even during authentication.
      if (!session || !await getUserByOpenId(session.openId)) {
        res.status(401).json({ error: "Authentication required." });
        return;
      }
      res.status(200).json(await inspectTrainingStorage());
    } catch {
      res.status(503).json({ error: "Storage check unavailable." });
    }
  });
}
