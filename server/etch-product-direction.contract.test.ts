import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("etch judgment training product direction", () => {
  const page = readFileSync("client/src/pages/EtchTraining.tsx", "utf8");
  it("offers optional preparation without unlocking requirements", () => {
    expect(page).toContain("훈련 전 빠른 준비 · 익숙하다면 건너뛰세요");
    expect(page).toContain("이 안내를 읽지 않아도 훈련할 수 있습니다.");
    expect(page).toContain("관찰 시작");
    expect(page).not.toContain("preparationCompleted");
  });
  it("does not equate retrospective markers with discovery time or claim live AI", () => {
    expect(page).toContain("과거를 표시했다고 그때 발견한 것은 아닙니다.");
    expect(page).toContain("AI 생성 답변이 아닙니다.");
    expect(page).toContain("실행마다 다른 가상 신호이며 Scenario 01의 정답 데이터와 분리됩니다.");
    expect(page).toContain("실제 팹 장비 연결은 아직 지원하지 않습니다.");
  });
});
