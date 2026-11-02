import { afterEach, describe, expect, it, vi } from "vitest";
import { recoveryMailAvailable, recoveryMailContent, sendRecoveryMail } from "./recoveryMail";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const sample = { to: "qa@example.test", language: "ko" as const, kind: "password" as const, token: "A".repeat(43) };
function configured() {
  vi.stubEnv("SEMIGUARD_ACCOUNT_RECOVERY_ENABLED", "1");
  vi.stubEnv("RECOVERY_MAIL_API_KEY", "synthetic-test-key");
  vi.stubEnv("RECOVERY_MAIL_FROM", "qa@example.test");
  vi.stubEnv("RECOVERY_PUBLIC_ORIGIN", "https://example.test");
}

describe("recovery mail transport (synthetic requests only)", () => {
  it("fails closed without explicit activation and never calls a provider", async () => {
    configured(); vi.stubEnv("SEMIGUARD_ACCOUNT_RECOVERY_ENABLED", "0");
    const provider = vi.fn(); vi.stubGlobal("fetch", provider);
    expect(recoveryMailAvailable()).toBe(false);
    await expect(sendRecoveryMail(sample)).rejects.toThrow("RECOVERY_MAIL_UNAVAILABLE");
    expect(provider).not.toHaveBeenCalled();
  });
  it.each(["http://example.test", "https://example.test/evil", "https://a:b@example.test", "https://example.test?x=1"])("rejects an unsafe public origin %s", origin => {
    configured(); vi.stubEnv("RECOVERY_PUBLIC_ORIGIN", origin);
    expect(recoveryMailAvailable()).toBe(false);
  });
  it.each(["ko", "en", "ja"] as const)("sends a bounded text-only request in %s using the configured origin", async language => {
    configured(); const provider = vi.fn().mockResolvedValue(new Response('{"messageId":"synthetic-queued-message"}', { status: 201 })); vi.stubGlobal("fetch", provider);
    await sendRecoveryMail({ ...sample, language });
    const [url, request] = provider.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(request.method).toBe("POST");
    expect(request.headers).toEqual({ "api-key": "synthetic-test-key", "Content-Type": "application/json", Accept: "application/json" });
    const payload = JSON.parse(request.body);
    expect(Object.keys(payload).sort()).toEqual(["sender", "subject", "textContent", "to"]);
    expect(payload.sender).toEqual({ name: "SemiGuard AI", email: "qa@example.test" });
    expect(payload.to).toEqual([{ email: sample.to }]);
    expect(payload.htmlContent).toBeUndefined();
    expect(payload.textContent).toContain(`https://example.test/account/recovery/reset#token=${sample.token}`);
    expect(payload.textContent).not.toContain("?token=");
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(request.redirect).toBe("error");
  });
  it("keeps the email verification fragment in text without introducing HTML or tracking fields", async () => {
    configured(); const provider = vi.fn().mockResolvedValue(new Response("{}", { status: 201 })); vi.stubGlobal("fetch", provider);
    await sendRecoveryMail({ ...sample, kind: "verify" });
    const payload = JSON.parse(provider.mock.calls[0][1].body);
    expect(payload.textContent).toContain(`https://example.test/account/recovery/verify#token=${sample.token}`);
    expect(payload).not.toHaveProperty("htmlContent");
    expect(payload).not.toHaveProperty("templateId");
    expect(payload).not.toHaveProperty("params");
  });
  it.each(["invalid-address", "qa@example.test\r\nBcc: extra@example.test"])("rejects invalid recipients without a provider call (%s)", async to => {
    configured(); const provider = vi.fn(); vi.stubGlobal("fetch", provider);
    await expect(sendRecoveryMail({ ...sample, to })).rejects.toThrow(/^RECOVERY_MAIL_INVALID$/);
    expect(provider).not.toHaveBeenCalled();
  });
  it("fails closed for an invalid configured sender without contacting Brevo", async () => {
    configured(); vi.stubEnv("RECOVERY_MAIL_FROM", "SemiGuard AI <qa@example.test>");
    const provider = vi.fn(); vi.stubGlobal("fetch", provider);
    expect(recoveryMailAvailable()).toBe(false);
    await expect(sendRecoveryMail(sample)).rejects.toThrow(/^RECOVERY_MAIL_UNAVAILABLE$/);
    expect(provider).not.toHaveBeenCalled();
  });
  it("does not report an unverified or unknown sender as accepted and does not expose Brevo's rejection", async () => {
    configured();
    const provider = vi.fn().mockResolvedValue(new Response('{"code":"invalid_parameter","message":"synthetic-private-unverified-sender"}', { status: 400 }));
    vi.stubGlobal("fetch", provider);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(sendRecoveryMail(sample)).rejects.toThrow(/^RECOVERY_MAIL_FAILED$/);
    expect(provider).toHaveBeenCalledOnce();
    expect(warn).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled();
  });
  it("uses the eight-second deadline and sanitizes an aborted request", async () => {
    configured();
    const controller = new AbortController();
    const deadline = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const provider = vi.fn((_url: string, request: RequestInit) => new Promise((_resolve, reject) => {
      request.signal!.addEventListener("abort", () => reject(new Error("synthetic-private-timeout-detail")), { once: true });
      controller.abort();
    }));
    vi.stubGlobal("fetch", provider);
    await expect(sendRecoveryMail(sample)).rejects.toThrow(/^RECOVERY_MAIL_FAILED$/);
    expect(deadline).toHaveBeenCalledWith(8000);
    expect(provider).toHaveBeenCalledOnce();
  });
  it("does not leak provider bodies or thrown errors to callers", async () => {
    configured(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("sensitive-provider-detail", { status: 403 })));
    await expect(sendRecoveryMail(sample)).rejects.toThrow(/^RECOVERY_MAIL_FAILED$/);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("sensitive-url-and-token")));
    await expect(sendRecoveryMail(sample)).rejects.toThrow(/^RECOVERY_MAIL_FAILED$/);
  });
  it("puts the ID only in the email body and rejects injected or invalid data", () => {
    expect(recoveryMailContent({ ...sample, kind: "id", loginId: "SYNTHETIC-ID" }, "https://example.test").text).toContain("SYNTHETIC-ID");
    expect(() => recoveryMailContent({ ...sample, kind: "id", loginId: "a\nBcc: bad" }, "https://example.test")).toThrow("RECOVERY_MAIL_INVALID");
    expect(() => recoveryMailContent({ ...sample, token: "invalid" }, "https://example.test")).toThrow("RECOVERY_MAIL_INVALID");
    expect(recoveryMailContent({ ...sample, kind: "changed" }, "https://example.test").text).not.toContain(sample.token);
  });
});
