import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { analyticsCampaign, analyticsPage, GA_ID, GoogleAnalyticsController, parseAnalyticsConsent } from "../client/src/lib/googleAnalytics";
import { GoogleAnalyticsNotice } from "../client/src/components/GoogleAnalytics";
import { practiceMeasurementTransition } from "../shared/practiceMeasurement";

const enabled = () => ({ enabled: true, qa: false, expires: Date.now() + 86400000 });
function harness(canonical = true) {
  let consent = enabled();
  const messages: unknown[][] = [];
  const port = { isCanonical: () => canonical, consent: () => consent, send: (...args: unknown[]) => { messages.push(args); },
    load: vi.fn(), disable: vi.fn(), discardQueue: vi.fn(), clearCookies: vi.fn() };
  return { port, messages, controller: new GoogleAnalyticsController(port), setConsent: (next: typeof consent) => { consent = next; } };
}
const events = (h: ReturnType<typeof harness>) => h.messages.filter(m => m[0] === "event");

describe("optional Google Analytics boundary", () => {
  it.each([null, "false", "{}", "broken", '{"enabled":true}', '{"enabled":"true","qa":false,"expires":100}'])("fails closed for %s", raw => {
    expect(parseAnalyticsConsent(raw).enabled).toBe(false);
  });
  it("requires a separate, unexpired, bounded consent choice", () => {
    const choice = enabled();
    const raw = JSON.stringify({ ...choice, ownMeasurement: true, answer: "private" });
    expect(parseAnalyticsConsent(raw)).toEqual(choice);
    expect(parseAnalyticsConsent(JSON.stringify({ ...enabled(), expires: Date.now() - 1 })).enabled).toBe(false);
    expect(parseAnalyticsConsent(JSON.stringify({ ...enabled(), expires: Date.now() + 31 * 86400000 })).enabled).toBe(false);
  });
  it.each(["/training/history/510001", "/training/shared?token=secret", "/training/metrics", "/api/auth/google/callback?code=secret", "/training/process/unknown", "https://elsewhere.example/"])("does not measure private/unknown path %s", path => {
    expect(analyticsPage(path)).toBeNull();
    const h = harness(); h.controller.sync(path); h.controller.track("practice_started");
    expect(h.port.load).not.toHaveBeenCalled(); expect(events(h)).toHaveLength(0);
    expect(h.port.disable).toHaveBeenLastCalledWith(true);
  });
  it("never loads a tag or queues events without consent or on a preview/local host", () => {
    const h = harness(); h.setConsent({ enabled: false, qa: false, expires: 0 });
    h.controller.sync("/training"); h.controller.track("practice_started");
    expect(h.messages).toHaveLength(0); expect(h.port.load).not.toHaveBeenCalled();
    const local = harness(false); local.controller.sync("/training");
    expect(local.port.load).not.toHaveBeenCalled(); expect(local.messages).toHaveLength(0);
  });
  it("sets safe defaults before one tag load and deduplicates a stable SPA page", () => {
    const h = harness(); h.controller.sync("/training?answer=private#token"); h.controller.sync("/training");
    expect(h.port.load).toHaveBeenCalledTimes(1); expect(events(h)).toHaveLength(1);
    expect(events(h)[0][1]).toBe("page_view");
    const config = h.messages.find(m => m[0] === "config")!;
    expect(config[1]).toBe(GA_ID);
    expect(config[2]).toMatchObject({ send_page_view: false, allow_google_signals: false,
      allow_ad_personalization_signals: false, cookie_expires: 30 * 86400, cookie_update: false,
      page_location: "https://semiguard-ai-five.vercel.app/training", page_title: "SemiGuard AI", page_referrer: "" });
    expect(JSON.stringify(h.messages)).not.toContain("private");
    expect(h.messages.findIndex(m => m[0] === "set")).toBeLessThan(h.messages.findIndex(m => m[0] === "config"));
  });
  it("counts distinct public SPA pages, then disables on private pages", () => {
    const h = harness(); h.controller.sync("/training"); h.controller.sync("/training/process/wafer");
    expect(events(h)).toHaveLength(2);
    h.controller.sync("/training/history/510001"); h.controller.track("practice_completed");
    expect(events(h)).toHaveLength(2); expect(h.port.disable).toHaveBeenLastCalledWith(true);
    expect(JSON.stringify(h.messages)).not.toContain("510001");
  });
  it("rechecks storage on every practice event and stops/clears on withdrawal", () => {
    const h = harness(); h.controller.sync("/training/process/wafer"); h.controller.track("practice_started");
    h.setConsent({ enabled: false, qa: false, expires: 0 });
    h.controller.track("practice_completed"); h.controller.sync("/training");
    expect(events(h).map(m => m[1])).toEqual(["page_view", "sg_practice_start"]);
    expect(h.port.disable).toHaveBeenLastCalledWith(true); expect(h.port.clearCookies).toHaveBeenCalled();
    expect(h.port.discardQueue).toHaveBeenCalled();
  });
  it("adds QA flags without transmitting a team account identifier", () => {
    const h = harness(); h.setConsent({ ...enabled(), qa: true }); h.controller.sync("/training/process/oxidation");
    h.controller.track("practice_completed");
    expect(events(h).at(-1)?.[2]).toMatchObject({ debug_mode: true, traffic_type: "internal" });
    expect(JSON.stringify(h.messages)).not.toMatch(/user_id|email|answer|attemptId|token/);
  });
  it("does not re-enable after a failed withdrawal storage write or a focus sync", () => {
    const h = harness(); h.controller.sync("/training");
    h.controller.block(); // The UI does this before attempting any storage write.
    h.controller.sync("/training"); h.controller.track("practice_started");
    expect(h.port.load).toHaveBeenCalledTimes(1); expect(events(h)).toHaveLength(1);
    h.controller.allow(); h.controller.sync("/training");
    expect(h.port.load).toHaveBeenCalledTimes(2); expect(events(h)).toHaveLength(2);
  });
  it("does not automatically retry a blocked tag when focus changes", () => {
    const h = harness(); h.controller.sync("/training");
    h.port.load.mock.calls[0][0](); h.controller.sync("/training");
    expect(h.port.load).toHaveBeenCalledTimes(1); expect(h.port.disable).toHaveBeenLastCalledWith(true);
  });
  it("does not expose arbitrary event/payload collection", () => {
    const h = harness(); h.controller.sync("/training"); h.controller.track("answer:secret" as never);
    expect(events(h)).toHaveLength(1);
  });
  it("accepts only known campaign constants, not arbitrary query values", () => {
    expect(analyticsCampaign("?utm_source=school&utm_medium=direct&utm_campaign=pilot_20261016")).toMatchObject({ campaign_source: "school", campaign_medium: "direct", campaign_name: "pilot_20261016" });
    expect(JSON.stringify(analyticsCampaign("?utm_source=private@example.com&utm_term=secret&token=private"))).not.toMatch(/private|secret|@/);
  });
  it("requires a fresh start for completion, not a restored review", () => {
    expect(practiceMeasurementTransition(true, false, true, false).event).toBeNull();
    const start = practiceMeasurementTransition(true, true, false, false);
    expect(start.event).toBe("practice_started");
    const end = practiceMeasurementTransition(true, false, true, start.started);
    expect(end.event).toBe("practice_completed");
    expect(practiceMeasurementTransition(true, false, true, end.started).event).toBeNull();
    expect(practiceMeasurementTransition(false, true, false, true).started).toBe(false);
  });
  it.each([
    { language: "ko" as const, title: "Google Analytics 측정 설정", decline: "동의하지 않고 이용", boundary: "답안·AI 대화·개인 기록 링크는 보내지 않습니다." },
    { language: "en" as const, title: "Google Analytics settings", decline: "Continue without consenting", boundary: "We do not send names, emails, answers, AI chats or personal record links." },
    { language: "ja" as const, title: "Google Analyticsの設定", decline: "同意せずに利用", boundary: "名前・メール・回答・AI会話・個人記録リンクは送信しません。" },
  ])("renders an accessible, unticked independent choice in $language", item => {
    const html = renderToStaticMarkup(createElement(GoogleAnalyticsNotice, { language: item.language, path: "/training",
      controls: { enabled: false, qa: false, failed: false, setConsent: () => {}, track: () => {} } }));
    for (const text of [item.title, item.decline, item.boundary, "Google LLC", "30", "OFF"]) expect(html).toContain(text);
    expect(html).toContain('type="checkbox"'); expect(html).not.toContain('checked=""');
    expect(html).toContain('disabled=""'); expect(html).toContain('rel="noreferrer"');
  });
  it("uses a dedicated layer and no static tag, account data, auth or external API", () => {
    const source = readFileSync("client/src/components/GoogleAnalytics.tsx", "utf8");
    expect(source).toContain("l=semiguardGaLayer"); expect(source).toContain('script.referrerPolicy = "no-referrer"');
    expect(source).toContain('window.addEventListener("storage"');
    expect(source).not.toContain("useAuth"); expect(source).not.toContain("trpc");
    expect(readFileSync("client/index.html", "utf8")).not.toContain("googletagmanager");
    const practice = readFileSync("client/src/components/PracticeMeasurement.tsx", "utf8");
    expect(practice).toContain("useGoogleAnalyticsPractice(running, reviewed, cycle)");
  });
});
