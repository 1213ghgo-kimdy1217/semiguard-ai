import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { ProcessRecordContext } from "../client/src/components/ProcessEvidenceReview";
import { getProcessScenario } from "../shared/processScenarios";

describe("packaging observation integration", () => {
  it.each(["ko", "en", "ja"] as const)("mounts in packaging selected-time context in %s", language => {
    const html = renderToStaticMarkup(createElement(ProcessRecordContext, { scenario: getProcessScenario("packaging")!, time: 55, language }));
    expect(html).toContain("pk-workspace");
    expect(html).toContain('max="55"');
    expect(html).not.toContain("56s");
    expect(html).not.toContain("82s");
    if (language === "ja") {
      expect(html).toContain("教育用の仮想記録");
      expect(html).not.toContain("교육용 가상 기록");
    }
  });
  it.each(["oxidation", "eds", "metal", "photo", "wafer", "deposition"])("does not mount packaging in %s", processId => {
    const html = renderToStaticMarkup(createElement(ProcessRecordContext, { scenario: getProcessScenario(processId)!, time: 55, language: "en" }));
    expect(html).not.toContain("pk-workspace");
  });
  it("retains observation and review selected-time wiring in the unchanged page", () => {
    const source = readFileSync("client/src/pages/ProcessTraining.tsx", "utf8");
    expect(source).toContain("<ProcessRecordContext scenario={scenario} time={time} language={language} />");
    expect(source).toContain("<ProcessSnapshot scenario={scenario} time={shownTime} language={language} />");
    expect(source).toContain('const shownTime = stage === "review" ? reviewTime : inspectionTime;');
  });
});
