import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import ProcessLearningContext from "../client/src/components/ProcessLearningContext";
describe("existing wafer, oxidation and photo tool context", () => {
  it.each(["wafer", "oxidation", "photo"] as const)("renders a labelled concept without new interaction in %s", kind => {
    for (const language of ["ko", "en", "ja"] as const) {
      const html = renderToStaticMarkup(createElement(ProcessLearningContext, { kind, language }));
      expect(html).toContain('role="img"');
      expect(html).not.toContain("<input");
      expect(html).not.toContain("<button");
      expect(html).not.toContain("NaN");
    }
  });
  it("never samples, persists or requests data", () => {
    const source = readFileSync("client/src/components/ProcessLearningContext.tsx", "utf8");
    expect(source).not.toMatch(/processSample|fetch\(|trpc|sessionStorage|localStorage|useState/);
  });
});
