import { readFileSync } from "node:fs";
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { BoothLearningAssistant } from "../client/src/components/LearningAssistant";
import {
  applyBoothAction,
  createBoothState,
  getBoothSnapshot,
} from "./boothExperience";

const mock = vi.hoisted(() => ({
  states: [] as unknown[],
  cursor: 0,
  refs: [] as { current: unknown }[],
  refCursor: 0,
  effects: [] as { dependencies: unknown[]; cleanup?: () => void }[],
  effectCursor: 0,
  userId: 41 as number | null,
  pending: false,
  failed: false,
  ready: { loginReady: true, aiReady: true },
  mutateAsync: vi.fn(),
  refetch: vi.fn(),
}));
vi.mock("react", async original => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = mock.cursor++;
    if (!(index in mock.states)) mock.states[index] = initial;
    return [
      mock.states[index],
      (value: unknown) => {
        mock.states[index] =
          typeof value === "function" ? value(mock.states[index]) : value;
      },
    ];
  },
  useRef: (initial: unknown) =>
    (mock.refs[mock.refCursor++] ??= { current: initial }),
  useEffect: (effect: () => void | (() => void), dependencies: unknown[]) => {
    const index = mock.effectCursor++,
      previous = mock.effects[index];
    if (
      !previous ||
      dependencies.some(
        (value, i) => !Object.is(value, previous.dependencies[i])
      )
    ) {
      previous?.cleanup?.();
      mock.effects[index] = { dependencies, cleanup: effect() || undefined };
    }
  },
}));
vi.mock("@radix-ui/react-dialog", () => ({
  Root: "dialog-root",
  Trigger: "dialog-trigger",
  Portal: "dialog-portal",
  Content: "dialog-content",
  Title: "dialog-title",
  Close: "dialog-close",
  Description: "dialog-description",
}));
vi.mock("wouter", () => ({ Link: "a", useLocation: () => ["/live"] }));
vi.mock("../client/src/lib/productLanguage", () => ({
  useProductLanguage: () => ["ko"],
  tr: (_: unknown, ko: string) => ko,
}));
vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    auth: {
      me: {
        useQuery: () => ({
          data: mock.userId === null ? null : { id: mock.userId },
          isPending: mock.pending,
          isError: mock.failed,
          refetch: mock.refetch,
        }),
      },
    },
    learning: {
      ask: { useMutation: () => ({ mutateAsync: mock.mutateAsync }) },
      status: {
        useQuery: () => ({
          data: mock.ready,
          isPending: false,
          isError: false,
          refetch: mock.refetch,
        }),
      },
    },
  },
}));
let source: Parameters<typeof BoothLearningAssistant>[0];
function render() {
  mock.cursor = 0;
  mock.refCursor = 0;
  mock.effectCursor = 0;
  const component = BoothLearningAssistant(source) as ReactElement<any>;
  return (component.type as (props: any) => ReactNode)(component.props);
}
function elements(node: ReactNode): ReactElement<any>[] {
  return Children.toArray(node).flatMap(child =>
    isValidElement(child)
      ? [child, ...elements((child.props as any).children)]
      : []
  );
}
const input = (tree: ReactNode) =>
  elements(tree).find(item => item.type === "textarea")!;
const form = (tree: ReactNode) =>
  elements(tree).find(item => item.type === "form")!;
function compose() {
  const tree = render();
  input(tree).props.onChange({
    target: { value: "어떤 값을 먼저 보면 좋을까?" },
  });
  elements(tree)
    .find(item => item.type === "input" && item.props.type === "checkbox")!
    .props.onChange({ target: { checked: true } });
  return render();
}
const answer = {
  status: "ready",
  provider: "nvidia",
  model: "test",
  answer: "화면의 유량과 압력을 각각 정상 범위와 비교해보세요.",
  destination: "none",
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.states = [];
  mock.refs = [];
  mock.effects = [];
  mock.userId = 41;
  mock.pending = false;
  mock.failed = false;
  mock.ready = { loginReady: true, aiReady: true };
  vi.stubGlobal("React", React);
  const engine = applyBoothAction(
    applyBoothAction(createBoothState(33), {
      type: "set-scenario",
      scenario: "combined",
    }),
    { type: "set-mode", mode: "mission" }
  );
  source = { snapshot: getBoothSnapshot(engine), stage: "brief" };
  mock.mutateAsync.mockResolvedValue(answer);
});
afterEach(() => vi.unstubAllGlobals());

