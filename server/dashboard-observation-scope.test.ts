import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8").replace(/\r\n/g, "\n");

describe("fixed dashboard consultation evidence UI", () => {
  it("sends only messages tied to the same observation, including retry and feedback", () => {
    expect(source).toContain("sourceObservation ?? chatObservation ?? captureDashboardObservation(current, Date.now())");
    expect(source).toContain("messagesForDashboardObservation(nextMessages, observation)");
    expect(source).toContain("messagesForDashboardObservation(chatMessages.slice(0, assistantIndex), observation)");
    expect(source).toContain("handleSendChatMessage(msg.recoveryPrompt, msg.observation)");
    expect(source.match(/setChatObservation\(null\)/g)).toHaveLength(3);
  });

  it("provides a manual refresh without an AI request and separates calculated facts from prose in three languages", () => {
    const refresh = source.slice(source.indexOf('<button type="button" disabled={isChatLoading || !current}'), source.indexOf("{/* 대화 메시지 영역 */}"));
    expect(refresh).toContain("captureDashboardObservation(current, Date.now())");
    expect(refresh).not.toContain("mutateAsync");
    for (const text of ["최신 관측으로 갱신", "最新の観測に更新", "Refresh observation", "계산된 관측 근거 · AI 문장과 별도", "計算された観測根拠 · AI文章とは別", "Calculated observation evidence · separate from AI text"]) expect(source).toContain(text);
    expect(source).toContain("msg.evidence.history.window.sampleCount");
    expect(source).toContain("fact.firstRecordedOutsideValue");
    expect(source).toContain("Unavailable history does not mean no range exit occurred.");
    expect(source).toContain("previous observations are not restored");
  });
});
