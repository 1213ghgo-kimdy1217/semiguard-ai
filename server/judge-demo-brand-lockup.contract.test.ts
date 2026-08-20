import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "client/src/pages/JudgeDemo.tsx"),
  "utf8"
);

describe("judge demo brand lockup contract", () => {
  it("keeps a compact, noninteractive SemiGuard AI brand lockup before the demo badges", () => {
    expect(source).toContain('className="mb-3 flex items-center gap-2.5" aria-label="SemiGuard AI"');
    expect(source).toContain('className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl');
    expect(source).toContain(">\n                SG\n              </span>");
    expect(source).toContain("Safety analysis console");
    expect(source.indexOf('aria-label="SemiGuard AI"')).toBeLessThan(source.indexOf("{text.badge}"));
  });
});
