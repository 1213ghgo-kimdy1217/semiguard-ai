import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import TrainingHistoryList from "../client/src/components/TrainingHistoryList";
import { getProcessScenario } from "../shared/processScenarios";
import type { ProductLanguage } from "../client/src/lib/productLanguage";

const row = (id: number) => ({ id, scenarioId: "wafer-surface-a-01", signal: "surface", onset: 45, marker: 5,
  signalMatched: 1, onsetMatched: 0, comparisonMatched: 1, certaintyMatched: 1, createdAt: "2026-10-04T00:00:00Z" });
const render = (language: ProductLanguage = "ko", attempts = [row(3), row(2)]) => renderToStaticMarkup(
  createElement(Router, { ssrPath: "/training" }, createElement(TrainingHistoryList, { language, attempts })));

describe("readable saved-result cards", () => {
  it.each([
    ["ko", "내가 고른 변화 항목", "내가 고른 시작 시점", "기준 일치", "다시 비교", "기록 열기"],
    ["en", "My selected signal", "My estimated onset", "Matches reference", "Revisit", "Open record"],
    ["ja", "自分が選んだ変化項目", "自分が判断した開始時点", "基準一致", "再比較", "記録を開く"],
  ] as const)("separates title, time, observations, criteria and action in %s", (language, signal, onset, matched, revisit, action) => {
    const html = render(language);
    const scenario = getProcessScenario("wafer-surface-a-01")!;
    const title = scenario.title[language === "ko" ? 0 : language === "en" ? 1 : 2];
    expect(html).toContain('class="et-record-list"');
    expect(html.match(/class="et-record-card"/g)).toHaveLength(2);
    expect(html).toContain('aria-labelledby="history-record-3-title"');
    expect(html).toContain(`<h3 id="history-record-3-title">${title}</h3>`);
    expect(html).toContain('dateTime="2026-10-04T00:00:00.000Z"');
    for (const text of [signal, onset, matched, revisit, action, "00:45"]) expect(html).toContain(text);
    expect(html).toContain('class="et-record-observation"');
    expect(html).toContain('class="et-record-criteria"');
    expect(html).toContain('data-result="revisit"');
    expect(html).toContain('href="/training/history/3"');
    expect(html).toContain(`aria-label="${title} · ${action}"`);
    expect(html).toContain('aria-describedby="history-record-3-saved"');
    expect(html).toContain('id="history-record-3-saved"');
    expect(html).toContain("3/4");
  });
  it("preserves newest-first order and separate repeat attempts", () => {
    const html = render();
    expect(html.indexOf('id="history-record-3-title"')).toBeLessThan(html.indexOf('id="history-record-2-title"'));
    expect(html).toContain('href="/training/history/2"');
  });
  it("does not invent an onset for a saved no-deviation answer", () => {
    const html = render("ko", [{ ...row(1), scenarioId: "oxidation-reference-a-01", signal: "none", onset: -1 }]);
    expect(html).toContain("차이 없음"); expect(html).toContain("해당 없음");
    expect(html).not.toContain("-1:");
  });
  it("marks unavailable values without treating them as matches or mismatches", () => {
    const html = render("ko", [{ ...row(1), onsetMatched: 2, createdAt: "invalid" }]);
    expect(html).toContain('data-result="unavailable"'); expect(html).toContain("일부 결과 확인 불가");
    expect(html).toContain("시각 확인 불가"); expect(html).not.toContain("Invalid Date");
  });
  it("keeps unrecognized historical modules readable and their exact detail link", () => {
    const html = render("ko", [{ ...row(1), scenarioId: "legacy-module", signal: "legacy-signal" }]);
    expect(html).toContain("legacy-module"); expect(html).toContain("legacy-signal");
    expect(html).toContain('href="/training/history/1"');
  });
  it("adds scoped spacing, wrapping, mobile layout and keyboard focus without changing data", () => {
    const css = readFileSync("client/src/components/training-history-list.css", "utf8");
    for (const token of [".et-record-list", "gap:16px", "minmax(0,1fr)", "overflow-wrap:anywhere", "min-height:44px", ":focus-visible", "@media(max-width:640px)"]) expect(css).toContain(token);
    const source = readFileSync("client/src/components/TrainingHistoryList.tsx", "utf8");
    expect(source).not.toMatch(/useMutation|fetch\(|localStorage|sessionStorage|\.mutate|setInterval/);
  });
});
