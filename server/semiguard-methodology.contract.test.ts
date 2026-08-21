import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeAnomalyScore } from "./semiguard";

describe("SemiGuard risk-score methodology", () => {
  it("calculates an additive z-score risk from the documented baseline", () => {
    const normal = computeAnomalyScore({
      current: 5,
      temperature: 45,
      vibration: 2,
      noise: 55,
      timestamp: Date.now(),
    });
    const oneSensorDeviation = computeAnomalyScore({
      current: 6.5,
      temperature: 45,
      vibration: 2,
      noise: 55,
      timestamp: Date.now(),
    });
    const cappedExtreme = computeAnomalyScore({
      current: 10,
      temperature: 75,
      vibration: 5,
      noise: 95,
      timestamp: Date.now(),
    });

    expect(normal).toBe(0);
    expect(oneSensorDeviation).toBe(24);
    expect(cappedExtreme).toBe(100);
  });

  it("keeps public demo and submission documents transparent about the current scope", () => {
    const demoSource = readFileSync(
      resolve(process.cwd(), "client/src/pages/JudgeDemo.tsx"),
      "utf8"
    );
    const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
    const aiUsage = readFileSync(resolve(process.cwd(), "AI_USAGE.md"), "utf8");
    const technicalReference = readFileSync(
      resolve(process.cwd(), "TECHNICAL_REFERENCE.md"),
      "utf8"
    );
    const impactScorecard = readFileSync(
      resolve(process.cwd(), "IMPACT_EVIDENCE_SCORECARD.md"),
      "utf8"
    );
    const todo = readFileSync(resolve(process.cwd(), "todo.md"), "utf8");

    expect(demoSource).toContain("methodTitle");
    expect(demoSource).toContain(
      "Isolation Forest 라이브러리나 사전 학습된 모델은 현재 사용하지 않습니다."
    );
    expect(readme).toContain("z-score 기반 규칙형 위험 점수");
    expect(readme).toContain("abs((x - μ) / σ)");
    expect(readme).not.toContain("|(x - μ) / σ|");
    expect(readme).toContain(
      "실제 팹 로그로 정확도·오탐·미탐·사전 경고 시간을 측정한 결과는 아직 없습니다."
    );
    expect(readme).toContain("| 학습 데이터 | **없음**입니다.");
    expect(technicalReference).toContain("z-score 독립 합산 규칙형 엔진");
    expect(technicalReference).toContain(
      "Mahalanobis 거리나 Isolation Forest, 사전 학습된 고장 분류 모델을 사용하지 않습니다."
    );
    expect(impactScorecard).toContain(
      "현재 실제 사용자 수, 현장 정확도, 절감 비용은 확정·측정된 성과로 기재하지 않습니다."
    );
    expect(aiUsage).toContain("Isolation Forest, 사전 학습된 고장 분류 모델");
    expect(todo).toContain("z-score 기반 규칙형 위험 신호 탐지 엔진");
    expect(todo).not.toContain("Isolation Forest 기반 AI 이상탐지 엔진");
  });
});
