import { beforeEach, describe, expect, it, vi } from "vitest";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { processScenarios, processSample } from "../shared/processScenarios";
import { trainingReplay } from "../shared/trainingReplay";
import TrainingHistory from "../client/src/pages/TrainingHistory";

const mock = vi.hoisted(() => ({
  states: [] as unknown[], cursor: 0, language: "ko", owner: 41 as number | null,
  response: undefined as any,
}));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(), useEffect: vi.fn(),
  useState: (initial: unknown) => {
    const index = mock.cursor++;
    if (!(index in mock.states)) mock.states[index] = initial;
    return [mock.states[index], (value: unknown) => { mock.states[index] = value; }];
  },
}));
vi.mock("../client/src/lib/productLanguage", async original => ({
  ...await original<typeof import("../client/src/lib/productLanguage")>(),
  useProductLanguage: () => [mock.language, vi.fn()],
}));
vi.mock("../client/src/lib/trpc", () => ({ trpc: {
  auth: { me: { useQuery: () => ({ data: mock.owner === null ? null : { id: mock.owner }, isLoading: false }) } },
  training: { detail: { useQuery: () => ({ data: mock.response, isLoading: false, isError: false }) } },
} }));

const record = { id: 15, scenarioId: "wafer-surface-a-01", signal: "thickness", onset: 45, marker: 5,
  comparison: "same-condition", certainty: "uncertain", createdAt: "2026-10-04T00:00:00Z",
  signalMatched: 0, onsetMatched: 0, comparisonMatched: 1, certaintyMatched: 1 };
function render() { mock.cursor = 0; return TrainingHistory({ attemptId: "15" }); }
function elements(node: ReactNode): ReactElement<any>[] {
  return Children.toArray(node).flatMap(child => isValidElement(child)
    ? [child, ...elements((child.props as any).children)] : []);
}
function text(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement(child)
    ? text((child.props as any).children) : String(child)).join("");
}
function button(tree: ReactNode, label: string) {
  return elements(tree).find(element => element.type === "button" && text(element.props.children) === label)!;
}
const slider = (tree: ReactNode) => elements(tree).find(element => element.props.id === "history-time")!;
const signal = (tree: ReactNode) => elements(tree).find(element => element.type === "select")!;

describe("trusted saved-record replay targets", () => {
  it.each(processScenarios)("uses $processId duration and the learner's signal, not the first signal", scenario => {
    const result = trainingReplay({ ...record, scenarioId: scenario.id, signal: scenario.signals[1].id,
      onset: scenario.duration, marker: 0 });
    expect(result?.signalId).toBe(scenario.signals[1].id);
    expect(result?.targets).toEqual([{ source: "onset", time: scenario.duration },
      { source: "marker", time: 0 }, { source: "start", time: 0 }]);
  });
  it("never invents an onset for the no-deviation choice", () => {
    const result = trainingReplay({ ...record, scenarioId: "oxidation-reference-a-01", signal: "none", onset: -1, marker: null });
    expect(result?.targets).toEqual([{ source: "start", time: 0 }]);
    expect(result?.signalId).toBe("film");
  });
  it.each([-1, 91, 3.5, NaN, Infinity])("does not navigate to invalid saved time %s", time => {
    expect(trainingReplay({ ...record, onset: time, marker: time })?.targets).toEqual([{ source: "start", time: 0 }]);
  });
  it("keeps a valid marker when the onset or chosen signal is unavailable", () => {
    expect(trainingReplay({ ...record, signal: "unknown", onset: 45 })?.targets)
      .toEqual([{ source: "marker", time: 5 }, { source: "start", time: 0 }]);
  });
  it.each(["wafer", "unknown", "wafer-surface-a-02"])("does not silently remap unknown record version %s", scenarioId => {
    expect(trainingReplay({ ...record, scenarioId })).toBeUndefined();
  });
  it("keeps onset and marker distinct when both are zero and never mutates the saved choices", () => {
    const saved = Object.freeze({ ...record, onset: 0, marker: 0 });
    expect(trainingReplay(saved)?.targets).toHaveLength(3);
    expect(saved).toEqual({ ...record, onset: 0, marker: 0 });
  });
});

describe("read-only record-to-evidence navigation", () => {
  beforeEach(() => {
    mock.states = []; mock.cursor = 0; mock.language = "ko"; mock.owner = 41;
    mock.response = { userId: 41, attempt: { ...record } };
  });
  it.each([
    ["ko", "내 시작 판단 00:45 보기", "내 표시 00:05 보기", "기록 처음 보기"],
    ["en", "View my onset choice 00:45", "View my marker 00:05", "View record start"],
    ["ja", "自分の開始判断 00:45 を見る", "自分の印 00:05 を見る", "記録の最初を見る"],
  ])("connects saved choices to the slider, selected signal and exact table values in %s", (language, onset, marker, start) => {
    mock.language = language;
    const initial = render();
    expect(slider(initial).props.value).toBe(45);
    expect(signal(initial).props.value).toBe("thickness");
    signal(initial).props.onChange({ target: { value: "surface" } });
    button(render(), marker).props.onClick();
    const marked = render();
    expect(slider(marked).props.value).toBe(5);
    expect(signal(marked).props.value).toBe("thickness");
    expect(elements(marked).find(e => e.props.stroke === "#71b7f0")?.props.x).toBe(5);
    const row = elements(marked).find(e => e.type === "tr" && e.props["aria-current"] === "true")!;
    expect(text(row)).toContain(processSample(processScenarios[0], "thickness", 5).value.toFixed(1));
    button(marked, onset).props.onClick(); expect(slider(render()).props.value).toBe(45);
    button(render(), start).props.onClick(); expect(slider(render()).props.value).toBe(0);
    slider(render()).props.onChange({ target: { value: "17" } });
    expect(slider(render()).props.value).toBe(17);
    expect(mock.response.attempt).toEqual(record);
  });
  it("does not replace a no-deviation choice with a guessed onset", () => {
    mock.response.attempt = { ...record, scenarioId: "oxidation-reference-a-01", signal: "none", onset: -1, marker: null };
    const tree = render();
    expect(slider(tree).props.value).toBe(0);
    expect(elements(tree).filter(e => e.type === "button")).toHaveLength(1);
    expect(elements(tree).filter(e => e.type === "button").map(e => text(e.props.children)))
      .toEqual(["기록 처음 보기"]);
  });
  it.each([null, 99])("never displays another account's record or replay controls to %s", owner => {
    mock.owner = owner;
    expect(slider(render())).toBeUndefined();
    expect(text(render())).not.toContain("00:45");
  });
});
