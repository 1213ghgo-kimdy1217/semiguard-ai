import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("learning navigation safeguards", () => {
  it("sets a distinct learning title", () => {
    expect(readFileSync("client/src/pages/LearningHub.tsx", "utf8")).toContain('document.title = "SemiGuard — 8대 공정 학습"');
  });
  it("warns on an unfinished draft while saved notes survive same-tab navigation", () => {
    const source = readFileSync("client/src/pages/EtchLive.tsx", "utf8");
    expect(source).toContain('<a href="/learn">');
    expect(source).not.toContain("<Link");
    expect(source).toContain('window.addEventListener("beforeunload", warn)');
    expect(source).toContain("if (draft.trim())");
    expect(source).toContain("sessionStorage.setItem(STORAGE_KEY");
  });
  it("only subscribes to auto-pause during an active run", () => {
    const source = readFileSync("client/src/pages/EtchLive.tsx", "utf8");
    expect(source).toMatch(/if \(!active\) return;\s+const pause/);
    const training = readFileSync("client/src/pages/EtchTraining.tsx", "utf8");
    expect(training).toMatch(/if \(!running \|\| attempt.submitted \|\| attempt.elapsed >= ETCH_DURATION\) return;\s+const pause/);
  });
});
