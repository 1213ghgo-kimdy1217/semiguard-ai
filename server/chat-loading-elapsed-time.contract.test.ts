import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat loading elapsed-time contract", () => {
  it("tracks elapsed seconds only while an AI response is loading", () => {
    expect(dashboardSource).toContain("const [chatLoadingElapsedSeconds, setChatLoadingElapsedSeconds] = useState(0);");
    expect(dashboardSource).toContain("if (!isChatLoading) {");
    expect(dashboardSource).toContain("window.setInterval");
    expect(dashboardSource).toContain("window.clearInterval(intervalId)");
  });

  it("shows a localized elapsed-time status after five seconds", () => {
    expect(dashboardSource).toContain("chatLoadingElapsedSeconds >= 5");
    expect(dashboardSource).toContain("${chatLoadingElapsedSeconds}초 경과");
    expect(dashboardSource).toContain("${chatLoadingElapsedSeconds}秒経過");
    expect(dashboardSource).toContain("${chatLoadingElapsedSeconds}s elapsed");
  });
});
