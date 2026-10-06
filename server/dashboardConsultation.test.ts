import { describe, expect, it } from "vitest";
import { buildDashboardConsultationMessages, parseDashboardConsultationReply } from "./dashboardConsultation";

describe("dashboard learner-facing answer validation", () => {
  it.each([
    "mm/s는 진동 속도 단위이며 측정 방식은 제공되지 않았습니다.",
    "As discussed in previous messages, mm/s is a velocity unit, not displacement.",
    "mm/sは振動速度の単位です。測定方式は提供されていません。",
  ])("extracts only the final answer and preserves natural supported-language text", answer => {
    expect(parseDashboardConsultationReply(JSON.stringify({ answer }))).toBe(answer);
  });

  it.each([
    null, [], " ", "A plain unvalidated answer", "```json\n{}\n```",
    '{"answer":42}', '{"answer":" "}',
    '{"answer":"Valid","analysis":"hidden"}',
    '{"answer":"<think>hidden</think>Final"}',
    JSON.stringify({ answer: "Q following.... internal trace" }),
    JSON.stringify({ answer: "The user's final message asks about the mm/snapshot" }),
    JSON.stringify({ answer: "Reasoning: we need to answer in Korean" }),
  ])("rejects invalid or leaked output without echoing its content", content => {
    expect(() => parseDashboardConsultationReply(content)).toThrow("Invalid dashboard AI reply");
  });

  it("does not invent a measurement convention or require a fixed report in a structured answer", () => {
    const messages = buildDashboardConsultationMessages({
      lang: "ko", messages: [{ role: "user", content: "진동 속도를 쉽게 설명해줘" }],
      sensorContext: { current: 5, temperature: 45, vibration: 2, noise: 55, anomalyScore: 0, riskLevel: "normal" },
    });
    expect(messages[0].content).toContain("측정 방식이 제공되지 않았으므로 평균·실효값(RMS)·피크 중 무엇인지 알 수 없습니다");
    expect(messages[0].content).toContain("The measurement convention is unknown, not a default arithmetic average");
    expect(messages[0].content).toContain("The JSON wrapper does not require report headings or a long response");
    expect(messages.at(-1)?.content).toBe("진동 속도를 쉽게 설명해줘");
  });

  it("uses the same final-answer format for past AI turns without changing their words", () => {
    const answer = 'mm/s는 속도 단위입니다. "평균"이라고 단정할 수 없습니다.';
    const messages = buildDashboardConsultationMessages({
      lang: "ko", messages: [
        { role: "user", content: "mm/s가 뭐야?" },
        { role: "assistant", content: answer },
        { role: "user", content: "그 설명을 한 문장으로 줄여줘" },
      ],
      sensorContext: { current: 5, temperature: 45, vibration: 2, noise: 55, anomalyScore: 0, riskLevel: "normal" },
    });
    expect(JSON.parse(messages[2].content)).toEqual({ answer });
    expect(messages[1].content).toBe("mm/s가 뭐야?");
    expect(messages[3].content).toBe("그 설명을 한 문장으로 줄여줘");
  });
});
