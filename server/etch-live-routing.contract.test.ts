import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("live observation integration", () => {
  it("keeps the old dashboard and exposes independent public observation", () => {
    const app = readFileSync("client/src/App.tsx", "utf8");
    expect(app).toContain('path={"/dashboard"}');
    expect(app).toContain('path={"/live"}');
    const page = readFileSync("client/src/pages/EtchLive.tsx", "utf8");
    expect(page).not.toContain("ETCH_STORAGE_KEY");
    expect(page).not.toContain("localStorage");
    expect(page).toContain("restoreLiveSession(sessionStorage.getItem(STORAGE_KEY))");
    expect(page).toContain("sessionStorage.setItem(STORAGE_KEY");
    expect(page).toContain("탭을 닫으면 사라질 수 있으니");
    expect(page).toContain("visibilitychange");
    expect(page).toContain("기록 파일 내려받기");
    expect(page).toContain("같은 패턴");
  });
  it("links training to the same equipment's live page", () => {
    const training = readFileSync("client/src/pages/EtchTraining.tsx", "utf8");
    expect(training).toContain('href="/live"');
    expect(training).not.toContain('href="/dashboard"');
  });
});
