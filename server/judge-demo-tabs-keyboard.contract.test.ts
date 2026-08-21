import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const judgeDemoSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/JudgeDemo.tsx"),
  "utf8"
);

describe("judge demo step tabs keyboard contract", () => {
  it("uses a roving tab stop and moves selection and focus with Arrow, Home, and End", () => {
    expect(judgeDemoSource).toContain(
      "const stepTabRefs = useRef<Array<HTMLButtonElement | null>>([]);"
    );
    expect(judgeDemoSource).toContain('event.key === "ArrowRight"');
    expect(judgeDemoSource).toContain('event.key === "ArrowLeft"');
    expect(judgeDemoSource).toContain('event.key === "Home"');
    expect(judgeDemoSource).toContain('event.key === "End"');
    expect(judgeDemoSource).toContain(
      "stepTabRefs.current[nextIndex]?.focus()"
    );
    expect(judgeDemoSource).toContain("tabIndex={step === index + 1 ? 0 : -1}");
    expect(judgeDemoSource).toMatch(
      /role="tablist"\s+aria-label=\{text\.timing\}\s+aria-orientation="horizontal"/
    );
  });

  it("connects the active tab to the live step panel", () => {
    expect(judgeDemoSource).toContain('aria-controls="judge-demo-step-panel"');
    expect(judgeDemoSource).toMatch(
      /id="judge-demo-step-panel"\s+role="tabpanel"\s+aria-labelledby=\{`judge-demo-step-tab-\$\{step\}`\}/
    );
  });
});
