import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PracticeHistory, {
  historyProcessFilter,
} from "../client/src/pages/PracticeHistory";

const state = vi.hoisted(() => ({
  language: "ko" as "ko" | "en" | "ja",
  search: "",
  auth: {
    data: { id: 7 } as { id: number } | null,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  },
  history: {
    data:
      {
        userId: 7,
        attempts: [] as {
          id: number;
          scenarioId: string;
          signal: string;
          onset: number;
          marker: number | null;
          signalMatched: number;
          onsetMatched: number;
          comparisonMatched: number;
          certaintyMatched: number;
          createdAt: string;
        }[],
      } | undefined,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  },
}));
vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    auth: { me: { useQuery: () => state.auth } },
    training: { history: { useQuery: () => state.history } },
  },
}));
vi.mock("../client/src/lib/productLanguage", async original => ({
  ...(await original<typeof import("../client/src/lib/productLanguage")>()),
  useProductLanguage: () => [state.language, vi.fn()],
}));
vi.mock("wouter", async original => ({
  ...(await original<typeof import("wouter")>()),
  useSearch: () => state.search,
}));
const row = (id: number, scenarioId = "wafer-surface-a-01") => ({
  id,
  scenarioId,
  signal: scenarioId.startsWith("etch") ? "pressure" : "surface",
  onset: 45,
  marker: 5,
  signalMatched: 1,
  onsetMatched: 0,
  comparisonMatched: 1,
  certaintyMatched: 1,
  createdAt: "2026-11-06T00:00:00Z",
});
const render = () =>
  renderToStaticMarkup(
    createElement(
      Router,
      { ssrPath: "/training/history" },
      createElement(PracticeHistory)
    )
  );
describe("saved judgment review entry", () => {
  beforeEach(() => {
    state.language = "ko";
    state.search = "";
    state.auth.data = { id: 7 };
    state.auth.isLoading = false;
    state.auth.isError = false;
    state.auth.isFetching = false;
    state.history.data = {
      userId: 7,
      attempts: [row(11), row(12, "etch-chamber-a-01")],
    };
    state.history.isLoading = false;
    state.history.isError = false;
    state.history.isFetching = false;
  });
  it.each([
    ["ko", "내 학습 기록·복기"],
    ["en", "My saved practice and review"],
    ["ja", "自分の学習記録・振り返り"],
  ] as const)("opens the existing saved timeline in %s", (language, title) => {
    state.language = language;
    const html = render();
    expect(html).toContain(title);
    expect(html).toContain('href="/training/history/11"');
    expect(html).toContain('href="/training/history/12"');
    expect(html.match(/class="et-record-card"/g)).toHaveLength(2);
  });
  it("never renders cached rows during unresolved sign-in", () => {
    state.auth.isLoading = true;
    expect(render()).not.toContain('href="/training/history/11"');
    expect(render()).toContain('role="status"');
  });
  it("hides cached rows when sign-in revalidation fails", () => {
    state.auth.isError = true;
    const html = render();
    expect(html).not.toContain('href="/training/history/11"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("다시 확인");
  });
  it("does not display the previous account's cached records", () => {
    state.auth.data = { id: 8 };
    const html = render();
    expect(html).not.toContain('href="/training/history/11"');
    expect(html).not.toContain('class="et-record-list"');
    expect(html).toContain("현재 계정의 기록을 다시 확인");
  });
  it("keeps cached rows hidden after history failure and offers retry", () => {
    state.history.isError = true;
    const html = render();
    expect(html).not.toContain('href="/training/history/11"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("기록 다시 불러오기");
  });
  it("provides an honest empty state and a practice entry", () => {
    state.history.data = { userId: 7, attempts: [] };
    const html = render();
    expect(html).toContain("아직 저장된 판단 기록이 없어요.");
    expect(html).toContain('href="/training"');
    expect(html).not.toContain('class="et-record-list"');
  });
  it("filters the already saved recent records by canonical process query", () => {
    state.search = "process=etch";
    const html = render();
    expect(html).not.toContain('href="/training/history/11"');
    expect(html).toContain('href="/training/history/12"');
  });
  it("does not invent a record if a chosen process has none", () => {
    state.search = "process=eds";
    const html = render();
    expect(html).toContain("이 공정의 최근 저장 기록이 없습니다.");
    expect(html).not.toContain('class="et-record-list"');
  });
  it("filters only within the existing latest-twenty window", () => {
    state.history.data = {
      userId: 7,
      attempts: [
        ...Array.from({ length: 20 }, (_, i) => row(i + 1)),
        row(99, "etch-chamber-a-01"),
      ],
    };
    state.search = "process=etch";
    const html = render();
    expect(html).not.toContain('href="/training/history/99"');
    expect(html).toContain("이 공정의 최근 저장 기록이 없습니다.");
  });
  it.each([
    "process=invalid",
    "process=__proto__",
    "process=etch-chamber-a-01",
    "anything=etch",
  ])("ignores non-canonical process input %s", search => {
    expect(historyProcessFilter(search)).toBe("all");
  });
});
