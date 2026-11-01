import { pathToFileURL } from "node:url";
import type { ConnectionOptions } from "mysql2";
import { inspectRecoverySchema, type RecoverySchemaReader, type RecoverySchemaReport } from "../server/accountRecoverySchema";

const HELP = `Usage: node --import tsx scripts/check-account-recovery-schema.ts [--help]

Read-only metadata preflight for the operator-supplied DATABASE_URL.
Does not load .env files, print credentials or account rows, run DDL, or deploy.
Confirm the approved target in your private connection manager before running.
TLS certificate and hostname verification are mandatory.

Output: JSON state and allowlisted missing/mismatched schema items only.
Exit codes: 0 ready; 2 absent; 3 partial; 1 unavailable/invalid configuration.
Absent/partial never trigger migration. Review drizzle/account_recovery.sql separately.
`;

type Connection = RecoverySchemaReader & { end(): Promise<unknown> };
type Connect = (options: ConnectionOptions) => Promise<Connection>;
type IO = { write(value: string): void };
const codes = { ready: 0, absent: 2, partial: 3, unavailable: 1 } as const;
const unavailable = (label: string): RecoverySchemaReport => ({ state: "unavailable", missing: [label] });

/** Decode in memory only; construct explicit options so URL query keys cannot override the host or enable debug logging. */
export function recoveryPreflightConnectionOptions(raw: string | undefined): ConnectionOptions | null {
  if (!raw || raw !== raw.trim() || /[\r\n\0]/.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "mysql:" || !url.hostname || !url.username || !url.password || url.hash
      || !/^\/[^/]+$/.test(url.pathname)) return null;
    const parameters = [...url.searchParams];
    if (parameters.some(([key]) => key !== "ssl") || parameters.length > 1) return null;
    let ssl: Record<string, unknown> = {};
    if (parameters.length) {
      const value: unknown = JSON.parse(parameters[0][1]);
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      ssl = value as Record<string, unknown>;
      if (Object.keys(ssl).some(key => !["rejectUnauthorized", "verifyIdentity", "ca"].includes(key))
        || "rejectUnauthorized" in ssl && ssl.rejectUnauthorized !== true
        || "verifyIdentity" in ssl && ssl.verifyIdentity !== true
        || "ca" in ssl && !(typeof ssl.ca === "string" && ssl.ca.length > 0
          || Array.isArray(ssl.ca) && ssl.ca.length > 0 && ssl.ca.every(value => typeof value === "string" && value.length > 0))) return null;
    }
    const user = decodeURIComponent(url.username), password = decodeURIComponent(url.password);
    const database = decodeURIComponent(url.pathname.slice(1));
    if ([user, password, database].some(value => !value || /[\r\n\0]/.test(value)) || /[/\\]/.test(database)) return null;
    const port = url.port ? Number(url.port) : 3306;
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
    return {
      host: url.hostname.startsWith("[") ? url.hostname.slice(1, -1) : url.hostname,
      port, user, password, database,
      ssl: { ...(ssl.ca === undefined ? {} : { ca: ssl.ca as string | string[] }), rejectUnauthorized: true, verifyIdentity: true },
      connectTimeout: 10_000, multipleStatements: false, debug: false, trace: false,
      charset: "utf8mb4", timezone: "Z", enableKeepAlive: false,
    };
  } catch { return null; }
}

async function connect(options: ConnectionOptions): Promise<Connection> {
  // Dynamic import is deliberately after --help and configuration validation.
  const { createConnection } = await import("mysql2/promise");
  const connection = await createConnection(options);
  return {
    execute: async (query, parameters) => connection.execute({ sql: query, timeout: 10_000 }, parameters),
    end: () => connection.end(),
  };
}

export async function runRecoverySchemaPreflight(
  args: string[], environment: { DATABASE_URL?: string }, io: IO, openConnection: Connect = connect,
): Promise<number> {
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) { io.write(HELP); return 0; }
  const emit = (report: RecoverySchemaReport) => { io.write(`${JSON.stringify(report)}\n`); return codes[report.state]; };
  if (args.length) return emit(unavailable("cli.arguments"));
  const options = recoveryPreflightConnectionOptions(environment.DATABASE_URL);
  if (!options) return emit(unavailable("connection.configuration"));
  let connection: Connection | undefined;
  try {
    connection = await openConnection(options);
    return emit(await inspectRecoverySchema(connection));
  } catch { return emit(unavailable("connection.unavailable")); }
  finally { try { await connection?.end(); } catch { /* Never print driver diagnostics or credentials. */ } }
}

// Importing this module in tests never reads environment values or opens a DB.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = await runRecoverySchemaPreflight(process.argv.slice(2), process.env, { write: value => process.stdout.write(value) });
}
