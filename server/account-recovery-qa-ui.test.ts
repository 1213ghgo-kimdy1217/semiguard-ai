import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isRecoveryQaBuild, recoveryQaLoginTarget, RecoveryQaBanner } from "../client/src/lib/recoveryQa";
import { Login } from "../client/src/pages/Login";

const fixture = vi.hoisted(() => ({ qa: false, language: "ko", stateIndex: 0, navigate: vi.fn(), invalidate: vi.fn() }));
// Read the returned element tree so these tests invoke Login's actual callbacks without a DOM.
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual,
    useEffect: () => undefined,
    useRef: (initial: unknown) => ({ current: initial }),
    useState: (initial: unknown) => {
      const index = fixture.stateIndex++;
      const value = index === 1 ? "SYNTHETIC-QA" : index === 2 ? "Synthetic-password" : typeof initial === "function" ? initial() : initial;
      return [value, vi.fn()];
    },
  };
});
vi.mock("wouter", () => ({ useLocation: () => ["/login", fixture.navigate] }));
vi.mock("../client/src/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock("../client/src/pages/Welcome", () => ({ WaferGraphic: () => null }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: { useUtils: () => ({ auth: { me: { invalidate: fixture.invalidate } } }) } }));
vi.mock("../client/src/lib/recoveryQa", async original => ({
  ...await original<typeof import("../client/src/lib/recoveryQa")>(),
  get RECOVERY_QA_BUILD() { return fixture.qa; },
}));
const elements = (node: ReactNode): ReactElement<any>[] => Children.toArray(node).flatMap(child => isValidElement(child) ? [child, ...elements((child.props as any).children)] : []);

describe("isolated recovery QA build disclosure", () => {
  it("requires the exact public build value 1 and defaults to normal production navigation", () => {
    for (const flag of [undefined, null, "", "0", "true", " 1", 1, true]) {
      const enabled = isRecoveryQaBuild(flag);
      expect(enabled).toBe(false); expect(recoveryQaLoginTarget(enabled)).toBe("/training");
      expect(renderToStaticMarkup(createElement(RecoveryQaBanner, { enabled, language: "ko" }))).toBe("");
    }
    expect(isRecoveryQaBuild("1")).toBe(true);
    expect(recoveryQaLoginTarget(isRecoveryQaBuild("1"))).toBe("/account");
  });
  it.each([
    ["ko", "계정 복구 QA 미리보기", "가상 테스트 계정만", "학습 기록이 없습니다", "계정 관리로 이동"],
    ["en", "Account recovery QA preview", "synthetic test accounts only", "no existing members or learning records", "Open account settings"],
    ["ja", "アカウント復旧QAプレビュー", "架空のテストアカウントのみ", "既存の会員・学習記録はありません", "アカウント管理へ"],
  ] as const)("clearly labels the QA preview and exposes an account link in %s", (language, title, synthetic, empty, account) => {
    const html = renderToStaticMarkup(createElement(RecoveryQaBanner, { enabled: true, language }));
    for (const copy of [title, synthetic, empty, account]) expect(html).toContain(copy);
    expect(html).toContain('role="note"'); expect(html).toContain(`aria-label="${title}"`);
    expect(html).toContain('href="/account"'); expect(html).toContain("min-h-11"); expect(html).toContain("focus-visible:");
    expect(html).not.toContain("<input"); expect(html).not.toContain("<form");
  });
});

describe("real Login callbacks keep QA and production destinations separate", () => {
  beforeEach(async () => {
    fixture.qa = false; fixture.language = "ko"; fixture.stateIndex = 0;
    fixture.navigate.mockReset(); fixture.invalidate.mockReset(); fixture.invalidate.mockResolvedValue(undefined);
    vi.stubGlobal("React", await import("react"));
    vi.stubGlobal("window", { localStorage: { getItem: () => fixture.language }, location: { search: "", href: "/login" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: { data: { json: { success: true } } } }) }));
  });
  afterEach(() => vi.unstubAllGlobals());
  it.each([
    [false, "ko", "연습 방식 선택하기", "/training"],
    [false, "en", "Choose a practice mode", "/training"],
    [false, "ja", "練習方法を選ぶ", "/training"],
    [true, "ko", "계정 관리로 이동", "/account"],
    [true, "en", "Open account settings", "/account"],
    [true, "ja", "アカウント管理へ", "/account"],
  ] as const)("sends the signed-in CTA to %s / %s destination", (qa, language, label, target) => {
    fixture.qa = qa; fixture.language = language;
    const button = elements(Login()).find(node => node.props.type === "button" && node.props.children === label);
    expect(button, `Expected the actual ${label} continuation button`).toBeDefined();
    button!.props.onClick();
    expect(fixture.navigate).toHaveBeenCalledOnce(); expect(fixture.navigate).toHaveBeenCalledWith(target);
  });
  it.each([[false, "/training"], [true, "/account"]] as const)("redirects a successful password login only after verification (%s)", async (qa, target) => {
    fixture.qa = qa;
    const form = elements(Login()).find(node => node.type === "form");
    expect(form).toBeDefined();
    await form!.props.onSubmit({ preventDefault: vi.fn() });
    expect(fetch).toHaveBeenCalledOnce(); expect(fixture.invalidate).toHaveBeenCalledOnce();
    expect(window.location.href).toBe(target); expect(fixture.navigate).not.toHaveBeenCalled();
  });
});
