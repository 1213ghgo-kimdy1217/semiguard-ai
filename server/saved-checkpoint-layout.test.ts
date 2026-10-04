import { beforeEach, describe, expect, it, vi } from "vitest";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { SavedCheckpointList } from "../client/src/components/TrainingCheckpoint";
import { processScenarios } from "../shared/processScenarios";

const mock = vi.hoisted(() => ({ ready: true, query: {} as any, options: [] as any[] }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: { training: {
  draftStorage: { useQuery: (_: unknown, options: unknown) => { mock.options.push(options); return { data: { ready: mock.ready } }; } },
  drafts: { useQuery: (_: unknown, options: unknown) => { mock.options.push(options); return mock.query; } },
} } }));
function elements(node: ReactNode): ReactElement<any>[] {
  return Children.toArray(node).flatMap(child => isValidElement(child) ? [child, ...elements((child.props as any).children)] : []);
}
function text(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement(child) ? text((child.props as any).children) : String(child)).join("");
}
const onEtch = vi.fn();
const render = (language: "ko" | "en" | "ja" = "ko", userId: number | null = 41) => SavedCheckpointList({ language, userId, onEtch });

describe("saved checkpoints as separate resumable cards", () => {
  beforeEach(() => {
    mock.ready = true; mock.options = []; onEtch.mockClear();
    mock.query = { isLoading: false, isError: false, data: { userId: 41, drafts: [
      { scenarioId: processScenarios[4].id, elapsed: 6, updatedAt: new Date("2026-10-04T10:47:11Z") },
      { scenarioId: processScenarios[3].id, elapsed: 54, updatedAt: new Date("2026-10-03T21:10:24Z") },
      { scenarioId: processScenarios[0].id, elapsed: 90, updatedAt: new Date("2026-10-03T21:06:36Z") },
    ] } };
  });
  it.each([["ko", "연습 열기", "6초에서 저장"], ["en", "Open exercise", "Saved at 6s"], ["ja", "練習を開く", "6秒で保存"]] as const)("separates titles, positions, timestamps and explicit entry actions in %s", (language, action, position) => {
    const tree = render(language); const es = elements(tree);
    expect(es.filter(e => e.type === "li")).toHaveLength(3);
    expect(es.filter(e => e.type === "h3").map(e => text(e.props.children))).toEqual([processScenarios[4], processScenarios[3], processScenarios[0]].map(s => s.title[language === "ko" ? 0 : language === "en" ? 1 : 2]));
    expect(text(tree)).toContain(position);
    expect(es.filter(e => e.type === "time").map(e => e.props.dateTime)).toEqual(mock.query.data.drafts.map((d: any) => d.updatedAt.toISOString()));
    const actions = es.filter(e => e.props.className === "et-linkbutton et-checkpoint-open");
    expect(actions).toHaveLength(3); expect(actions.every(e => text(e.props.children).includes(action))).toBe(true);
    expect(actions.every(e => e.props["aria-label"].includes(action))).toBe(true);
    expect(actions[0].props.href).toBe("/training/process/deposition"); expect(actions[2].props.href).toBe("/training/process/wafer");
    expect(onEtch).not.toHaveBeenCalled(); actions[1].props.onClick(); expect(onEtch).toHaveBeenCalledOnce();
  });
  it("does not reveal cached saved cards to guests or another owner", () => {
    expect(render("ko", null)).toBeNull(); expect(mock.options.every(o => o.enabled === false)).toBe(true);
    mock.options = []; const tree = render("ko", 99);
    expect(elements(tree).filter(e => e.type === "li")).toHaveLength(0); expect(text(tree)).not.toContain("6초에서 저장");
  });
  it("preserves unavailable, loading, error and empty list states", () => {
    mock.ready = false; expect(render()).toBeNull();
    mock.ready = true; mock.query.isLoading = true; expect(text(render())).toContain("불러오는 중");
    mock.query.isLoading = false; mock.query.isError = true; expect(text(render())).toContain("중간 저장 목록을 사용할 수 없습니다");
    mock.query.isError = false; mock.query.data.drafts = []; expect(text(render())).toContain("아직 계정에 중간 저장한 연습이 없습니다");
  });
  it("ignores unknown module IDs instead of making broken routes", () => {
    mock.query.data.drafts.push({ scenarioId: "unknown-module", elapsed: 12, updatedAt: "2026-10-04T10:00:00Z" });
    expect(elements(render()).filter(e => e.type === "li")).toHaveLength(3);
  });
  it("scopes roomy responsive layout and focus styles to the checkpoint list", () => {
    const css = readFileSync("client/src/components/training-checkpoint.css", "utf8");
    expect(css).toContain(".et-saved-checkpoints"); expect(css).toContain("gap: 16px");
    expect(css).toContain("minmax(0, 1fr)"); expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain("@media (max-width: 640px)"); expect(css).toContain(":focus-visible");
  });
});
