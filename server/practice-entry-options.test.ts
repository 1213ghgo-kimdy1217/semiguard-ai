import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FourSensorBrief, PracticeLearningOptions } from "../client/src/components/PracticeEntryOptions";
import type { ProductLanguage } from "../client/src/lib/productLanguage";

const page = readFileSync("client/src/pages/EtchTraining.tsx", "utf8");
const copy = [
  { language: "ko", learning: "8대 공정 학습", dashboard: "4센서 대시보드", preview: "활용 방법 먼저 보기", enter: "4센서 대시보드 들어가기", back: "선택 화면으로", scope: "교육용 가상 값", rules: "규칙 기반 계산", ai: "AI는 위험 점수를 계산하거나 고장을 확정하지 않습니다." },
  { language: "en", learning: "Eight-process learning", dashboard: "Four-sensor dashboard", preview: "See how to use it", enter: "Enter four-sensor dashboard", back: "Back to choices", scope: "synthetic training values", rules: "rule-based reference and z-score calculations", ai: "AI does not calculate the risk score or confirm failures." },
  { language: "ja", learning: "8大工程の学習", dashboard: "4センサーダッシュボード", preview: "まず使い方を見る", enter: "4センサーダッシュボードに進む", back: "選択画面へ", scope: "教育用の仮想値", rules: "ルールベースの計算", ai: "AIはリスクスコアを計算せず、故障を確定しません。" },
] as const;

describe("visible practice options and four-sensor entry briefing", () => {
  it.each(copy)("renders learning and a briefing-first dashboard option in $language", item => {
    const html = renderToStaticMarkup(createElement(Router, { ssrPath: "/training" }, createElement(PracticeLearningOptions, { language: item.language as ProductLanguage, onSensorBrief: () => {} })));
    expect(html).toContain(item.learning);
    expect(html).toContain(item.dashboard);
    expect(html).toContain(item.preview);
    expect(html).toContain('href="/learn"');
    expect(html).not.toContain('href="/dashboard"');
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-labelledby="sensor-option-title"');
  });

  it.each(copy)("explains limits and provides explicit entry and return in $language", item => {
    const html = renderToStaticMarkup(createElement(Router, { ssrPath: "/training" }, createElement(FourSensorBrief, { language: item.language as ProductLanguage, headingRef: null, onBack: () => {} })));
    for (const text of [item.enter, item.back, item.scope, item.rules, item.ai, "Scenario 01", "mm/s", "dB"]) expect(html).toContain(text);
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/learn"');
    expect(html).toContain('tabindex="-1"');
    expect(html).not.toContain("<form");
  });

  it("adds options before history without replacing the existing scenario and free observation", () => {
    expect(page).toContain('onSensorBrief={() => move("sensor-brief")}');
    expect(page).toContain('stage === "sensor-brief" ? <FourSensorBrief');
    expect(page).toContain('headingRef={heading} onBack={() => move("home")}');
    expect(page.indexOf("<PracticeLearningOptions")).toBeLessThan(page.indexOf('className="et-panel et-history"'));
    expect(page).toContain('href="/live"');
    expect(page).toContain('attempt.elapsed > 0 ? "observe" : "brief"');
    expect(page).toContain('heading.current?.focus()');
    expect(page).toContain('heading.current?.scrollIntoView({ block: "start" })');
    expect(readFileSync("client/src/pages/etch-training.css", "utf8")).toContain("scroll-margin-top:110px");
    expect(page).not.toContain('setLocation("/learn")');
    expect(page).not.toContain('window.location.href = "/dashboard"');
  });
});
