import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("risk-aware chatbot quick prompts contract", () => {
  it("selects a dedicated prompt group for every real-time risk level", () => {
    expect(dashboardSource).toContain("function getQuickChatPrompts(riskLevel: RiskLevel, lang: Lang)");
    expect(dashboardSource).toContain("normal: {");
    expect(dashboardSource).toContain("caution: {");
    expect(dashboardSource).toContain("warning: {");
    expect(dashboardSource).toContain("danger: {");
    expect(dashboardSource).toContain("const quickChatPrompts = getQuickChatPrompts(riskLevel, lang)");
  });

  it("keeps risk-aware recommendations localized, accessible, and wired to the existing send flow", () => {
    expect(dashboardSource).toContain("상태 추천");
    expect(dashboardSource).toContain("状態の推奨");
    expect(dashboardSource).toContain("recommendations");
    expect(dashboardSource).toContain("quickChatPrompts.map((chip, cIdx)");
    expect(dashboardSource).toContain("setQuickPromptStatus(lang === \"ko\"");
    expect(dashboardSource).toContain("추천 질문을 전송합니다:");
    expect(dashboardSource).toContain("void handleSendChatMessage(chip);");
  });
});
