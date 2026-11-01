import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { inspectRecoverySchema, validateRecoverySchema, type RecoverySchemaMetadata } from "./accountRecoverySchema";
import { recoveryPreflightConnectionOptions, runRecoverySchemaPreflight } from "../scripts/check-account-recovery-schema";

/** Convert the shipped manual DDL to information_schema-shaped fixtures; the
 * golden case follows the actual migration, not a second copy of checker rules. */
function migrated(): RecoverySchemaMetadata {
  const metadata: RecoverySchemaMetadata = {
    tables: ["users", "account_revocations"].map(tableName => ({ tableName, tableType: "BASE TABLE" })), columns: [], indexes: [],
  };
  let table = "";
  function column(tableName: string, line: string) {
    const match = /^(\w+)\s+(enum\([^)]*\)|varchar\(\d+\)|int|timestamp)(\s.*)$/i.exec(line);
    if (!match) throw new Error("Synthetic fixture could not parse shipped column");
    const [, columnName, type, rest] = match;
    const dataType = type.split("(")[0].toLowerCase();
    metadata.columns.push({ tableName, columnName, dataType, columnType: type === "int" ? "int(11)" : type,
      nullable: /NOT NULL/.test(rest) ? "NO" : "YES", defaultValue: /DEFAULT 0/.test(rest) ? "0" : null,
      characterLength: dataType === "varchar" ? Number(/\d+/.exec(type)![0]) : null,
      datetimePrecision: dataType === "timestamp" ? 0 : null, extra: "" });
    if (/PRIMARY KEY/.test(rest)) metadata.indexes.push({ tableName, indexName: "PRIMARY", position: 1, columnName, nonUnique: 0, prefix: null });
  }
  for (const raw of readFileSync(new URL("../drizzle/account_recovery.sql", import.meta.url), "utf8").split(/\r?\n/)) {
    const line = raw.trim().replace(/[,;]$/, "");
    if (!line || line.startsWith("--")) continue;
    const alter = /^ALTER TABLE users ADD COLUMN (.+)$/i.exec(line);
    if (alter) { column("users", alter[1]); continue; }
    const create = /^CREATE TABLE (\w+) \($/i.exec(line);
    if (create) { table = create[1]; metadata.tables.push({ tableName: table, tableType: "BASE TABLE" }); continue; }
    if (line === ")") { table = ""; continue; }
    const index = /^(UNIQUE )?KEY (\w+) \(([^)]+)\)$/i.exec(line);
    if (index) {
      index[3].split(",").forEach((name, i) => metadata.indexes.push({ tableName: table, indexName: index[2], position: i + 1,
        columnName: name.trim(), nonUnique: index[1] ? 0 : 1, prefix: null }));
    } else if (table) column(table, line);
  }
  return metadata;
}
function absent(): RecoverySchemaMetadata {
  return { tables: [{ tableName: "users", tableType: "BASE TABLE" }, { tableName: "account_revocations", tableType: "BASE TABLE" }], columns: [], indexes: [] };
}
function reader(metadata: RecoverySchemaMetadata) {
  const responses = [metadata.tables, metadata.columns, metadata.indexes];
  return { execute: vi.fn(async () => [responses.shift(), []] as const), end: vi.fn(async () => {}) };
}
const syntheticUrl = "mysql://synthetic-user:synthetic-password@example.invalid/synthetic_db";

