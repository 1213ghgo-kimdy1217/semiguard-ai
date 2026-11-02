import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type { ConnectionOptions } from "mysql2";
import type { RecoveryStore, RecoveryTransaction } from "../server/accountRecoveryStore";
import { inspectRecoverySchema, type RecoverySchemaReader } from "../server/accountRecoverySchema";
import { sessionMatchesUser } from "../server/accountRecoverySession";
import { recoveryPreflightConnectionOptions } from "./check-account-recovery-schema";

export const RECOVERY_QA_DATABASE = "semiguard_recovery_qa_20261102";
const TABLES = ["users", "account_revocations", "account_recovery_emails", "account_recovery_tokens", "account_recovery_limits"] as const;
export type RecoveryQaReport = { passed: boolean; checks: Record<string, boolean> };
type Report = RecoveryQaReport;
export type RecoveryQaTarget = { expectedHost: string; expectedUser: string };
type IO = { write(value: string): void };
const HELP = `Usage: node --import tsx scripts/qa-account-recovery-tidb.ts [--help | --prepare-sql | --run]

Default/--help: no environment lookup or connection.
--prepare-sql: print only static DDL for the approved, isolated QA database.
--run: operator-provided DATABASE_URL must select exactly ${RECOVERY_QA_DATABASE}.
RECOVERY_QA_EXPECTED_HOST and RECOVERY_QA_EXPECTED_USER must separately identify
the approved owned-cluster host and database user. A shared gateway host alone
does not establish the approved tenant.
Requires its five reviewed tables to be ready and empty; creates four synthetic accounts.
No .env loading, production mutation, external mail, schema deletion or raw diagnostics.
Certificate AND hostname verification are mandatory. Output: pass/fail booleans only.
Exit 0 means all checks and run-owned cleanup passed; exit 1 means stop and review.
`;

/** Offline output only. No application rows are copied and no DROP is generated. */
export function recoveryQaBootstrapSql() {
  return `CREATE DATABASE IF NOT EXISTS \`${RECOVERY_QA_DATABASE}\` CHARACTER SET utf8mb4;
USE \`${RECOVERY_QA_DATABASE}\`;
CREATE TABLE users (
  id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  openId varchar(64) NOT NULL UNIQUE,
  name text,
  email varchar(320),
  loginMethod varchar(64),
  badge_number varchar(64),
  date_of_birth date,
  password_hash text,
  role enum('user','admin') NOT NULL DEFAULT 'user',
  createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  lastSignedIn timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE account_revocations (
  subject_hash varchar(64) NOT NULL PRIMARY KEY,
  revoked_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
${readFileSync(new URL("../drizzle/account_recovery.sql", import.meta.url), "utf8")}`;
}

function guardedOptions(connectionUrl: string | undefined, target: RecoveryQaTarget): ConnectionOptions | null {
  const options = recoveryPreflightConnectionOptions(connectionUrl);
  if (!options || options.database !== RECOVERY_QA_DATABASE || !target.expectedHost
    || typeof target.expectedUser !== "string" || !target.expectedUser || target.expectedUser.length > 256
    || target.expectedUser !== target.expectedUser.trim() || /[\r\n\0]/.test(target.expectedUser)
    || options.host?.toLowerCase() !== target.expectedHost.toLowerCase() || options.port !== 4000
    || options.user !== target.expectedUser) return null;
  return options;
}

type PreparationConnection = RecoverySchemaReader & {
  query(sql: string): Promise<readonly [unknown, unknown]>;
  end(): Promise<unknown>;
};
type PreparationConnect = (options: ConnectionOptions) => Promise<PreparationConnection>;
async function openPreparationConnection(options: ConnectionOptions): Promise<PreparationConnection> {
  const { createConnection } = await import("mysql2/promise");
  const connection = await createConnection(options);
  return {
    execute: (query, parameters) => connection.execute({ sql: query, timeout: 10_000 }, parameters),
    query: query => connection.query({ sql: query, timeout: 30_000 }),
    end: () => connection.end(),
  };
}

