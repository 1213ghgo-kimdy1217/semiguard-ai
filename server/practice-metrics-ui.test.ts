import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PracticeMetrics from "../client/src/pages/PracticeMetrics";

const state = vi.hoisted(() => ({
  access: {} as any, storage: {} as any, report: {} as any,
  storageQuery: vi.fn(), reportQuery: vi.fn(),
}));
vi.mock("../client/src/lib/trpc", () => ({ trpc: { practiceMeasurement: {
  access: { useQuery: () => state.access },
  storage: { useQuery: (...args: unknown[]) => { state.storageQuery(...args); return state.storage; } },
  report: { useQuery: (...args: unknown[]) => { state.reportQuery(...args); return state.report; } },
} } }));
vi.mock("../client/src/components/PracticeMeasurement", () => ({ default: () => null }));
const reportData = { visits: 8, starts: 4, completions: 2, cohort: 4, returned: 1,
  retentionMature: false, qa: { visits: 9, starts: 7, completions: 6 }, observedAt: new Date(),
  week2Start: new Date("2026-10-20T00:00:00Z"), week2End: new Date("2026-10-27T00:00:00Z") };
const render = () => renderToStaticMarkup(createElement(Router, { ssrPath: "/training/metrics" }, createElement(PracticeMetrics)));
beforeEach(() => {
  vi.clearAllMocks();
  state.access = { isSuccess: true, isLoading: false, isError: false, data: { authenticated: true, canRead: false }, refetch: vi.fn() };
  state.storage = { data: { ready: true } };
  state.report = { data: reportData };
});
describe("practice aggregate permission UI", () => {
  it.each(["loading", "refreshing", "error", "guest", "denied"])("hides even cached aggregates and disables both data queries when %s", mode => {
    if (mode === "loading") Object.assign(state.access, { isSuccess: false, isLoading: true });
    if (mode === "refreshing") Object.assign(state.access, { isFetching: true, data: { authenticated: true, canRead: true } });
    if (mode === "error") Object.assign(state.access, { isSuccess: false, isError: true, data: { authenticated: true, canRead: true } });
    if (mode === "guest") state.access.data.authenticated = false;
    const html = render();
    expect(html).not.toContain("<table"); expect(html).not.toContain("집계 확인</button>");
    expect(state.storageQuery.mock.calls[0][1]).toMatchObject({ enabled: false, retry: false });
    expect(state.reportQuery.mock.calls[0][1]).toMatchObject({ enabled: false, retry: false });
    if (mode === "loading" || mode === "refreshing") expect(html).toContain('aria-busy="true"');
    if (mode === "error") { expect(html).toContain('role="alert"'); expect(html).toContain("권한 다시 확인"); }
    if (mode === "guest") expect(html).toContain('href="/login"');
    if (mode === "denied") expect(html).toContain("이 계정에는 집계 조회 권한이 없습니다");
  });
  it("uses the server capability, preserves aggregate caveats and separates QA", () => {
    state.access.data.canRead = true;
    const html = render();
    expect(html).toContain("<table"); expect(html).toContain("개별 이용자의 이름·답안·개인 기록은 제공하지 않는");
    expect(html).toContain("팀·테스트 제외 확인: 방문 9 / 시작 7 / 완료 6");
    expect(html).toContain("최종 재연습률은 미측정");
    expect(state.storageQuery.mock.calls[0][1]).toMatchObject({ enabled: true });
    expect(state.reportQuery.mock.calls[0][1]).toMatchObject({ enabled: true });
  });
  it("does not display a cached report as current when the server rejects it", () => {
    state.access.data.canRead = true; state.report.isError = true;
    const html = render(); expect(html).not.toContain("<table"); expect(html).toContain("0명으로 표시하지 않습니다");
  });
  it("waits for confirmed compatible storage before requesting a report", () => {
    state.access.data.canRead = true; state.storage = { isLoading: true }; state.report = {};
    expect(render()).not.toContain("<table");
    expect(state.reportQuery.mock.calls[0][1]).toMatchObject({ enabled: false });
  });
});
