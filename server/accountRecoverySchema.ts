/** Read-only preflight. Never import the application DB, dotenv or Secret configuration. */
export type RecoverySchemaState = "ready" | "absent" | "partial" | "unavailable";
export type RecoverySchemaReport = { state: RecoverySchemaState; missing: string[] };
export type RecoverySchemaMetadata = {
  tables: { tableName: string; tableType: string }[];
  columns: { tableName: string; columnName: string; dataType: string; columnType: string; nullable: string;
    defaultValue: unknown; characterLength: number | string | null; datetimePrecision: number | string | null; extra: string }[];
  indexes: { tableName: string; indexName: string; position: number | string; columnName: string | null;
    nonUnique: number | string; prefix: number | string | null }[];
};
export interface RecoverySchemaReader {
  execute(query: string, parameters: string[]): Promise<readonly [unknown, unknown]>;
}

const featureTables = ["account_recovery_emails", "account_recovery_tokens", "account_recovery_limits"] as const;
const selectedTables = ["users", "account_revocations", ...featureTables];
const unavailable = (): RecoverySchemaReport => ({ state: "unavailable", missing: ["schema.metadata"] });

// Bind the small table allowlist; never select a schema name or application rows.
export const recoverySchemaMetadataQueries = [
  "SELECT TABLE_NAME AS tableName, TABLE_TYPE AS tableType FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?, ?, ?, ?, ?)",
  "SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, DATA_TYPE AS dataType, COLUMN_TYPE AS columnType, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS defaultValue, CHARACTER_MAXIMUM_LENGTH AS characterLength, DATETIME_PRECISION AS datetimePrecision, EXTRA AS extra FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?, ?, ?, ?, ?) AND (TABLE_NAME <> 'users' OR COLUMN_NAME = 'auth_version')",
  "SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName, SEQ_IN_INDEX AS position, COLUMN_NAME AS columnName, NON_UNIQUE AS nonUnique, SUB_PART AS prefix FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?, ?, ?, ?, ?)",
] as const;

type ColumnRule = { name: string; type: "int" | "varchar" | "timestamp" | "enum"; length?: number; values?: string; defaultZero?: boolean };
const rules: Record<(typeof featureTables)[number], ColumnRule[]> = {
  account_recovery_emails: [
    { name: "user_id", type: "int" }, { name: "email", type: "varchar", length: 320 },
    { name: "email_key", type: "varchar", length: 64 }, { name: "verified_at", type: "timestamp" },
  ],
  account_recovery_tokens: [
    { name: "token_hash", type: "varchar", length: 64 }, { name: "user_id", type: "int" },
    { name: "kind", type: "enum", values: "enum('verify','password')" },
    { name: "language", type: "enum", values: "enum('ko','en','ja')" },
    { name: "email", type: "varchar", length: 320 }, { name: "auth_version", type: "int" },
    { name: "expires_at", type: "timestamp" },
  ],
  account_recovery_limits: [
    { name: "limit_key", type: "varchar", length: 64 }, { name: "hits", type: "int" },
    { name: "expires_at", type: "timestamp" },
  ],
};

