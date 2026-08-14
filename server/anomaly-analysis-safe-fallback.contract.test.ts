import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

describe("anomaly analysis safe fallback contract", () => {
  it("builds a sensor-evidence fallback in Korean, English, and Japanese", () => {
    expect(routerSource).toContain("const buildFallbackAnalysis = (fallbackLang: ChatLanguage) =>");
    expect(routerSource).toContain("규칙 기반 센서 이상 감지 (AI 분석 대체)");
    expect(routerSource).toContain("ルールベースのセンサー異常検知（AI分析の代替）");
    expect(routerSource).toContain("Rule-based sensor anomaly detected (AI analysis fallback)");
    expect(routerSource).toContain("buildEvidenceGate({ current, temperature, vibration, noise, anomalyScore, riskLevel }, fallbackLang)");
  });

  it("uses the safe fallback only when each language-specific LLM result fails", () => {
    expect(routerSource).toContain('const koData = koResult.status === "fulfilled" ? koResult.value : buildFallbackAnalysis("ko")');
    expect(routerSource).toContain('const enData = enResult.status === "fulfilled" ? enResult.value : buildFallbackAnalysis("en")');
    expect(routerSource).toContain('const jaData = jaResult.status === "fulfilled" ? jaResult.value : buildFallbackAnalysis("ja")');
    expect(routerSource).toContain("현재 수치만으로 특정 고장 원인을 단정할 수는 없습니다.");
  });
});
