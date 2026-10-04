import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PracticeLearningOptions, PracticeWorkspaceNav } from "../client/src/components/PracticeEntryOptions";
import { AccountPracticeBenefits } from "../client/src/components/TrainingCheckpoint";
import type { ProductLanguage } from "../client/src/lib/productLanguage";

const render = (node: Parameters<typeof createElement>[0], props: Record<string, unknown>) => renderToStaticMarkup(createElement(Router, { ssrPath: "/training" }, createElement(node, props)));
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const locales = [
  { language: "ko", choices: "연습 방식", history: "내 학습 기록", purpose: "공정 이해", sensors: "단위·기여도 비교", account: "기록을 남기고, 다음 연습으로 이어가세요.", old: "로그인하고, 내 판단을 이어가세요." },
  { language: "en", choices: "Practice options", history: "My practice history", purpose: "Process concepts", sensors: "Units and contributions", account: "Save your reasoning. Build on it next time.", old: "Sign in. Keep building your reasoning." },
  { language: "ja", choices: "練習方法", history: "自分の練習記録", purpose: "工程を理解", sensors: "単位・寄与を比較", account: "判断を記録し、次の練習につなげましょう。", old: "ログインして、自分の判断を続けましょう。" },
] as const;

describe("clear signed-in practice choices", () => {
  it.each(locales)("provides native in-page shortcuts in $language", item => {
    const html = render(PracticeWorkspaceNav, { language: item.language });
    expect(html).toContain("<nav");
    expect(html).toContain(item.choices);
    expect(html).toContain(item.history);
    expect(html).toContain('href="#practice-options"');
    expect(html).toContain('href="#practice-history"');
    expect(html).not.toMatch(/<button|href="\/login"/);
  });

  it.each(locales)("shows separate learning purposes without skipping the sensor briefing in $language", item => {
    const html = render(PracticeLearningOptions, { language: item.language as ProductLanguage, onSensorBrief: () => {} });
    expect(html).toContain(item.purpose);
    expect(html).toContain(item.sensors);
    expect(html.match(/class="et-card-top"/g)).toHaveLength(2);
    expect(html.match(/class="et-card-icon"/g)).toHaveLength(2);
    expect(html).toContain('href="/learn"');
    expect(html).not.toContain('href="/dashboard"');
    expect(html).toContain('type="button"');
  });

  it.each(locales)("uses signed-in account wording and preserves explicit-save privacy in $language", item => {
    const html = render(AccountPracticeBenefits, { language: item.language });
    expect(html).toContain(item.account);
    expect(html).not.toContain(item.old);
    expect(html).not.toContain("GUEST PREVIEW");
    expect(html).toContain("PERSONAL WORKSPACE");
    expect(html).not.toMatch(/<button|<form|href="\/login"/);
    expect(html).toContain(item.language === "ko" ? "버튼을 누를 때만" : item.language === "en" ? "only when requested" : "ボタンを押したときだけ");
    expect(html).toContain(item.language === "ko" ? "서술형 원문은 계정에 저장하지" : item.language === "en" ? "Written answers are not stored" : "記述回答は保存しない");
  });

  it("links to real home targets and keeps both original entry handlers and record owner gating", () => {
    const page = read("client/src/pages/EtchTraining.tsx");
    expect(page).toContain("<PracticeWorkspaceNav language={language} />");
    expect(page).toContain('id="practice-options"');
    expect(page).toContain('id="practice-history"');
    expect(page).toContain('className="et-columns et-choice-grid"');
    expect(page.match(/className="et-card-top"/g)).toHaveLength(2);
    expect(page).toContain('onClick={() => move("process-select")}');
    expect(page).toContain('onSensorBrief={() => move("sensor-brief")}');
    expect(page).toContain('href="/live"');
    expect(page).toContain('history.data?.userId === auth.data?.id');
    expect(page).toContain('attempt.submitted ? "review" : "brief"');
    expect(page).not.toContain("scroll-behavior:smooth");
  });

  it("scopes card layout, touch controls and responsive wrapping without new animation or global overrides", () => {
    const css = read("client/src/components/practice-entry-options.css");
    expect(css).toContain(".et-choice-grid .et-entry-card");
    expect(css).toContain("minmax(0,1fr)");
    expect(css).toContain("min-height:44px");
    expect(css).toContain("scroll-margin-top:110px");
    expect(css).toContain("@media(max-width:760px)");
    expect(css).toContain("overflow-wrap:anywhere");
    expect(css).not.toMatch(/@keyframes|animation:|!important|scroll-behavior/);
  });
});
