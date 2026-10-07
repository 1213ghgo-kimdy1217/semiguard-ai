import { beforeEach, describe, expect, it, vi } from "vitest";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { TrainingCheckpoint } from "../client/src/components/TrainingCheckpoint";
import { restoreTrainingDraft, type TrainingDraft } from "../shared/trainingDraft";

// Exercise the component's explicit handlers without browser storage or a live DB.
const mock = vi.hoisted(() => ({
  states: [] as unknown[], cursor: 0, owner: { current: 41 as number | null },
  refs: [] as any[], refCursor: 0, effects: [] as (() => void)[],
  readiness: { data: { ready: true }, isLoading: false },
  query: { data: undefined as any, isLoading: false, isError: false, refetch: vi.fn() },
  mutation: { isPending: false, mutateAsync: vi.fn() },
}));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useRef: (initial: unknown) => {
    const index = mock.refCursor++;
    return mock.refs[index] ??= index === 0 ? mock.owner : { current: initial };
  },
  useId: () => "checkpoint-confirmation",
  useEffect: (effect: () => void) => { mock.effects.push(effect); },
  useState: (initial: unknown) => {
    const index = mock.cursor++;
    if (!(index in mock.states)) mock.states[index] = initial;
    return [mock.states[index], (value: unknown) => { mock.states[index] = value; }];
  },
}));
vi.mock("../client/src/lib/trpc", () => ({ trpc: { training: {
  draftStorage: { useQuery: () => mock.readiness },
  drafts: { useQuery: () => mock.query },
  saveDraft: { useMutation: () => mock.mutation },
} } }));

const draft: TrainingDraft = { version: 1, scenarioId: "etch-chamber-a-01", elapsed: 54,
  marker: 40, stage: "observe", signal: "pressure", onset: "40", comparison: "same-phase", certainty: "uncertain" };
const capture = vi.fn(() => draft);
const restore = vi.fn();
const props = { userId: 41, language: "ko" as const, scenarioId: draft.scenarioId, capture, restore };
function render(extra: Record<string, unknown> = {}) {
  mock.cursor = 0; mock.refCursor = 0; mock.effects = [];
  const tree = TrainingCheckpoint({ ...props, ...extra });
  for (const element of elements(tree)) {
    if (element.type === "button" && element.props.ref) {
      element.props.ref.current ??= { focus: vi.fn() };
    }
  }
  mock.effects.forEach(effect => effect());
  return tree;
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
  return elements(tree).find(element => element.type === "button" && text(element.props.children) === label);
}

