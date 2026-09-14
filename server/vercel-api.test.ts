import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { createApp } from "./_core/app";

let server: Server | undefined;
afterEach(async () => {
  vi.unstubAllEnvs();
  if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
  server = undefined;
});

async function start() {
  server = createServer(createApp());
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  return `http://127.0.0.1:${address.port}`;
}

describe("portable API deployment", () => {
  it("serves health and public session checks without account configuration", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("JWT_SECRET", "");
    const base = await start();
    const health = await fetch(`${base}/api/health`);
    expect(health.headers.get("cache-control")).toBe("no-store");
    expect(await health.json()).toEqual({ status: "ok", capabilities: { accounts: false } });
    const session = await fetch(`${base}/api/trpc/auth.me?batch=1`);
    expect(session.status).toBe(200);
    expect(await session.json()).toEqual([{ result: { data: { json: null } } }]);
  });

  it("fails closed for login and OAuth when a deployment has no signing secret", async () => {
    vi.stubEnv("DATABASE_URL", "mysql://test.invalid/example");
    vi.stubEnv("JWT_SECRET", "");
    vi.stubEnv("VITE_APP_ID", "semiguard-ai");
    const base = await start();
    for (const path of ["/api/trpc/auth.login", "/api/oauth/callback", "/api/trpc/semiguard.getStats"]) {
      const response = await fetch(`${base}${path}`, { redirect: "manual" });
      expect(response.status).toBe(503);
    }
  });

  it("reports configured account services without exposing environment values", async () => {
    vi.stubEnv("DATABASE_URL", "mysql://test.invalid/example");
    vi.stubEnv("JWT_SECRET", "test-only-signing-secret");
    vi.stubEnv("VITE_APP_ID", "semiguard-ai");
    const base = await start();
    const response = await fetch(`${base}/api/health`);
    expect(await response.json()).toEqual({ status: "ok", capabilities: { accounts: true } });
  });
});
