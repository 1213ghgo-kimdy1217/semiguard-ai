import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("mobile chatbot floating button compact-label contract", () => {
  it("uses concise labels on narrow screens while retaining localized full labels on larger screens", () => {
    expect(dashboardSource).toContain('className="sm:hidden whitespace-nowrap"');
    expect(dashboardSource).toContain('lang === "ko" ? "AI 상담" : lang === "ja" ? "AI相談" : "AI Chat"');
    expect(dashboardSource).toContain('className="hidden sm:inline whitespace-nowrap"');
    expect(dashboardSource).toContain('className="hidden sm:block text-xs font-semibold opacity-90 whitespace-nowrap"');
  });
});
