import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "client/src/pages/JudgeDemo.tsx"),
  "utf8"
).replace(/\r\n/g, "\n");

describe("judge demo brand lockup contract", () => {
  it("uses the shared compact site brand while preserving the demo's own title and badges", () => {
    const header = readFileSync(resolve(process.cwd(), "client/src/components/SiteHeader.tsx"), "utf8");
    const app = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
    expect(app).toContain("<SiteHeader />");
    expect(header).toContain('className="sg-site-logo"');
    expect(header).toContain('className="sg-site-symbol" aria-hidden="true">SG</span>');
    expect(header).toContain('"SemiGuard AI 홈", "SemiGuard AI home", "SemiGuard AI ホーム"');
    expect(source).not.toContain('aria-label="SemiGuard AI"');
    expect(source).toContain("{text.badge}");
    expect(source).toContain("{text.readOnly}");
    expect(source).toMatch(/<h1[^>]*>\s*\{text\.title\}/);
    expect(source).toContain("{text.subtitle}");
    expect(source.indexOf("{text.badge}")).toBeLessThan(source.indexOf("{text.title}"));
  });
});
