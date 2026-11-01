import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { hashPassword } from "../server/password";
import { inspectRecoverySchema } from "../server/accountRecoverySchema";
import { recoveryPreflightConnectionOptions } from "./check-account-recovery-schema";
import { prepareRecoveryQaDatabase, runRecoveryQa, RECOVERY_QA_DATABASE, type RecoveryQaReport, type RecoveryQaTarget } from "./qa-account-recovery-tidb";

export const BROWSER_QA_LOGIN_ID = "SEMIGUARD-RECOVERY-QA-20261102";
type BrowserOwner = { id: number; openId: string };
type SeedResult = { passed: boolean; owner?: BrowserOwner };
const QA_TABLES = ["users", "account_revocations", "account_recovery_emails", "account_recovery_tokens", "account_recovery_limits"];
type Dependencies = {
  prepare: (url: string, target: RecoveryQaTarget) => Promise<RecoveryQaReport>;
  run: (url: string, target: RecoveryQaTarget) => Promise<RecoveryQaReport>;
  validate?: (url: string, target: RecoveryQaTarget) => Promise<RecoveryQaReport>;
  seed?: (url: string, target: RecoveryQaTarget, password: string) => Promise<SeedResult>;
  cleanup?: (url: string, target: RecoveryQaTarget, owner: BrowserOwner) => Promise<{ passed: boolean }>;
};
type Phase = "configure" | "ready" | "running" | "passed" | "review" | "forgotten";
type BrowserPhase = "not-seeded" | "seeding" | "seeded" | "seed-review" | "cleaning" | "cleaned" | "cleanup-review";
const MAX_BODY = 8192;
const CSP = "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";
const HTML = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SemiGuard 비공개 QA 연결</title><style>[hidden]{display:none!important}body{font:16px system-ui;background:#101716;color:#edf0eb;margin:0;padding:24px}main{max-width:600px;margin:auto}label,input,button{display:block;box-sizing:border-box;width:100%;margin:12px 0}input,button{padding:12px;font:inherit;border-radius:6px}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}:focus-visible{outline:3px solid #80e5e0;outline-offset:3px}small{line-height:1.6}#status{white-space:pre-wrap}</style><main><h1>비공개 복구 기능 QA</h1><p>이 컴퓨터의 임시 연결창입니다. 운영 DB가 아닌 승인된 가상 시험 DB만 준비·점검합니다. 연결정보는 파일이나 화면 결과에 기록하지 않습니다.</p><form id="target" autocomplete="off"><label for="host">승인한 TiDB 서버 주소</label><input id="host" required spellcheck="false" autocomplete="off"><label for="user">승인한 TiDB 사용자 이름</label><input id="user" required spellcheck="false" autocomplete="off"><button>시험 대상 고정</button></form><form id="credentials" autocomplete="off" hidden><label for="password">새 소유 TiDB의 기존 비밀번호</label><input id="password" type="password" required autocomplete="off"><small>시험 DB: ${RECOVERY_QA_DATABASE}. 입력 후 값은 즉시 비웁니다. 성공 여부가 불확실하면 다시 실행하지 않고 확인합니다.</small><button>승인된 가상 시험 실행</button></form><p id="status" role="status" tabindex="-1"></p><button id="copy" hidden>QA DB 연결주소 복사</button><button id="forget" hidden>임시 연결정보 지우기</button></main><script src="/client.js" defer></script></html>`;
const CLIENT = `const target=document.querySelector('#target'),credentials=document.querySelector('#credentials'),status=document.querySelector('#status'),copy=document.querySelector('#copy'),forget=document.querySelector('#forget');
const labels={configure:'먼저 승인한 시험 대상을 고정해 주세요.',ready:'대상이 고정되었습니다. 기존 비밀번호를 직접 입력해 주세요.',running:'준비·검사 중입니다. 중복 실행하지 마세요.',passed:'가상 시험 검사를 통과했습니다.',review:'실행을 중단했습니다. 결과 확인이 필요하며 다시 실행하지 않습니다.',forgotten:'서버 메모리의 임시 연결정보를 지웠습니다.'};
function render(state){status.textContent=labels[state.phase]||'상태를 확인하지 못했습니다.';if(state.totalChecks)status.textContent+=' 확인 '+state.passedChecks+'/'+state.totalChecks;target.hidden=state.configured;credentials.hidden=state.phase!=='ready';copy.hidden=state.phase!=='passed';forget.hidden=!state.configured||state.phase==='running'||state.phase==='forgotten';}
async function post(path,payload){const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!response.ok)throw new Error('REQUEST_FAILED');return response.json();}
target.addEventListener('submit',async e=>{e.preventDefault();const button=target.querySelector('button');button.disabled=true;try{const body={host:document.querySelector('#host').value,user:document.querySelector('#user').value};document.querySelector('#host').value='';document.querySelector('#user').value='';render(await post('/configure',body));}catch{status.textContent='대상 설정을 완료하지 못했습니다. 승인된 주소와 실행 상태를 확인해 주세요.';}finally{button.disabled=false;}});
credentials.addEventListener('submit',async e=>{e.preventDefault();const field=document.querySelector('#password');let password=field.value;field.value='';credentials.querySelector('button').disabled=true;status.textContent=labels.running;try{const work=post('/run',{password});password='';render(await work);}catch{status.textContent='실행 상태를 확인해야 합니다. 다시 실행하지 말고 운영자에게 알려주세요.';credentials.hidden=true;try{render(await(await fetch('/state')).json());}catch{}}finally{password='';}});
copy.addEventListener('click',async()=>{copy.disabled=true;try{const result=await post('/copy',{});await navigator.clipboard.writeText(result.url);status.textContent='QA DB 연결주소를 클립보드에 복사했습니다. 채팅에 붙여넣지 마세요.';}catch{status.textContent='복사를 완료하지 못했습니다. 연결정보는 화면에 표시하지 않습니다.';}finally{copy.disabled=false;}});
forget.addEventListener('click',async()=>{try{render(await post('/forget',{}));}catch{status.textContent='처리 중에는 지울 수 없습니다. 완료 후 다시 확인해 주세요.';}});
fetch('/state').then(r=>r.json()).then(render).catch(()=>{status.textContent='연결창 상태를 확인하지 못했습니다.';});`;

const BROWSER_HTML = `<section><h2>실제 Preview의 가상 계정 1개</h2><p>기존 4계정 시험을 다시 돌리지 않습니다. 고정 시험 아이디: <strong>${BROWSER_QA_LOGIN_ID}</strong></p><form id="browser-seed" autocomplete="off" hidden><label for="qa-password">이 가상 계정에만 사용할 새 시험 비밀번호 (10~128자)</label><input id="qa-password" type="password" autocomplete="off" minlength="10" maxlength="128" required><button>가상 계정 1개 만들기</button></form><p id="browser-status" role="status" tabindex="-1"></p><button id="copy-jwt" hidden>Preview 전용 JWT 키 복사</button><button id="browser-cleanup" hidden>메일 검증 후 이 가상 계정만 정리</button></section>`;
const BROWSER_CLIENT = `const seed=document.querySelector('#browser-seed'),browserStatus=document.querySelector('#browser-status'),jwt=document.querySelector('#copy-jwt'),cleanup=document.querySelector('#browser-cleanup');const baseRender=render;render=function(state){baseRender(state);const active=state.browserPhase==='seeded';seed.hidden=state.phase!=='passed'||state.browserPhase!=='not-seeded';jwt.hidden=!active;cleanup.hidden=!active&&!state.cleanupRequired;cleanup.disabled=state.browserPhase==='cleaning'||state.browserPhase==='cleanup-review';forget.hidden=forget.hidden||state.cleanupRequired;browserStatus.textContent=state.browserPhase==='seeded'?'가상 계정 생성 완료. Preview에서만 사용하고 검증 후 정리하세요.':state.browserPhase==='cleaned'?'이 실행에서 만든 가상 계정을 정리했습니다.':/review/.test(state.browserPhase||'')?'상태 확인이 필요합니다. 연결창을 닫거나 다시 실행하지 마세요.':'';};
seed.addEventListener('submit',async e=>{e.preventDefault();const field=document.querySelector('#qa-password');let password=field.value;field.value='';seed.querySelector('button').disabled=true;try{const work=post('/seed',{password});password='';render(await work);}catch{browserStatus.textContent='생성 상태를 확인해야 합니다. 다시 실행하지 마세요.';}finally{password='';}});
jwt.addEventListener('click',async()=>{jwt.disabled=true;try{const result=await post('/copy-jwt',{});await navigator.clipboard.writeText(result.secret);browserStatus.textContent='Preview 전용 JWT 키를 복사했습니다. 채팅에 붙여넣지 마세요.';}catch{browserStatus.textContent='키를 복사하지 못했습니다. 값은 표시하지 않습니다.';}finally{jwt.disabled=false;}});
cleanup.addEventListener('click',async()=>{cleanup.disabled=true;try{render(await post('/cleanup',{}));}catch{browserStatus.textContent='정리 상태 확인이 필요합니다. 다시 실행하지 마세요.';}});
fetch('/state').then(r=>r.json()).then(render).catch(()=>{});`;

async function privateConnection(url: string, target: RecoveryQaTarget) {
  const options = recoveryPreflightConnectionOptions(url);
  if (!options || options.database !== RECOVERY_QA_DATABASE || options.host !== target.expectedHost || options.user !== target.expectedUser || options.port !== 4000) throw new Error("QA_TARGET_INVALID");
  const { createConnection } = await import("mysql2/promise");
  return createConnection(options);
}
async function checkPrivateSchema(connection: Awaited<ReturnType<typeof privateConnection>>, requireEmptyUsers: boolean) {
  const query = (sql: string, values: unknown[] = []) => connection.execute<any[]>({ sql, timeout: 10_000 }, values);
  const [identity] = await query("SELECT DATABASE() = ? AS matches", [RECOVERY_QA_DATABASE]);
  const [tables] = await query("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()");
  if (identity.length !== 1 || Number(identity[0].matches) !== 1 || tables.length !== QA_TABLES.length || tables.some(row => !QA_TABLES.includes(row.name))) return false;
  if ((await inspectRecoverySchema({ execute: (sql, values) => connection.execute({ sql, timeout: 10_000 }, values) })).state !== "ready") return false;
  const [revoked] = await query("SELECT COUNT(*) AS count FROM account_revocations");
  if (Number(revoked[0]?.count) !== 0) return false; // No withdrawal QA or unknown HMAC deletion.
  if (requireEmptyUsers) { const [users] = await query("SELECT COUNT(*) AS count FROM users"); if (Number(users[0]?.count) !== 0) return false; }
  return true;
}
async function validateBrowserQa(url: string, target: RecoveryQaTarget): Promise<RecoveryQaReport> {
  let connection: Awaited<ReturnType<typeof privateConnection>> | undefined;
  try { connection = await privateConnection(url, target); const passed = await checkPrivateSchema(connection, true); return { passed, checks: { isolatedEmptyBrowserQaSchema: passed } }; }
  catch { return { passed: false, checks: { isolatedEmptyBrowserQaSchema: false } }; }
  finally { try { await connection?.end(); } catch { /* No raw driver diagnostics. */ } }
}
async function seedBrowserQa(url: string, target: RecoveryQaTarget, password: string): Promise<SeedResult> {
  let connection: Awaited<ReturnType<typeof privateConnection>> | undefined, owner: BrowserOwner | undefined;
  try {
    connection = await privateConnection(url, target);
    if (!await checkPrivateSchema(connection, true)) return { passed: false };
    await connection.beginTransaction();
    const [users] = await connection.execute<any[]>({ sql: "SELECT COUNT(*) AS count FROM users", timeout: 10_000 });
    if (Number(users[0]?.count) !== 0) throw new Error("QA_NOT_EMPTY");
    const openId = `local_browser_qa_${randomUUID()}`;
    const [result] = await connection.execute<any>({ sql: "INSERT INTO users (openId,name,loginMethod,badge_number,password_hash,auth_version,role) VALUES (?,?,?,?,?,0,'user')", timeout: 10_000 }, [openId, "Synthetic recovery browser QA", "password", BROWSER_QA_LOGIN_ID, hashPassword(password)]);
    if (!Number.isSafeInteger(result.insertId) || result.insertId <= 0) throw new Error("QA_OWNER_UNKNOWN");
    owner = { id: result.insertId, openId };
    const [after] = await connection.execute<any[]>({ sql: "SELECT COUNT(*) AS count FROM users", timeout: 10_000 });
    if (Number(after[0]?.count) !== 1) throw new Error("QA_NOT_EXCLUSIVE");
    await connection.commit(); return { passed: true, owner };
  } catch { try { await connection?.rollback(); } catch { /* Uncertain outcome requires review. */ } return { passed: false, ...(owner ? { owner } : {}) }; }
  finally { try { await connection?.end(); } catch { /* No automatic DB cleanup. */ } }
}
async function cleanupBrowserQa(url: string, target: RecoveryQaTarget, owner: BrowserOwner): Promise<{ passed: boolean }> {
  let connection: Awaited<ReturnType<typeof privateConnection>> | undefined;
  try {
    connection = await privateConnection(url, target);
    if (!await checkPrivateSchema(connection, false)) return { passed: false };
    await connection.beginTransaction();
    const [rows] = await connection.execute<any[]>({ sql: "SELECT openId FROM users WHERE id = ? FOR UPDATE", timeout: 10_000 }, [owner.id]);
    if (rows.length !== 1 || rows[0].openId !== owner.openId) throw new Error("QA_OWNER_CHANGED");
    // Only account-owned rows are removed. Shared/global mail budgets and all
    // account_recovery_limits rows deliberately survive this cleanup.
    await connection.execute({ sql: "DELETE FROM account_recovery_tokens WHERE user_id = ?", timeout: 10_000 }, [owner.id]);
    await connection.execute({ sql: "DELETE FROM account_recovery_emails WHERE user_id = ?", timeout: 10_000 }, [owner.id]);
    const [result] = await connection.execute<any>({ sql: "DELETE FROM users WHERE id = ? AND openId = ?", timeout: 10_000 }, [owner.id, owner.openId]);
    if (result.affectedRows !== 1) throw new Error("QA_OWNER_CHANGED");
    await connection.commit(); return { passed: true };
  } catch { try { await connection?.rollback(); } catch { /* Preserve owner metadata for operator review. */ } return { passed: false }; }
  finally { try { await connection?.end(); } catch { /* Never print private diagnostics. */ } }
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size <= MAX_BODY) chunks.push(buffer);
  }
  if (size > MAX_BODY) throw new Error("BODY_LIMIT");
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!plainObject(parsed)) throw new Error("BODY_INVALID");
  return parsed;
}
function summarize(reports: RecoveryQaReport[]) {
  const checks = reports.flatMap(report => Object.values(report.checks));
  return { passedChecks: checks.filter(value => value === true).length, totalChecks: checks.length };
}