describe("contextual model Q&A", () => {
  it("captures consented send-time public values, without later live changes or private data", async () => {
    source.snapshot.values.pressure = 28.4;
    form(compose()).props.onSubmit({ preventDefault() {} });
    const request = mock.mutateAsync.mock.calls[0][0];
    source.snapshot.values.pressure = 37.8;
    await Promise.resolve();
    await Promise.resolve();
    expect(request.boothContext.values.pressure).toBe(28.4);
    expect(request.boothContext.scenarioId).toBe("combined");
    expect(Object.keys(request).sort()).toEqual([
      "boothContext",
      "consent",
      "language",
      "question",
    ]);
    expect(JSON.stringify(request)).not.toMatch(
      /matchingOptimum|gasGain|exhaustOffset|camera|reflection|userId/
    );
    const exchange = mock.states[3] as {
      context: { values: { pressure: number } };
    }[];
    expect(exchange[0].context.values.pressure).toBe(28.4);
  });
  it("sends frozen final values explicitly as review data", async () => {
    source.stage = "review";
    source.snapshot.mission.status = "won";
    source.snapshot.values.pressure = 19.6;
    form(compose()).props.onSubmit({ preventDefault() {} });
    expect(mock.mutateAsync.mock.calls[0][0].boothContext).toMatchObject({
      stage: "review",
      missionStatus: "won",
      values: { pressure: 19.6 },
    });
  });
  it("retains the question through a terminal transition instead of sending inconsistent context", () => {
    source.stage = "experience";
    source.snapshot.mission.status = "won";
    form(compose()).props.onSubmit({ preventDefault() {} });
    expect(mock.mutateAsync).not.toHaveBeenCalled();
    expect(input(render()).props.value).toBe("어떤 값을 먼저 보면 좋을까?");
    expect(elements(render()).some(item => item.props.role === "alert")).toBe(
      true
    );
  });
  it("keeps guests and unavailable login servers out of provider calls", () => {
    mock.userId = null;
    mock.failed = true;
    const tree = render();
    expect(form(tree)).toBeUndefined();
    expect(elements(tree).some(item => item.props.role === "alert")).toBe(true);
    const retry = elements(tree).find(
      item => item.type === "button" && item.props.children === "연결 다시 확인"
    );
    expect(retry).toBeDefined();
    retry!.props.onClick();
    expect(mock.refetch).toHaveBeenCalledOnce();
    expect(mock.mutateAsync).not.toHaveBeenCalled();
  });
  it("shows truthful preparation status and no unusable login link when the preview AI is unconfigured", () => {
    mock.userId = null;
    mock.ready = { loginReady: false, aiReady: false };
    const tree = render();
    expect(form(tree)).toBeUndefined();
    expect(
      elements(tree).some(
        item => item.type === "a" && item.props.href === "/login"
      )
    ).toBe(false);
    expect(elements(tree).some(item => item.props.role === "status")).toBe(
      true
    );
    expect(mock.mutateAsync).not.toHaveBeenCalled();
  });
  it("ignores a response after a run/account component unmount", async () => {
    let resolve!: (value: unknown) => void;
    mock.mutateAsync.mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        })
    );
    form(compose()).props.onSubmit({ preventDefault() {} });
    mock.effects[0].cleanup!();
    resolve(answer);
    await Promise.resolve();
    await Promise.resolve();
    expect((mock.states[3] as { result: unknown }[])[0].result).toBeNull();
  });
  it("always mounts one helper by controls, outside the hidden review section, keyed per run", () => {
    const text = readFileSync("client/src/pages/EtchLive.tsx", "utf8");
    const root = ts.createSourceFile(
      "EtchLive.tsx",
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    const helpers: ts.JsxSelfClosingElement[] = [];
    function visit(node: ts.Node) {
      if (
        ts.isJsxSelfClosingElement(node) &&
        node.tagName.getText() === "BoothLearningAssistant"
      )
        helpers.push(node);
      ts.forEachChild(node, visit);
    }
    visit(root);
    expect(helpers).toHaveLength(1);
    for (let node = helpers[0].parent; node; node = node.parent) {
      if (ts.isJsxElement(node))
        expect(
          node.openingElement.attributes.properties.some(
            item => ts.isJsxAttribute(item) && item.name.getText() === "hidden"
          )
        ).toBe(false);
      expect(
        ts.isConditionalExpression(node) ||
          (ts.isBinaryExpression(node) &&
            node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
      ).toBe(false);
    }
    const key = helpers[0].attributes.properties.find(
      item => ts.isJsxAttribute(item) && item.name.getText() === "key"
    )!;
    expect(key.getText()).toContain("completedAttempt?.id");
    expect(key.getText()).toContain("runIdRef.current");
    expect(helpers[0].getText()).toContain("snapshot={displaySnapshot}");
  });
});
