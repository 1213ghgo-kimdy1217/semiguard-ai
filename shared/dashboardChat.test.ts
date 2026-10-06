import { describe, expect, it } from "vitest";
import { prepareDashboardChatHistory } from "./dashboardChat";

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
});
