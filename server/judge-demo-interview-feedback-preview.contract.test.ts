import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const demoSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/JudgeDemo.tsx"),
  "utf8"
);

describe("judge-demo interview-feedback preview contract", () => {
  it("shows an explicit, localized preview of next-week interview-informed improvements", () => {
    expect(demoSource).toContain("futureFeedbackTitle:");
    expect(demoSource).toContain("다음 주 반영 예정 · 인터뷰 기반 개선 미리보기");
    expect(demoSource).toContain(
      "Planned next week · Interview-informed improvement preview"
    );
    expect(demoSource).toContain(
      "来週反映予定・インタビューに基づく改善プレビュー"
    );
    expect(demoSource).toContain('id="judge-demo-feedback-preview-title"');
    expect(demoSource).toContain("{text.futureFeedbackItems.map");
  });

  it("keeps the preview distinct from implemented safety functions and avoids exposing interview evidence", () => {
    expect(demoSource).toContain("현재 카드는 기능 동작이 아닌 개선 방향을 보여주는 미리보기입니다.");
    expect(demoSource).toContain("실제 설비 제어·원인 확정·현장 효과를 의미하지 않습니다.");
    expect(demoSource).toContain("가능한 원인 후보");
    expect(demoSource).not.toContain("P-01 —");
    expect(demoSource).not.toContain("삼성SDI");
    expect(demoSource).not.toContain("SFA반도체");
  });
});
