import { beforeEach, describe, expect, it, vi } from "vitest";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import TrainingHistoryList from "../client/src/components/TrainingHistoryList";

const mock = vi.hoisted(() => ({ filter: "all", language: "ko" }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: () => [mock.filter, (value: string) => { mock.filter = value; }],
}));
const row = (id: number) => ({ id, scenarioId: "wafer-surface-a-01", signal: "surface", onset: 45, marker: 5,
  signalMatched: 1, onsetMatched: 1, comparisonMatched: 1, certaintyMatched: 1, createdAt: new Date("2026-10-04T00:00:00Z") });
const rows = [row(3), { ...row(2), onsetMatched: 0 }, { ...row(1), onsetMatched: 0, certaintyMatched: 0 }];
function elements(node: ReactNode): ReactElement<any>[] {
  return Children.toArray(node).flatMap(child => isValidElement(child) ? [child, ...elements((child.props as any).children)] : []);
}
function text(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement(child) ? text((child.props as any).children) : String(child)).join("");
}
function render(attempts = rows) { return TrainingHistoryList({ language: mock.language as any, attempts }); }
function choose(tree: ReactNode, startsWith: string) {
  const button = elements(tree).find(e => e.type === "button" && text(e.props.children).startsWith(startsWith))!;
  expect(button).toBeDefined(); button.props.onClick();
}
const recordLinks = (tree: ReactNode) => elements(tree).filter(e => typeof e.props.href === "string" && e.props.href.startsWith("/training/history/"));

describe("personal record-to-review navigation", () => {
  beforeEach(() => { mock.filter = "all"; mock.language = "ko"; });
  it.each([
    ["ko", "변화 시작 시점", "전체 기록"], ["en", "Change onset", "All records"], ["ja", "変化開始時点", "すべての記録"],
  ])("filters saved records and restores the full list in %s", (language, criterion, all) => {
    mock.language = language;
    expect(recordLinks(render()).map(e => e.props.href)).toEqual(["/training/history/3", "/training/history/2", "/training/history/1"]);
    choose(render(), criterion);
    const filtered = render();
    expect(recordLinks(filtered).map(e => e.props.href)).toEqual(["/training/history/2", "/training/history/1"]);
    expect(elements(filtered).find(e => e.type === "button" && e.props["aria-pressed"] === true)?.props["aria-controls"]).toBe("training-history-records");
    expect(text(filtered)).toContain("2 / 3");
    if (language === "en") {
      const single = render([rows[1]]);
      expect(text(single)).toContain("Records to revisit: 1");
      expect(text(single)).not.toContain("1 records");
    }
    choose(filtered, all); expect(recordLinks(render())).toHaveLength(3);
  });
  it("shows a neutral empty-filter result rather than declaring the learner competent", () => {
    choose(render(), "관측 항목");
    expect(recordLinks(render())).toHaveLength(0);
    expect(text(render())).toContain("이 항목에서 다시 비교할 저장 기록이 없습니다.");
    expect(text(render())).not.toMatch(/전문가 수준|현장 역량 향상|100%/);
  });
  it("clearly limits the summary to saved, recent choice results", () => {
    expect(text(render())).toContain("최근 저장된 최대 20건");
    expect(text(render())).toContain("같은 모듈의 반복 시도도 각각 포함");
    expect(text(render())).toContain("현장 역량이나 전체 학습 기록의 통계가 아닙니다");
    expect(text(render())).toContain("저장된 선택형 결과 기준");
  });
  it("never invents an onset for a saved no-change result", () => {
    const tree = render([{ ...row(1), scenarioId: "oxidation-reference-a-01", signal: "none", onset: -1, marker: null }]);
    expect(text(tree)).toContain("차이 없음"); expect(text(tree)).toContain("해당 없음");
    expect(recordLinks(tree)[0].props.href).toBe("/training/history/1");
  });
  it("keeps owner gating in the parent and resets list state for a different owner", () => {
    const source = readFileSync("client/src/pages/EtchTraining.tsx", "utf8");
    expect(source).toContain("history.data?.userId === auth.data?.id");
    expect(source).toContain('<TrainingHistoryList key={auth.data.id}');
    expect(source).toContain("attempts={accountHistory}");
    const component = readFileSync("client/src/components/TrainingHistoryList.tsx", "utf8");
    expect(component).not.toMatch(/useMutation|localStorage|sessionStorage|fetch\(|\.mutate|userId/);
  });
  it("keeps the selected filter visually distinct from the inherited action style", () => {
    const css = readFileSync("client/src/components/training-history-list.css", "utf8");
    expect(css).toContain('.et-app .et-actions.et-review-filters button[aria-pressed="true"]');
    expect(css).toContain("background:#e4aa55;color:#17201b");
  });
});
