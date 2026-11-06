import { beforeEach, describe, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("./_core/env", async original => {
  const actual = await original<typeof import("./_core/env")>();
  return { ...actual, ENV: { ...actual.ENV, cookieSecret: "synthetic-share-test-key-only" } };
});
vi.mock("./trainingShare", async original => {
  const actual = await original<typeof import("./trainingShare")>();
  calls.read.mockImplementation(actual.readSharedChoices);
  return { ...actual, readSharedChoices: calls.read };
});
import { appRouter } from "./routers";
import { signSharedChoices } from "./trainingShare";

const choices = { scenarioId: "etch-chamber-a-01", signal: "pressure", onset: 70, marker: 82, comparison: "same-phase", certainty: "uncertain" };
const context = (user: null | { id: number; role: string }) => ({ user, req: { headers: {} }, res: {} }) as any;
beforeEach(() => { vi.clearAllMocks(); });

describe("shared choice records require sign-in and the existing valid link", () => {
  it("rejects a guest before reading even a valid share token", async () => {
    const { token } = await signSharedChoices(choices);
    await expect(appRouter.createCaller(context(null)).training.shared({ token })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(calls.read).not.toHaveBeenCalled();
  });
  it("allows a signed-in recipient, while returning only the sanitized snapshot", async () => {
    const { token } = await signSharedChoices(choices);
    const result = await appRouter.createCaller(context({ id: 99, role: "user" })).training.shared({ token });
    expect(calls.read).toHaveBeenCalledWith(token);
    expect(result.record.signal).toBe("pressure");
    expect(result.record.signalMatched).toBe(1);
    for (const field of ["id", "userId", "name", "email", "facts", "checks", "createdAt"]) expect(result.record).not.toHaveProperty(field);
  });
  it("still rejects tampered or expired tokens for signed-in recipients", async () => {
    const caller = appRouter.createCaller(context({ id: 99, role: "user" }));
    const { token } = await signSharedChoices(choices);
    await expect(caller.training.shared({ token: token.slice(0, -20) + "A".repeat(20) })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const expired = await signSharedChoices(choices, Math.floor(Date.now() / 1000) - 8 * 86400);
    await expect(caller.training.shared({ token: expired.token })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("does not grant guest access to actual learning answers or the learning guide", async () => {
    const guest = appRouter.createCaller(context(null));
    await expect(guest.learning.ask({} as any)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(guest.learning.guide()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("explains sign-in plus link validity in each sharing disclosure", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile("client/src/components/TrainingShareControls.tsx", "utf8");
    for (const text of ["로그인한 사용자는 유효한 링크로", "Signed-in users with a valid link", "ログインしたユーザーは有効なリンクで"]) expect(source).toContain(text);
    expect(source).not.toContain("7일 동안 로그인 없이");
  });
});