/** Loopback only. Importing does not listen, load .env, or read credentials. */
export async function startRecoveryQaConsole(options: { port?: number; previewOnly?: boolean; dependencies?: Dependencies } = {}) {
  const dependencies: Dependencies = options.dependencies ?? { prepare: prepareRecoveryQaDatabase, run: runRecoveryQa };
  let target: RecoveryQaTarget | undefined, privateUrl: string | undefined, browserOwner: BrowserOwner | undefined, qaJwtSecret: string | undefined;
  let phase: Phase = "configure", attempted = false, passedChecks = 0, totalChecks = 0;
  let browserPhase: BrowserPhase = "not-seeded", seedAttempted = false, cleanupAttempted = false;
  let origin = "";
  const cleanupRequired = () => Boolean(browserOwner) || ["seeding", "seed-review", "cleaning", "cleanup-review"].includes(browserPhase);
  const state = () => ({ configured: Boolean(target), phase, schema: RECOVERY_QA_DATABASE, passed: phase === "passed", passedChecks, totalChecks,
    mode: options.previewOnly ? "preview-only" : "harness", browserPhase, cleanupRequired: cleanupRequired(), ...(browserPhase === "seeded" ? { loginId: BROWSER_QA_LOGIN_ID, seeded: true } : {}) });
  const reply = (res: ServerResponse, code: number, value: unknown, type = "application/json") => {
    res.writeHead(code, { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "no-store", "Content-Security-Policy": CSP, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
    res.end(type === "application/json" ? JSON.stringify(value) : value);
  };
  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    if (req.headers.host !== origin.slice("http://".length)) { req.resume(); reply(res, 403, { blocked: true }); return; }
    if (req.method === "GET") {
      if (req.url === "/") reply(res, 200, HTML.replace("</main>", `${BROWSER_HTML}</main>`).replace("승인된 가상 시험 실행", options.previewOnly ? "기존 QA DB 범위만 확인" : "승인된 가상 시험 실행")
        .replace("운영 DB가 아닌 승인된 가상 시험 DB만 준비·점검합니다.", options.previewOnly ? "운영 DB를 건드리지 않고 기존 QA DB의 범위만 확인합니다. 이후 별도 버튼으로 가상 계정 1개를 만듭니다." : "운영 DB가 아닌 승인된 가상 시험 DB만 준비·점검합니다."), "text/html");
      else if (req.url === "/client.js") reply(res, 200, (options.previewOnly ? CLIENT.replace("가상 시험 검사를 통과했습니다.", "Preview용 스키마 범위 확인 완료.").replace("준비·검사 중입니다. 중복 실행하지 마세요.", "기존 QA DB의 스키마 범위 확인 중입니다. 기존 계정 시험을 다시 실행하지 않습니다.") : CLIENT) + BROWSER_CLIENT, "text/javascript");
      else if (req.url === "/state") reply(res, 200, state());
      else reply(res, 404, { unavailable: true });
      return;
    }
    if (req.method !== "POST" || req.headers.origin !== origin || req.headers["content-type"]?.split(";")[0].trim() !== "application/json") {
      req.resume(); reply(res, 403, { blocked: true }); return;
    }
    if (!req.url || !["/configure", "/run", "/copy", "/copy-jwt", "/forget", "/seed", "/cleanup"].includes(req.url)) { req.resume(); reply(res, 404, { unavailable: true }); return; }
    if (Number(req.headers["content-length"] ?? 0) > MAX_BODY) { req.resume(); reply(res, 413, { blocked: true }); return; }
    let body: Record<string, unknown>;
    try { body = await readJson(req); } catch { reply(res, 400, { blocked: true }); return; }
    if (req.url === "/configure") {
      if (target || attempted || phase !== "configure") { reply(res, 409, state()); return; }
      if (Object.keys(body).sort().join(",") !== "host,user" || typeof body.host !== "string" || typeof body.user !== "string"
        || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+tidbcloud\.com$/i.test(body.host)
        || !body.user || body.user.length > 256 || body.user !== body.user.trim() || /[\r\n\0]/.test(body.user)) { reply(res, 400, { blocked: true }); return; }
      target = { expectedHost: body.host.toLowerCase(), expectedUser: body.user };
      phase = "ready";
      reply(res, 200, { configured: true, phase, schema: RECOVERY_QA_DATABASE }); return;
    }
    if (req.url === "/run") {
      if (!target || attempted || phase !== "ready") { reply(res, 409, state()); return; }
      if (Object.keys(body).join(",") !== "password" || typeof body.password !== "string" || !body.password || body.password.length > 1024 || /[\r\n\0]/.test(body.password)) { reply(res, 400, { blocked: true }); return; }
      attempted = true; phase = "running";
      const url = new URL(`mysql://${target.expectedHost}:4000/${RECOVERY_QA_DATABASE}`);
      url.username = target.expectedUser!; url.password = body.password;
      body.password = "";
      url.searchParams.set("ssl", JSON.stringify({ rejectUnauthorized: true, verifyIdentity: true }));
      const candidate = url.href;
      url.password = "";
      try {
        const prepared = options.previewOnly
          ? await (dependencies.validate ?? validateBrowserQa)(candidate, { ...target })
          : await dependencies.prepare(candidate, { ...target });
        let reports = [prepared];
        if (prepared.passed && !options.previewOnly) reports = [...reports, await dependencies.run(candidate, { ...target })];
        ({ passedChecks, totalChecks } = summarize(reports));
        if (reports.every(report => report.passed && Object.values(report.checks).every(value => value === true))) {
          privateUrl = candidate; phase = "passed";
        } else { privateUrl = undefined; phase = "review"; }
      } catch { privateUrl = undefined; phase = "review"; }
      reply(res, 200, state()); return;
    }
    if (req.url === "/seed") {
      if (!target || !privateUrl || phase !== "passed" || seedAttempted || browserPhase !== "not-seeded") { reply(res, 409, state()); return; }
      if (Object.keys(body).join(",") !== "password" || typeof body.password !== "string" || body.password.length < 10 || body.password.length > 128 || /[\r\n\0]/.test(body.password)) { reply(res, 400, { blocked: true }); return; }
      seedAttempted = true; browserPhase = "seeding";
      let password = body.password; body.password = "";
      try {
        const result = await (dependencies.seed ?? seedBrowserQa)(privateUrl, { ...target }, password);
        browserOwner = result.owner;
        if (result.passed && browserOwner && Number.isSafeInteger(browserOwner.id) && browserOwner.id > 0 && /^local_browser_qa_[a-f0-9-]{36}$/.test(browserOwner.openId)) {
          qaJwtSecret = randomBytes(32).toString("base64url"); browserPhase = "seeded";
        } else { qaJwtSecret = undefined; browserPhase = "seed-review"; }
      } catch { qaJwtSecret = undefined; browserPhase = "seed-review"; }
      finally { password = ""; }
      reply(res, 200, state()); return;
    }
    if (Object.keys(body).length) { reply(res, 400, { blocked: true }); return; }
    if (req.url === "/copy") {
      if (phase !== "passed" || !privateUrl) { reply(res, 409, state()); return; }
      reply(res, 200, { url: privateUrl }); return;
    }
    if (req.url === "/copy-jwt") {
      if (browserPhase !== "seeded" || !qaJwtSecret) { reply(res, 409, state()); return; }
      reply(res, 200, { secret: qaJwtSecret }); return;
    }
    if (req.url === "/cleanup") {
      if (!target || !privateUrl || !browserOwner || cleanupAttempted || !["seeded", "seed-review"].includes(browserPhase)) { reply(res, 409, state()); return; }
      cleanupAttempted = true; browserPhase = "cleaning";
      try {
        const result = await (dependencies.cleanup ?? cleanupBrowserQa)(privateUrl, { ...target }, { ...browserOwner });
        if (result.passed) { browserOwner = undefined; qaJwtSecret = undefined; browserPhase = "cleaned"; }
        else browserPhase = "cleanup-review";
      } catch { browserPhase = "cleanup-review"; }
      reply(res, 200, state()); return;
    }
    if (phase === "running" || cleanupRequired()) { reply(res, 409, state()); return; }
    privateUrl = undefined; target = undefined; qaJwtSecret = undefined; phase = "forgotten";
    reply(res, 200, state());
  };
  const server = createServer((req, res) => { void handle(req, res).catch(() => { if (!res.headersSent) reply(res, 500, { unavailable: true }); else res.end(); }); });
  server.requestTimeout = 15_000; server.headersTimeout = 10_000;
  server.on("close", () => { privateUrl = undefined; target = undefined; qaJwtSecret = undefined; browserOwner = undefined; });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject); server.listen(options.port ?? (options.previewOnly ? 4320 : 4319), "127.0.0.1", () => { server.removeListener("error", reject); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === "string") { server.close(); throw new Error("CONSOLE_UNAVAILABLE"); }
  origin = `http://127.0.0.1:${address.port}`;
  return { server, url: origin, close: () => new Promise<void>((resolve, reject) => {
    if (phase === "running" || cleanupRequired()) { reject(new Error("CONSOLE_CLEANUP_REVIEW_REQUIRED")); return; }
    server.close(error => error ? reject(new Error("CONSOLE_CLOSE_FAILED")) : resolve()); server.closeIdleConnections();
  }) };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || args.length === 1 && args[0] !== "--preview-only") throw new Error("CONSOLE_ARGUMENTS");
    const consoleServer = await startRecoveryQaConsole({ previewOnly: args[0] === "--preview-only" }); process.stdout.write(`${consoleServer.url}\n`);
    const stop = () => { void consoleServer.close().then(() => { process.exitCode = 0; }).catch(() => { process.stderr.write("가상 계정 정리 또는 상태 확인 후 연결창을 종료하세요.\n"); }); };
    process.on("SIGINT", stop); process.on("SIGTERM", stop);
  }
  catch { process.stderr.write("QA 연결창을 열지 못했습니다.\n"); process.exitCode = 1; }
}
