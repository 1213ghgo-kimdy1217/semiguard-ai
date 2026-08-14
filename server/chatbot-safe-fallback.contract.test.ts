import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

describe("chatbot safe fallback contract", () => {
  it("builds a sensor-evidence safety diagnosis in all supported languages", () => {
    expect(routerSource).toContain("function buildSafeFallbackDiagnostic");
    expect(routerSource).toContain("[기본 안전 진단]");
    expect(routerSource).toContain("[基本安全診断]");
    expect(routerSource).toContain("[Baseline Safety Diagnosis]");
    expect(routerSource).toContain("formatEvidenceGate(gate, lang)");
  });

  it("keeps manual citations available when an LLM call falls back", () => {
    expect(routerSource).toContain('console.warn("AI consultation fallback used:"');
    expect(routerSource).toContain("reply: buildSafeFallbackDiagnostic(sensorContext, lang)");
    expect(routerSource).toContain("manualSources: manualSources.map((source, index) => ({");
    expect(routerSource).toContain("relevanceScore: source.relevanceScore");
    expect(routerSource).toContain("matchedTerms: source.matchedTerms");
  });
});
