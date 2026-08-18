import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const readProjectDocument = (filename: string) => readFileSync(resolve(projectRoot, filename), "utf8");

const readme = readProjectDocument("README.md");
const aiUsage = readProjectDocument("AI_USAGE.md");
const validationPlan = readProjectDocument("VALIDATION_PLAN.md");
const pitchStoryboard = readProjectDocument("PITCH_VIDEO_STORYBOARD.md");

describe("submission documentation contract", () => {
  it("keeps all linked submission documents in the repository", () => {
    [
      "AI_USAGE.md",
      "VALIDATION_PLAN.md",
      "PITCH_VIDEO_STORYBOARD.md",
      "PRESENTATION_DEMO_SCRIPT.md",
      "W1_TEAM_GOALS.md",
      "DEPENDENCY_SECURITY_REVIEW.md",
    ].forEach(filename => {
      expect(existsSync(resolve(projectRoot, filename))).toBe(true);
      expect(readme).toContain(`](${filename})`);
    });
  });

  it("keeps the runnable account, two-person team, and read-only scope visible", () => {
    expect(readme).toContain("TEST-2026-V1");
    expect(readme).toContain("김대영");
    expect(readme).toContain("김승현");
    expect(readme).not.toContain("김경서");
    expect(readme).toContain("읽기 전용 예지안전 보조 시스템");
    expect(readme).toContain("실제 장비 제어, 레시피 변경, PLC 명령 전송 기능은 제공하지 않습니다.");
  });

  it("keeps the implemented z-score method and unvalidated simulation boundary consistent", () => {
    expect(readme).toContain("z-score 기반 규칙형 위험 점수");
    expect(readme).toContain("Isolation Forest 라이브러리가 아니라");
    expect(aiUsage).toContain("시뮬레이션 데이터");
    expect(aiUsage).toContain("실제 팹에서 검증된 경제적 성과가 아닙니다.");
    expect(validationPlan).toContain("정확도·오탐·미탐·사전 경고 시간을 측정한 결과는 아직 없습니다.");
    expect(pitchStoryboard).toContain("실제 정확도·비용 절감·설비 제어 성과를 이미 달성한 것처럼 말하지 않습니다.");
  });
});
