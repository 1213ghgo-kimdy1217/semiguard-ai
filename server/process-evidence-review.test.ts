import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import ProcessEvidenceReview, { ProcessRecordContext } from "../client/src/components/ProcessEvidenceReview";
import { getProcessScenario, processSample } from "../shared/processScenarios";

function elements(node: ReactNode): ReactElement<any>[] {
  return Children.toArray(node).flatMap(child => isValidElement<{ children?: ReactNode }>(child) ? [child, ...elements(child.props.children)] : []);
}
function text(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement<{ children?: ReactNode }>(child) ? text(child.props.children) : String(child)).join("");
}

describe("condition-aware oxidation and transient photo evidence", () => {
  it.each([["ko", "검사 묶음"], ["en", "Inspection group"], ["ja", "検査グループ"]] as const)("identifies the currently selected oxidation group in %s", (language, label) => {
    const scenario = getProcessScenario("oxidation")!;
    for (const [time, group] of [[0, "A"], [29, "A"], [30, "B"], [90, "B"]] as const) {
      const result = text(ProcessRecordContext({ scenario, time, language }));
      expect(result).toContain(`${label} ${group}`);
      expect(result).not.toMatch(/편차 없음|No deviation|偏差なし/);
    }
    expect(processSample(scenario, "film", 29).high).toBe(86);
    expect(processSample(scenario, "film", 30).low).toBe(96);
  });
  it.each(["ko", "en", "ja"] as const)("compares both oxidation records before and after the reference switch in %s", language => {
    const scenario = getProcessScenario("oxidation")!; const onReviewPoint = vi.fn();
    const tree = ProcessEvidenceReview({ scenario, language, onReviewPoint });
    expect(elements(tree).filter(element => element.type === "article")).toHaveLength(2);
    const buttons = elements(tree).filter(element => element.type === "button");
    buttons.forEach(button => button.props.onClick());
    expect(onReviewPoint.mock.calls).toEqual([[29], [30]]);
    expect(text(tree)).toContain("78.0–86.0"); expect(text(tree)).toContain("96.0–104.0");
    for (const at of [29, 30]) for (const signal of scenario.signals) {
      const sample = processSample(scenario, signal.id, at);
      expect(text(tree)).toContain(sample.value.toFixed(1)); expect(text(tree)).toContain(sample.reference.toFixed(1));
    }
    expect(scenario.changeTime).toBeNull(); expect(scenario.expectedSignal).toBe("none");
  });
  it.each(["ko", "en", "ja"] as const)("compares photo before, during and after the brief deviation in %s", language => {
    const scenario = getProcessScenario("photo")!; const before = JSON.stringify(scenario); const onReviewPoint = vi.fn();
    const tree = ProcessEvidenceReview({ scenario, language, onReviewPoint });
    const cards = elements(tree).filter(element => element.type === "article");
    expect(cards).toHaveLength(3);
    elements(tree).filter(element => element.type === "button").forEach(button => button.props.onClick());
    expect(onReviewPoint.mock.calls).toEqual([[31], [32], [45]]);
    for (const [index, time] of [31, 32, 45].entries()) {
      for (const signal of scenario.signals) {
        const sample = processSample(scenario, signal.id, time);
        expect(text(cards[index])).toContain(sample.value.toFixed(1));
        expect(text(cards[index])).toContain(sample.reference.toFixed(1));
      }
      const position = processSample(scenario, "position", time);
      expect(position.value > position.high).toBe(time === 32);
      const shape = processSample(scenario, "shape", time);
      expect(shape.value >= shape.low && shape.value <= shape.high).toBe(true);
    }
    expect(text(tree)).toContain({ko:"고장이 해결됐다는 증거는 아닙니다",en:"not evidence that a fault was fixed",ja:"故障が解決した証拠ではありません"}[language]);
    expect(JSON.stringify(scenario)).toBe(before);
  });
  it("does not add review answers to other modules or expose comparisons during observation", () => {
    expect(ProcessEvidenceReview({ scenario: getProcessScenario("wafer")!, language: "ko", onReviewPoint: vi.fn() })).toBeNull();
    expect(ProcessRecordContext({ scenario: getProcessScenario("photo")!, time: 32, language: "ko" })).toBeNull();
    const source = readFileSync("client/src/pages/ProcessTraining.tsx", "utf8");
    expect(source.indexOf("<ProcessEvidenceReview")).toBeGreaterThan(source.indexOf('stage === "review" && matched'));
    expect(source).toContain('onReviewPoint={time => reviewChoicePoint(time, "timeline")}');
  });
  it("keeps account history comparisons read-only and supports small-screen controls", () => {
    const component = readFileSync("client/src/components/ProcessEvidenceReview.tsx", "utf8");
    expect(component).not.toMatch(/useMutation|useEffect|localStorage|sessionStorage|\bfetch\(|saveDraft|saveAttempt/);
    const history = readFileSync("client/src/pages/TrainingHistory.tsx", "utf8");
    expect(history).toContain("<ProcessRecordContext"); expect(history).toContain("onReviewPoint={reviewEvidencePoint}");
    expect(history).toContain("heading?.focus({ preventScroll: true })");
    expect(history).toContain('query.data?.userId === auth.data?.id');
    const css = readFileSync("client/src/pages/process-training.css", "utf8");
    expect(css).toContain(".pt-evidence-points"); expect(css).toContain("min-height:44px");
  });
  it("supports the authored normal-switch explanation for the full oxidation record", () => {
    const scenario = getProcessScenario("oxidation")!;
    for (let at = 0; at <= scenario.duration; at++) for (const signal of scenario.signals) {
      const sample = processSample(scenario, signal.id, at);
      expect(sample.value >= sample.low && sample.value <= sample.high).toBe(true);
    }
  });
});
