import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
describe("practice workspace flow", () => {
  it("labels the preserved etch module consistently with the process chooser", () => {
    const page = read("client/src/pages/EtchTraining.tsx");
    expect(page).toContain("PLASMA ETCH / PROCESS JUDGMENT");
    expect(page).not.toContain("SCENARIO 01");
    expect(page).not.toContain("Scenario 01");
    expect(read("client/src/components/ProcessScenarioPath.tsx")).not.toContain("기존 식각 훈련 열기");
  });

  it("opens the eight-module chooser from the home card while keeping etch accessible", () => {
    const page = read("client/src/pages/EtchTraining.tsx");
    expect(page).toContain('onClick={() => move("process-select")}');
    expect(page).toContain('stage === "process-select"');
    expect(page).toContain("8개 모듈 선택하기");
    expect(page).toContain('<ProcessScenarioPath language={language}');
    expect(page).toContain('href="/training/process/deposition"');
  });
  it("opens account-bound read-only history without inventing old written answers", () => {
    const page = read("client/src/pages/TrainingHistory.tsx");
    expect(read("client/src/App.tsx")).toContain('"/training/history/:attemptId"');
    expect(read("client/src/pages/EtchTraining.tsx")).toContain('href={`/training/history/${item.id}`}');
    expect(page).toContain("query.data?.userId === auth.data?.id");
    expect(page).toContain("서술형 답안은 서버에 저장하지 않았으므로");
    expect(page).not.toContain("useMutation");
    expect(read("server/routers.ts")).toContain("getTrainingAttempt(ctx.user.id, input.id)");
  });
  it("keeps Q&A floating, opt-in, non-persistent and account/language separated", () => {
    const page = read("client/src/components/LearningAssistant.tsx");
    expect(read("client/src/components/learning-assistant.css")).toContain("position:fixed");
    expect(page).toContain('key={`${auth.data?.id ?? "guest"}:${language}`}');
    expect(page).toContain('if (!userId || !consent || waiting');
    expect(page).toContain("ask.mutateAsync({ consent: true, language, question: text })");
    expect(page).toContain("generation.current !== sequence");
    expect(page).not.toMatch(/localStorage|sessionStorage|dangerouslySetInnerHTML/);
  });
});
