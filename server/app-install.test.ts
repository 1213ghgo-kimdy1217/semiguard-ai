import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import AppInstall from "../client/src/components/AppInstall";

const hooks = vi.hoisted(() => ({ states: [] as unknown[], cursor: 0, refs: [] as { current: unknown }[], refCursor: 0, cleanup: undefined as undefined | (() => void), mounted: false }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (value: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.states)) hooks.states[index] = value;
    return [hooks.states[index], (next: unknown) => { hooks.states[index] = next; }];
  },
  useRef: (value: unknown) => hooks.refs[hooks.refCursor++] ??= { current: value },
  useEffect: (effect: () => () => void) => {
    if (!hooks.mounted) { hooks.mounted = true; hooks.cleanup = effect(); }
  },
}));

let browser: EventTarget;
let standalone: EventTarget & { matches: boolean };
function render(language: "ko" | "en" | "ja" = "ko") {
  hooks.cursor = hooks.refCursor = 0;
  return AppInstall({ language });
}
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...Children.toArray(node.props.children as ReactNode).flatMap(elements)];
}
function textOf(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (!isValidElement<Record<string, unknown>>(node)) return "";
  return Children.toArray(node.props.children as ReactNode).map(textOf).join(" ");
}
function button() {
  return elements(render()).find(element => element.type === "button");
}
function ready(choice: Promise<{ outcome: "accepted" | "dismissed" }>, prompt = vi.fn().mockResolvedValue(undefined)) {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  Object.assign(event, { prompt, userChoice: choice });
  browser.dispatchEvent(event);
  return { event, prompt };
}

beforeEach(() => {
  hooks.states = []; hooks.refs = []; hooks.cursor = hooks.refCursor = 0; hooks.mounted = false; hooks.cleanup = undefined;
  browser = new EventTarget();
  standalone = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal("React", React);
  vi.stubGlobal("window", Object.assign(browser, { matchMedia: () => standalone }));
  vi.stubGlobal("navigator", { standalone: false });
});
afterEach(() => { hooks.cleanup?.(); vi.unstubAllGlobals(); });

describe("online app installation", () => {
  it.each(["ko", "en", "ja"] as const)("offers manual instructions without a fake install button in %s", language => {
    const view = render(language);
    const text = textOf(view);
    expect(text).toContain("Android · Chrome");
    expect(text).toContain("iPhone · iPad · Safari");
    expect(text).toMatch(/인터넷 연결|internet connection|インターネット接続/);
    expect(elements(view).some(element => element.type === "details")).toBe(true);
    expect(elements(view).some(element => element.type === "button")).toBe(false);
  });
  it("captures a real browser offer and invokes it only on an explicit click", async () => {
    render();
    const request = ready(Promise.resolve({ outcome: "dismissed" }));
    expect(request.event.defaultPrevented).toBe(true);
    expect(request.prompt).not.toHaveBeenCalled();
    await (button()!.props.onClick as () => Promise<void>)();
    expect(request.prompt).toHaveBeenCalledTimes(1);
    expect(button()).toBeUndefined();
    expect(render()).not.toBeNull();
  });
  it("does not confuse accepting a prompt with a completed installation", async () => {
    render(); ready(Promise.resolve({ outcome: "accepted" }));
    await (button()!.props.onClick as () => Promise<void>)();
    expect(render()).not.toBeNull();
    browser.dispatchEvent(new Event("appinstalled"));
    expect(render()).toBeNull();
  });
  it("blocks duplicate install clicks while the dialog is pending", async () => {
    render();
    let finish!: (value: { outcome: "dismissed" }) => void;
    const request = ready(new Promise(resolve => { finish = resolve; }));
    const click = button()!.props.onClick as () => Promise<void>;
    const pending = click();
    await click();
    expect(request.prompt).toHaveBeenCalledTimes(1);
    expect(button()!.props.disabled).toBe(true);
    finish({ outcome: "dismissed" }); await pending;
    expect(button()).toBeUndefined();
  });
  it("keeps manual instructions and reports a rejected install prompt", async () => {
    render(); ready(Promise.resolve({ outcome: "dismissed" }), vi.fn().mockRejectedValue(new Error("unavailable")));
    await (button()!.props.onClick as () => Promise<void>)();
    expect(textOf(render())).toContain("설치 창을 열지 못했습니다");
    expect(button()).toBeUndefined();
  });
  it("hides the guide when launched in standalone mode", () => {
    standalone.matches = true;
    render(); expect(render()).toBeNull();
  });
  it("recognizes the iOS standalone flag", () => {
    vi.stubGlobal("navigator", { standalone: true });
    render(); expect(render()).toBeNull();
  });
  it("cleans up browser listeners and does not update an unmounted guide", async () => {
    render();
    let finish!: (value: { outcome: "dismissed" }) => void;
    ready(new Promise(resolve => { finish = resolve; }));
    const pending = (button()!.props.onClick as () => Promise<void>)();
    hooks.cleanup?.();
    const states = [...hooks.states];
    browser.dispatchEvent(new Event("appinstalled"));
    finish({ outcome: "dismissed" }); await pending;
    expect(hooks.states).toEqual(states);
  });
});

