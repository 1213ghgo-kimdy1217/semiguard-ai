import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("AI consultation scroll motion contract", () => {
  it("applies the shared reduced-motion-aware behavior when jumping to the latest message", () => {
    expect(dashboardSource).toContain("messageList.scrollTo({ top: messageList.scrollHeight, behavior: getKeyboardScrollBehavior() })");
  });

  it("applies the shared reduced-motion-aware behavior to quick-question keyboard scrolling", () => {
    expect(dashboardSource).toContain("event.currentTarget.scrollBy({ left: event.key === \"ArrowRight\" ? 180 : -180, behavior: getKeyboardScrollBehavior() })");
    expect(dashboardSource).toContain('if (event.key === "ArrowRight" || event.key === "ArrowLeft")');
  });
});