/** Explicit, separate bootstrap action. Existing partial/unrelated schemas are never repaired automatically. */
export async function prepareRecoveryQaDatabase(
  connectionUrl: string, target: RecoveryQaTarget, open: PreparationConnect = openPreparationConnection,
): Promise<Report> {
  const options = guardedOptions(connectionUrl, target);
  const checks = { approvedQaDatabaseAndHost: Boolean(options), schemaScopeSafe: false, requiredFiveTablesReady: false };
  if (!options) return { passed: false, checks };
  let cluster: PreparationConnection | undefined, qa: PreparationConnection | undefined;
  try {
    const { database: _qaOnly, ...clusterOptions } = options;
    cluster = await open(clusterOptions);
    const [exists] = await cluster.execute("SELECT COUNT(*) AS present FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?", [RECOVERY_QA_DATABASE]);
    if (!Array.isArray(exists) || exists.length !== 1) return { passed: false, checks };
    if (Number(exists[0].present) === 0) await cluster.query(`CREATE DATABASE IF NOT EXISTS \`${RECOVERY_QA_DATABASE}\` CHARACTER SET utf8mb4`);
    await cluster.end(); cluster = undefined;
    qa = await open(options);
    const [identity] = await qa.execute("SELECT DATABASE() = ? AS matches", [RECOVERY_QA_DATABASE]);
    if (!Array.isArray(identity) || identity.length !== 1 || Number(identity[0].matches) !== 1) return { passed: false, checks };
    const [present] = await qa.execute("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()", []);
    if (!Array.isArray(present)) return { passed: false, checks };
    if (!present.length) {
      checks.schemaScopeSafe = true;
      // Source is the reviewed local bootstrap, never a user-supplied SQL string.
      const statements = recoveryQaBootstrapSql().replace(/^\s*--.*$/gm, "").split(";")
        .map(value => value.trim()).filter(value => value && !/^CREATE DATABASE\b|^USE\b/i.test(value));
      if (statements.length !== 6 || statements.some(statement => !/^CREATE TABLE (?:users|account_revocations|account_recovery_emails|account_recovery_tokens|account_recovery_limits)\s*\(|^ALTER TABLE users ADD COLUMN auth_version int NOT NULL DEFAULT 0$/i.test(statement))) return { passed: false, checks };
      for (const statement of statements) await qa.query(statement);
    } else {
      // A ready existing QA schema is left intact; any partial/unrelated state stops.
      checks.schemaScopeSafe = present.length === TABLES.length && present.every(row => TABLES.includes(row.name));
      if (!checks.schemaScopeSafe) return { passed: false, checks };
    }
    checks.requiredFiveTablesReady = (await inspectRecoverySchema(qa)).state === "ready";
    return { passed: checks.schemaScopeSafe && checks.requiredFiveTablesReady, checks };
  } catch { return { passed: false, checks }; }
  finally {
    try { await qa?.end(); } catch { /* No raw diagnostics. */ }
    try { await cluster?.end(); } catch { /* No raw diagnostics. */ }
  }
}

function recoveryError(error: unknown, code: string, message: string) {
  return Boolean(error && typeof error === "object" && "code" in error && "message" in error
    && error.code === code && error.message === message);
}
async function rejects(operation: Promise<unknown>, code: string, message: string) {
  try { await operation; return false; } catch (error) { return recoveryError(error, code, message); }
}

/** No live work is possible until the CLI's exact database gate has passed. */
async function executeLiveQa(options: ConnectionOptions): Promise<Report> {
  const checks: Record<string, boolean> = {
    approvedQaDatabase: false, schemaReady: false, exclusiveEmptySchema: false,
    syntheticAccountsWithinLimit: false, verifiedAddressSetup: false,
    concurrentResetSingleSuccess: false, passwordAndEpochChanged: false, tokenReplayRejected: false,
    rollbackRestoredPasswordEpochAndToken: false, jwtVersionsEnforced: false,
    emailUniqueRaceSingleOwner: false, recipientLimitShared: false, expiredTokenRejected: false,
    noExternalMailTransport: false, cleanupOwnedRows: false,
  };
  const check = (name: string, passed: boolean) => { checks[name] = passed; if (!passed) throw new Error("QA_CHECK_FAILED"); };
  const { createPool } = await import("mysql2/promise");
  const { drizzle } = await import("drizzle-orm/mysql2");
  const { and, eq, inArray } = await import("drizzle-orm");
  const tables = await import("../drizzle/schema");
  const { createRecoveryStore } = await import("../server/accountRecoveryStore");
  const { createAccountRecoveryService, recoveryTokenHash } = await import("../server/accountRecovery");
  const { hashPassword, verifyPassword } = await import("../server/password");
  const { SignJWT, jwtVerify } = await import("jose");
  const pool = createPool({ ...options, connectionLimit: 4, maxIdle: 4 });
  // Use mysql2's public underlying callback pool, matching the application's
  // store client type. Queries, transactions and pool.end share the same pool.
  const database = drizzle(pool.pool, { logger: false });
  const run = randomUUID();
  const openIds = Array.from({ length: 4 }, (_, i) => `local_qa_${run}_${i + 1}`);
  const secret = randomBytes(32).toString("hex");
  const subjectHash = (openId: string) => createHmac("sha256", secret).update("semiguard-account-revocation-v1\0").update(openId).digest("hex");
  const emailKey = (email: string) => createHmac("sha256", secret).update(`semiguard-account-recovery-v1\0email\0${email.toLowerCase()}`).digest("hex");
  const store = createRecoveryStore(database, subjectHash);
  const counterKeys = new Set<string>();
  const mail: { to: string; kind: string; token?: string; loginId?: string }[] = [];
  let clock = Math.floor(Date.now() / 1000) * 1000;
  const oldPassword = randomBytes(24).toString("base64url");
  const newPassword = randomBytes(24).toString("base64url");
  let created: { id: number; openId: string; badgeNumber: string | null }[] = [];
  let cleanupAllowed = false;
  // The injected adapter changes only the isolated test process. Background
  // expiry GC is omitted so even concurrent foreign QA rows cannot be deleted.
  // Explicit cleanup below targets only this run's UUID users/digest keys.
  const tracked = (transform?: (tx: RecoveryTransaction) => RecoveryTransaction): RecoveryStore => ({
    ...store,
    transaction: callback => store.transaction(tx => {
      const decorated = { ...tx, purgeExpired: async () => {}, hitLimit: async (limit: Parameters<RecoveryTransaction["hitLimit"]>[0]) => {
        counterKeys.add(limit.key); return tx.hitLimit(limit);
      } };
      return callback(transform ? transform(decorated) : decorated);
    }),
  });
  const service = (using: RecoveryStore = tracked()) => createAccountRecoveryService({
    available: () => true, store: async () => using, secret: () => secret, now: () => clock, receiptMinimumMs: 0,
    send: async value => { mail.push({ ...value }); }, // Fixed memory sink; no transport option.
  });
  const address = (n: number) => `qa-${run}-${n}@example.invalid`;
  const latestToken = (kind: string, to: string) => {
    const token = mail.findLast(value => value.kind === kind && value.to === to)?.token;
    if (!token) throw new Error("QA_EXPECTED_MEMORY_MAIL");
    return token;
  };
  const request = (using: ReturnType<typeof service>, identifier: string, method: "id" | "email" = "id", purpose: "password" | "id" = "password") =>
    using.request({ purpose, method, identifier, language: "ko" }, `qa-client-${run}`);
  const reset = (using: ReturnType<typeof service>, token: string) => using.reset({ token, password: newPassword, confirmation: newPassword }, `qa-reset-${run}`);
  const invalid = (operation: Promise<unknown>) => rejects(operation, "BAD_REQUEST", "RECOVERY_LINK_INVALID");
  try {
    const [identity] = await pool.execute<any[]>("SELECT DATABASE() = ? AS matches", [RECOVERY_QA_DATABASE]);
    check("approvedQaDatabase", identity.length === 1 && Number(identity[0].matches) === 1);
    const metadata = await inspectRecoverySchema({ execute: (query, parameters) => pool.execute({ sql: query, timeout: 10_000 }, parameters) });
    check("schemaReady", metadata.state === "ready");
    const [present] = await pool.execute<any[]>("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()");
    let empty = present.length === TABLES.length && present.every(row => TABLES.includes(row.name));
    for (const table of TABLES) {
      // Table names come exclusively from the static five-table allowlist.
      const [rows] = await pool.execute<any[]>(`SELECT COUNT(*) AS count FROM \`${table}\``);
      empty = empty && Number(rows[0]?.count) === 0;
    }
    check("exclusiveEmptySchema", empty);
    cleanupAllowed = true;
    await database.insert(tables.users).values(openIds.map((openId, i) => ({ openId, badgeNumber: `QA-${run}-${i + 1}`,
      name: "Synthetic recovery QA", loginMethod: "password", passwordHash: hashPassword(oldPassword), authVersion: 0 })));
    created = await database.select({ id: tables.users.id, openId: tables.users.openId, badgeNumber: tables.users.badgeNumber })
      .from(tables.users).where(inArray(tables.users.openId, openIds));
    created.sort((a, b) => openIds.indexOf(a.openId) - openIds.indexOf(b.openId));
    check("syntheticAccountsWithinLimit", created.length === 4 && created.length <= 6 && created.every(row => openIds.includes(row.openId)));
    const normal = service();
    for (let i = 0; i < 2; i++) {
      await normal.enroll(created[i].id, { email: address(i + 1), currentPassword: oldPassword, language: "ko" }, `qa-enroll-${run}-${i}`);
      await normal.confirmEmail(latestToken("verify", address(i + 1)), `qa-confirm-${run}-${i}`);
    }
    check("verifiedAddressSetup", (await store.userEmail(created[0].id))?.email === address(1) && (await store.userEmail(created[1].id))?.email === address(2));

    await request(normal, created[0].badgeNumber!);
    const token = latestToken("password", address(1));
    const outcomes = await Promise.allSettled([reset(service(), token), reset(service(), token)]);
    check("concurrentResetSingleSuccess", outcomes.filter(result => result.status === "fulfilled").length === 1
      && outcomes.filter(result => result.status === "rejected" && recoveryError(result.reason, "BAD_REQUEST", "RECOVERY_LINK_INVALID")).length === 1);
    const changed = await store.user(created[0].id);
    check("passwordAndEpochChanged", changed?.authVersion === 1 && verifyPassword(newPassword, changed.passwordHash!) && !await store.token(recoveryTokenHash(token)));
    check("tokenReplayRejected", await invalid(reset(normal, token)));
    const jwtKey = new TextEncoder().encode(secret);
    const mint = (version?: number) => new SignJWT({ openId: created[0].openId, ...(version === undefined ? {} : { authVersion: version }) })
      .setProtectedHeader({ alg: "HS256" }).setExpirationTime("5m").sign(jwtKey);
    const versions = await Promise.all([mint(), mint(0), mint(1)]);
    const payloads = await Promise.all(versions.map(jwt => jwtVerify(jwt, jwtKey, { algorithms: ["HS256"] })));
    const epochs = payloads.map(({ payload }) => ({ authVersion: typeof payload.authVersion === "number" ? payload.authVersion : undefined }));
    check("jwtVersionsEnforced", !sessionMatchesUser(epochs[0], changed!) && !sessionMatchesUser(epochs[1], changed!) && sessionMatchesUser(epochs[2], changed!));

    await request(normal, created[1].badgeNumber!);
    const rollbackToken = latestToken("password", address(2));
    const before = await store.user(created[1].id);
    const faulty = service(tracked(tx => ({ ...tx, deleteTokens: async (id, kind) => {
      await tx.deleteTokens(id, kind); throw new Error("QA_INJECTED_AFTER_PASSWORD_AND_TOKEN_WRITE");
    } })));
    const failed = await rejects(reset(faulty, rollbackToken), "SERVICE_UNAVAILABLE", "RECOVERY_UNAVAILABLE");
    const after = await store.user(created[1].id);
    check("rollbackRestoredPasswordEpochAndToken", failed && before?.passwordHash === after?.passwordHash && before?.authVersion === after?.authVersion && Boolean(await store.token(recoveryTokenHash(rollbackToken))));

    const shared = address(9);
    const verification: string[] = [];
    for (let i = 2; i < 4; i++) {
      await normal.enroll(created[i].id, { email: shared, currentPassword: oldPassword, language: "ko" }, `qa-enroll-${run}-${i}`);
      verification.push(latestToken("verify", shared));
    }
    let waiting = 0, release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const racing = service(tracked(tx => ({ ...tx, saveEmail: async email => {
      if (++waiting === 2) release();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { await Promise.race([barrier, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("QA_RACE_BARRIER_TIMEOUT")), 15_000); })]); }
      finally { if (timer) clearTimeout(timer); }
      await tx.saveEmail(email);
    } })));
    const claims = await Promise.allSettled(verification.map(value => racing.confirmEmail(value, `qa-unique-${run}`)));
    const owners = await store.emailsByKey(emailKey(shared));
    check("emailUniqueRaceSingleOwner", claims.filter(value => value.status === "fulfilled").length === 1
      && claims.filter(value => value.status === "rejected" && recoveryError(value.reason, "BAD_REQUEST", "RECOVERY_LINK_INVALID")).length === 1
      && owners.length === 1 && created.slice(2).some(user => user.id === owners[0].userId));
    const winner = created.find(user => user.id === owners[0].userId)!;
    let receipts = true;
    for (let i = 0; i < 7; i++) {
      const method = i % 2 ? "email" : "id";
      const result = await request(service(), method === "id" ? winner.badgeNumber! : shared, method, method === "email" && i > 1 ? "id" : "password");
      receipts = receipts && result.accepted === true && Object.keys(result).length === 1;
    }
    check("recipientLimitShared", receipts && mail.filter(value => value.to === shared && value.kind !== "changed").length === 5);

    await request(normal, created[0].badgeNumber!);
    const expired = latestToken("password", address(1));
    clock += 15 * 60 * 1000 + 1000;
    check("expiredTokenRejected", await invalid(reset(normal, expired)) && (await store.user(created[0].id))?.authVersion === 1);
    check("noExternalMailTransport", mail.every(value => value.to.endsWith("@example.invalid")));
  } catch { /* Only the fixed boolean report is emitted; never an exception or query. */ }
  finally {
    try {
      if (!cleanupAllowed) { checks.cleanupOwnedRows = true; }
      else {
      let cleanedIds: number[] = [];
      await database.transaction(async tx => {
        const owned = await tx.select({ id: tables.users.id, openId: tables.users.openId }).from(tables.users).where(inArray(tables.users.openId, openIds)).for("update");
        if (owned.some(row => !openIds.includes(row.openId) || created.some(original => original.openId === row.openId && original.id !== row.id))) throw new Error("QA_CLEANUP_OWNER_CHANGED");
        const ids = owned.map(row => row.id);
        cleanedIds = ids;
        if (ids.length) {
          await tx.delete(tables.accountRecoveryTokens).where(inArray(tables.accountRecoveryTokens.userId, ids));
          await tx.delete(tables.accountRecoveryEmails).where(inArray(tables.accountRecoveryEmails.userId, ids));
          await tx.delete(tables.accountRevocations).where(inArray(tables.accountRevocations.subjectHash, owned.map(row => subjectHash(row.openId))));
          await tx.delete(tables.users).where(and(inArray(tables.users.id, ids), inArray(tables.users.openId, openIds)));
        }
        if (counterKeys.size) await tx.delete(tables.accountRecoveryLimits).where(inArray(tables.accountRecoveryLimits.key, [...counterKeys]));
      });
      const remaining = await database.select({ id: tables.users.id }).from(tables.users).where(inArray(tables.users.openId, openIds)).limit(1);
      const ids = cleanedIds;
      const tokenRows = ids.length ? await database.select({ userId: tables.accountRecoveryTokens.userId }).from(tables.accountRecoveryTokens).where(inArray(tables.accountRecoveryTokens.userId, ids)).limit(1) : [];
      const emailRows = ids.length ? await database.select({ userId: tables.accountRecoveryEmails.userId }).from(tables.accountRecoveryEmails).where(inArray(tables.accountRecoveryEmails.userId, ids)).limit(1) : [];
      const counters = counterKeys.size ? await database.select({ key: tables.accountRecoveryLimits.key }).from(tables.accountRecoveryLimits).where(inArray(tables.accountRecoveryLimits.key, [...counterKeys])).limit(1) : [];
      const markers = await database.select({ hash: tables.accountRevocations.subjectHash }).from(tables.accountRevocations).where(inArray(tables.accountRevocations.subjectHash, openIds.map(subjectHash))).limit(1);
      checks.cleanupOwnedRows = !remaining.length && !tokenRows.length && !emailRows.length && !counters.length && !markers.length;
      }
    } catch { checks.cleanupOwnedRows = false; }
    try { await pool.end(); } catch { checks.cleanupOwnedRows = false; }
    mail.length = 0;
  }
  return { passed: Object.values(checks).every(Boolean), checks };
}

