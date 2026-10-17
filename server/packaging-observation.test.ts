import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PackagingObservationWorkspace, { packagingObservation } from "../client/src/components/PackagingObservationWorkspace";
import { getProcessScenario, processSample } from "../shared/processScenarios";

describe("packaging observed-only comparison", () => {
  it("preserves original records and hides future exits and returns", () => {
    for (let time = 0; time <= 90; time++) {
      const view = packagingObservation(time);
      expect(view.records).toHaveLength(time + 1);
      expect(view.records[time]).toEqual(processSample(getProcessScenario("packaging")!, "connection", time));
      expect(view.outside?.time).toBe(time < 56 ? undefined : 56);
      expect(view.returned?.time).toBe(time < 82 ? undefined : 82);
    }
  });
  it.each(["ko", "en", "ja"] as const)("renders conceptual package and two comparison records in %s", language => {
    const html = renderToStaticMarkup(createElement(PackagingObservationWorkspace, { time: 55, language }));
    expect(html.match(/<svg/g)).toHaveLength(3);
    expect(html).toContain('max="55"');
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("56s");
    expect(html).not.toContain("82s");
  });
});