describe("public app packaging and discovery", () => {
  const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
  const html = read("client/index.html");
  const manifest = JSON.parse(read("client/public/manifest.webmanifest"));
  const config = JSON.parse(read("vercel.json"));
  it("keeps the Korean search description concise and consistent after the introduction loads", () => {
    const descriptions = [...html.matchAll(/<meta name="description" content="([^"]+)"/g)];
    expect(descriptions).toHaveLength(1);
    const description = descriptions[0][1];
    expect([...description].length).toBeLessThanOrEqual(80);
    expect(description).toContain("SemiGuard AI(세미가드 에이아이)");
    expect(description).toContain("가상 장비");
    expect(description).toContain("교육 플랫폼");
    const koreanCopy = read("client/src/pages/Welcome.tsx").split("const welcomeCopy = {")[1].split("  en: {")[0];
    expect(koreanCopy.match(/description: "([^"]+)"/)?.[1]).toBe(description);
  });
  it("keeps the approved Google ownership tag in the initial head, without JavaScript", () => {
    const tag = '<meta name="google-site-verification" content="u2D1VsEA4N2qCg6dtiSqT5B8HbEsV1B_D02plBi78IU" />';
    const head = html.match(/<head>([\s\S]*?)<\/head>/)![1];
    expect(head).toContain(tag);
    expect(html.split(tag)).toHaveLength(2);
    expect(html.split("<body>")[1]).not.toContain("google-site-verification");
  });
  it("keeps the approved Naver ownership tag in the initial head, without JavaScript", () => {
    const tag = '<meta name="naver-site-verification" content="1f49aa1e10a7dba7e4d430978333b9ca0e123b55" />';
    const head = html.match(/<head>([\s\S]*?)<\/head>/)![1];
    expect(head).toContain(tag);
    expect(html.split(tag)).toHaveLength(2);
    expect(html.split("<body>")[1]).not.toContain("naver-site-verification");
  });
  it("uses the public introduction as a stable online app start, without forcing orientation", () => {
    expect(manifest).toMatchObject({ id: "/", start_url: "/", scope: "/", display: "standalone", prefer_related_applications: false });
    expect(manifest.orientation).toBeUndefined();
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('rel="apple-touch-icon"');
  });
  it("ships real raster icons with the advertised dimensions", () => {
    for (const icon of manifest.icons) {
      const bytes = readFileSync(resolve(process.cwd(), "client/public", `.${icon.src}`));
      expect(bytes.subarray(1, 4).toString()).toBe("PNG");
      expect(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`).toBe(icon.sizes);
    }
  });
  it("offers meaningful public brand content without JavaScript", () => {
    const body = html.split('<div id="root">')[1].split('<script type="module"')[0];
    expect(body).toContain("SemiGuard AI · 세미가드 에이아이");
    expect(body).toContain("교육용 가상 시뮬레이션");
    expect(body).toContain("규칙 기반");
    expect(body).toContain('href="/preview"');
    expect(body).toContain("실제 팹 성능은 검증되지 않았습니다");
  });
  it("declares the actual brand aliases and canonical public URL without fake ratings", () => {
    const json = JSON.parse(html.match(/<script type="application\/ld\+json">\s*([\s\S]+?)<\/script>/)![1]);
    expect(json).toMatchObject({ "@type": "WebSite", name: "SemiGuard AI", url: "https://semiguard-ai-five.vercel.app/" });
    expect(json.alternateName).toContain("세미가드 에이아이");
    expect(json.aggregateRating).toBeUndefined();
    expect(html).toContain('rel="canonical" href="https://semiguard-ai-five.vercel.app/"');
  });
  it("lists only the public canonical introduction, not individual records or tokens", () => {
    const sitemap = read("client/public/sitemap.xml");
    expect([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1])).toEqual(["https://semiguard-ai-five.vercel.app/"]);
    expect(read("client/public/robots.txt")).toContain("Sitemap: https://semiguard-ai-five.vercel.app/sitemap.xml");
    const privateHeader = config.headers.find((item: { source: string }) => item.source.includes(":private"));
    expect(privateHeader.source).toBe("/:private(login|signup|training|dashboard|live|demo|api)/:path*");
    expect(privateHeader.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
  });
  it("does not introduce offline caches, tracking, or credential storage", () => {
    const component = read("client/src/components/AppInstall.tsx");
    expect(component).not.toMatch(/fetch\(|localStorage|sessionStorage|caches\.|serviceWorker\.register/);
    expect(read("client/src/main.tsx")).not.toContain("serviceWorker.register");
    expect(config.rewrites).toEqual([
      { source: "/api/:path*", destination: "/api" },
      { source: "/((?!api(?:/|$)).*)", destination: "/index.html" },
    ]);
  });
});
