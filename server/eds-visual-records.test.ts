import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import EdsObservationWorkspace from "../client/src/components/EdsObservationWorkspace";

describe("EDS wafer and probe concepts", () => {
  it.each(["ko", "en", "ja"] as const)("labels conceptual diagrams and native region controls in %s", language => {
    const html = renderToStaticMarkup(createElement(EdsObservationWorkspace, { time: 60, observedUntil: 60, language }));
    expect(html.match(/<svg/g)).toHaveLength(2);
    expect(html.match(/role="img"/g)).toHaveLength(2);
    expect(html.match(/<button/g)).toHaveLength(3);
    expect(html.match(/<details>/g)).toHaveLength(3);
    expect(html).not.toContain("NaN");
  });
  it.each([0, 29, 30, 59, 60, 90])("disables unobserved regions at %s", time => {
    const html = renderToStaticMarkup(createElement(EdsObservationWorkspace, { time, observedUntil: time, language: "en" }));
    const count = time < 30 ? 1 : time < 60 ? 2 : 3;
    expect(html.match(/<details>/g)).toHaveLength(count);
    expect((html.match(/disabled=""/g) ?? []).length).toBe(3 - count);
    expect(html).toContain("not a same-time manufacturing map");
    expect(html).toContain("neither confirms nor rules out");
  });
});
