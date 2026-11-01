import { afterEach, describe, expect, it, vi } from "vitest";
import { recoveryMailAvailable, recoveryMailContent, sendRecoveryMail } from "./recoveryMail";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
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
    configured(); const provider = vi.fn().mockResolvedValue(new Response("{}", { status: 200 })); vi.stubGlobal("fetch", provider);
    await sendRecoveryMail({ ...sample, language });
    const [url, request] = provider.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const payload = JSON.parse(request.body);
    expect(payload.to).toEqual([sample.to]);
    expect(payload.html).toBeUndefined();
    expect(payload.text).toContain(`https://example.test/account/recovery/reset#token=${sample.token}`);
    expect(payload.text).not.toContain("?token=");
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(request.redirect).toBe("error");
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
