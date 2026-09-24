import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("protected equipment observation workbench", () => {
  it("opens the new workbench at /dashboard and preserves legacy account/history features", () => {
    const app = readFileSync("client/src/App.tsx", "utf8");
    expect(app).toMatch(/<Route path=\{"\/dashboard\/legacy"\}>\s*<ProtectedRoute>[\s\S]*?<Dashboard \/>/);
    expect(app).toMatch(/<Route path=\{"\/dashboard"\}>\s*<ProtectedRoute>[\s\S]*?<OperationsForCurrentUser \/>/);
    expect(app).toContain('<EtchOperations key={user.id} userId={user.id} />');
    const page = readFileSync("client/src/pages/EtchOperations.tsx", "utf8");
    expect(page).toContain("실제 설비 연결 및 제어 없음");
    expect(page).toContain("3초마다 관측 중");
    expect(page).toContain("학습된 AI 판단이 아닌 단순 비교 규칙");
    expect(page).toContain("기존 기록·계정");
    expect(page).not.toContain("userId: 1");
  });
});
