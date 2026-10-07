import { describe, expect, it } from "vitest";
import { DASHBOARD_CHAT_HISTORY_LIMIT, dashboardChatContextNotice, prepareDashboardChatHistory } from "./dashboardChat";
import { messagesForDashboardObservation, type DashboardChatObservation } from "./dashboardObservation";

describe("dashboard consultation history", () => {
  it("does not teach the model to repeat greetings or failed-service summaries", () => {
    expect(prepareDashboardChatHistory([
      { role: "assistant", content: "Welcome" },
      { role: "user", content: "Explain vibration" },
      { role: "assistant", content: "[규칙 기반 근거 요약] same summary" },
      { role: "assistant", content: "request failed", recoveryPrompt: "Explain vibration" },
      { role: "assistant", content: "fallback", usedFallback: true },
      { role: "user", content: "What does mm/s mean?" },
    ])).toEqual([
      { role: "user", content: "Explain vibration" },
      { role: "user", content: "What does mm/s mean?" },
    ]);
  });

  it("keeps actual answers and follow-up wording within a bounded history", () => {
    const history = Array.from({ length: 20 }, (_, index) => ({
      role: index % 2 === 0 ? "user" as const : "assistant" as const, content: `turn ${index}`,
    }));
    const result = prepareDashboardChatHistory([...history, { role: "user", content: "Explain that more simply" }]);
    expect(result.length).toBeLessThanOrEqual(12);
    expect(result[0].role).toBe("user");
    expect(result.at(-1)?.content).toBe("Explain that more simply");
    expect(result.some(message => message.content === "turn 19")).toBe(true);
  });

  it("truncates original turns without fabricating a summary at the shared limit", () => {
    const history = Array.from({ length: 20 }, (_, index) => ({
      role: index % 2 === 0 ? "user" as const : "assistant" as const, content: `original ${index}`,
    }));
    expect(prepareDashboardChatHistory(history)).toEqual(history.slice(-DASHBOARD_CHAT_HISTORY_LIMIT));
  });

  it("excludes reopened text and other observations before selecting recent turns", () => {
    const observation: DashboardChatObservation = { capturedAt: 1000,
      sensorContext: { current: 5, temperature: 45, vibration: 2, noise: 55, anomalyScore: 0, riskLevel: "normal" } };
    const messages = [
      { role: "user" as const, content: "stored question without observation" },
      { role: "assistant" as const, content: "old answer", observation: { ...observation, capturedAt: 500 } },
      { role: "user" as const, content: "current question", observation },
      { role: "assistant" as const, content: "service failure", observation, usedFallback: true },
      { role: "user" as const, content: "follow-up", observation },
    ];
    expect(prepareDashboardChatHistory(messagesForDashboardObservation(messages, observation))).toEqual([
      { role: "user", content: "current question" }, { role: "user", content: "follow-up" },
    ]);
  });

  it.each(["ko", "ja", "en"] as const)("truthfully describes the context boundary in %s", lang => {
    const active = dashboardChatContextNotice(lang, true);
    const reopened = dashboardChatContextNotice(lang, false);
    expect(active).toContain(String(DASHBOARD_CHAT_HISTORY_LIMIT));
    expect(reopened).not.toEqual(active);
    const statements = {
      ko: ["요약하지 않습니다", "이전 대화는 AI에 전달하지 않습니다"],
      ja: ["要約しません", "以前の会話はAIに送信しません"],
      en: ["not summarized", "Earlier visible turns are not sent to AI"],
    };
    expect(active).toContain(statements[lang][0]);
    expect(reopened).toContain(statements[lang][1]);
  });
});
