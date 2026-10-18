import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import PracticeFirstStep from "../client/src/components/PracticeFirstStep";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("first-use practice guidance", () => {
  it.each([
    ["ko", "먼저 이것부터 해보세요", "같은 조건의 정상 참고와 비교", "정상 참고와 차이가 없는 기록도 있습니다."],
    ["en", "Start with these three steps", "same-condition normal reference", "Some records do not deviate"],
    ["ja", "まずはこの3つから", "同じ条件の正常参照と比較", "正常参照と差がない記録もあります。"],
  ] as const)("renders three ordered judgment actions in %s without assuming a fault", (language, title, comparison, scope) => {
    const html = renderToStaticMarkup(createElement(PracticeFirstStep, { language }));
    expect(html).toContain(`<section class="et-first-step" aria-label="${title}">`);
    expect(html.match(/<li>/g)).toHaveLength(3);
    expect(html).toContain(comparison);
    expect(html).toContain(scope);
    expect(html).not.toMatch(/<button|<input|<form|<a /);
  });

  it.each([
    ["ko", "관찰한 사실과 원인 추정을 구분", "같은 단계의 정상 참고와 비교", "정해진 정답을 제출하지 않습니다."],
    ["en", "separating observed facts from possible causes", "same-phase normal reference", "no fixed answer to submit"],
    ["ja", "観察した事実と原因の推測を分ける", "同じ段階の正常参照と比較", "決まった正解を提出する画面ではありません。"],
  ] as const)("explains free observation's purpose and first action in %s", (language, goal, comparison, scope) => {
    const html = renderToStaticMarkup(createElement(PracticeFirstStep, { language, mode: "free" }));
    expect(html.match(/<li>/g)).toHaveLength(3);
    expect(html).toContain(goal);
    expect(html).toContain(comparison);
    expect(html).toContain(scope);
  });

  it("is view-only and cannot expose scenario answers or change training state", () => {
    const guidance = source("client/src/components/PracticeFirstStep.tsx");
    expect(guidance).not.toMatch(/useState|useEffect|fetch\(|onClick|localStorage|sessionStorage|scenario\.expected|processSample|etchSample/);
    for (const path of ["ProcessTraining", "EtchTraining"]) {
      expect(source(`client/src/pages/${path}.tsx`)).toContain('{stage === "observe" ? <PracticeFirstStep language={language} /> : null}');
    }
    const live = source("client/src/pages/EtchLive.tsx");
    expect(live).toContain('<PracticeFirstStep language={language} mode="free" />');
    expect(live).toContain('<details className="et-live-details"><summary>');
    expect(live).not.toContain('<details className="et-live-details" open');
    expect(live).toContain('const next = addLiveNote(notes, time, elapsed, selected, draft);');
    expect(live).toContain('max={elapsed}');
    const styles = source("client/src/pages/etch-training.css");
    expect(styles).toMatch(/\.et-first-step ol\{[^}]*list-style:decimal/);
  });
});
