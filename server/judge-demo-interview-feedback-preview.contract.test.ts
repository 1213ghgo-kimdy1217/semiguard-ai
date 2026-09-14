import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const demoSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/JudgeDemo.tsx"),
  "utf8"
);

describe("judge-demo evidence-first direction contract", () => {
  it("implements the interview-informed fact and inference separation in all languages", () => {
    expect(demoSource).toContain('observationLabel: "관찰된 사실"');
    expect(demoSource).toContain('causeCandidateLabel: "가능한 원인 후보 · 추정"');
    expect(demoSource).toContain('observationLabel: "Observed facts"');
    expect(demoSource).toContain('causeCandidateLabel: "Possible cause candidate · inference"');
    expect(demoSource).toContain('observationLabel: "観察された事実"');
    expect(demoSource).toContain('causeCandidateLabel: "可能性のある原因候補・推定"');
    expect(demoSource).toContain("{text.observationLabel}");
    expect(demoSource).toContain("{text.causeCandidateLabel}");
    expect(demoSource).toContain("{text.causeCandidate}");
  });

  it("removes the obsolete next-week preview and avoids exposing interview evidence", () => {
    expect(demoSource).not.toContain("futureFeedbackTitle");
    expect(demoSource).not.toContain("다음 주 반영 예정");
    expect(demoSource).not.toContain("Planned next week");
    expect(demoSource).not.toContain("来週反映予定");
    expect(demoSource).not.toContain("P-01 —");
    expect(demoSource).not.toContain("삼성SDI");
    expect(demoSource).not.toContain("SFA반도체");
  });
});
