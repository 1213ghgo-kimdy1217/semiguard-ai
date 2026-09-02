import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const readDocument = (filename: string) =>
  readFileSync(resolve(projectRoot, filename), "utf8");

const readme = readDocument("README.md");
const handover = readDocument("CHATGPT_HANDOVER.md");
const startPrompt = readDocument("CHATGPT_START_PROMPT.md");

describe("ChatGPT handover contract", () => {
  it("keeps the handover documents discoverable from the repository README", () => {
    expect(existsSync(resolve(projectRoot, "CHATGPT_HANDOVER.md"))).toBe(true);
    expect(existsSync(resolve(projectRoot, "CHATGPT_START_PROMPT.md"))).toBe(
      true
    );
    expect(readme).toContain("[ChatGPT 이전 안내](CHATGPT_HANDOVER.md)");
    expect(readme).toContain(
      "[ChatGPT 시작 프롬프트](CHATGPT_START_PROMPT.md)"
    );
  });

  it("preserves project facts, evidence limits, and safe upload boundaries", () => {
    expect(handover).toContain("김대영(팀장), 김승현(팀원) — **2명으로 고정**");
    expect(handover).toContain("규칙형 위험 점수");
    expect(handover).toContain("실제 응답과 익명 인용 사용 동의를 받은 인터뷰 4건");
    expect(handover).toContain("가짜 인터뷰·가짜 인용·가짜 수치 금지");
    expect(handover).toContain("ChatGPT에 올리지 않을 것");
    expect(handover).not.toContain("P-01 —");
    expect(handover).not.toContain("w2-interview-private");
  });

  it("gives ChatGPT an explicit, safe continuation prompt", () => {
    expect(startPrompt).toContain("CHATGPT_HANDOVER.md를 먼저 읽고");
    expect(startPrompt).toContain("가짜 인터뷰, 가짜 인용, 가짜 통계");
    expect(startPrompt).toContain("외부에 영향을 주는 행동은 직접 실행하지 말고");
    expect(startPrompt).not.toContain("TEST-2026-V1");
  });
});
