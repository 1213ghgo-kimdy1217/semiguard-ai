import { beforeEach, describe, expect, it, vi } from "vitest";
const service = vi.hoisted(() => ({ availability: vi.fn(), status: vi.fn(), enroll: vi.fn(), confirmEmail: vi.fn(), request: vi.fn(), reset: vi.fn() }));
vi.mock("./accountRecovery", async original => ({ ...await original<typeof import("./accountRecovery")>(), accountRecovery: service }));
import { appRouter } from "./routers";
const TOKEN = "A".repeat(43);
const validRequest = { purpose: "password", method: "id", identifier: "QA-21", language: "ko" } as const;
function context(user: any = null, override: any = {}) {
  const res = { setHeader: vi.fn(), clearCookie: vi.fn(), cookie: vi.fn() };
  const req = { method: "POST", protocol: "https", path: "/accountRecovery.request", headers: { host: "example.invalid", origin: "https://example.invalid" }, socket: { remoteAddress: "synthetic-client" }, ...override };
  return { ctx: { req: req as any, res: res as any, user }, res };
}
beforeEach(() => {
  vi.clearAllMocks(); service.availability.mockResolvedValue({ available: false });
  service.status.mockResolvedValue({ available: true, verifiedEmail: null, loginId: "QA-21" });
  service.enroll.mockResolvedValue({ accepted: true }); service.request.mockResolvedValue({ accepted: true });
  service.confirmEmail.mockResolvedValue({ success: true }); service.reset.mockResolvedValue({ success: true });
});
describe("account recovery API trust boundary", () => {
  it("exposes global availability without a session and disables response caching", async () => {
    const { ctx, res } = context();
    expect(await appRouter.createCaller(ctx).accountRecovery.availability()).toEqual({ available: false });
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
  it("requires an authenticated owner for status and enrollment before calling services", async () => {
    const { ctx, res } = context(); const caller = appRouter.createCaller(ctx);
    await expect(caller.accountRecovery.status()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.accountRecovery.enroll({ email: "qa@example.invalid", currentPassword: "synthetic" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(service.status).not.toHaveBeenCalled(); expect(service.enroll).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
  it("takes enrollment owner only from the authenticated session and defaults language", async () => {
    const { ctx } = context({ id: 21 });
    expect(await appRouter.createCaller(ctx).accountRecovery.enroll({ email: "qa@example.invalid", currentPassword: "synthetic" })).toEqual({ accepted: true });
    expect(service.enroll).toHaveBeenCalledWith(21, { email: "qa@example.invalid", currentPassword: "synthetic", language: "ko" }, "synthetic-client");
    await expect(appRouter.createCaller(ctx).accountRecovery.enroll({ email: "qa@example.invalid", currentPassword: "synthetic", userId: 22 } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it.each([
    { method: "GET" }, { path: "/accountRecovery.request,auth.me" },
    { headers: { host: "example.invalid", origin: "https://foreign.invalid" } },
    { headers: { host: "example.invalid", origin: "http://example.invalid" } },
    { headers: { host: "example.invalid" } },
  ])("rejects cross-origin, GET and multi-procedure submission %#", async override => {
    const { ctx, res } = context(null, override);
    await expect(appRouter.createCaller(ctx).accountRecovery.request(validRequest)).rejects.toMatchObject({ code: "FORBIDDEN", message: "RECOVERY_ORIGIN" });
    expect(service.request).not.toHaveBeenCalled(); expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
  it("sets no-store even for input errors and blocks forged fields/mismatched passwords", async () => {
    const { ctx, res } = context();
    await expect(appRouter.createCaller(ctx).accountRecovery.request({ ...validRequest, userId: 21 } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(appRouter.createCaller(ctx).accountRecovery.reset({ token: TOKEN, password: "synthetic-new-password", confirmation: "different-password" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(service.reset).not.toHaveBeenCalled(); expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
  it("returns only receipt data and clears the old cookie after reset without auto login", async () => {
    const { ctx, res } = context(); const caller = appRouter.createCaller(ctx);
    expect(await caller.accountRecovery.request(validRequest)).toEqual({ accepted: true });
    expect(await caller.accountRecovery.reset({ token: TOKEN, password: "synthetic-new-password", confirmation: "synthetic-new-password" })).toEqual({ success: true });
    expect(res.clearCookie).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ httpOnly: true, secure: true, maxAge: -1 }));
    expect(res.cookie).not.toHaveBeenCalled();
  });
  it("never clears an unrelated browser session when password reset fails", async () => {
    service.reset.mockRejectedValue(new Error("synthetic-invalid-link"));
    const { ctx, res } = context();
    await expect(appRouter.createCaller(ctx).accountRecovery.reset({ token: TOKEN, password: "synthetic-new-password", confirmation: "synthetic-new-password" })).rejects.toThrow();
    expect(res.clearCookie).not.toHaveBeenCalled(); expect(res.cookie).not.toHaveBeenCalled();
  });
});
