import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ProcessCriteriaFeedback from "../client/src/components/ProcessCriteriaFeedback";
import { processCriteria, processScenarios, type ProcessAnswer } from "../shared/processScenarios";

const scenarios = processScenarios.filter(scenario => scenario.processId !== "etch");
const wafer = scenarios[0];
const answer: ProcessAnswer = { signal: "surface", onset: "45", comparison: "whole-run", certainty: "uncertain", facts: "가상 기록에 대한 관찰 사실입니다.", checks: "같은 조건의 가상 기록을 함께 비교합니다." };
function elements(node: ReactNode): ReactElement<any>[] {
  return Children.toArray(node).flatMap(child => isValidElement<{ children?: ReactNode }>(child) ? [child, ...elements(child.props.children)] : []);
}
function text(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement<{ children?: ReactNode }>(child) ? text(child.props.children) : String(child)).join("");
}
const render = (language: "ko" | "en" | "ja" = "ko", value = answer, scenario = wafer, onReviewPoint = vi.fn()) =>
  ProcessCriteriaFeedback({ scenario, answer: value, matched: processCriteria(scenario, value)!, language, onReviewPoint });

describe("process feedback reconnects choices to their evidence", () => {
  it.each([
    ["ko", "내 선택", "교육용 비교 기준", "전체 기록의 평균만 비교", "45초의 내 시작 판단 보기", "25초의 구성상 시작 보기"],
    ["en", "Your choice", "Teaching criterion", "Compare only the whole-record average", "Review your onset at 45 s", "Review designed onset at 25 s"],
    ["ja", "自分の選択", "教育用の比較基準", "記録全体の平均だけを比較", "自分の開始判断（45秒）を見る", "構成上の開始（25秒）を見る"],
  ] as const)("shows the submitted choices beside the criteria in %s", (language, own, criterion, comparison, ownPoint, designedPoint) => {
    const onReview = vi.fn(); const tree = render(language, answer, wafer, onReview);
    const content = text(tree);
    expect(elements(tree).filter(element => element.type === "article")).toHaveLength(4);
    expect(content).toContain(own); expect(content).toContain(criterion); expect(content).toContain(comparison);
    expect(content).toContain("00:45"); expect(content).toContain("00:25");
    expect(elements(tree).filter(element => element.props.className === "et-revisit")).toHaveLength(2);
    for (const [label, time] of [[ownPoint, 45], [designedPoint, 25]] as const) {
      elements(tree).find(element => element.type === "button" && text(element.props.children) === label)!.props.onClick();
      expect(onReview).toHaveBeenLastCalledWith(time);
    }
    expect(onReview).toHaveBeenCalledTimes(2);
  });
  it.each(scenarios)("preserves the four existing criteria for $processId without grading prose", scenario => {
    const value = { ...answer, signal: scenario.expectedSignal, onset: scenario.changeTime === null ? "none" : String(scenario.changeTime), comparison: "same-condition" };
    const before = JSON.stringify(value); const tree = render("ko", value, scenario);
    expect(elements(tree).filter(element => element.props.className === "et-good")).toHaveLength(4);
    expect(text(tree)).not.toContain(value.facts); expect(text(tree)).not.toContain(value.checks);
    expect(JSON.stringify(value)).toBe(before);
  });
  it("does not invent a zero-second anomaly for the normal oxidation record", () => {
    const scenario = scenarios.find(item => item.processId === "oxidation")!;
    const value = { ...answer, signal: "none", onset: "none", comparison: "same-condition" };
    const tree = render("ko", value, scenario); const content = text(tree);
    expect(content).toContain("편차 시작을 지정하지 않음");
    expect(content).not.toContain("00:00");
    expect(elements(tree).filter(element => element.type === "button").map(element => text(element.props.children))).toEqual(["전체 기록과 정상 참고 비교"]);
  });
  it("retains zero as an explicitly selected valid onset and does not mutate the submitted answer", () => {
    const value = { ...answer, onset: "0" }; const before = JSON.stringify(value); const onReview = vi.fn();
    const tree = render("ko", value, wafer, onReview);
    elements(tree).find(element => element.type === "button" && text(element.props.children) === "0초의 내 시작 판단 보기")!.props.onClick();
    expect(onReview).toHaveBeenCalledWith(0); expect(JSON.stringify(value)).toBe(before);
  });
  it("keeps navigation read-only and focuses the graph with a return to the source section", () => {
    const component = readFileSync("client/src/components/ProcessCriteriaFeedback.tsx", "utf8");
    expect(component).not.toMatch(/useMutation|useEffect|localStorage|sessionStorage|\bfetch\(|\.mutate|saveDraft|saveAttempt/);
    const source = readFileSync("client/src/pages/ProcessTraining.tsx", "utf8");
    expect(source).toContain('reviewChoicePoint(event.time, "timeline")');
    expect(source).toContain('onReviewPoint={time => reviewChoicePoint(time, "criteria")}');
    expect(source).toContain('ref={criteriaHeading} tabIndex={-1}');
    expect(source).toContain('ref={timelineHeading} tabIndex={-1}');
    expect(source).toContain('target?.focus({ preventScroll: true })');
    expect(source).toContain('target?.scrollIntoView({ block: "start", behavior: "auto" })');
    expect(source).toContain('onReviewPoint={reviewCoachPoint}');
  });
  it("keeps choices readable and navigation controls keyboard accessible on small screens", () => {
    const css = readFileSync("client/src/pages/process-training.css", "utf8");
    expect(css).toContain(".pt-choice-values"); expect(css).toContain("min-height:44px");
    expect(css).toContain(".pt-review-return"); expect(css).toContain("scroll-margin-top:110px");
  });
  it("does not remove the graph return control before scrolling to the source heading", () => {
    const source = readFileSync("client/src/pages/ProcessTraining.tsx", "utf8");
    const returning = source.slice(source.indexOf("const returnToReview ="), source.indexOf("const reviewCoachPoint ="));
    expect(returning).toContain('target?.focus({ preventScroll: true })');
    expect(returning).not.toContain("setReviewReturnTarget(null)");
    expect(returning).toContain("alignReviewHeading(target)");
    expect(source).toContain("productHeader.current?.getBoundingClientRect().height");
    expect(source).toContain('ref={productHeader}');
  });
});
