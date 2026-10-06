import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

describe("chatbot safe fallback contract", () => {
  it("builds a rule-based synthetic sensor evidence summary in all supported languages", () => {
    expect(routerSource).toContain("function buildSafeFallbackDiagnostic");
    expect(routerSource).toContain("[규칙 기반 근거 요약]");
    expect(routerSource).toContain("[ルールベースの根拠要約]");
    expect(routerSource).toContain("[Rule-based Evidence Summary]");
    expect(routerSource).toContain("아래는 질문의 답이 아닌 현재 가상 센서의 고정 요약입니다");
    expect(routerSource).not.toContain("formatEvidenceGate(gate, lang)");
  });

  it("keeps manual citations available when an LLM call falls back", () => {
    expect(routerSource).toContain('console.warn("AI consultation fallback used:"');
    expect(routerSource).toContain("reply: buildSafeFallbackDiagnostic(sensorContext, lang)");
    expect(routerSource).toContain("manualSources: manualSources.map((source, index) => ({");
    expect(routerSource).toContain("relevanceScore: source.relevanceScore");
    expect(routerSource).toContain("matchedTerms: source.matchedTerms");
  });
});
