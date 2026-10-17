import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import WaferInspection, { WaferInspectionBrief } from "../client/src/components/WaferInspection";
import { waferInspectionComparison } from "../shared/waferInspection";

const read = (path: string) => readFileSync(path, "utf8");
const copy = [
  { language: "ko", title: "변화가 어느 위치에 모였나요?", intro: "이번에는 그래프보다 위치부터", reference: "같은 위치의 정상 참고", table: "선택 구역의 수치 비교표", rules: "규칙 기반 안내", limit: "실제 웨이퍼 사진·칩 배열·제조사 검사 출력이 아닙니다", scope: "계정 저장·이어하기·공유·AI 입력에는 포함되지 않습니다" },
  { language: "en", title: "Where are the changes concentrated?", intro: "Start with locations", reference: "Same-location normal reference", table: "Numeric comparison for the selected region", rules: "rule-based guidance", limit: "not a wafer photo, die layout or manufacturer inspection output", scope: "not included in account saves, checkpoints, sharing or AI input" },
  { language: "ja", title: "変化はどの位置に集中していますか？", intro: "位置から確認しましょう", reference: "同じ位置の正常参照", table: "選択区画の数値比較表", rules: "ルールに基づく案内", limit: "実際のウェーハ写真・チップ配置・メーカーの検査出力ではありません", scope: "アカウント保存・再開・共有・AI入力には含まれません" },
] as const;

describe("wafer-specific spatial observation", () => {
  it.each(copy)("explains the distinct location-first task and synthetic boundary in $language", item => {
    const html = renderToStaticMarkup(createElement(WaferInspectionBrief, { language: item.language }));
    expect(html).toContain(item.intro); expect(html).toContain(item.limit);
    expect(html).toContain("A3"); expect(html).toContain('aria-hidden="true"');
  });
  it.each(copy)("provides nine native region buttons, a numeric alternative and no review answer before submission in $language", item => {
    const html = renderToStaticMarkup(createElement(WaferInspection, { language: item.language, region: "B2", signal: "surface", time: 24, review: false, onRegionChange: () => {} }));
    for (const label of [item.title, item.reference, item.table, item.scope]) expect(html).toContain(label);
    expect(html.match(/<button/g)).toHaveLength(9);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/role="listitem"/g)).toHaveLength(9);
    expect(html).toContain('tabindex="0"'); expect(html).toContain('scope="row"');
    expect(html).not.toContain('class="wi-review"'); expect(html).not.toContain("largest absolute");
    expect(html).not.toMatch(/<form|<img|<iframe|https?:|onkeydown=/);
  });
  it.each(copy)("grounds review in the selected location and selected time in $language", item => {
    const html = renderToStaticMarkup(createElement(WaferInspection, { language: item.language, region: "B2", signal: "thickness", time: 90, review: true, onRegionChange: () => {} }));
    const comparison = waferInspectionComparison("B2", 90);
    expect(html).toContain(item.rules); expect(html).toContain("01:30"); expect(html).toContain("A3");
    expect(html).toContain(comparison.surface.value.toFixed(1));
    expect(html).toContain(comparison.largestSurface.sample.difference.toFixed(1));
    expect(html).toContain(item.scope);
  });
  it("keeps region selection out of answers and network/persistent storage", () => {
    const page = read("client/src/pages/ProcessTraining.tsx");
    expect(page).toContain('const [waferRegion, setWaferRegion] = useState<WaferRegion>("B2")');
    expect(page).toContain('scenario.processId === "wafer" ? <WaferInspectionBrief');
    expect(page).toContain('review={stage === "review"}');
    expect(page).toContain('onRegionChange={region => { setWaferRegion(region); if (stage === "observe") { setRunning(false); setInspectionSelection(shownTime); } }}');
    expect(page).toContain('setWaferRegion("B2")');
    expect(page).toContain('toProcessTrainingSubmission(completed)');
    const component = read("client/src/components/WaferInspection.tsx");
    expect(component).not.toMatch(/localStorage|sessionStorage|trpc|fetch\(|useEffect|dangerouslySetInnerHTML/);
    expect(component).toContain('onClick={() => onRegionChange(item)}');
  });
  it("does not ask the learner to compare a largest region with itself", () => {
    const render = (region: "A3" | "B2") => renderToStaticMarkup(createElement(WaferInspection, { language: "ko", region, signal: "surface", time: 90, review: true, onRegionChange: () => {} }));
    expect(render("A3")).toContain("선택한 구역(A3)의 표면 차이 절댓값이 이 시점에서 가장 큽니다");
    expect(render("A3")).not.toContain("선택 구역과 나란히 비교하세요");
    expect(render("B2")).toContain("선택 구역과 나란히 비교하세요");
  });
  it("uses responsive native controls and a non-color-only legend", () => {
    const css = read("client/src/components/wafer-inspection.css");
    expect(css).toContain("min-height:44px"); expect(css).toContain(":focus-visible");
    expect(css).toContain("grid-template-columns:repeat(3,minmax(0,1fr))");
    expect(css).toContain("@media(max-width:760px)"); expect(css).toContain("grid-template-columns:minmax(0,1fr)");
    expect(css).not.toMatch(/animation:|@keyframes|!important/);
  });
});
