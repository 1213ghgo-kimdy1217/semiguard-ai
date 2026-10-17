import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import InspectionConceptRecord from "../client/src/components/InspectionConceptRecord";
import { depositionEvidence } from "../shared/inspectionEvidence";

describe("inspection-specific explanation boundaries", () => {
  it.each(["ko", "en", "ja"] as const)("keeps exact records and native boundary disclosure in %s", language => {
    for (const time of [0, 47, 48, 90]) {
      const view = depositionEvidence(time, "film-difference");
      for (const signal of ["film", "electrical"] as const) {
        const sample = view[signal];
        const html = renderToStaticMarkup(createElement(InspectionConceptRecord, { signal, sample, language }));
        expect(html.match(/<details>/g)).toHaveLength(1);
        expect(html.match(/<summary>/g)).toHaveLength(1);
        expect(html).toContain(sample.value.toFixed(1));
        expect(html).toContain(sample.reference.toFixed(1));
        expect(html).not.toContain("NaN");
        if (language === "en") expect(html).toContain(signal === "film" ? "composition" : "implantation dose");
        if (language === "ko") expect(html).not.toContain("今回の記録");
      }
    }
  });
});
