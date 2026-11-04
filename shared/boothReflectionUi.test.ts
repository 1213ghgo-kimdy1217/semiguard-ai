import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BoothReflection from "../client/src/components/BoothReflection";
import { createBoothState, getBoothSnapshot } from "./boothExperience";
import { captureBoothAttempt } from "./boothReflection";

describe("reflection appears only for completed evidence", () => {
  it("does not show a writing form during a live experience", () => {
    expect(renderToStaticMarkup(createElement(BoothReflection, { attempt: null, language: "ko" }))).toBe("");
  });
  it("shows the completed run, observation/actions/review fields and honest local save status", () => {
    const captured = captureBoothAttempt({ id: "review-ui", scenarioId: "combined", scenarioTitle: "복합 공정 이상", outcome: "failed", snapshot: getBoothSnapshot(createBoothState()), durationMs: 120000 });
    const markup = renderToStaticMarkup(createElement(BoothReflection, { attempt: captured, language: "ko", onRetry: () => {} }));
    expect(markup).toContain("복합 공정 이상");
    expect(markup).toContain("시간 종료");
    expect(markup).toContain("02:00");
    expect(markup).toContain("관찰한 변화");
    expect(markup).toContain("조치와 판단 이유");
    expect(markup).toContain("복기 · 다음 확인");
    expect(markup.match(/<textarea\b/g)).toHaveLength(3);
    expect(markup).toContain("기록을 준비하고 있어요");
    expect(markup).not.toContain("복기 기록을 이 브라우저에 저장했어요");
    expect(markup).not.toContain("AI 채점");
    expect(markup).not.toContain("계정에 저장");
  });
});