/** In-memory API for the operator's loopback credential form. Import performs no environment lookup or connection. */
export async function runRecoveryQa(
  connectionUrl: string, target: RecoveryQaTarget,
  execute: (options: ConnectionOptions) => Promise<Report> = executeLiveQa,
) {
  const options = guardedOptions(connectionUrl, target);
  if (!options) return { passed: false, checks: { approvedQaDatabaseAndHost: false } };
  try { return await execute(options); }
  catch { return { passed: false, checks: { qaCompleted: false } }; }
}

export async function runRecoveryQaCli(
  args: string[], environment: { DATABASE_URL?: string; RECOVERY_QA_EXPECTED_HOST?: string; RECOVERY_QA_EXPECTED_USER?: string; [name: string]: string | undefined }, io: IO,
  execute: (options: ConnectionOptions) => Promise<Report> = executeLiveQa,
) {
  if (!args.length || args.length === 1 && ["--help", "-h"].includes(args[0])) { io.write(HELP); return 0; }
  if (args.length === 1 && args[0] === "--prepare-sql") { io.write(recoveryQaBootstrapSql()); return 0; }
  const print = (report: Report) => { io.write(`${JSON.stringify(report)}\n`); return report.passed ? 0 : 1; };
  if (args.length !== 1 || args[0] !== "--run") return print({ passed: false, checks: { argumentsValid: false } });
  return print(await runRecoveryQa(environment.DATABASE_URL ?? "", {
    expectedHost: environment.RECOVERY_QA_EXPECTED_HOST ?? "",
    expectedUser: environment.RECOVERY_QA_EXPECTED_USER ?? "",
  }, execute));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = await runRecoveryQaCli(process.argv.slice(2), process.env, { write: value => process.stdout.write(value) });
}