/** Pure validation returns only static allowlisted labels, never actual metadata values. */
export function validateRecoverySchema(metadata: RecoverySchemaMetadata): RecoverySchemaReport {
  const missing: string[] = [];
  const fail = (label: string, matches: boolean) => { if (!matches) missing.push(label); };
  const tablePresent = (table: string) => metadata.tables.some(value => value.tableName === table);
  for (const table of selectedTables) {
    const rows = metadata.tables.filter(value => value.tableName === table);
    fail(`${table}.table`, rows.length === 1 && rows[0].tableType === "BASE TABLE");
  }
  function column(table: string, rule: ColumnRule) {
    const rows = metadata.columns.filter(value => value.tableName === table && value.columnName === rule.name);
    const label = `${table}.${rule.name}`;
    if (rows.length !== 1) { fail(label, false); return; }
    const value = rows[0];
    fail(`${label}.type`, value.dataType === rule.type
      && (rule.type !== "int" || /^int(?:\(\d+\))?$/i.test(value.columnType))
      && (rule.length === undefined || Number(value.characterLength) === rule.length)
      && (rule.values === undefined || value.columnType === rule.values)
      && (rule.type !== "timestamp" || value.datetimePrecision !== null && Number(value.datetimePrecision) === 0));
    fail(`${label}.not_null`, value.nullable === "NO");
    fail(`${label}.no_generated_value`, !value.extra || !/auto_increment|generated/i.test(value.extra));
    if (rule.defaultZero) fail(`${label}.default_zero`, value.defaultValue !== null && String(value.defaultValue) === "0");
  }
  column("users", { name: "auth_version", type: "int", defaultZero: true });
  for (const table of featureTables) {
    if (!tablePresent(table)) continue;
    const actual = metadata.columns.filter(value => value.tableName === table);
    const expected = rules[table];
    // Unexpected non-defaulted columns can prevent inserts even if required
    // columns exist. Require the reviewed manual migration's exact column set.
    fail(`${table}.columns`, actual.length === expected.length && actual.every(value => expected.some(rule => rule.name === value.columnName)));
    for (const rule of expected) column(table, rule);
  }
  function index(table: string, columns: string[], nonUnique: number, primary = false) {
    const groups = new Map<string, RecoverySchemaMetadata["indexes"]>();
    for (const entry of metadata.indexes.filter(value => value.tableName === table)) {
      groups.set(entry.indexName, [...groups.get(entry.indexName) ?? [], entry]);
    }
    return Array.from(groups.entries()).some(([name, rows]) => (!primary || name === "PRIMARY") && rows.length === columns.length
      && rows.every(value => Number(value.nonUnique) === nonUnique && value.prefix === null)
      && [...rows].sort((a, b) => Number(a.position) - Number(b.position))
        .every((value, i) => Number(value.position) === i + 1 && value.columnName === columns[i]));
  }
  if (tablePresent("account_recovery_emails")) {
    fail("account_recovery_emails.primary_key", index("account_recovery_emails", ["user_id"], 0, true));
    fail("account_recovery_emails.email_key_unique", index("account_recovery_emails", ["email_key"], 0));
  }
  if (tablePresent("account_recovery_tokens")) {
    fail("account_recovery_tokens.primary_key", index("account_recovery_tokens", ["token_hash"], 0, true));
    fail("account_recovery_tokens.owner_index", index("account_recovery_tokens", ["user_id"], 1));
    fail("account_recovery_tokens.expiry_index", index("account_recovery_tokens", ["expires_at"], 1));
  }
  if (tablePresent("account_recovery_limits")) {
    fail("account_recovery_limits.primary_key", index("account_recovery_limits", ["limit_key"], 0, true));
    fail("account_recovery_limits.expiry_index", index("account_recovery_limits", ["expires_at"], 1));
  }
  if (!missing.length) return { state: "ready", missing: [] };
  const featureExists = tablePresent("users") && metadata.columns.some(value => value.tableName === "users" && value.columnName === "auth_version")
    || featureTables.some(table => tablePresent(table) || metadata.columns.some(value => value.tableName === table) || metadata.indexes.some(value => value.tableName === table));
  const baselineReady = ["users", "account_revocations"].every(table => metadata.tables.filter(value => value.tableName === table && value.tableType === "BASE TABLE").length === 1);
  return { state: !featureExists && baselineReady ? "absent" : "partial", missing };
}

/** The supplied reader must already target the approved DB. No connection is opened here. */
export async function inspectRecoverySchema(reader: RecoverySchemaReader): Promise<RecoverySchemaReport> {
  try {
    const lists: unknown[][] = [];
    for (const query of recoverySchemaMetadataQueries) {
      const [rows] = await reader.execute(query, [...selectedTables]);
      if (!Array.isArray(rows) || rows.length > 1000 || rows.some(row => !row || typeof row !== "object" || Array.isArray(row))) return unavailable();
      lists.push(rows);
    }
    return validateRecoverySchema({ tables: lists[0], columns: lists[1], indexes: lists[2] } as RecoverySchemaMetadata);
  } catch { return unavailable(); }
}
