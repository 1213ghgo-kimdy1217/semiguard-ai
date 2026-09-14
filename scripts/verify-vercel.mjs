// Verify the actual built entry using Node, without a TypeScript loader.
import assert from "node:assert/strict";
import { createServer } from "node:http";

delete process.env.DATABASE_URL;
delete process.env.JWT_SECRET;
delete process.env.VITE_APP_ID;
const { default: app } = await import("../api/index.mjs");
const server = createServer(app);
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).capabilities.accounts, false);
  const login = await fetch(`${origin}/api/trpc/auth.login`, { method: "POST" });
  assert.equal(login.status, 503);
  console.log("Vercel bundled entry: health and unconfigured-auth checks passed.");
} finally {
  await new Promise(resolve => server.close(resolve));
}
