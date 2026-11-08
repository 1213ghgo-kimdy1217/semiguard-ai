import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("learning navigation safeguards", () => {
  it("sets a distinct learning title", () => {
    expect(readFileSync("client/src/pages/LearningHub.tsx", "utf8")).toContain('document.title = l("SemiGuard — 8대 공정 학습"');
  });
  it("connects the model review to the shared navigation guard and local storage", () => {
    const live = readFileSync("client/src/pages/EtchLive.tsx", "utf8");
    const reflection = readFileSync("client/src/components/BoothReflection.tsx", "utf8");
    expect(live).toContain("useSiteNavigationGuard(() => canLeaveReview())");
    expect(live).toContain("registerLeaveGuard={registerLeaveGuard}");
    expect(reflection).toContain("registerLeaveGuard(attempt ? canLeave : null)");
    expect(reflection).toContain("loadBoothReflections(storage)");
    expect(reflection).toContain("saveBoothReflection(storage, record)");
  });
  it("skips model ticks outside visible active runs and pauses classic observations", () => {
    const source = readFileSync("client/src/pages/EtchLive.tsx", "utf8");
    expect(source).toContain("if (document.hidden || !runningRef.current) return;");
    const training = readFileSync("client/src/pages/EtchTraining.tsx", "utf8");
    expect(training).toMatch(/if \(!running \|\| attempt.submitted \|\| attempt.elapsed >= ETCH_DURATION\) return;\s+const pause/);
  });
});
