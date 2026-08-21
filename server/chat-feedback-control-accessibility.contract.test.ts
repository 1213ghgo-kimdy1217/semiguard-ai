import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("AI answer feedback control accessibility contract", () => {
  it("groups answer feedback and exposes localized names with pressed states", () => {
    expect(dashboardSource).toContain('role="group" aria-label={lang === "ko" ? "AI 답변 평가"');
    expect(dashboardSource).toContain('"AI 답변이 도움이 됨"');
    expect(dashboardSource).toContain('"AI回答が役に立った"');
    expect(dashboardSource).toContain('"AI answer was helpful"');
    expect(dashboardSource).toContain('aria-pressed={messageFeedbacks[idx] === "like"}');
    expect(dashboardSource).toContain('"AI 답변이 도움이 되지 않음"');
    expect(dashboardSource).toContain('"AI回答が役に立たなかった"');
    expect(dashboardSource).toContain('"AI answer was not helpful"');
    expect(dashboardSource).toContain('aria-pressed={messageFeedbacks[idx] === "dislike"}');
  });
});
