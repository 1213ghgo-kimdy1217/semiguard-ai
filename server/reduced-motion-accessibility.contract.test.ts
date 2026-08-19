import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const globalStyles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("reduced-motion accessibility contract", () => {
  it("reduces non-essential animation, transition, and smooth-scroll motion for users who request it", () => {
    expect(globalStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(globalStyles).toContain("animation-duration: 0.01ms !important");
    expect(globalStyles).toContain("animation-iteration-count: 1 !important");
    expect(globalStyles).toContain("transition-duration: 0.01ms !important");
    expect(globalStyles).toContain("scroll-behavior: auto !important");
  });
});
