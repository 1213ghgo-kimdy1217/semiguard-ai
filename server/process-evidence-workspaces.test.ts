import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { DepositionWorkspace, MetalWorkspace, ProcessEvidenceBrief } from "../client/src/components/ProcessEvidenceWorkspaces";
import { depositionEvidence, metalObservation } from "../shared/inspectionEvidence";

const read = (path: string) => readFileSync(path, "utf8");
const copy = [
  { language: "ko", deposition: "이 문장은 어떤 기록으로 말할 수 있나요", metal: "한 구간의 복귀와, 이어지는 기록을 구분하기", separate: "같은 웨이퍼·같은 검사라는 뜻이 아닙니다", scope: "답안·계정 저장·이어하기·AI 입력에 포함되지 않습니다", limit: "실제 생산 주기·수율·장비 고장 원인을 재현하지 않습니다", counts: "실제 불량률·수율이 아닙니다" },
  { language: "en", deposition: "Which record supports this claim", metal: "Separate one interval", separate: "not evidence that they concern the same wafer", scope: "not a score, answer, account save, checkpoint or AI input", limit: "not real production cycles, yield or equipment-fault causes", counts: "not real defect rates or yield" },
  { language: "ja", deposition: "この主張をどの記録で裏付けられますか", metal: "一区間の復帰と、その後の記録を区別する", separate: "同じウェーハ・同じ検査を意味しません", scope: "点数・回答・保存・再開・AI入力には含まれません", limit: "実際の生産周期・歩留まり・装置故障原因を再現しません", counts: "実際の不良率・歩留まりではありません" },
] as const;

describe("evidence sorting and recurrence observation workspaces", () => {
  it.each(copy)("explains different reasoning tasks and synthetic limits in $language", item => {
    for (const processId of ["deposition", "metal"] as const) {
      const html = renderToStaticMarkup(createElement(ProcessEvidenceBrief, { processId, language: item.language }));
      expect(html).toContain(item.limit); expect(html.match(/<li>/g)).toHaveLength(2);
      expect(html).toContain(processId === "deposition" ? "SORT THE EVIDENCE" : "FOLLOW THE RECURRENCE");
    }
  });
  it.each(copy)("has separate exact evidence cards and an explicit unscored classifier in $language", item => {
    const html = renderToStaticMarkup(createElement(DepositionWorkspace, { time: 48, language: item.language, onInteraction: vi.fn() }));
    for (const label of [item.deposition, item.separate, item.scope]) expect(html).toContain(label);
    expect(html.match(/<article/g)).toHaveLength(2); expect(html.match(/<option/g)).toHaveLength(3);
    expect(html.match(/<button/g)).toHaveLength(3); expect(html).not.toContain('class="pe-check"');
    for (const sample of [depositionEvidence(48, "film-difference").film, depositionEvidence(48, "film-difference").electrical]) {
      expect(html).toContain(sample.value.toFixed(1)); expect(html).toContain(sample.reference.toFixed(1));
    }
    expect(html).not.toMatch(/<form|<iframe|<img|https?:/);
  });
  it.each(copy)("shows observed metal intervals and numeric record details in $language", item => {
    const html = renderToStaticMarkup(createElement(MetalWorkspace, { time: 48, observedUntil: 59, language: item.language, onTimeChange: vi.fn() }));
    expect(html).toContain(item.metal); expect(html).toContain(item.counts);
    const intervals = html.match(/<div class="pe-window-grid"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
    const perspectives = html.match(/<div class="pc-controls"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
    const details = html.slice(html.indexOf('<div class="pe-interval-detail">'));
    // Each independent control group must keep exactly one selected item.
    expect(intervals.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(intervals.match(/<button/g)).toHaveLength(10);
    expect(perspectives.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(perspectives.match(/<button/g)).toHaveLength(2);
    expect(details.match(/<button/g)).toHaveLength(6);
    expect(html.match(/<button/g)).toHaveLength(18); // Original 16 record controls plus 2 perspectives.
    expect(html).toContain('tabindex="0"'); expect(html).toContain('scope="row"'); expect(html).toContain('aria-current="true"');
    for (const row of metalObservation(48, 59).selected.rows) {
      expect(html).toContain(row.connection.value.toFixed(1)); expect(html).toContain(row.appearance.value.toFixed(1));
    }
    expect(html).toContain("00:42–00:47"); expect(html).toContain("00:48–00:53"); expect(html).toContain("00:54–00:59");
    expect(html).not.toContain("01:00");
  });
  it("never displays unobserved recurrence records and bounds the selected interval", () => {
    const html = renderToStaticMarkup(createElement(MetalWorkspace, { time: 54, observedUntil: 41, language: "ko", onTimeChange: vi.fn() }));
    expect(html).toContain("00:36–00:41"); expect(html).not.toContain("00:42"); expect(html).not.toContain("00:54");
  });
  it("keeps all workspace activity outside saved answers, network and AI", () => {
    const component = read("client/src/components/ProcessEvidenceWorkspaces.tsx");
    expect(component).not.toMatch(/localStorage|sessionStorage|trpc|\bfetch\(|useEffect|dangerouslySetInnerHTML/);
    expect(component).toContain('check?.time === view.time && check.claim === claim');
    expect(component).toContain('onTimeChange(window.end)'); expect(component).toContain('onTimeChange(row.time)');
    expect(component).toContain('사전 연습 · 규칙 기반 안내');
    const page = read("client/src/pages/ProcessTraining.tsx");
    expect(page).toContain('onInteraction={pauseObservationView}');
    expect(page).toContain('observedUntil={stage === "review" ? scenario.duration : attempt.elapsed}');
    expect(page).toContain('if (stage === "review") setReviewTime(time); else setInspectionSelection(Math.min(time, attempt.elapsed))');
    expect(page).toContain('toProcessTrainingSubmission(completed)');
    expect(read("shared/processScenarios.ts")).not.toMatch(/EvidenceClaim|EvidenceSource|metalObservation|depositionEvidence/);
  });
  it("has native mobile-friendly controls, keyboard focus and contained table overflow", () => {
    const css = read("client/src/components/process-evidence-workspaces.css");
    expect(css).toContain("min-height:44px"); expect(css).toContain(":focus-visible");
    expect(css).toContain("@media(max-width:760px)"); expect(css).toContain("grid-template-columns:repeat(2,minmax(0,1fr))");
    expect(css).toContain(".pe-interval-detail .et-table{max-width:100%}");
    expect(css).not.toMatch(/animation:|@keyframes|!important/);
  });
});
