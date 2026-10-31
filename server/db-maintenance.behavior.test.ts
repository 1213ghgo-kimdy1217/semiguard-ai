import { createServer, type Server } from "node:http";
import type { Express } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const downstream = vi.hoisted(() => ({
  context: vi.fn(),
  query: vi.fn(),
  mutation: vi.fn(),
  oauth: vi.fn(),
  socialOAuth: vi.fn(),
  storageCheck: vi.fn(),
  publicStorage: vi.fn(),
}));

vi.mock("./_core/context", () => ({ createContext: downstream.context }));
vi.mock("./routers", async () => {
  const { initTRPC } = await import("@trpc/server");
  const t = initTRPC.create();
  return {
    appRouter: t.router({
      read: t.procedure.query(() => downstream.query()),
      save: t.procedure.mutation(() => downstream.mutation()),
    }),
  };
});
vi.mock("./_core/oauth", () => ({
  registerOAuthRoutes: (app: Express) => {
    app.get("/api/oauth/callback", (_req, res) => {
      downstream.oauth();
      res.json({ callback: "legacy" });
    });
  },
}));
vi.mock("./_core/socialOAuth", () => ({
  registerSocialOAuthRoutes: (app: Express) => {
    for (const provider of ["google", "naver", "kakao"]) {
      app.get(`/api/oauth/${provider}/callback`, (_req, res) => {
        downstream.socialOAuth(provider);
        res.json({ callback: provider });
      });
    }
  },
}));
vi.mock("./trainingStorageCheck", () => ({
  registerTrainingStorageCheck: (app: Express) => {
    app.get("/api/internal/training-storage-check", (_req, res) => {
      downstream.storageCheck();
      res.json({ ready: true });
    });
  },
}));
vi.mock("./_core/storageProxy", () => ({
  registerStorageProxy: (app: Express) => {
    app.get("/manus-storage/public-example", (_req, res) => {
      downstream.publicStorage();
      res.type("text/plain").send("public example");
    });
  },
}));

import { createApp } from "./_core/app";

let server: Server | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SEMIGUARD_DB_MAINTENANCE", "");
  vi.stubEnv("DATABASE_URL", "mysql://test.invalid/example");
  vi.stubEnv("JWT_SECRET", "test-only-signing-secret");
  vi.stubEnv("VITE_APP_ID", "semiguard-ai");
  downstream.context.mockResolvedValue({ user: null });
  downstream.query.mockReturnValue({ read: true });
  downstream.mutation.mockReturnValue({ saved: true });
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  if (server) {
    const closingServer = server;
    closingServer.closeAllConnections();
    await new Promise<void>((resolve, reject) => closingServer.close(error => error ? reject(error) : resolve()));
  }
  server = undefined;
});

async function start() {
  const app = createApp();
  // The actual static handler is installed by _core/index.ts after createApp.
  // This fallback verifies the API gate leaves that later route reachable.
  app.get("/learn", (_req, res) => res.type("html").send("<main>Public learning</main>"));
  app.get("/apix", (_req, res) => res.send("outside the API mount"));
  server = createServer(app);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  return `http://127.0.0.1:${address.port}`;
}

function expectNoApiExecution() {
  for (const key of ["context", "query", "mutation", "oauth", "socialOAuth", "storageCheck"] as const) {
    expect(downstream[key], key).not.toHaveBeenCalled();
  }
}

