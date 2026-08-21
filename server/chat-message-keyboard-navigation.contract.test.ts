import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat message keyboard navigation contract", () => {
  it("makes the message log focusable and supports Home and End navigation", () => {
    expect(dashboardSource).toContain("tabIndex={0}");
    expect(dashboardSource).toContain('if (event.key === "Home")');
    expect(dashboardSource).toContain('if (event.key === "End")');
    expect(dashboardSource).toContain("event.currentTarget.scrollTo({ top: 0, behavior: getKeyboardScrollBehavior() })");
    expect(dashboardSource).toContain("event.currentTarget.scrollTo({ top: event.currentTarget.scrollHeight, behavior: getKeyboardScrollBehavior() })");
  });

  it("describes the keyboard navigation in Korean, Japanese, and English", () => {
    expect(dashboardSource).toContain("Home 키로 처음 메시지");
    expect(dashboardSource).toContain("Homeキーで最初のメッセージ");
    expect(dashboardSource).toContain("use Home to move to the first message");
  });
});
