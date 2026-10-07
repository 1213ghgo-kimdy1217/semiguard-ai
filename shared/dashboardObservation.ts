export type DashboardChatObservation = {
  capturedAt: number;
  sensorContext: {
    current: number; temperature: number; vibration: number; noise: number;
    anomalyScore: number; riskLevel: string; logId?: number;
  };
};

type Reading = {
  sensorData: { current: number; temperature: number; vibration: number; noise: number };
  anomalyScore: number; riskLevel: string; logId?: number;
};

// Copy only the displayed synthetic observation. Missing data is not a normal reading.
export function captureDashboardObservation(reading: Reading | null, capturedAt: number): DashboardChatObservation | null {
  if (!reading || !Number.isFinite(capturedAt)) return null;
  const { current, temperature, vibration, noise } = reading.sensorData;
  if (![current, temperature, vibration, noise, reading.anomalyScore].every(Number.isFinite)) return null;
  return { capturedAt, sensorContext: { current, temperature, vibration, noise,
    anomalyScore: reading.anomalyScore, riskLevel: reading.riskLevel, logId: reading.logId } };
}

// Old stored text has no observation metadata. Keep it visible, but do not pass it
// off as a conversation about newly captured measurements.
export function messagesForDashboardObservation<T extends { observation?: DashboardChatObservation }>(
  messages: T[], observation: DashboardChatObservation,
) {
  return messages.filter(message => message.observation?.capturedAt === observation.capturedAt);
}
