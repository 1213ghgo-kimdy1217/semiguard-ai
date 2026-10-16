import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { AccountLogoutView } from "../client/src/components/AccountSession";
import { finishLocalLogout, isLogoutSignal, LOGOUT_SIGNAL_KEY, requestLogout } from "../client/src/lib/logoutSession";

function ports() {
  const order: string[] = [];
  return {
    order,
    request: vi.fn(async () => { order.push("server"); return { success: true }; }),
    notify: vi.fn(() => { order.push("notify"); }),
    cancelQueries: vi.fn(async () => { order.push("cancel"); }),
    clearFallback: vi.fn(() => { order.push("fallback"); }),
    clearCache: vi.fn(() => { order.push("cache"); }),
    navigate: vi.fn(() => { order.push("login"); }),
  };
}

describe("workspace logout lifecycle", () => {
  it("requires server confirmation before clearing cached identity and navigating", async () => {
    const p = ports();
    await requestLogout(p);
    expect(p.order).toEqual(["server", "notify", "cancel", "fallback", "cache", "login"]);
    expect(p.request).toHaveBeenCalledOnce();
  });
  it("preserves the current workspace and surfaces a rejected request instead of faking success", async () => {
    const p = ports();
    p.request.mockRejectedValue(new Error("offline"));
    await expect(requestLogout(p)).rejects.toThrow("offline");
    for (const fn of [p.notify, p.cancelQueries, p.clearFallback, p.clearCache, p.navigate]) expect(fn).not.toHaveBeenCalled();
  });
  it("also rejects an unconfirmed success response", async () => {
    const p = ports(); p.request.mockResolvedValue({ success: false });
    await expect(requestLogout(p)).rejects.toThrow("not confirmed");
    expect(p.clearCache).not.toHaveBeenCalled(); expect(p.navigate).not.toHaveBeenCalled();
  });
  it("still exits when peer notification or browser storage is unavailable", async () => {
    const p = ports();
    p.notify.mockImplementation(() => { throw new Error("blocked"); });
    p.clearFallback.mockImplementation(() => { throw new Error("blocked"); });
    p.cancelQueries.mockRejectedValue(new Error("cancel failed"));
    await requestLogout(p);
    expect(p.clearCache).toHaveBeenCalledOnce(); expect(p.navigate).toHaveBeenCalledOnce();
  });
  it("clears another tab without making an additional server logout request", async () => {
    const p = ports(); await finishLocalLogout(p);
    expect(p.request).not.toHaveBeenCalled(); expect(p.notify).not.toHaveBeenCalled();
    expect(p.order).toEqual(["cancel", "fallback", "cache", "login"]);
  });
  it.each([null, "", "broken", "null", '{"type":"login","at":123}', '{"type":"logout","at":"123"}'])("ignores invalid synchronization message %s", raw => {
    expect(isLogoutSignal(raw)).toBe(false);
  });
  it("accepts only an explicit logout signal; it contains no account data", () => {
    expect(isLogoutSignal(JSON.stringify({ type: "logout", at: 1792163000000 }))).toBe(true);
    expect(LOGOUT_SIGNAL_KEY).toBe("semiguard:session-logout:v1");
    const source = readFileSync("client/src/components/AccountSession.tsx", "utf8");
    expect(source).toContain('new BroadcastChannel(LOGOUT_SIGNAL_KEY)');
    expect(source).toContain('window.addEventListener("storage", storage)');
    expect(source).toContain('window.removeEventListener("storage", storage)');
    expect(source).toContain('channel.current?.close()');
    expect(source).toContain('if (busy.current || !signedIn) return;');
    expect(source).toContain('queryClient.clear()');
    expect(source).not.toContain('sessionStorage.clear()');
    expect(source).not.toContain('localStorage.clear()');
  });
});

describe("discoverable, localized account action", () => {
  it.each([
    ["ko", "로그아웃", "로그아웃 중…", "로그아웃을 확인하지 못했습니다"],
    ["en", "Log out", "Logging out…", "Logout was not confirmed"],
    ["ja", "ログアウト", "ログアウト中…", "ログアウトを確認できませんでした"],
  ] as const)("renders a labeled button, busy state and retry feedback in %s", (language, label, busy, error) => {
    const props = { language, signedIn: true, pending: false, failed: false, onLogout: vi.fn() };
    const normal = renderToStaticMarkup(createElement(AccountLogoutView, props));
    expect(normal).toContain(label); expect(normal).toContain('type="button"'); expect(normal).not.toContain("disabled");
    const pending = renderToStaticMarkup(createElement(AccountLogoutView, { ...props, pending: true }));
    expect(pending).toContain(busy); expect(pending).toContain('aria-busy="true"'); expect(pending).toContain("disabled");
    const failed = renderToStaticMarkup(createElement(AccountLogoutView, { ...props, failed: true }));
    expect(failed).toContain('role="alert"'); expect(failed).toContain(error); expect(failed).not.toContain("disabled");
    expect(renderToStaticMarkup(createElement(AccountLogoutView, { ...props, signedIn: false }))).toBe("");
  });
  it("mounts one shared session boundary around routes and the personal assistant", () => {
    const app = readFileSync("client/src/App.tsx", "utf8");
    expect(app).toContain("<AccountSessionProvider><GoogleAnalyticsProvider>");
    expect(app).toContain("<LearningAssistant /></AccountSessionProvider>");
  });
  it.each(["Welcome", "EtchTraining", "ProcessTraining", "LearningHub", "TrainingHistory", "EtchLive", "EtchOperations", "SharedTraining", "TrainingPreview"])("puts logout in the %s header without changing the language selector", name => {
    const source = readFileSync(`client/src/pages/${name}.tsx`, "utf8");
    expect(source).toContain('<ProductLanguageSelect language={language} onChange={setLanguage} /><AccountLogout language={language} />');
  });
  it("keeps touch and keyboard affordances in a small scoped style sheet", () => {
    const css = readFileSync("client/src/components/account-session.css", "utf8");
    expect(css).toContain("min-height:44px"); expect(css).toContain(":focus-visible"); expect(css).toContain("flex-wrap:wrap");
  });
});
