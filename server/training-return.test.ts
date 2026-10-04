import { beforeEach, describe, expect, it, vi } from "vitest";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { TrainingRetry } from "../client/src/components/TrainingRetry";
import { trainingPracticeHref } from "../shared/trainingReplay";
import { processScenarios } from "../shared/processScenarios";

const mock = vi.hoisted(() => ({ states: [] as unknown[], cursor: 0 }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useEffect: vi.fn(), useId: () => "retry-dialog", useRef: () => ({ current: null }),
  useState: (initial: unknown) => {
    const index = mock.cursor++;
    if (!(index in mock.states)) mock.states[index] = initial;
    return [mock.states[index], (value: unknown) => { mock.states[index] = value; }];
  },
}));
const pause = vi.fn();
const restart = vi.fn();
function render(extra: Record<string, unknown> = {}) {
  mock.cursor = 0;
  return TrainingRetry({ language: "ko", hasWork: true, disabled: false, onPause: pause, onRestart: restart, ...extra });
}
function elements(node: ReactNode): ReactElement<any>[] {
  return Children.toArray(node).flatMap(child => isValidElement(child)
    ? [child, ...elements((child.props as any).children)] : []);
}
function text(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement(child)
    ? text((child.props as any).children) : String(child)).join("");
}
function button(tree: ReactNode, label: string) {
  return elements(tree).find(e => e.type === "button" && text(e.props.children) === label)!;
}

describe("saved-record return routes", () => {
  it.each(processScenarios)("opens $processId itself, not the module chooser", scenario => {
    expect(trainingPracticeHref(scenario.id)).toBe(scenario.processId === "etch" ? "/training/etch" : `/training/process/${scenario.processId}`);
  });
  it.each(["wafer", "etch", "unknown", "etch-chamber-a-02"])("does not invent a route for unknown saved module %s", id => {
    expect(trainingPracticeHref(id)).toBeUndefined();
  });
});

describe("explicit new-attempt confirmation", () => {
  beforeEach(() => { vi.clearAllMocks(); mock.states = []; mock.cursor = 0; });
  it.each([
    ["ko", "새 시도로 다시 연습", "현재 탭 답안을 비우고 시작", "취소", "계정에 저장한 완료 기록과 중간 저장본은 그대로"],
    ["en", "Practice with a new attempt", "Clear this tab's answer and start", "Cancel", "Completed records and checkpoints saved to your account remain unchanged"],
    ["ja", "新しい試行で再練習", "このタブの回答を消して開始", "キャンセル", "アカウントに保存した完了記録と中間保存は変わりません"],
  ])("pauses without resetting, then requires explicit confirmation in %s", (language, open, confirm, cancel, disclosure) => {
    expect(restart).not.toHaveBeenCalled();
    button(render({ language }), open).props.onClick();
    expect(pause).toHaveBeenCalledTimes(1); expect(restart).not.toHaveBeenCalled();
    const dialog = render({ language });
    expect(text(dialog)).toContain(disclosure);
    expect(elements(dialog).find(e => e.props.role === "alertdialog")?.props["aria-modal"]).toBe(false);
    button(dialog, cancel).props.onClick(); expect(restart).not.toHaveBeenCalled();
    expect(button(render({ language }), confirm)).toBeUndefined();
    button(render({ language }), open).props.onClick();
    button(render({ language }), confirm).props.onClick();
    expect(restart).toHaveBeenCalledTimes(1);
    expect(button(render({ language }), confirm)).toBeUndefined();
  });
  it("Escape cancels without replacing any answer", () => {
    button(render(), "새 시도로 다시 연습").props.onClick();
    const dialog = elements(render()).find(e => e.props.role === "alertdialog")!;
    dialog.props.onKeyDown({ key: "Escape", preventDefault: vi.fn() });
    expect(restart).not.toHaveBeenCalled();
    expect(button(render(), "현재 탭 답안을 비우고 시작")).toBeUndefined();
  });
  it("does not reset while saving, including an already open confirmation", () => {
    button(render(), "새 시도로 다시 연습").props.onClick();
    const busy = render({ disabled: true });
    expect(button(busy, "새 시도로 다시 연습").props.disabled).toBe(true);
    expect(button(busy, "현재 탭 답안을 비우고 시작").props.disabled).toBe(true);
    button(busy, "현재 탭 답안을 비우고 시작").props.onClick();
    expect(restart).not.toHaveBeenCalled();
  });
  it("has no clear action for an empty or replaced attempt", () => {
    expect(render({ hasWork: false })).toBeNull();
    button(render(), "새 시도로 다시 연습").props.onClick();
    expect(render({ hasWork: false })).toBeNull();
    expect(restart).not.toHaveBeenCalled();
  });
  it("guards the restart handler if confirmation was not opened", () => {
    expect(button(render(), "현재 탭 답안을 비우고 시작")).toBeUndefined();
    expect(restart).not.toHaveBeenCalled();
  });
});

describe("parent wiring preserves current answers on navigation", () => {
  it("adds a direct etch entry without changing the default selection screen", () => {
    const app = readFileSync("client/src/App.tsx", "utf8");
    expect(app).toContain('path={"/training/etch"}');
    expect(app).toContain('<Training key="etch-direct" entry="brief" />');
    const etch = readFileSync("client/src/pages/EtchTraining.tsx", "utf8");
    expect(etch).toContain('entry = "home"');
    expect(etch).toContain('entry === "brief" ? restored.submitted ? "review" : "brief" : "home"');
    expect(etch).toContain("restoreEtchAttempt(sessionStorage.getItem(expectedStorageKey))");
  });
  it("keeps both engines' restart controls account/attempt scoped, paused and blocked while saving", () => {
    for (const page of ["ProcessTraining", "EtchTraining"]) {
      const source = readFileSync(`client/src/pages/${page}.tsx`, "utf8");
      expect(source).toMatch(/<TrainingRetry key=\{`\$\{(?:storageKey|expectedStorageKey)\}:\$\{attempt.saveKey/);
      expect(source).toContain('disabled={saveStatus === "saving"} onPause={() => setRunning(false)} onRestart={reset}');
      expect(source).toContain('${retryRevision}');
      expect(source).toContain('setRetryRevision(revision => revision + 1)');
      expect(source).not.toContain("onClick={reset}");
      const retry = readFileSync("client/src/components/TrainingRetry.tsx", "utf8");
      expect(retry).not.toMatch(/useMutation|localStorage|sessionStorage|fetch\(/);
    }
  });
  it("offers only a trusted module link and explains preserving records in all three languages", () => {
    const history = readFileSync("client/src/pages/TrainingHistory.tsx", "utf8");
    expect(history).toContain("trainingPracticeHref(record.scenarioId)");
    expect(history).toContain("이 모듈 다시 열기");
    expect(history).toContain("Open this module again");
    expect(history).toContain("このモジュールをもう一度開く");
    expect(history).not.toContain("useMutation");
  });
});