describe("checkpoint recovery after submitting an exercise", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mock.states = []; mock.cursor = 0; mock.owner.current = 41;
    mock.refs = []; mock.refCursor = 0; mock.effects = [];
    mock.readiness = { data: { ready: true }, isLoading: false };
    mock.query.data = { userId: 41, drafts: [{ ...draft, updatedAt: "2026-10-04T00:00:00Z" }] };
    mock.query.isLoading = false; mock.query.isError = false;
    mock.mutation.isPending = false; mock.mutation.mutateAsync.mockResolvedValue({ saved: true });
  });

  it.each([
    ["ko", "저장본 불러오기", "현재 지점 저장", "계정에 저장된 제출 기록은 바뀌지 않습니다"],
    ["en", "Load checkpoint", "Save current point", "Submitted records saved to your account remain unchanged"],
    ["ja", "保存内容を読み込む", "現在の時点を保存", "アカウントに保存した提出記録は変わりません"],
  ])("offers load-only recovery in %s without capturing a completed result", (language, load, save, disclosure) => {
    const tree = render({ resumeOnly: true, language });
    expect(button(tree, load)).toBeDefined(); expect(button(tree, save)).toBeUndefined();
    expect(text(tree)).toContain(disclosure);
    expect(capture).not.toHaveBeenCalled(); expect(restore).not.toHaveBeenCalled();
    expect(mock.mutation.mutateAsync).not.toHaveBeenCalled();
  });

  it("requires confirmation and cancel leaves the completed attempt untouched", () => {
    button(render({ resumeOnly: true }), "저장본 불러오기")!.props.onClick();
    const confirmation = render({ resumeOnly: true });
    expect(text(confirmation)).toContain("서술형 입력은 비워집니다");
    expect(restore).not.toHaveBeenCalled();
    button(confirmation, "취소")!.props.onClick();
    expect(button(render({ resumeOnly: true }), "불러오기")).toBeUndefined();
    expect(restore).not.toHaveBeenCalled(); expect(mock.mutation.mutateAsync).not.toHaveBeenCalled();
  });

  it.each([
    ["ko", "저장본 불러오기", "취소"],
    ["en", "Load checkpoint", "Cancel"],
    ["ja", "保存内容を読み込む", "キャンセル"],
  ])("keeps confirmation and cancellation keyboard focus in %s", (language, load, cancel) => {
    const opener = button(render({ language }), load)!;
    opener.props.onClick();
    const confirmation = render({ language });
    const dialog = elements(confirmation).find(element => element.props.role === "alertdialog")!;
    const cancelButton = button(confirmation, cancel)!;
    expect(dialog).toBeDefined();
    expect(dialog.props["aria-modal"]).toBe(false);
    expect(dialog.props["aria-labelledby"]).toBeTruthy();
    expect(opener.props["aria-controls"]).toBeUndefined();
    expect(button(confirmation, load)!.props["aria-controls"]).toBe(dialog.props.id);
    expect(cancelButton.props.ref.current.focus).toHaveBeenCalled();
    cancelButton.props.onClick();
    expect(opener.props.ref.current.focus).toHaveBeenCalledTimes(1);
    expect(elements(render({ language })).some(element => element.props.role === "alertdialog")).toBe(false);
    expect(restore).not.toHaveBeenCalled(); expect(capture).not.toHaveBeenCalled();
    expect(mock.mutation.mutateAsync).not.toHaveBeenCalled();
  });

  it("Escape cancels confirmation without loading or saving and restores the opener", () => {
    const opener = button(render(), "저장본 불러오기")!;
    opener.props.onClick();
    const dialog = elements(render()).find(element => element.props.role === "alertdialog")!;
    const event = { key: "Escape", preventDefault: vi.fn() };
    dialog.props.onKeyDown(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(opener.props.ref.current.focus).toHaveBeenCalledTimes(1);
    expect(button(render(), "불러오기")).toBeUndefined();
    expect(restore).not.toHaveBeenCalled(); expect(mock.mutation.mutateAsync).not.toHaveBeenCalled();
  });

  it("returns focus to a stable control after loading without relying on a stage change", () => {
    const opener = button(render(), "저장본 불러오기")!;
    opener.props.onClick();
    button(render(), "불러오기")!.props.onClick();
    expect(restore).toHaveBeenCalledWith(draft);
    expect(opener.props.ref.current.focus).toHaveBeenCalledTimes(1);
    expect(button(render(), "불러오기")).toBeUndefined();
    expect(mock.mutation.mutateAsync).not.toHaveBeenCalled();
  });

  it("restores only a confirmed draft, paused and unsubmitted, without a save or deletion", () => {
    button(render({ resumeOnly: true }), "저장본 불러오기")!.props.onClick();
    button(render({ resumeOnly: true }), "불러오기")!.props.onClick();
    expect(restore).toHaveBeenCalledTimes(1); expect(restore).toHaveBeenCalledWith(draft);
    const attempt = restoreTrainingDraft(restore.mock.calls[0][0]);
    expect(attempt).toMatchObject({ elapsed: 54, marker: 40, submitted: false, answer: { facts: "", checks: "", onset: "40" } });
    expect(attempt).not.toHaveProperty("saveKey");
    expect(text(render())).toContain("일시정지 상태로 이어갑니다");
    expect(capture).not.toHaveBeenCalled(); expect(mock.mutation.mutateAsync).not.toHaveBeenCalled();
  });

  it.each(["disabled", "isPending"])("blocks loading, including a pending confirmation, while %s", flag => {
    button(render({ resumeOnly: true }), "저장본 불러오기")!.props.onClick();
    if (flag === "isPending") mock.mutation.isPending = true;
    const extra = { resumeOnly: true, disabled: flag === "disabled" };
    const tree = render(extra);
    expect(button(tree, "저장본 불러오기")!.props.disabled).toBe(true);
    expect(button(tree, "불러오기")!.props.disabled).toBe(true);
    button(tree, "불러오기")!.props.onClick();
    expect(restore).not.toHaveBeenCalled();
  });

  it.each([null, 99])("never offers another account's checkpoint to owner %s", userId => {
    const tree = render({ resumeOnly: true, userId });
    expect(button(tree, "저장본 불러오기")).toBeUndefined();
    expect(text(tree)).not.toContain("54초"); expect(restore).not.toHaveBeenCalled();
  });

  it("keeps the existing explicit save action for an unsubmitted draft", async () => {
    button(render(), "현재 지점 저장")!.props.onClick();
    await Promise.resolve();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(mock.mutation.mutateAsync).toHaveBeenCalledTimes(1); expect(mock.mutation.mutateAsync).toHaveBeenCalledWith(draft);
    expect(restore).not.toHaveBeenCalled();
  });

  it("shows unavailable checkpoints without replacing or fabricating saved data", () => {
    mock.query.data = undefined; mock.query.isError = true;
    const tree = render({ resumeOnly: true });
    expect(button(tree, "저장본 불러오기")).toBeUndefined();
    expect(text(tree)).toContain("저장본 목록을 불러오지 못했습니다");
    expect(restore).not.toHaveBeenCalled(); expect(capture).not.toHaveBeenCalled();
  });

  it("keeps checkpoint recovery reachable in both engines and blocks it during result saving", () => {
    for (const page of ["EtchTraining", "ProcessTraining"]) {
      const source = readFileSync(`client/src/pages/${page}.tsx`, "utf8");
      expect(source).toContain("resumeOnly={attempt.submitted}");
      expect(source).toContain('disabled={saveStatus === "saving"}');
      expect(source).not.toMatch(/!attempt\.submitted\s*\?\s*<TrainingCheckpoint/);
    }
    const etch = readFileSync("client/src/pages/EtchTraining.tsx", "utf8");
    expect(etch).toMatch(/SavedCheckpointList[^\n]+onEtch=\{\(\) => move\(attempt\.submitted \? "review" : "brief"\)\}/);
  });
});
