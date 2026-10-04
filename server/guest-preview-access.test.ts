import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import PracticeAccess from "../client/src/components/PracticeAccess";
import { PREVIEW_TIMES, TrainingPreviewContent } from "../client/src/pages/TrainingPreview";
import { etchSample } from "../shared/etchScenario";
import type { ProductLanguage } from "../client/src/lib/productLanguage";

const auth = vi.hoisted(() => ({ user: null as null | { id: number }, loading: false, error: null as null | Error, isAuthenticated: false, refresh: vi.fn() }));
vi.mock("../client/src/_core/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("../client/src/components/ProductLanguageSelect", () => ({ default: () => null }));
vi.mock("../client/src/lib/productLanguage", async importOriginal => ({ ...await importOriginal<typeof import("../client/src/lib/productLanguage")>(), useProductLanguage: () => ["ko", vi.fn()] }));
const render = (node: ReactNode) => renderToStaticMarkup(createElement(Router, { ssrPath: "/preview" }, node));
const mounted = vi.fn();
function FullWorkspace() { mounted(); return createElement("div", null, "PRIVATE_FULL_TRAINING"); }
const boundary = () => render(createElement(PracticeAccess, null, createElement(FullWorkspace)));
function elements(node: ReactNode): ReactElement<any>[] {
  return Children.toArray(node).flatMap(child => isValidElement(child) ? [child, ...elements((child.props as any).children)] : []);
}
const props = (language: ProductLanguage = "ko", authenticated = false) => ({ language, authenticated, setLanguage: vi.fn(), index: 3, setIndex: vi.fn(), signal: "pressure" as const, setSignal: vi.fn() });

describe("full practice identity boundary", () => {
  beforeEach(() => { auth.user = null; auth.loading = false; auth.error = null; auth.isAuthenticated = false; auth.refresh.mockClear(); mounted.mockClear(); });
  it("does not mount full training for a guest, and renders only the bounded sample", () => {
    const html = boundary();
    expect(mounted).not.toHaveBeenCalled(); expect(html).not.toContain("PRIVATE_FULL_TRAINING");
    expect(html).toContain("30-SECOND SAMPLE"); expect(html).toContain('href="/login"'); expect(html).not.toContain('href="/training"');
  });
  it("does not mount training or pretend the user is a guest while session resolution is pending", () => {
    auth.loading = true;
    const html = boundary(); expect(mounted).not.toHaveBeenCalled();
    expect(html).toContain('role="status"'); expect(html).toContain('aria-busy="true"'); expect(html).not.toContain("30-SECOND SAMPLE");
  });
  it("hides cached training during a pending logout as well", () => {
    auth.user = { id: 7 }; auth.loading = true; auth.isAuthenticated = true;
    expect(boundary()).not.toContain("PRIVATE_FULL_TRAINING"); expect(mounted).not.toHaveBeenCalled();
  });
  it("shows explicit safe retry and preview recovery when session lookup fails", () => {
    auth.error = new Error("PRIVATE_INTERNAL_ERROR");
    const html = boundary(); expect(mounted).not.toHaveBeenCalled();
    expect(html).toContain('role="alert"'); expect(html).toContain("다시 확인"); expect(html).toContain('href="/preview"');
    expect(html).not.toContain("PRIVATE_INTERNAL_ERROR"); expect(html).not.toContain("PRIVATE_FULL_TRAINING");
  });
  it("mounts the existing full workspace only after a resolved signed-in identity", () => {
    auth.user = { id: 7 }; auth.isAuthenticated = true;
    expect(boundary()).toContain("PRIVATE_FULL_TRAINING"); expect(mounted).toHaveBeenCalledOnce();
  });
  it("does not trust cached identity when a later session check has failed", () => {
    auth.user = { id: 7 }; auth.isAuthenticated = true; auth.error = new Error("network unavailable");
    expect(boundary()).toContain('role="alert"'); expect(mounted).not.toHaveBeenCalled();
  });
});

describe("observation-only sample", () => {
  it.each([
    ["ko", "장비를 이해하고, 신호를 먼저 살펴보세요.", "로그인하고 본 훈련 시작", "교육용 상대지수", "샘플 관찰 시점"],
    ["en", "Meet the equipment. Explore a sample signal.", "Log in to start full practice", "Teaching relative index", "Sample observation time"],
    ["ja", "装置を理解し、まず信号を見てみましょう。", "ログインして本訓練を始める", "教育用相対指数", "サンプル観察時点"],
  ] as const)("explains sample versus full training in %s without presenting grading controls", (language, title, login, units, timeLabel) => {
    const html = render(createElement(TrainingPreviewContent, props(language)));
    for (const text of [title, login, units, "00:30", etchSample("pressure", 30).value.toFixed(2), "76–84"]) expect(html).toContain(text);
    expect(html).toContain('href="/login"'); expect(html).toContain('href="/signup"'); expect(html).not.toContain('href="/training"');
    expect(html).not.toContain("<form"); expect(html).not.toContain('type="submit"'); expect(html).not.toContain("textarea");
    expect(html).toContain('scope="row"'); expect(html).toContain('role="img"'); expect(html).toContain('aria-valuetext="00:30"');
    expect(html).toContain(`type="range" aria-label="${timeLabel}"`);
  });
  it("allows 4 signals and 4 sample points, capped at 30 seconds, without a timer or scoring API", () => {
    expect(PREVIEW_TIMES).toEqual([0, 10, 20, 30]);
    const p = props(), es = elements(TrainingPreviewContent(p));
    const signals = es.filter(e => e.type === "button" && typeof e.props["aria-pressed"] === "boolean");
    expect(signals).toHaveLength(4); signals[1].props.onClick(); expect(p.setSignal).toHaveBeenCalledWith("flow");
    const range = es.find(e => e.type === "input" && e.props.type === "range")!;
    expect(range.props.max).toBe("3"); range.props.onChange({ target: { value: "2" } }); expect(p.setIndex).toHaveBeenCalledWith(2);
    const source = readFileSync("client/src/pages/TrainingPreview.tsx", "utf8");
    for (const token of ["setInterval", "etchFeedback", "saveAttempt", "saveDraft", "requestJudgmentCoach", "trpc.", "sessionStorage"]) expect(source).not.toContain(token);
  });
  it("lets a signed-in user leave the sample for their existing workspace", () => {
    const html = render(createElement(TrainingPreviewContent, props("ko", true)));
    expect(html).toContain('href="/training"'); expect(html).toContain("연습 방식 선택하기"); expect(html).not.toContain('href="/signup"');
  });
  it("uses scoped responsive layout and native keyboard-operable observation controls", () => {
    const css = readFileSync("client/src/pages/training-preview.css", "utf8");
    expect(css).toContain("minmax(0,"); expect(css).toContain("@media(max-width:760px)"); expect(css).toContain("min-height:44px");
    const html = render(createElement(TrainingPreviewContent, props()));
    expect(html).toContain('aria-pressed="true"'); expect(html).toContain('type="range"'); expect(html).toContain('href="#preview-main"');
  });
});
