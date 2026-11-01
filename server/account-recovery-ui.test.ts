import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AccountRecovery from "../client/src/pages/AccountRecovery";
import RecoveryEmailSettings from "../client/src/components/RecoveryEmailSettings";
import type { ProductLanguage } from "../client/src/lib/productLanguage";

const fixture = vi.hoisted(() => ({
  language: "ko" as ProductLanguage,
  available: true,
  error: false,
  verifiedEmail: null as string | null,
  loginId: "SYNTHETIC-ID" as string | null,
  mutateAsync: vi.fn(),
  reset: vi.fn(),
}));
vi.mock("../client/src/components/ProductLanguageSelect", () => ({ default: () => null }));
vi.mock("../client/src/lib/productLanguage", async original => ({
  ...await original<typeof import("../client/src/lib/productLanguage")>(),
  useProductLanguage: () => [fixture.language, vi.fn()],
}));
vi.mock("../client/src/lib/trpc", () => {
  const mutation = { useMutation: () => ({ mutateAsync: fixture.mutateAsync, reset: fixture.reset }) };
  return { trpc: { accountRecovery: {
    availability: { useQuery: () => ({ data: { available: fixture.available }, isLoading: false, isError: fixture.error, refetch: vi.fn() }) },
    status: { useQuery: () => ({ data: { available: fixture.available, verifiedEmail: fixture.verifiedEmail, loginId: fixture.loginId }, isLoading: false, isError: fixture.error, refetch: vi.fn() }) },
    request: mutation, reset: mutation, confirmEmail: mutation, enroll: mutation,
  } } };
});
const location = (search = "", hash = "") => vi.stubGlobal("window", { location: { pathname: "/account/recovery", search, hash } });
const render = (view: "request" | "reset" | "verify" = "request") => renderToStaticMarkup(createElement(Router, { ssrPath: "/account/recovery" }, createElement(AccountRecovery, { view })));
const renderSettings = () => renderToStaticMarkup(createElement(RecoveryEmailSettings, { language: fixture.language }));

describe("account recovery entry and unavailable states", () => {
  beforeEach(() => { fixture.language = "ko"; fixture.available = true; fixture.error = false; fixture.loginId = "SYNTHETIC-ID"; fixture.verifiedEmail = null; fixture.mutateAsync.mockClear(); location(); });
  afterEach(() => vi.unstubAllGlobals());
  it("offers ID and registered-email password recovery with a labelled sign-in ID input", () => {
    const html = render();
    expect(html).toContain('type="radio"'); expect(html).toContain('name="method"');
    expect(html).toContain("아이디로 찾기"); expect(html).toContain("등록된 이메일로 찾기");
    expect(html).toContain('for="recovery-identifier"'); expect(html).toMatch(/autocomplete="username"/i);
    expect(html).not.toContain("SYNTHETIC-ID"); expect(fixture.mutateAsync).not.toHaveBeenCalled();
  });
  it("sends an ID reminder only to an email and never offers public identity results", () => {
    location("?purpose=id");
    const html = render(); expect(html).toContain('type="email"'); expect(html).not.toContain('type="radio"');
    expect(html).toContain("인증한 이메일로 로그인 아이디를 보냅니다."); expect(html).not.toContain("SYNTHETIC-ID");
  });
  it.each([
    ["ko", "이메일 복구 준비 중입니다."], ["en", "Email recovery is being prepared."], ["ja", "メールによる復旧は準備中です。"],
  ] as const)("does not offer a fake email form when unavailable in %s", (language, message) => {
    fixture.language = language; fixture.available = false;
    const html = render(); expect(html).toContain(message); expect(html).not.toContain("<form");
    expect(html).toContain('href="/login"'); expect(fixture.mutateAsync).not.toHaveBeenCalled();
  });
  it("keeps forms closed when the availability check failed", () => {
    fixture.error = true;
    const html = render(); expect(html).toContain('role="alert"'); expect(html).not.toContain("<form");
  });
  it.each(["", "#token=bad-token", `#token=${"A".repeat(200)}`])("does not show a reset form for a missing or malformed link (%s)", hash => {
    location("", hash);
    const html = render("reset"); expect(html).not.toContain("<form"); expect(html).toContain("메일에 포함된 링크로 다시 열어 주세요.");
  });
  it("keeps a valid link out of HTML and asks for a new password twice without auto-login", () => {
    const token = "A".repeat(43); location("", `#token=${token}`);
    const html = render("reset"); expect(html).toContain('id="recovery-password"'); expect(html).toContain('id="recovery-confirmation"');
    expect(html.match(/autocomplete="new-password"/gi)).toHaveLength(2); expect(html).not.toContain(token);
    expect(html).not.toContain("type=\"hidden\""); expect(fixture.mutateAsync).not.toHaveBeenCalled();
  });
  it("requires a deliberate verification submission when the emailed link is opened", () => {
    location("", `#token=${"B".repeat(43)}`);
    const html = render("verify"); expect(html).toContain("이메일 인증하기"); expect(html).toContain('type="submit"');
    expect(fixture.mutateAsync).not.toHaveBeenCalled();
  });
  it("requires the current password before registering a recovery email", () => {
    fixture.verifiedEmail = "synthetic@example.invalid";
    const html = renderSettings(); expect(html).toContain("synthetic@example.invalid"); expect(html).toMatch(/autocomplete="current-password"/i);
    expect(html).toContain('type="email"'); expect(html).toContain("인증 전에는 기존 복구 이메일이 유지됩니다.");
  });
  it("does not offer email enrollment for a social-only account", () => {
    fixture.loginId = null;
    const html = renderSettings(); expect(html).not.toContain("<form"); expect(html).toContain("연결된 소셜 로그인");
  });
});
