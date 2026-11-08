import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  consumeSharedTrainingReturn,
  rememberSharedTrainingReturn,
} from "../client/src/lib/sharedTrainingReturn";
import { createApp } from "./_core/app";
import { signSharedChoices } from "./trainingShare";

vi.mock("./_core/env", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/env")>();
  return { ...actual, ENV: { ...actual.ENV, cookieSecret: "synthetic-share-transport-signing-key" } };
});
vi.mock("./_core/context", () => ({
  createContext: ({ req, res }: { req: { headers: Record<string, unknown> }; res: unknown }) => ({
    req, res, user: req.headers["x-synthetic-recipient"] === "yes" ? { id: 42 } : null,
  }),
}));

const choices = {
  scenarioId: "etch-chamber-a-01", signal: "pressure", onset: 70,
  marker: 82, comparison: "same-phase", certainty: "uncertain",
};
const fakeToken = `synthetic_header.${"synthetic_payload".repeat(5)}.synthetic_signature`;
let server: Server | undefined;
afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  if (server) {
    const open = server;
    server = undefined;
    await new Promise<void>((resolve, reject) => open.close(error => error ? reject(error) : resolve()));
  }
});

function tab() {
  const values = new Map<string, string>();
  const sessionStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  return { values, sessionStorage };
}

describe("shared result sign-in handoff", () => {
  it("returns to the same result once in the initiating tab and never sets local storage", () => {
    const first = tab();
    const localStorage = { setItem: vi.fn() };
    vi.stubGlobal("window", { sessionStorage: first.sessionStorage, localStorage });
    rememberSharedTrainingReturn(`#${fakeToken}`);
    expect(first.values.size).toBe(1);
    const second = tab();
    vi.stubGlobal("window", { sessionStorage: second.sessionStorage, localStorage });
    expect(consumeSharedTrainingReturn()).toBeNull();
    vi.stubGlobal("window", { sessionStorage: first.sessionStorage, localStorage });
    expect(consumeSharedTrainingReturn()).toBe(`/training/shared#${fakeToken}`);
    expect(consumeSharedTrainingReturn()).toBeNull();
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it("discards expired or invalid redirects and continues sign-in without storage access", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T01:00:00Z"));
    const current = tab();
    vi.stubGlobal("window", { sessionStorage: current.sessionStorage });
    rememberSharedTrainingReturn(`#${fakeToken}`);
    vi.setSystemTime(new Date("2026-10-22T01:15:00Z"));
    expect(consumeSharedTrainingReturn()).toBeNull();
    expect(current.values.size).toBe(0);
    rememberSharedTrainingReturn("#https://unexpected.example.test");
    expect(consumeSharedTrainingReturn()).toBeNull();
    vi.stubGlobal("window", { get sessionStorage() { throw new Error("disabled"); } });
    expect(() => rememberSharedTrainingReturn(`#${fakeToken}`)).not.toThrow();
    expect(consumeSharedTrainingReturn()).toBeNull();
  });

  it("accepts share tokens in a POST body, keeps old GET clients, and requires a session", async () => {
    vi.stubEnv("DATABASE_URL", "mysql://synthetic-user:synthetic-password@127.0.0.1:1/synthetic-db");
    vi.stubEnv("JWT_SECRET", "synthetic-share-transport-signing-key");
    vi.stubEnv("VITE_APP_ID", "synthetic-share-transport-app");
    vi.stubEnv("SEMIGUARD_DB_MAINTENANCE", "0");
    vi.stubEnv("SEMIGUARD_RECOVERY_QA", "0");
    const { token } = await signSharedChoices(choices);
    const running = createServer(createApp());
    server = running;
    await new Promise<void>((resolve, reject) => {
      running.once("error", reject);
      running.listen(0, "127.0.0.1", resolve);
    });
    const address = running.address();
    if (!address || typeof address === "string") throw new Error("No loopback test port");
    const base = `http://127.0.0.1:${address.port}/api/trpc/`;
    const body = JSON.stringify({ json: { token } });
    const input = { method: "POST", headers: { "Content-Type": "application/json" }, body };
    const denied = await fetch(base + "training.shared", input);
    expect(denied.status).toBe(401);
    expect(denied.headers.get("cache-control")).toBe("no-store");
    const recipient = { ...input.headers, "x-synthetic-recipient": "yes" };
    const delivered = await fetch(base + "training.shared", { ...input, headers: recipient });
    expect(delivered.status).toBe(200);
    expect(delivered.headers.get("cache-control")).toBe("no-store");
    const result = await delivered.json();
    expect(result.result.data.json.record).toMatchObject(choices);
    expect(result.result.data.json.record).not.toHaveProperty("userId");
    const legacy = await fetch(base + "training.shared?" + new URLSearchParams({ input: body }), { headers: recipient });
    expect(legacy.status).toBe(200);
    expect(await legacy.json()).toEqual(result);
    const otherQuery = await fetch(base + "auth.me", { ...input, headers: recipient, body: JSON.stringify({ json: null }) });
    expect(otherQuery.status).toBe(405);
  });
});
