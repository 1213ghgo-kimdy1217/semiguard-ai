import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const loginSource = readFileSync(resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");

describe("social OAuth error dialog accessibility contract", () => {
  it("moves focus to the retry control and restores the previous focus when the dialog closes", () => {
    expect(loginSource).toContain('const oauthErrorPreviousFocusRef = useRef<HTMLElement | null>(null);');
    expect(loginSource).toContain('const oauthErrorCloseButtonRef = useRef<HTMLButtonElement | null>(null);');
    expect(loginSource).toContain('const oauthErrorRetryButtonRef = useRef<HTMLButtonElement | null>(null);');
    expect(loginSource).toContain('(retryButton && !retryButton.disabled ? retryButton : oauthErrorCloseButtonRef.current)?.focus();');
    expect(loginSource).toContain('if (previousFocus && document.contains(previousFocus)) previousFocus.focus();');
    expect(loginSource).toContain('ref={oauthErrorCloseButtonRef}');
    expect(loginSource).toContain('ref={oauthErrorRetryButtonRef}');
  });

  it("allows the social login failure dialog to close with Escape", () => {
    expect(loginSource).toContain('role="alertdialog" aria-modal="true"');
    expect(loginSource).toContain('event.key === "Escape"');
    expect(loginSource).toContain('dismissOauthError();');
  });
});
