import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("RAG manual query recovery contract", () => {
  it("distinguishes manual list, search, and source preview failures", () => {
    expect(dashboardSource).toContain("manualDocumentsQuery.isError");
    expect(dashboardSource).toContain("manualDocumentSearchQuery.isError");
    expect(dashboardSource).toContain("manualPreviewQuery.isError");
    expect(dashboardSource).toContain("매뉴얼 목록을 불러오지 못했습니다.");
    expect(dashboardSource).toContain("매뉴얼 검색 결과를 불러오지 못했습니다.");
    expect(dashboardSource).toContain("원문을 불러오지 못했습니다.");
  });

  it("keeps each manual request retryable without conflating it with an empty state", () => {
    expect(dashboardSource).toContain("void manualDocumentsQuery.refetch()");
    expect(dashboardSource).toContain("void manualDocumentSearchQuery.refetch()");
    expect(dashboardSource).toContain("void manualPreviewQuery.refetch()");
    expect(dashboardSource).toContain("manualDocumentsQuery.isFetching");
    expect(dashboardSource).toContain("manualDocumentSearchQuery.isFetching");
    expect(dashboardSource).toContain("manualPreviewQuery.isFetching");
  });

  it("exposes each manual retry as busy while a replacement request is in flight", () => {
    expect(dashboardSource).toContain('aria-busy={manualDocumentsQuery.isFetching || undefined}');
    expect(dashboardSource).toContain('aria-busy={manualDocumentSearchQuery.isFetching || undefined}');
    expect(dashboardSource).toContain('aria-busy={manualPreviewQuery.isFetching || undefined}');
  });

  it("announces localized list, search, and source loading states as atomic polite statuses", () => {
    expect(dashboardSource).toContain('"매뉴얼 목록을 불러오는 중..."');
    expect(dashboardSource).toContain('"매뉴얼 제목과 원문을 검색하는 중..."');
    expect(dashboardSource).toContain('"원문을 불러오는 중..."');
    expect(dashboardSource.match(/role="status" aria-live="polite" aria-atomic="true"/g)?.length).toBeGreaterThan(2);
  });

  it("announces localized list, search, and source failures as atomic alerts", () => {
    expect(dashboardSource).toMatch(
      /manualDocumentsQuery\.isError \? \(\s*<div[^>]*role="alert"[^>]*aria-atomic="true"/
    );
    expect(dashboardSource).toMatch(
      /manualDocumentSearchQuery\.isError \? \(\s*<div[^>]*role="alert"[^>]*aria-atomic="true"/
    );
    expect(dashboardSource).toMatch(
      /manualPreviewQuery\.isError \? \(\s*<div[^>]*role="alert"[^>]*aria-atomic="true"/
    );
  });

  it("keeps the manual list failure message while hiding its decorative warning symbol", () => {
    expect(dashboardSource).toContain('<p><span aria-hidden="true">⚠️</span>{" "}{lang === "ko" ? "매뉴얼 목록을 불러오지 못했습니다."');
  });
});
