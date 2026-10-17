import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import DepositionImplantationConcept from "../client/src/components/DepositionImplantationConcept";
import ProcessEquipmentReference from "../client/src/components/ProcessEquipmentReference";

describe("separate deposition and implantation concepts", () => {
  it.each(["ko", "en", "ja"] as const)("renders labelled concept and native viewing controls in %s", language => {
    const html = renderToStaticMarkup(createElement(DepositionImplantationConcept, { language }));
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-live="polite"');
  });
  it.each(["wafer", "oxidation", "photo", "etch", "metal", "eds", "packaging"] as const)("keeps concept out of %s equipment context", processId => {
    const html = renderToStaticMarkup(createElement(ProcessEquipmentReference, { processId, language: "en" }));
    expect(html).not.toContain('class="di-concept"');
  });
  it("mounts only in deposition and preserves manufacturer references", () => {
    const html = renderToStaticMarkup(createElement(ProcessEquipmentReference, { processId: "deposition", language: "en" }));
    expect(html).toContain('class="di-concept"');
    expect(html).toContain("Real equipment context for this exercise");
    expect(html).toContain("not measurements");
    expect(html).toContain("not consecutive results from the same wafer");
  });
  it("does not import scenario data, persistence or API into explanatory drawing", () => {
    const source = readFileSync("client/src/components/DepositionImplantationConcept.tsx", "utf8");
    for (const forbidden of ["processSample", "trpc", "sessionStorage", "localStorage", "fetch("]) expect(source).not.toContain(forbidden);
  });
});
