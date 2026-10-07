import { describe, expect, it } from "vitest";
import { captureDashboardObservation, messagesForDashboardObservation } from "./dashboardObservation";

const reading = { sensorData: { current: 5, temperature: 45, vibration: 1.46, noise: 55 },
  anomalyScore: 20, riskLevel: "normal", logId: 10 };

describe("dashboard consultation observation scope", () => {
  it("keeps the first snapshot unchanged while the live display advances", () => {
    const live = structuredClone(reading);
    const observation = captureDashboardObservation(live, 1000)!;
    live.sensorData.vibration = 1.94;
    live.logId = 11;
    expect(observation.sensorContext).toMatchObject({ vibration: 1.46, logId: 10 });
    expect(captureDashboardObservation(live, 2000)?.sensorContext).toMatchObject({ vibration: 1.94, logId: 11 });
  });

  it("does not invent default normal values when readings are absent or invalid", () => {
    expect(captureDashboardObservation(null, 1000)).toBeNull();
    expect(captureDashboardObservation({ ...reading, anomalyScore: NaN }, 1000)).toBeNull();
    expect(captureDashboardObservation({ ...reading, sensorData: { ...reading.sensorData, noise: Infinity } }, 1000)).toBeNull();
  });

  it("separates explicitly refreshed observations and unbound stored chat text", () => {
    const first = captureDashboardObservation(reading, 1000)!;
    const refreshed = captureDashboardObservation(reading, 2000)!;
    const messages = [
      { content: "old stored text" },
      { content: "first question", observation: first },
      { content: "first answer", observation: first },
      { content: "new question", observation: refreshed },
    ];
    expect(messagesForDashboardObservation(messages, first).map(message => message.content)).toEqual(["first question", "first answer"]);
    expect(messagesForDashboardObservation(messages, refreshed).map(message => message.content)).toEqual(["new question"]);
  });

  it("retains original evidence for feedback regeneration after a refresh", () => {
    const first = captureDashboardObservation(reading, 1000)!;
    const second = captureDashboardObservation({ ...reading, logId: 11 }, 2000)!;
    const messages = [{ content: "question", observation: first }, { content: "answer", observation: first },
      { content: "new question", observation: second }];
    expect(messagesForDashboardObservation(messages.slice(0, 1), messages[1].observation)[0].observation.sensorContext.logId).toBe(10);
  });
});