describe("database maintenance request barrier", () => {
  it.each([
    "/api", "/api/", "/api/index.mjs", "/api/health", "/api/trpc/auth.me?batch=1",
    "/api/trpc/read", "/api/trpc/training.history", "/api/trpc/semiguard.getStats",
    "/api/oauth/callback?code=synthetic&state=synthetic",
    "/api/oauth/google/callback", "/api/oauth/naver/callback", "/api/oauth/kakao/callback",
    "/api/internal/training-storage-check", "/API/trpc/read", "/api//trpc/read",
  ])("stops %s before API context or callbacks", async path => {
    vi.stubEnv("SEMIGUARD_DB_MAINTENANCE", "1");
    const base = await start();
    const response = await fetch(`${base}${path}`, { redirect: "manual" });
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: { code: "DB_MAINTENANCE", message: "Account and saved-record services are temporarily unavailable. Please try again shortly." },
    });
    expectNoApiExecution();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])("blocks the %s method too", async method => {
    vi.stubEnv("SEMIGUARD_DB_MAINTENANCE", "1");
    const base = await start();
    const response = await fetch(`${base}/api/trpc/save`, { method });
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("60");
    expectNoApiExecution();
  });

  it("blocks malformed JSON before the existing body parser reads it", async () => {
    vi.stubEnv("SEMIGUARD_DB_MAINTENANCE", "1");
    const base = await start();
    const response = await fetch(`${base}/api/trpc/save`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{",
    });
    expect(response.status).toBe(503);
    expectNoApiExecution();
  });

  it("does not let encoded unmatched paths reach API handlers", async () => {
    vi.stubEnv("SEMIGUARD_DB_MAINTENANCE", "1");
    const base = await start();
    for (const path of ["/%61pi/trpc/read", "/api%2Ftrpc/read"]) {
      const response = await fetch(`${base}${path}`);
      // Express may reject an encoded literal before the API mount; either way,
      // no real API handler or authentication side effect may run.
      expect([404, 503]).toContain(response.status);
    }
    expectNoApiExecution();
  });

  it("keeps later public pages and the existing public storage route reachable", async () => {
    vi.stubEnv("SEMIGUARD_DB_MAINTENANCE", "1");
    const base = await start();
    const page = await fetch(`${base}/learn`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("Public learning");
    const storage = await fetch(`${base}/manus-storage/public-example`);
    expect(storage.status).toBe(200);
    expect(await storage.text()).toBe("public example");
    expect((await fetch(`${base}/apix`)).status).toBe(200);
    expect(downstream.publicStorage).toHaveBeenCalledOnce();
    expectNoApiExecution();
  });

  it.each(["", "0", "false", "true", " 1", "1 "])("preserves normal API behavior for non-enabled value %j", async flag => {
    vi.stubEnv("SEMIGUARD_DB_MAINTENANCE", flag);
    const base = await start();
    const read = await fetch(`${base}/api/trpc/read`);
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual({ result: { data: { read: true } } });
    const save = await fetch(`${base}/api/trpc/save`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });
    expect(save.status).toBe(200);
    expect(await save.json()).toEqual({ result: { data: { saved: true } } });
    expect(downstream.context).toHaveBeenCalledTimes(2);
    expect(downstream.query).toHaveBeenCalledOnce();
    expect(downstream.mutation).toHaveBeenCalledOnce();
  });

  it("preserves health, OAuth and storage-check contracts when the flag is absent", async () => {
    vi.stubEnv("SEMIGUARD_DB_MAINTENANCE", undefined);
    const base = await start();
    const health = await fetch(`${base}/api/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok", capabilities: { accounts: true } });
    expect((await fetch(`${base}/api/oauth/callback`)).status).toBe(200);
    for (const provider of ["google", "naver", "kakao"]) {
      expect((await fetch(`${base}/api/oauth/${provider}/callback`)).status).toBe(200);
    }
    expect((await fetch(`${base}/api/internal/training-storage-check`)).status).toBe(200);
    expect(downstream.oauth).toHaveBeenCalledOnce();
    expect(downstream.socialOAuth).toHaveBeenCalledTimes(3);
    expect(downstream.storageCheck).toHaveBeenCalledOnce();
  });

  it("retains existing malformed-body rejection when maintenance is off", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const base = await start();
    const response = await fetch(`${base}/api/trpc/save`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{",
    });
    expect(response.status).toBe(400);
    expectNoApiExecution();
  });

  it("checks the flag on every request rather than caching its initial value", async () => {
    const base = await start();
    vi.stubEnv("SEMIGUARD_DB_MAINTENANCE", "1");
    expect((await fetch(`${base}/api/trpc/read`)).status).toBe(503);
    expectNoApiExecution();
    vi.stubEnv("SEMIGUARD_DB_MAINTENANCE", "0");
    expect((await fetch(`${base}/api/trpc/read`)).status).toBe(200);
    expect(downstream.context).toHaveBeenCalledOnce();
    expect(downstream.query).toHaveBeenCalledOnce();
    vi.stubEnv("SEMIGUARD_DB_MAINTENANCE", "1");
    expect((await fetch(`${base}/api/trpc/read`)).status).toBe(503);
    expect(downstream.context).toHaveBeenCalledOnce();
  });
});
