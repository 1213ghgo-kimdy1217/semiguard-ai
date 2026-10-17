import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MeasurementChoiceForm } from "../client/src/components/MeasurementPreferences";
import { hasLegacyMeasurementChoice, hasRecentMeasurementChoice } from "../client/src/lib/measurementChoice";
import { parseAnalyticsConsent } from "../client/src/lib/googleAnalytics";
import { trainingHistoryPage } from "../client/src/lib/trainingHistoryPagination";

describe("visible, independent optional measurement choices", () => {
  const now = 1792220600000;
  it.each([null, "broken", "{}", "true", JSON.stringify({ expires: now }), JSON.stringify({ expires: now + 31 * 86400000 })])("does not recognize an invalid/expired choice: %s", raw => {
    expect(hasRecentMeasurementChoice(raw, now)).toBe(false);
  });
  it("remembers explicit refusal as well as consent, without granting permission", () => {
    expect(hasRecentMeasurementChoice(JSON.stringify({ expires: now + 86400000 }), now)).toBe(true);
    const refused = JSON.stringify({ enabled: false, qa: false, expires: now + 86400000 });
    expect(hasLegacyMeasurementChoice(null, refused, now)).toBe(true);
    expect(parseAnalyticsConsent(refused, now).enabled).toBe(false);
    for (const enabled of [false, true]) expect(hasLegacyMeasurementChoice(JSON.stringify({ enabled, revision: now - 1000 }), null, now)).toBe(true);
    expect(hasLegacyMeasurementChoice(JSON.stringify({ enabled: false, revision: now - 31 * 86400000 }), null, now)).toBe(false);
    expect(hasLegacyMeasurementChoice(JSON.stringify({ enabled: true, revision: now + 1000 }), null, now)).toBe(false);
    expect(hasLegacyMeasurementChoice("broken", JSON.stringify({ enabled: true, qa: false, expires: now + 1 }), now)).toBe(true);
    expect(hasLegacyMeasurementChoice(null, JSON.stringify({ enabled: "true", qa: false, expires: now + 1 }), now)).toBe(false);
  });
  it.each([
    ["ko", "방문·연습 통계에 참여 (선택)", "Google Analytics 전송에 동의 (선택)", "동의 없이 계속"],
    ["en", "Share visit and practice statistics (optional)", "Allow Google Analytics (optional)", "Continue without consenting"],
    ["ja", "訪問・練習統計に参加（任意）", "Google Analyticsへの送信に同意（任意）", "同意せずに続ける"],
  ] as const)("renders unticked, separate choices and equal decline controls in %s", (language, own, ga, decline) => {
    const html = renderToStaticMarkup(createElement(MeasurementChoiceForm, {
      language, own: false, google: false, qa: false, saving: false, onSave: async () => {},
    }));
    for (const value of [own, ga, decline, "Google LLC", "type=\"submit\""]) expect(html).toContain(value);
    expect(html.match(/type="checkbox"/g)).toHaveLength(3);
    expect(html).not.toContain('checked=""'); expect(html).not.toContain('required=""');
    expect(html).not.toContain('disabled=""');
  });
  it("keeps pending writes disabled and current independent preferences visible on reopening", () => {
    const html = renderToStaticMarkup(createElement(MeasurementChoiceForm, {
      language: "ko", own: true, google: false, qa: false, saving: true, onSave: async () => {},
    }));
    expect(html).toContain('<fieldset disabled="">');
    expect(html.match(/checked=""/g)).toHaveLength(1);
  });
  it("adds no consent gate, hidden tracking payload, mandatory signup consent, or server/schema changes", () => {
    const source = readFileSync("client/src/components/MeasurementPreferences.tsx", "utf8");
    expect(source).toContain("!practice.consented && !google.enabled");
    expect(source).toContain("if (!gaSaved || !ownSaved)");
    expect(source).toContain("setDismissed(true)");
    expect(source).toContain("localStorage.setItem(MEASUREMENT_CHOICE_KEY, JSON.stringify({ expires:");
    expect(source).not.toMatch(/window\.location\s*=|navigate\(|\.track\(|userId|email:|answer:|required=/);
    expect(readFileSync("client/src/App.tsx", "utf8")).toContain("<Router /><MeasurementPreferences />");
    expect(readFileSync("client/src/components/GoogleAnalytics.tsx", "utf8")).toContain("localStorage.setItem(GA_CONSENT_KEY, JSON.stringify(next))");
  });
});

describe("five-record history pages", () => {
  it.each([0, 1, 5, 6, 10, 11, 20])("keeps order and every record exactly once for %s records", count => {
    const rows = Array.from({ length: count }, (_, index) => ({ id: count - index }));
    const pages = Math.max(1, Math.ceil(count / 5));
    const result = Array.from({ length: pages }, (_, index) => trainingHistoryPage(rows, index + 1));
    expect(result.flatMap(page => page.records)).toEqual(rows);
    expect(result.every(page => page.records.length <= 5)).toBe(true);
    expect(rows).toHaveLength(count);
  });
  it("clamps stale, negative and non-finite page requests without mutating records", () => {
    const rows = Object.freeze([1, 2, 3, 4, 5, 6]);
    expect(trainingHistoryPage(rows, 99)).toMatchObject({ page: 2, pages: 2, records: [6] });
    for (const invalid of [-1, 0, NaN, Infinity]) expect(trainingHistoryPage(rows, invalid).page).toBe(1);
    expect(trainingHistoryPage([], 4)).toEqual({ page: 1, pages: 1, start: 0, records: [] });
  });
});
