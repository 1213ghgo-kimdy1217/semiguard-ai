import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { sdk } from "./_core/sdk";
import { getWithdrawalStatus, withdrawAccount } from "./accountWithdrawal";

vi.mock("./accountWithdrawal", () => ({ getWithdrawalStatus: vi.fn(), withdrawAccount: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: { verifySession: vi.fn(), getRequestSessionToken: vi.fn() } }));
const input = { confirmation: "DELETE", acknowledged: true, password: "synthetic-test-password" } as const;
function context() {
  return { user: { id: 21, openId: "synthetic-local-21", role: "user" },
    req: { path: "/auth.withdraw", protocol: "https", headers: { origin: "https://semiguard-ai-five.vercel.app", host: "semiguard-ai-five.vercel.app" } },
    res: { clearCookie: vi.fn() } } as any;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(sdk.getRequestSessionToken).mockReturnValue("synthetic-session");
  vi.mocked(sdk.verifySession).mockResolvedValue({ openId: "synthetic-local-21", issuedAt: Math.floor(Date.now() / 1000), name: "QA", appId: "test" });
  vi.mocked(withdrawAccount).mockResolvedValue({ success: true });
});

describe("withdrawal API boundary", () => {
  it("rejects guests and never accepts a caller-supplied target account", async () => {
    const c = context(); c.user = null;
    await expect(appRouter.createCaller(c).auth.withdraw(input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(appRouter.createCaller(context()).auth.withdraw({ ...input, userId: 22 } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(withdrawAccount).not.toHaveBeenCalled();
  });
  it.each([undefined, "https://attacker.invalid", "invalid", "ftp://semiguard-ai-five.vercel.app"])("rejects origin %s before touching records", async origin => {
    const c = context(); c.req.headers.origin = origin;
    await expect(appRouter.createCaller(c).auth.withdraw(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(withdrawAccount).not.toHaveBeenCalled(); expect(c.res.clearCookie).not.toHaveBeenCalled();
  });
  it("refuses to combine a withdrawal with other batched writes", async () => {
    const c = context(); c.req.path = "/auth.withdraw,training.saveDraft";
    await expect(appRouter.createCaller(c).auth.withdraw(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(withdrawAccount).not.toHaveBeenCalled();
  });
  it("uses only server identity and clears the session cookie only after commit", async () => {
    const c = context(); const order: string[] = [];
    vi.mocked(withdrawAccount).mockImplementation(async () => { order.push("commit"); return { success: true }; });
    c.res.clearCookie.mockImplementation(() => order.push("cookie"));
    expect(await appRouter.createCaller(c).auth.withdraw(input)).toEqual({ success: true });
    expect(withdrawAccount).toHaveBeenCalledWith(21, input, true);
    expect(order).toEqual(["commit", "cookie"]);
    expect(c.res.clearCookie).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ maxAge: -1, httpOnly: true, secure: true, path: "/" }));
  });
  it.each([undefined, Math.floor(Date.now() / 1000) - 301, Math.floor(Date.now() / 1000) + 600])("does not treat legacy, stale or future login time %s as fresh", async issuedAt => {
    vi.mocked(sdk.verifySession).mockResolvedValue({ openId: "synthetic-local-21", name: "QA", appId: "test", issuedAt });
    await appRouter.createCaller(context()).auth.withdraw(input);
    expect(withdrawAccount).toHaveBeenCalledWith(21, input, false);
  });
  it("does not use a fresh login for a different subject", async () => {
    vi.mocked(sdk.verifySession).mockResolvedValue({ openId: "other", name: "QA", appId: "test", issuedAt: Math.floor(Date.now() / 1000) });
    await appRouter.createCaller(context()).auth.withdraw(input);
    expect(withdrawAccount).toHaveBeenCalledWith(21, input, false);
  });
  it("never reports success or clears the session when the transaction rejects", async () => {
    const c = context(); vi.mocked(withdrawAccount).mockRejectedValue(new Error("synthetic rollback"));
    await expect(appRouter.createCaller(c).auth.withdraw(input)).rejects.toThrow("synthetic rollback");
    expect(c.res.clearCookie).not.toHaveBeenCalled();
  });
  it("scopes the read-only status to the authenticated account", async () => {
    vi.mocked(getWithdrawalStatus).mockResolvedValue({ passwordRequired: true, blocked: null });
    expect(await appRouter.createCaller(context()).auth.withdrawalStatus()).toEqual({ passwordRequired: true, blocked: null });
    expect(getWithdrawalStatus).toHaveBeenCalledWith(21);
  });
});
