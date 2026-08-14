import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("mobile chatbot floating button safe-area contract", () => {
  it("keeps the chatbot launcher clear of a mobile device's bottom gesture area", () => {
    expect(dashboardSource).toContain('bottom: isMobile ? "max(1.25rem, calc(env(safe-area-inset-bottom) + 0.5rem))" : undefined');
  });

  it("keeps the established desktop bottom spacing when mobile safe-area handling is not needed", () => {
    expect(dashboardSource).toContain('className="fixed bottom-5 right-4 sm:bottom-8 sm:right-8');
  });
});
