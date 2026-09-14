import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "client/src/pages/JudgeDemo.tsx"),
  "utf8"
).replace(/\r\n/g, "\n");

describe("judge demo professional motion and evidence context contract", () => {
  it("uses restrained scroll and step motion while honoring reduced-motion preferences", () => {
    expect(source).toContain('from "framer-motion"');
    expect(source).toContain("useScroll");
    expect(source).toContain("useSpring");
    expect(source).toContain("useReducedMotion");
    expect(source).toContain("style={{ scaleX: smoothScrollProgress }}");
    expect(source).toContain('<AnimatePresence mode="wait" initial={false}>');
    expect(source).toContain("initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}");
  });

  it("shows current value, normal range, and score contribution as separate sensor facts", () => {
    expect(source).toContain('currentLabel: "현재값"');
    expect(source).toContain('normalRangeLabel: "정상 범위"');
    expect(source).toContain('contributionLabel: "점수 기여"');
    expect(source).toContain("sensor.contribution");
    expect(source).toContain("{text.currentLabel}");
    expect(source).toContain("{text.normalRangeLabel}");
    expect(source).toContain("{text.contributionLabel}");
  });

  it("keeps the visible warning score and the final trend point consistent", () => {
    expect(source).toContain('{ minute: "now", current: 6.5, vibration: 1.1, risk: 67 }');
    expect(source).toContain('scoreEvidence: "위험도 67/100 · 경고"');
  });
});
