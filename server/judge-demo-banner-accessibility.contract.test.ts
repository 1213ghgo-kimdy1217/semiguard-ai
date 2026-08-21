import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "client/src/pages/JudgeDemo.tsx"),
  "utf8"
);

describe("judge demo banner accessibility contract", () => {
  it("announces the localized demo-mode boundary as one atomic polite status", () => {
    expect(source).toMatch(
      /\{showDemoBanner && \(\s*<section[\s\S]{0,500}?role="status"\s+aria-live="polite"\s+aria-atomic="true"/
    );
    expect(source).toContain("text.demoMode");
    expect(source).toContain("text.demoModeDescription");
  });

  it("keeps decorative header and banner status dots out of the accessible name", () => {
    expect(source).toContain('<span aria-hidden="true">●</span>{" "}');
    expect(source).toContain('aria-hidden="true" className="mt-0.5 flex h-5 w-5');
  });
});
