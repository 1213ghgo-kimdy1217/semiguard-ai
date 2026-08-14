import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat message live-log contract", () => {
  it("exposes new consultation messages through a polite live log", () => {
    expect(dashboardSource).toContain('role="log"');
    expect(dashboardSource).toContain('aria-live="polite"');
    expect(dashboardSource).toContain('aria-relevant="additions text"');
    expect(dashboardSource).toContain("aria-busy={isChatLoading}");
  });

  it("provides a localized accessible name for the message log", () => {
    expect(dashboardSource).toContain("AI 상담 메시지");
    expect(dashboardSource).toContain("AI相談メッセージ");
    expect(dashboardSource).toContain("AI consultation messages");
  });
});
