import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/JudgeDemo.tsx"), "utf8");

describe("judge demo banner close control contract", () => {
  it("keeps the localized accessible name and shows a visible close label on desktop", () => {
    expect(source).toContain("aria-label={text.closeDemoMode}");
    expect(source).toContain('<span className="hidden text-xs sm:inline">{text.close}</span>');
    expect(source).toContain("sm:w-auto sm:px-2");
  });
});
