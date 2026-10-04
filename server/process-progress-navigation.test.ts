import { beforeEach, describe, expect, it, vi } from "vitest";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { processScenarios, scenarioHref } from "../shared/processScenarios";
import ProcessScenarioPath from "../client/src/components/ProcessScenarioPath";

const mock = vi.hoisted(() => ({ view: false, query: {} as any, options: {} as any }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: () => [mock.view, (value: boolean) => { mock.view = value; }],
}));
vi.mock("../client/src/lib/trpc", () => ({ trpc: { training: { progress: { useQuery: (_: unknown, options: unknown) => {
  mock.options = options; return mock.query;
} } } } }));
function elements(node: ReactNode): ReactElement<any>[] {
  return Children.toArray(node).flatMap(child => isValidElement(child) ? [child, ...elements((child.props as any).children)] : []);
}
function text(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement(child) ? text((child.props as any).children) : String(child)).join("");
}
const etch = vi.fn();
const render = (userId: number | null = 42, language: "ko" | "en" | "ja" = "ko") => ProcessScenarioPath({ userId, language, onEtch: etch });
const buttons = (tree: ReactNode) => elements(tree).filter(e => e.type === "button");
const cards = (tree: ReactNode) => elements(tree).filter(e => e.type === "li");
const nextLink = (tree: ReactNode) => elements(tree).find(e => e.props.className === "et-linkbutton process-path-next");

describe("process selection to next unsubmitted training", () => {
  beforeEach(() => {
    mock.view = false; etch.mockClear();
    mock.query = { data: { userId: 42, scenarioIds: processScenarios.slice(0, 4).map(s => s.id) },
      isError: false, isLoading: false, isFetching: false, refetch: vi.fn() };
  });
  it.each([
    ["ko", "미제출 공정만", "모든 공정", "미제출 공정 4개"],
    ["en", "Unsubmitted only", "All processes", "Unsubmitted processes: 4"],
    ["ja", "未提出の工程のみ", "すべての工程", "未提出の工程 4件"],
  ] as const)("filters pending modules and restores all eight in %s", (language, pending, all, status) => {
    let tree = render(42, language);
    expect(cards(tree)).toHaveLength(8);
    expect(nextLink(tree)?.props.href).toBe("/training/process/deposition");
    buttons(tree).find(e => text(e.props.children).startsWith(pending))!.props.onClick();
    tree = render(42, language);
    expect(cards(tree)).toHaveLength(4); expect(text(tree)).toContain(status);
    expect(buttons(tree).find(e => e.props["aria-pressed"] === true)?.props["aria-controls"]).toBe("process-path-modules");
    expect(elements(tree).filter(e => e.props.href).map(e => e.props.href)).toEqual([
      "/training/process/deposition", ...processScenarios.slice(4).map(scenarioHref),
    ]);
    buttons(tree).find(e => text(e.props.children).startsWith(all))!.props.onClick();
    expect(cards(render(42, language))).toHaveLength(8);
  });
  it("uses the existing etch handler instead of resetting or rerouting the attempt", () => {
    mock.query.data.scenarioIds = processScenarios.slice(0, 3).map(s => s.id);
    const tree = render(); const next = nextLink(tree)!;
    expect(next.type).toBe("button"); next.props.onClick(); expect(etch).toHaveBeenCalledOnce();
    expect(cards(tree)).toHaveLength(8);
  });
  it("does not present a suggestion or count for a guest", () => {
    const tree = render(null); expect(mock.options.enabled).toBe(false);
    expect(cards(tree)).toHaveLength(8); expect(nextLink(tree)).toBeUndefined();
    expect(elements(tree).find(e => e.type === "progress")).toBeUndefined();
  });
  it("keeps all modules selectable while loading, without inventing completion", () => {
    mock.query.data = undefined; mock.query.isLoading = true;
    const tree = render(); expect(cards(tree)).toHaveLength(8);
    expect(text(tree)).toContain("제출 기록을 확인하는 중");
    expect(nextLink(tree)).toBeUndefined(); expect(text(tree)).not.toContain("미제출 공정만");
  });
  it("never displays another account's cached progress or pending filter", () => {
    mock.view = true; mock.query.data.userId = 43;
    const tree = render(); expect(cards(tree)).toHaveLength(8);
    expect(nextLink(tree)).toBeUndefined(); expect(text(tree)).not.toContain("4/8");
  });
  it("allows a read-only retry after a progress error without using stale completion", () => {
    mock.query.isError = true; mock.view = true;
    const tree = render(); expect(cards(tree)).toHaveLength(8);
    expect(nextLink(tree)).toBeUndefined();
    buttons(tree).find(e => text(e.props.children) === "제출 기록 다시 불러오기")!.props.onClick();
    expect(mock.query.refetch).toHaveBeenCalledOnce();
  });
  it("explains all-submitted state without certifying ability or locking modules", () => {
    mock.query.data.scenarioIds = processScenarios.map(s => s.id); mock.view = true;
    const tree = render(); expect(cards(tree)).toHaveLength(0); expect(nextLink(tree)).toBeUndefined();
    expect(text(tree)).toContain("8개 공정의 제출 기록이 있어요");
    expect(text(tree)).toContain("모든 공정"); expect(text(tree)).not.toMatch(/숙련도 인증 완료|100% 역량|훈련 잠금/);
    const progress = elements(tree).find(e => e.type === "progress")!;
    expect(progress.props.value).toBe(8); expect(progress.props.max).toBe(8);
  });
  it("keeps filters local and resets the component when the account changes", () => {
    const source = readFileSync("client/src/pages/EtchTraining.tsx", "utf8");
    expect(source).toContain('<ProcessScenarioPath language={language} key={auth.data?.id ?? "guest"}');
    const component = readFileSync("client/src/components/ProcessScenarioPath.tsx", "utf8");
    expect(component).not.toMatch(/useMutation|localStorage|sessionStorage|\bfetch\(|\.mutate|saveDraft|saveAttempt/);
  });
  it("keeps selected-filter styling and a clear keyboard focus indicator", () => {
    const css = readFileSync("client/src/components/process-scenario-path.css", "utf8");
    expect(css).toContain('.et-app .process-path-filters button[aria-pressed="true"]');
    expect(css).toContain("background: #e4aa55; color: #17201b");
    expect(css).toContain(".et-linkbutton:focus-visible");
  });
});
