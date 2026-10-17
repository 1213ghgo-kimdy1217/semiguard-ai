import { createElement, Children, isValidElement, type ReactNode, type ReactElement } from "react";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { getProcessScenario, processCriteria, type ProcessAnswer } from "../shared/processScenarios";
import { processEventReviewSignal, processReviewSignal } from "../client/src/lib/processReviewNavigation";
import ProcessCriteriaFeedback from "../client/src/components/ProcessCriteriaFeedback";

function elements(node: ReactNode): ReactElement<any>[] {
  return Children.toArray(node).flatMap(child => isValidElement<{ children?: ReactNode }>(child) ? [child, ...elements(child.props.children)] : []);
}
const read = (path: string) => readFileSync(path, "utf8");
describe("feedback navigation opens the intended original record", () => {
  it.each([
    ["wafer", ["surface", "thickness"]], ["oxidation", ["film", "film"]],
    ["photo", ["position", "position"]], ["deposition", ["film", "electrical"]],
    ["metal", ["connection", "appearance"]], ["eds", ["die", "die"]],
    ["packaging", ["connection", "connection"]],
  ] as const)("uses authored event context, not the last selected %s view", (id, expected) => {
    const scenario = getProcessScenario(id)!; const before = JSON.stringify(scenario);
    expect(scenario.events.map((_, index) => processEventReviewSignal(scenario, index))).toEqual(expected);
    expect(JSON.stringify(scenario)).toBe(before);
    expect(processReviewSignal(scenario, "untrusted or none")).toBe(scenario.signals[0].id);
    for (const signal of scenario.signals) expect(processReviewSignal(scenario, signal.id)).toBe(signal.id);
  });
  it.each(["ko", "en", "ja"] as const)("distinguishes learner's item from teaching item in %s", language => {
    const scenario = getProcessScenario("metal")!;
    const answer: ProcessAnswer = { signal: "appearance", onset: "48", comparison: "same-condition", certainty: "uncertain", facts: "가상 QA 관찰 사실을 기록했습니다.", checks: "같은 조건의 이전 기록과 비교하겠습니다." };
    const before = JSON.stringify(answer); const jump = vi.fn();
    const tree = ProcessCriteriaFeedback({ scenario, answer, matched: processCriteria(scenario, answer)!, language, onReviewPoint: jump });
    const buttons = elements(tree).filter(e => e.type === "button");
    expect(buttons).toHaveLength(3);
    buttons.forEach(button => button.props.onClick());
    expect(jump.mock.calls).toEqual([[48, "appearance"], [42, "connection"], [90, "connection"]]);
    expect(JSON.stringify(answer)).toBe(before);
  });
  it("opens the real graph before focusing it, only for a valid submitted review", () => {
    const page = read("client/src/pages/ProcessTraining.tsx");
    const choices = page.slice(page.indexOf("const reviewChoicePoint ="), page.indexOf("const returnToReview ="));
    const coach = page.slice(page.indexOf("const reviewCoachPoint ="), page.indexOf("const [notice,"));
    for (const handler of [choices, coach]) {
      expect(handler).toContain('if (!attempt.submitted || stage !== "review"');
      expect(handler).toContain("!Number.isInteger(time)"); expect(handler).toContain("time > scenario.duration");
      expect(handler.indexOf("reviewGraph.current.open = true")).toBeLessThan(handler.indexOf("reviewHeading.current?.focus"));
      expect(handler).toContain("alignReviewHeading(reviewHeading.current)");
      expect(handler).not.toMatch(/setAttempt|\.mutate|saveAttempt|saveDraft/);
    }
    expect(choices).toContain("setSignalId(processReviewSignal(scenario, signal))");
    expect(coach).toContain("setSignalId(processReviewSignal(scenario, answer.signal))");
    expect(page).toContain('<details className="pt-reference" ref={reviewGraph}>');
    expect(page).toContain('<h3 ref={reviewHeading} tabIndex={-1}>');
    expect(page).toContain('onReviewPoint={(time, signal) => reviewChoicePoint(time, "criteria", signal)}');
    expect(page).toContain('onReviewPoint={reviewCoachPoint}');
  });
  it("does not read model output or persist new view state", () => {
    const helper = read("client/src/lib/processReviewNavigation.ts");
    expect(helper).not.toMatch(/processSample|localStorage|sessionStorage|trpc|fetch\(|useEffect|\.question|parseInt/);
    for (const path of ["shared/trainingRecord.ts", "shared/trainingDraft.ts", "shared/judgmentCoach.ts", "shared/coachReview.ts"]) {
      expect(read(path)).not.toMatch(/processReviewSignal|processEventReviewSignal|reviewGraph/);
    }
  });
});
