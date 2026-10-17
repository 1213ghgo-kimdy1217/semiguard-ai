import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { OxidationWorkspace, PhotoWorkspace, ProcessObservationBrief } from "../client/src/components/ProcessObservationWorkspaces";
import { oxidationComparison, photoObservation } from "../shared/processObservation";

const read = (path: string) => readFileSync(path, "utf8");
const copy = [
  { language: "ko", oxidation: "이전 숫자가 아니라, 맞는 기준과 비교하기", photo: "한 장을 고정하고, 앞뒤를 비교하기", warning: "다른 묶음의 기준을 적용 중", reference: "정상 참고 겹쳐 보기", scope: "관측 전의 기록은 표시하지 않습니다", limit: "실제 측정 영상·장비 출력·공정 조건을 재현하지 않습니다" },
  { language: "en", oxidation: "Compare with a matching reference", photo: "Compare frames, not just the last one", warning: "applying another group", reference: "Overlay the normal reference", scope: "Unobserved records are not displayed", limit: "do not reproduce measurement images, equipment output or process conditions" },
  { language: "ja", oxidation: "対応する基準と比較", photo: "一枚を固定して前後を比べる", warning: "別グループの基準を使用中", reference: "正常参照を重ねて表示", scope: "未観測の記録は表示しません", limit: "実測画像・装置出力・工程条件を再現しません" },
] as const;

describe("different observation tasks for oxidation and photolithography", () => {
  it.each(copy)("explains two different tasks and boundaries in $language", item => {
    for (const processId of ["oxidation", "photo"] as const) {
      const html = renderToStaticMarkup(createElement(ProcessObservationBrief, { processId, language: item.language }));
      expect(html).toContain(item.limit); expect(html.match(/<li>/g)).toHaveLength(2);
      expect(html).toContain(processId === "oxidation" ? "MATCH THE REFERENCE" : "COMPARE PATTERN RECORDS");
    }
  });
  it.each(copy)("presents exact oxidation numbers and a visibly labelled mismatched-reference mode in $language", item => {
    const html = renderToStaticMarkup(createElement(OxidationWorkspace, { time: 35, language: item.language, reference: "group-a", onReferenceChange: vi.fn() }));
    expect(html).toContain(item.oxidation); expect(html).toContain(item.warning); expect(html).toContain('role="status"');
    expect(html.match(/<button/g)).toHaveLength(2); expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    const record = oxidationComparison(35, "group-a").records[0];
    for (const value of [record.sample.value, record.compared.reference, record.difference]) expect(html).toContain(value.toFixed(1));
    const early = renderToStaticMarkup(createElement(OxidationWorkspace, { time: 0, language: item.language, reference: "group-a", onReferenceChange: vi.fn() }));
    expect(early).toContain('disabled=""'); expect(early).not.toContain(item.warning);
    expect(early).not.toContain("00:29"); expect(early).not.toContain("100.0");
  });
  it.each(copy)("uses observed-only photo frames, numeric equivalents and labelled overlays in $language", item => {
    const props = { time: 45, pinnedTime: 32, signal: "position" as const, overlay: true, language: item.language, onPinChange: vi.fn(), onOverlayChange: vi.fn() };
    const html = renderToStaticMarkup(createElement(PhotoWorkspace, props));
    for (const value of [item.photo, item.reference, item.scope, "00:32", "00:45"]) expect(html).toContain(value);
    expect(html.match(/class="po-pattern-reference"/g)).toHaveLength(6);
    expect(html.match(/<title /g)).toHaveLength(2); expect(html).toContain('type="number"'); expect(html).toContain('max="45"');
    const records = photoObservation(45, 32, "position");
    for (const record of [records.pinned, records.current]) expect(html).toContain(record.value.toFixed(1));
    const hidden = renderToStaticMarkup(createElement(PhotoWorkspace, { ...props, time: 20, pinnedTime: 32, overlay: false }));
    expect(hidden).not.toContain('class="po-pattern-reference"'); expect(hidden).not.toContain("00:32"); expect(hidden).toContain('max="20"');
    expect(html).not.toMatch(/<img|<iframe|<form|https?:|AI feedback|AI 코칭 결과/);
  });
  it("keeps workspace preferences outside the answer, network and persistence contracts", () => {
    const source = read("client/src/components/ProcessObservationWorkspaces.tsx");
    expect(source).not.toMatch(/localStorage|sessionStorage|trpc|fetch\(|useEffect|dangerouslySetInnerHTML/);
    const page = read("client/src/pages/ProcessTraining.tsx");
    expect(page).toContain('const [oxidationReference, setOxidationReference] = useState<OxidationReference>("matching")');
    expect(page).toContain('const [photoPinnedTime, setPhotoPinnedTime] = useState(0)');
    expect(page).toContain('pauseObservationView(); setPhotoPinnedTime(time)');
    expect(page).toContain('pauseObservationView(); setOxidationReference(reference)');
    expect(page).toContain('setRunning(false); setInspectionSelection(shownTime)');
    expect(page).toContain('toProcessTrainingSubmission(completed)');
    expect(page).toContain('setOxidationReference("matching"); setPhotoPinnedTime(0); setPhotoOverlay(true)');
  });
  it("provides responsive controls with visible keyboard focus and non-color-only records", () => {
    const css = read("client/src/components/process-observation-workspaces.css");
    expect(css).toContain("min-height:44px"); expect(css).toContain(":focus-visible");
    expect(css).toContain("@media(max-width:760px)"); expect(css).toContain("grid-template-columns:minmax(0,1fr)");
    expect(css).toContain("stroke-dasharray:5 4"); expect(css).not.toMatch(/animation:|@keyframes|!important/);
  });
});
