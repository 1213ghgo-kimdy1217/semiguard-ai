import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import InspectionConceptRecord from "../client/src/components/InspectionConceptRecord";
import { DepositionWorkspace } from "../client/src/components/ProcessEvidenceWorkspaces";
import { depositionEvidence } from "../shared/inspectionEvidence";

describe("selected inspection evidence diagrams", () => {
  it.each(["ko", "en", "ja"] as const)("mounts two concepts and two gauges in %s", language => {
    const html = renderToStaticMarkup(createElement(DepositionWorkspace, { time: 48, language, onInteraction: () => {} }));
    expect(html.match(/<svg/g)).toHaveLength(4);
    expect(html).toContain('class="pe-classifier"');
    expect(html).toContain("48s");
  });
  it.each([0, 47, 48, 90])("uses exact selected original samples at %s", time => {
    const view = depositionEvidence(time, "film-difference");
    for (const signal of ["film", "electrical"] as const) {
      const html = renderToStaticMarkup(createElement(InspectionConceptRecord, { signal, sample: view[signal], language: "en" }));
      expect(html).toContain(view[signal].value.toFixed(1));
      expect(html).toContain(`${time}s`);
      expect(html).toContain("not measured");
      expect(html).not.toContain("NaN");
    }
  });
});
