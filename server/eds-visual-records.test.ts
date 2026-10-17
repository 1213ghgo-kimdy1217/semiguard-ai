import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import EdsObservationWorkspace from "../client/src/components/EdsObservationWorkspace";

describe("EDS record diagrams", () => {
  it.each(["ko", "en", "ja"] as const)("labels separate sample diagrams in %s", language => {
    const html = renderToStaticMarkup(createElement(EdsObservationWorkspace, { time: 60, observedUntil: 60, language }));
    expect(html.match(/<svg/g)).toHaveLength(6);
    expect(html.match(/role="img"/g)).toHaveLength(6);
    expect(html.match(/<circle/g)).toHaveLength(6);
    expect(html.match(/<details>/g)).toHaveLength(3);
    expect(html).not.toContain("NaN");
  });
  it.each([0, 29, 30, 59, 60, 90])("shows only unfolded record diagrams at %s", time => {
    const html = renderToStaticMarkup(createElement(EdsObservationWorkspace, { time, observedUntil: time, language: "en" }));
    expect(html.match(/<svg/g)).toHaveLength(time < 30 ? 2 : time < 60 ? 4 : 6);
    expect(html).toContain("not a same-time manufacturing map");
    expect(html).toContain("neither confirms nor rules out");
  });
});
