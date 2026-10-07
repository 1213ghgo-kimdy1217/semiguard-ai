import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import LearningAssistant from "../client/src/components/LearningAssistant";

const mock = vi.hoisted(() => ({
  states: [] as unknown[], cursor: 0,
  refs: [] as { current: unknown }[], refCursor: 0,
  effects: [] as { dependencies: unknown[]; cleanup?: () => void }[], effectCursor: 0,
  language: "ko", userId: 41 as number | null,
  mutateAsync: vi.fn(), mutationOptions: undefined as unknown,
}));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = mock.cursor++;
    if (!(index in mock.states)) mock.states[index] = initial;
    return [mock.states[index], (value: unknown) => {
      mock.states[index] = typeof value === "function" ? value(mock.states[index]) : value;
    }];
  },
  useRef: (initial: unknown) => mock.refs[mock.refCursor++] ??= { current: initial },
  useEffect: (effect: () => void | (() => void), dependencies: unknown[]) => {
    const index = mock.effectCursor++;
    const previous = mock.effects[index];
    if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
      previous?.cleanup?.();
      mock.effects[index] = { dependencies, cleanup: effect() || undefined };
    }
  },
}));
vi.mock("@radix-ui/react-dialog", () => ({
  Root: "dialog-root", Trigger: "dialog-trigger", Portal: "dialog-portal",
  Content: "dialog-content", Title: "dialog-title", Close: "dialog-close", Description: "dialog-description",
}));
vi.mock("wouter", () => ({ Link: "a", useLocation: () => ["/training"] }));
vi.mock("../client/src/lib/productLanguage", () => ({
  useProductLanguage: () => [mock.language],
  tr: (language: string, ko: string, en: string, ja: string) => language === "ja" ? ja : language === "en" ? en : ko,
}));
vi.mock("../client/src/lib/trpc", () => ({ trpc: {
  auth: { me: { useQuery: () => ({ data: mock.userId === null ? null : { id: mock.userId } }) } },
  learning: { ask: { useMutation: (options: unknown) => {
    mock.mutationOptions = options; return { mutateAsync: mock.mutateAsync };
  } } },
} }));

function render() {
  mock.cursor = 0; mock.refCursor = 0; mock.effectCursor = 0;
  const component = LearningAssistant() as ReactElement<any>;
  return (component.type as (props: any) => ReactNode)(component.props);
}
function elements(node: ReactNode): ReactElement<any>[] {
  return Children.toArray(node).flatMap(child => isValidElement(child)
    ? [child, ...elements((child.props as any).children)] : []);
}
function input(tree: ReactNode) { return elements(tree).find(element => element.type === "textarea")!; }
function form(tree: ReactNode) { return elements(tree).find(element => element.type === "form")!; }
function submit(tree: ReactNode) { return elements(tree).find(element => element.type === "button" && element.props.type === "submit")!; }
function compose(question = "  가상 기록의 정상 참고는 왜 비교하나요?  ") {
  const tree = render();
  input(tree).props.onChange({ target: { value: question } });
  elements(tree).find(element => element.type === "input" && element.props.type === "checkbox")!
    .props.onChange({ target: { checked: true } });
  return render();
}
async function send(tree: ReactNode) {
  const event = { preventDefault: vi.fn() };
  form(tree).props.onSubmit(event);
  expect(event.preventDefault).toHaveBeenCalledOnce();
  expect(input(render()).props.disabled).toBe(true);
  await Promise.resolve();
  await Promise.resolve();
  return render();
}

describe("learning assistant manual retry preserves failed questions", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mock.states = []; mock.refs = []; mock.effects = [];
    mock.language = "ko"; mock.userId = 41; mock.mutationOptions = undefined;
    // The test runner uses classic JSX; the production Vite build uses automatic JSX.
    vi.stubGlobal("React", React);
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(["ko", "en", "ja"])("restores a cooldown question in %s without automatic resubmission", async language => {
    mock.language = language;
    mock.mutateAsync.mockResolvedValue({ status: "unavailable", reason: "cooldown" });
    const tree = await send(compose());
    expect(input(tree).props.value).toBe("가상 기록의 정상 참고는 왜 비교하나요?");
    expect(input(tree).props.disabled).toBe(false);
    expect(submit(tree).props.disabled).toBe(false);
    expect(mock.mutateAsync).toHaveBeenCalledOnce();
    expect(mock.mutateAsync).toHaveBeenCalledWith({ consent: true, language, question: "가상 기록의 정상 참고는 왜 비교하나요?" });
    expect(mock.mutationOptions).toEqual({ retry: false });
  });

  it.each(["not-configured", "provider-error", "invalid-response"])("keeps the question editable after %s", async reason => {
    mock.mutateAsync.mockResolvedValue({ status: "unavailable", reason });
    const tree = await send(compose());
    expect(input(tree).props.value).toBe("가상 기록의 정상 참고는 왜 비교하나요?");
    expect(input(tree).props.disabled).toBe(false);
    expect(mock.mutateAsync).toHaveBeenCalledOnce();
  });

  it("restores a rejected request and permits editing before an explicit retry", async () => {
    mock.mutateAsync.mockRejectedValueOnce(new Error("offline"));
    const failed = await send(compose());
    expect(input(failed).props.value).toBe("가상 기록의 정상 참고는 왜 비교하나요?");
    expect(elements(failed).some(element => element.props.role === "alert")).toBe(true);
    input(failed).props.onChange({ target: { value: "가상 기록의 단위가 서로 다르면 어떻게 비교하나요?" } });
    expect(mock.mutateAsync).toHaveBeenCalledOnce();
    mock.mutateAsync.mockResolvedValueOnce({ status: "ready", provider: "nvidia", model: "test", answer: "가상 값은 단위를 구분해서 각 참고 범위와 비교하세요.", destination: "none" });
    const retried = await send(render());
    expect(mock.mutateAsync).toHaveBeenCalledTimes(2);
    expect(mock.mutateAsync).toHaveBeenLastCalledWith({ consent: true, language: "ko", question: "가상 기록의 단위가 서로 다르면 어떻게 비교하나요?" });
    expect(input(retried).props.value).toBe("");
  });

  it("leaves successful questions cleared, with one request and no repeat", async () => {
    mock.mutateAsync.mockResolvedValue({ status: "ready", provider: "nvidia", model: "test", answer: "가상 기록을 같은 조건의 정상 참고와 비교하세요.", destination: "none" });
    const tree = await send(compose());
    expect(input(tree).props.value).toBe("");
    expect(submit(tree).props.disabled).toBe(true);
    expect(mock.mutateAsync).toHaveBeenCalledOnce();
  });

  it("does not restore an old account's question after unmount", async () => {
    let reject!: (error: Error) => void;
    mock.mutateAsync.mockImplementationOnce(() => new Promise((_, rejectRequest) => { reject = rejectRequest; }));
    form(compose()).props.onSubmit({ preventDefault() {} });
    expect(input(render()).props.value).toBe("");
    mock.effects[0].cleanup!();
    reject(new Error("late response"));
    await Promise.resolve(); await Promise.resolve();
    expect(mock.states[1]).toBe("");
    expect(mock.mutateAsync).toHaveBeenCalledOnce();
  });

  it("cannot send before consent and never enables a guest question form", () => {
    const tree = render();
    input(tree).props.onChange({ target: { value: "가상 데이터 질문" } });
    form(render()).props.onSubmit({ preventDefault() {} });
    expect(mock.mutateAsync).not.toHaveBeenCalled();
    mock.userId = null;
    expect(form(render())).toBeUndefined();
    expect(mock.mutateAsync).not.toHaveBeenCalled();
  });
});
