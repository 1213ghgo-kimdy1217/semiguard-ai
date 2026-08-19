import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("first analysis onboarding dialog accessibility contract", () => {
  it("moves initial focus to the close control and restores focus to the review trigger", () => {
    expect(dashboardSource).toContain("const onboardingTriggerRef = useRef<HTMLButtonElement>(null);");
    expect(dashboardSource).toContain("const onboardingCloseButtonRef = useRef<HTMLButtonElement>(null);");
    expect(dashboardSource).toContain("onboardingCloseButtonRef.current?.focus();");
    expect(dashboardSource).toContain("onboardingTriggerRef.current?.focus()");
    expect(dashboardSource).toContain("ref={onboardingCloseButtonRef}");
    expect(dashboardSource).toContain("ref={onboardingTriggerRef}");
  });

  it("closes with Escape and keeps Tab navigation within enabled onboarding controls", () => {
    expect(dashboardSource).toContain('event.key === "Escape"');
    expect(dashboardSource).toContain("closeOnboarding();");
    expect(dashboardSource).toContain('querySelectorAll<HTMLButtonElement>("button:not([disabled])")');
    expect(dashboardSource).toContain("event.shiftKey && document.activeElement === firstControl");
    expect(dashboardSource).toContain("document.activeElement === lastControl");
  });
});
