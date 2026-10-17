import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DepositionWorkspace } from "../client/src/components/ProcessEvidenceWorkspaces";
import { depositionEvidence } from "../shared/inspectionEvidence";

describe("progressive disclosure of exact inspection evidence", () => {
  it.each(["ko", "en", "ja"] as const)("keeps two collapsed numeric comparisons and original controls in %s", language => {
    const html = renderToStaticMarkup(createElement(DepositionWorkspace, { time: 48, language, onInteraction: () => {} }));
    expect(html.match(/class="pe-exact-evidence"/g)).toHaveLength(2);
    expect(html).not.toMatch(/<details[^>]*\bopen(?:=|\s|>)/);
    expect(html.match(/<button/g)).toHaveLength(3);
    expect(html.match(/<option/g)).toHaveLength(3);
    const evidence = depositionEvidence(48, "film-difference");
    for (const record of [evidence.film, evidence.electrical]) {
      expect(html).toContain(record.value.toFixed(1));
      expect(html).toContain(record.reference.toFixed(1));
      expect(html).toContain(record.low.toFixed(1));
      expect(html).toContain(record.high.toFixed(1));
    }
    expect(html).not.toContain('class="pe-check"');
  });
});
