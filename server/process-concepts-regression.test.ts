import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import EtchChamberConcept from "../client/src/components/EtchChamberConcept";
import MetalLayerConcept from "../client/src/components/MetalLayerConcept";
import { etchEvidence } from "../shared/etchScenario";
import { getProcessScenario, processSample } from "../shared/processScenarios";

describe("process concepts", () => {
  it.each(["ko", "en", "ja"] as const)("caps etch record in %s", language => {
    const html = renderToStaticMarkup(createElement(EtchChamberConcept, { time: 180, observedUntil: 39, language }));
    expect(html).toContain("39s");
    expect(html).toContain(etchEvidence(180, 39)[0].value.toFixed(1));
    expect(html).not.toContain("180s");
    expect(html.match(/<button/g)).toHaveLength(4);
  });
  it.each([0, 39, 40, 69, 70, 180])("retains phase reference at %s", time => {
    const html = renderToStaticMarkup(createElement(EtchChamberConcept, { time, observedUntil: time, language: "en" }));
    expect(html).toContain(etchEvidence(time, time)[0].reference.toFixed(1));
    expect(html).not.toContain("NaN");
  });
  it.each([0, 41, 42, 48, 54, 90])("retains metal record at %s", time => {
    const html = renderToStaticMarkup(createElement(MetalLayerConcept, { time, language: "en" }));
    expect(html).toContain(processSample(getProcessScenario("metal")!, "connection", time).value.toFixed(1));
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).toContain("not a defect");
  });
});
