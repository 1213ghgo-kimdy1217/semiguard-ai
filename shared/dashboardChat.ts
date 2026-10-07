export type DashboardChatMessage = {
  role: "user" | "assistant";
  content: string;
  usedFallback?: boolean;
  recoveryPrompt?: string;
};

export const DASHBOARD_CHAT_HISTORY_LIMIT = 12;

export function dashboardChatContextNotice(lang: "ko" | "ja" | "en", hasObservation: boolean) {
  if (!hasObservation) {
    return lang === "ko" ? "다음 질문은 새 관측으로 시작합니다. 화면의 이전 대화는 AI에 전달하지 않습니다."
      : lang === "ja" ? "次の質問は新しい観測で始まります。表示中の以前の会話はAIに送信しません。"
      : "The next question starts a new observation. Earlier visible turns are not sent to AI.";
  }
  return lang === "ko" ? `같은 관측의 최근 대화만 전달합니다(최대 ${DASHBOARD_CHAT_HISTORY_LIMIT}개 메시지). 오래된 대화는 요약하지 않습니다.`
    : lang === "ja" ? `同じ観測の直近の会話のみ送信します（最大${DASHBOARD_CHAT_HISTORY_LIMIT}メッセージ）。古い会話は要約しません。`
    : `Only recent turns for this observation are sent (up to ${DASHBOARD_CHAT_HISTORY_LIMIT} messages). Older turns are not summarized.`;
}

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
  ).slice(-DASHBOARD_CHAT_HISTORY_LIMIT);
  const start = recent.findIndex(message => message.role === "user");
  return recent.slice(Math.max(0, start)).map(({ role, content }) => ({ role, content }));
}
