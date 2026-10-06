export type DashboardChatMessage = {
  role: "user" | "assistant";
  content: string;
  usedFallback?: boolean;
  recoveryPrompt?: string;
};

const serviceReplyMarkers = [
  "[규칙 기반 근거 요약]", "[ルールベースの根拠要約]", "[Rule-based Evidence Summary]",
  "[기본 안전 진단]", "[基本安全診断]", "[Baseline Safety Diagnosis]",
  "AI 상담 연결 중 일시적인 지연", "AI相談への接続中に一時的な遅延", "Temporary delay connecting to AI consultation",
  "응답 생성 중 오류가 발생했습니다.", "回答の生成中にエラーが発生しました。", "Error generating response. Please try again.",
];

// Greetings and service failures are UI status, not previous model answers.
// Keep the original text intact; never invent a summary of omitted turns.
export function prepareDashboardChatHistory(messages: DashboardChatMessage[]) {
  const firstQuestion = messages.findIndex(message => message.role === "user");
  if (firstQuestion < 0) return [];
  const recent = messages.slice(firstQuestion).filter(message =>
    message.role === "user" || (!message.usedFallback && !message.recoveryPrompt &&
      !serviceReplyMarkers.some(marker => message.content.includes(marker)))
  ).slice(-12);
  const start = recent.findIndex(message => message.role === "user");
  return recent.slice(Math.max(0, start)).map(({ role, content }) => ({ role, content }));
}
