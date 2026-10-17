import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WithdrawalDisclosure } from "../client/src/pages/AccountSettings";

describe("withdrawal disclosure and accessible confirmation", () => {
  it.each(["ko", "en", "ja"] as const)("explains deletion boundaries and limits in %s", language => {
    const markup = renderToStaticMarkup(createElement(WithdrawalDisclosure, { language }));
    expect(markup).toContain("<ul>"); expect(markup).toContain("<li>");
    expect(markup).toMatch(/7/); expect(markup).toMatch(/AI/);
    expect(markup).toMatch(/Google/); expect(markup).toMatch(/S.*Guard|계정|アカウント|account/);
    expect(markup).not.toContain("<input");
  });
  it("has a private route, guarded readiness and a separately confirmed non-retrying mutation", () => {
    const app = readFileSync("client/src/App.tsx", "utf8");
    expect(app).toContain('<Route path="/account"><ProtectedRoute>');
    const source = readFileSync("client/src/pages/AccountSettings.tsx", "utf8");
    expect(source).toContain('confirmation === "DELETE"');
    expect(source).toContain('!status.data.blocked'); expect(source).toContain('!status.isError');
    expect(source).toContain('trpc.auth.withdraw.useMutation({ retry: false })');
    expect(source).toContain('<AlertDialogCancel disabled={busy}>');
    expect(source).toContain('if (!allowed || lock.current');
    expect(source).toContain('type="password" autoComplete="current-password"');
    expect(source).toContain('setPassword("")');
    expect(source).toContain('role="alert"');
    expect(source).not.toMatch(/console\.|localStorage\.setItem|sessionStorage\.setItem/);
  });
  it("keeps withdrawal in account settings, not a one-click destructive header button", () => {
    const source = readFileSync("client/src/components/AccountSession.tsx", "utf8");
    expect(source).toContain('href="/account"');
    expect(source).not.toContain("auth.withdraw.useMutation");
  });
  it("cleans only the current tab after confirmed success and sends no identity to peers", () => {
    const source = readFileSync("client/src/components/AccountSession.tsx", "utf8");
    expect(source).toContain("clearWithdrawnDrafts(sessionStorage, userId)");
    expect(source).toContain('window.location.replace("/account/closed")');
    expect(source).not.toContain('postMessage(userId)');
    expect(source).not.toContain("sessionStorage.clear()"); expect(source).not.toContain("localStorage.clear()");
  });
});
