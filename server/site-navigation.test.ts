import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { SiteHeaderView } from "../client/src/components/SiteHeader";
import { activeNavigation, createSiteNavigationRegistry, getSiteHeaderHeight } from "../client/src/lib/siteNavigation";
import type { ProductLanguage } from "../client/src/lib/productLanguage";

function render(path: string, language: ProductLanguage = "ko", state = { signedIn: false, pending: false, failed: false }) {
  return renderToStaticMarkup(createElement(Router, { ssrPath: path }, createElement(SiteHeaderView, {
    path, language, ...state, onLanguageChange: vi.fn(), onLogout: vi.fn(),
  })));
}
function primary(html: string) { return html.match(/<nav class="sg-site-primary"[^>]*>([\s\S]*?)<\/nav>/)![1]; }
const destinations = ["/welcome", "/learn", "/training", "/live"];

describe("consistent primary site navigation", () => {
  it.each(["/", "/welcome", "/learn", "/training", "/training/etch", "/training/process/wafer", "/training/history/7", "/training/shared", "/training/metrics", "/live", "/model-preview.html", "/preview", "/dashboard", "/demo", "/account", "/account/recovery/reset", "/login", "/signup", "/404"])("keeps the same four destinations and order on %s", path => {
    const html = render(path);
    expect(Array.from(primary(html).matchAll(/href="([^"]+)"/g), match => match[1])).toEqual(destinations);
    expect(html.match(/<header\b/g)).toHaveLength(1);
    expect(html).toContain('href="#site-content"');
    expect(primary(html)).not.toContain("TRAINING LAB");
  });

  it.each([
    ["ko", "주 메뉴", ["홈", "8대 공정 학습", "판단 연습", "장비 모형 실습"], "표시 언어"],
    ["en", "Main navigation", ["Home", "Process learning", "Judgment practice", "Equipment lab"], "Display language"],
    ["ja", "メインメニュー", ["ホーム", "8大工程の学習", "判断練習", "装置模型の実習"], "表示言語"],
  ] as const)("names all primary destinations and the shared language control in %s", (language, navigation, labels, languageLabel) => {
    const html = render("/learn", language);
    expect(html).toContain(`aria-label="${navigation}"`);
    for (const label of labels) expect(primary(html)).toContain(label);
    expect(html).toContain(`aria-label="${languageLabel}"`);
    expect(html.match(/<select\b/g)).toHaveLength(1);
    expect(Array.from(primary(html).matchAll(/href="([^"]+)"/g), match => match[1])).toEqual(destinations);
  });

  it.each([
    ["/", "/welcome"], ["/welcome", "/welcome"], ["/learn?process=etch", "/learn"],
    ["/training/history/13", "/training"], ["/training/process/wafer", "/training"],
    ["/dashboard/simulation", "/training"], ["/live#model", "/live"], ["/model-preview.html", "/live"],
  ])("highlights exactly the current section for %s", (path, href) => {
    const links = primary(render(path)).match(/<a\b[^>]*aria-current="page"[^>]*>/g) ?? [];
    expect(links).toHaveLength(1);
    expect(links[0]).toContain(`href="${href}"`);
  });

  it.each(["/login", "/account", "/learner", "/training-other", "/live-status", "/404"])("does not falsely highlight a primary section on %s", path => {
    expect(activeNavigation(path)).toBeNull();
    expect(primary(render(path))).not.toContain("aria-current");
  });

  it("shows guest sign-in and keeps authenticated account controls inside one named menu", () => {
    const guest = render("/learn");
    expect(guest.match(/<a\b[^>]*class="sg-site-signin"[^>]*>/)?.[0]).toContain('href="/login"');
    expect(guest).not.toContain("<details");
    const signedIn = render("/learn", "ko", { signedIn: true, pending: false, failed: false });
    expect(signedIn).toContain('<details class="sg-site-account">');
    expect(signedIn).toContain("내 계정");
    expect(signedIn).toContain('href="/account"');
    expect(signedIn).toContain("로그아웃");
    expect(signedIn).not.toContain('class="sg-site-signin"');
    expect(primary(signedIn)).toEqual(primary(guest));
  });

  it("preserves logout pending and failed feedback rather than hiding the action", () => {
    const pending = render("/account", "ko", { signedIn: true, pending: true, failed: false });
    expect(pending).toContain("로그아웃 중…");
    expect(pending).toContain('aria-busy="true"');
    expect(pending).toMatch(/<button[^>]*disabled=""/);
    const failed = render("/account", "ko", { signedIn: true, pending: false, failed: true });
    expect(failed).toContain('role="alert"');
    expect(failed).toContain("로그아웃을 확인하지 못했습니다");
    expect(failed).not.toMatch(/<button[^>]*disabled/);
  });

  it("offers native destination links in the standalone model entry without requiring a router", () => {
    const html = renderToStaticMarkup(createElement(SiteHeaderView, {
      path: "/model-preview.html", language: "ko", signedIn: false, pending: false, failed: false,
      onLanguageChange: vi.fn(), onLogout: vi.fn(), fullNavigation: true,
    }));
    expect(Array.from(primary(html).matchAll(/href="([^"]+)"/g), match => match[1])).toEqual(destinations);
    expect(primary(html).match(/<a\b[^>]*aria-current="page"[^>]*>/)?.[0]).toContain('href="/live"');
    expect(html.match(/<a\b[^>]*class="sg-site-signin"[^>]*>/)?.[0]).toContain('href="/login"');
  });

  it("mounts the shared header once outside route loading and removes old page-level site bars", () => {
    const app = readFileSync("client/src/App.tsx", "utf8");
    expect(app.match(/<SiteHeader\s*\/>/g)).toHaveLength(1);
    expect(app).toMatch(/<SiteNavigationProvider><SiteHeader\s*\/><div id="site-content" tabIndex=\{-1\}><Router\s*\/>/);
    for (const page of ["Welcome", "EtchTraining", "ProcessTraining", "EtchLive", "LearningHub", "EtchOperations", "TrainingPreview", "TrainingHistory", "SharedTraining", "AccountSettings", "AccountRecovery"]) {
      expect(readFileSync(`client/src/pages/${page}.tsx`, "utf8"), page).not.toMatch(/<header\b[^>]*className="(?:et-header|kp-header|sg-nav)"/);
    }
  });
});

describe("site navigation preserves in-progress work", () => {
  it("blocks navigation while any mounted page cannot safely leave and releases its guard on unmount", () => {
    const registry = createSiteNavigationRegistry();
    const persist = vi.fn(() => false);
    const unregister = registry.registerGuard(persist);
    expect(registry.canLeave()).toBe(false);
    expect(persist).toHaveBeenCalledOnce();
    persist.mockReturnValue(true);
    expect(registry.canLeave()).toBe(true);
    unregister();
    persist.mockClear();
    expect(registry.canLeave()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it("does not run later guards after cancellation and isolates separate app registries", () => {
    const registry = createSiteNavigationRegistry();
    const later = vi.fn(() => true);
    registry.registerGuard(() => false);
    registry.registerGuard(later);
    expect(registry.canLeave()).toBe(false);
    expect(later).not.toHaveBeenCalled();
    expect(createSiteNavigationRegistry().canLeave()).toBe(true);
  });

  it("runs the current-page practice action once, retains a newer registration and cleans it up", () => {
    const registry = createSiteNavigationRegistry();
    const original = vi.fn(), current = vi.fn();
    const oldUnmount = registry.registerAction("/training", original);
    const unmount = registry.registerAction("/training", current);
    oldUnmount();
    expect(registry.runCurrentPageAction("/learn")).toBe(false);
    expect(registry.runCurrentPageAction("/training")).toBe(true);
    expect(original).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledOnce();
    unmount();
    expect(registry.runCurrentPageAction("/training")).toBe(false);
  });

  it("uses a safe server-render fallback when no header DOM is mounted", () => {
    expect(getSiteHeaderHeight()).toBe(80);
  });
});
