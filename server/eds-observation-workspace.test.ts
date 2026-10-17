import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { edsObservation } from "../shared/edsObservation";
import { getProcessScenario, processSample } from "../shared/processScenarios";
import EdsObservationWorkspace from "../client/src/components/EdsObservationWorkspace";
import { ProcessRecordContext } from "../client/src/components/ProcessEvidenceReview";

const scenario = getProcessScenario("eds")!;
describe("observed-only EDS region comparison", () => {
  it("preserves exact original samples at every replay position", () => {
    for (let time = 0; time <= 90; time++) {
      const rows = edsObservation(time, 90);
      expect(rows.map(row => row.region)).toEqual(time < 30 ? ["A"] : time < 60 ? ["A", "B"] : ["A", "B", "C"]);
      for (const row of rows) {
        expect(row.end).toBeLessThanOrEqual(time);
        expect(row.die).toEqual(processSample(scenario, "die", row.end));
        expect(row.comparison).toEqual(processSample(scenario, "comparison", row.end));
        expect(row.dieBand).toBe(row.region === "C" ? "above" : "inside");
        expect(row.comparisonBand).toBe("inside");
      }
    }
  });
  it.each([0, 29, 30, 59, 60, 90])("clamps future selection to observation %s", until => {
    expect(edsObservation(90, until)).toEqual(edsObservation(until, until));
    expect(edsObservation(until, 90).every(row => row.end <= until)).toBe(true);
  });
  it("normalizes invalid bounds using the existing sampler", () => {
    expect(edsObservation(NaN, 90)).toEqual(edsObservation(0, 0));
    expect(edsObservation(90, -1)).toEqual(edsObservation(0, 0));
    expect(edsObservation(Infinity, 90)).toEqual(edsObservation(0, 0));
  });
  it.each(["ko", "en", "ja"] as const)("renders native disclosure controls without new form inputs in %s", language => {
    const html = renderToStaticMarkup(createElement(EdsObservationWorkspace, { time: 60, observedUntil: 60, language }));
    expect(html.match(/<details>/g)).toHaveLength(3);
    expect(html.match(/<summary>/g)).toHaveLength(3);
    expect(html).not.toContain("<input");
    expect(html).not.toContain("NaN");
  });
  it("integrates only in EDS selected-time evidence and hides future regions on rewind", () => {
    const html = renderToStaticMarkup(createElement(ProcessRecordContext, { scenario, time: 29, language: "en" }));
    expect(html).toContain("COMPARE OBSERVED REGIONS");
    expect(html.match(/<details>/g)).toHaveLength(1);
    expect(html).toContain("neither confirms nor rules out");
  });
});