describe("metadata-only account recovery schema preflight", () => {
  it("accepts the actual shipped migration and ignores unrelated metadata in its report", () => {
    const fixture = migrated();
    fixture.tables.push({ tableName: "private_unrelated_table", tableType: "BASE TABLE" });
    expect(validateRecoverySchema(fixture)).toEqual({ state: "ready", missing: [] });
  });
  it("distinguishes a wholly absent feature from partial migration, without suggesting automatic DDL", () => {
    const before = validateRecoverySchema(absent());
    expect(before.state).toBe("absent");
    expect(before.missing.sort()).toEqual(["account_recovery_emails.table", "account_recovery_limits.table", "account_recovery_tokens.table", "users.auth_version"].sort());
    const partial = absent(); partial.columns.push(migrated().columns.find(column => column.tableName === "users")!);
    expect(validateRecoverySchema(partial).state).toBe("partial");
    expect(validateRecoverySchema({ tables: [], columns: [], indexes: [] }).state).toBe("partial");
  });
  it("rejects wrong defaults, nullability, signed types, enum sets, lengths and unexpected insert columns", () => {
    const fixture = migrated();
    fixture.columns.find(column => column.tableName === "users")!.defaultValue = "1";
    const owner = fixture.columns.find(column => column.tableName === "account_recovery_emails" && column.columnName === "user_id")!;
    owner.nullable = "YES"; owner.columnType = "int(11) unsigned";
    fixture.columns.find(column => column.columnName === "kind")!.columnType = "enum('verify','password','other')";
    fixture.columns.find(column => column.columnName === "email_key")!.characterLength = 32;
    fixture.columns.push({ ...owner, columnName: "private_unplanned_column" });
    const report = validateRecoverySchema(fixture);
    expect(report.state).toBe("partial");
    expect(report.missing).toEqual(expect.arrayContaining(["users.auth_version.default_zero", "account_recovery_emails.user_id.type",
      "account_recovery_emails.user_id.not_null", "account_recovery_tokens.kind.type", "account_recovery_emails.email_key.type", "account_recovery_emails.columns"]));
    expect(JSON.stringify(report)).not.toContain("private_unplanned_column");
  });
  it("rejects prefix/composite uniqueness, missing expiry indexes, duplicate metadata and views", () => {
    const fixture = migrated();
    const unique = fixture.indexes.find(index => index.indexName === "account_recovery_email_unique")!;
    unique.prefix = 32;
    fixture.indexes.push({ ...unique, columnName: "user_id", position: 2, prefix: null });
    fixture.indexes = fixture.indexes.filter(index => index.indexName !== "account_recovery_token_expiry");
    fixture.columns.push({ ...fixture.columns.find(column => column.tableName === "users")! });
    fixture.tables.find(table => table.tableName === "account_recovery_limits")!.tableType = "VIEW";
    const report = validateRecoverySchema(fixture);
    expect(report.state).toBe("partial");
    expect(report.missing).toEqual(expect.arrayContaining(["account_recovery_emails.email_key_unique", "account_recovery_tokens.expiry_index", "users.auth_version", "account_recovery_limits.table"]));
  });
  it("executes only allowlisted information_schema SELECTs and sanitizes all metadata errors", async () => {
    const database = reader(migrated());
    expect(await inspectRecoverySchema(database)).toEqual({ state: "ready", missing: [] });
    expect(database.execute).toHaveBeenCalledTimes(3);
    for (const call of database.execute.mock.calls as unknown as [string, string[]][]) {
      expect(call[0]).toMatch(/^SELECT .+ FROM information_schema\./);
      expect(call[0]).toContain("TABLE_SCHEMA = DATABASE()");
      expect(call[1]).toEqual(["users", "account_revocations", "account_recovery_emails", "account_recovery_tokens", "account_recovery_limits"]);
    }
    const failed = { execute: vi.fn(async () => { throw new Error("mysql://private-user:private-password@private-host/private-db"); }) };
    expect(await inspectRecoverySchema(failed)).toEqual({ state: "unavailable", missing: ["schema.metadata"] });
  });
  it("prints help without reading DATABASE_URL or opening a connection", async () => {
    const environment = new Proxy({}, { get: () => { throw new Error("Environment must not be read by help"); } });
    const write = vi.fn(); const connect = vi.fn();
    expect(await runRecoverySchemaPreflight(["--help"], environment, { write }, connect)).toBe(0);
    expect(connect).not.toHaveBeenCalled(); expect(write.mock.calls[0][0]).toContain("Exit codes: 0 ready; 2 absent; 3 partial; 1 unavailable");
  });
  it("forces certificate AND hostname verification and rejects configuration overrides without connecting", () => {
    expect(recoveryPreflightConnectionOptions(syntheticUrl)).toMatchObject({ ssl: { rejectUnauthorized: true, verifyIdentity: true }, multipleStatements: false, debug: false });
    for (const suffix of ["?ssl=" + encodeURIComponent('{"rejectUnauthorized":false}'), "?ssl=" + encodeURIComponent('{"verifyIdentity":false}'),
      "?host=unapproved.invalid", "?debug=true", "?ssl={}&ssl={}", "#fragment"]) {
      expect(recoveryPreflightConnectionOptions(syntheticUrl + suffix)).toBeNull();
    }
    const ca = "synthetic-public-ca";
    expect(recoveryPreflightConnectionOptions(syntheticUrl + "?ssl=" + encodeURIComponent(JSON.stringify({ ca, rejectUnauthorized: true })))).toMatchObject({ ssl: { ca, rejectUnauthorized: true, verifyIdentity: true } });
  });
  it("uses the documented exit codes and outputs no credentials, schema names or driver errors", async () => {
    const partial = migrated(); partial.columns.find(column => column.tableName === "users")!.defaultValue = null;
    for (const [fixture, state, code] of [[migrated(), "ready", 0], [absent(), "absent", 2], [partial, "partial", 3]] as const) {
      const database = reader(fixture); const write = vi.fn();
      expect(await runRecoverySchemaPreflight([], { DATABASE_URL: syntheticUrl }, { write }, async () => database)).toBe(code);
      expect(JSON.parse(write.mock.calls[0][0]).state).toBe(state); expect(database.end).toHaveBeenCalledOnce();
      expect(write.mock.calls[0][0]).not.toMatch(/synthetic-user|synthetic-password|example\.invalid|synthetic_db/);
    }
    const write = vi.fn();
    expect(await runRecoverySchemaPreflight([], { DATABASE_URL: syntheticUrl }, { write }, async () => { throw new Error("private-host private-password"); })).toBe(1);
    expect(JSON.parse(write.mock.calls[0][0])).toEqual({ state: "unavailable", missing: ["connection.unavailable"] });
    expect(await runRecoverySchemaPreflight([], {}, { write }, vi.fn())).toBe(1);
  });
});
