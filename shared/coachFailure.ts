import type { JudgmentCoachResult } from "./judgmentCoach";

export type CoachRequestFailure = "session-expired" | "invalid-request" | "request-error";
export type CoachFailure = CoachRequestFailure | Extract<JudgmentCoachResult, { status: "unavailable" }>["reason"];

export function classifyCoachRequestError(error: unknown): CoachRequestFailure {
  if (!error || typeof error !== "object") return "request-error";
  const value = error as { name?: unknown; data?: { code?: unknown } | null };
  if (value.data?.code === "UNAUTHORIZED") return "session-expired";
  if (value.name === "ZodError" || value.data?.code === "BAD_REQUEST" || value.data?.code === "PARSE_ERROR") return "invalid-request";
  return "request-error";
}

const messages: Record<Exclude<CoachFailure, "cooldown">, [string, string, string]> = {
  "session-expired": [
    "로그인 상태를 확인할 수 없어 코칭 요청이 거절됐습니다. 현재 답안은 그대로 두고 다른 창에서 로그인 상태를 확인한 뒤 직접 다시 요청하세요.",
    "The coaching request was rejected because your sign-in could not be verified. Keep this answer open, check your sign-in in another tab, then request coaching manually.",
    "ログイン状態を確認できず、コーチング依頼が拒否されました。現在の回答を開いたまま、別のタブでログイン状態を確認してから手動で再依頼してください。",
  ],
  "invalid-request": [
    "코칭 요청의 답안 형식이나 제출 상태를 확인하지 못했습니다. 페이지를 닫거나 답안을 다시 제출하지 말고, 제출 결과가 표시되어 있는지 확인하세요.",
    "The answer format or submitted state could not be verified. Keep this page open and check that the submission result is displayed; do not resubmit the exercise.",
    "コーチング依頼の回答形式や提出状態を確認できませんでした。ページを閉じたり練習を再提出せず、提出結果が表示されているか確認してください。",
  ],
  "request-error": [
    "서버에서 코칭 요청 결과를 확인하지 못했습니다. 연결 상태를 확인한 뒤 직접 다시 요청하세요. 이 안내만으로 다른 창의 동시 요청 때문이라고 판단할 수는 없습니다.",
    "The coaching request result could not be confirmed by the server. Check your connection, then try again manually. This message alone does not establish a concurrent-tab conflict.",
    "サーバーからコーチング依頼の結果を確認できませんでした。接続を確認して手動で再依頼してください。この案内だけでは別タブの同時依頼が原因とは判断できません。",
  ],
  "not-configured": [
    "서버의 AI 연결 설정이 준비되지 않아 코칭을 요청할 수 없습니다. 운영자의 설정 확인이 필요합니다. 답안을 다시 제출할 필요는 없습니다.",
    "The server's AI connection is not configured for coaching. An administrator needs to check the configuration. You do not need to resubmit your answer.",
    "サーバーのAI接続設定が整っておらず、コーチングを依頼できません。運営者による設定確認が必要です。回答を再提出する必要はありません。",
  ],
  "provider-error": [
    "AI 서비스 연결 또는 응답 완료 단계에서 코칭을 받지 못했습니다. 잠시 뒤 직접 다시 요청할 수 있습니다. 답안을 다시 제출할 필요는 없습니다.",
    "Coaching failed while connecting to the AI service or completing its response. You can try again manually later; you do not need to resubmit your answer.",
    "AIサービスへの接続、または応答の完了時にコーチングを受け取れませんでした。しばらくして手動で再依頼できます。回答を再提出する必要はありません。",
  ],
  "invalid-response": [
    "AI 답변이 형식·언어·근거 또는 안전성 검증을 통과하지 못해 표시하지 않았습니다. 내 답안이 틀렸다는 뜻은 아닙니다. 잠시 뒤 직접 다시 요청할 수 있습니다.",
    "The AI response was not shown because it failed format, language, evidence or safety validation. This does not mean your answer is wrong. You can try again manually later.",
    "AI回答が形式・言語・根拠または安全性の検証を通過せず、表示しませんでした。自分の回答が間違っているという意味ではありません。しばらくして手動で再依頼できます。",
  ],
};

export function coachFailureMessage(failure: CoachFailure, language: "ko" | "en" | "ja", retryAfterSeconds?: number) {
  const index = language === "ko" ? 0 : language === "en" ? 1 : 2;
  const seconds = typeof retryAfterSeconds === "number" && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? Math.ceil(retryAfterSeconds) : 60;
  const heading = failure === "cooldown" ? [
    `다른 창을 포함한 요청이 진행 중이거나 너무 빠르게 반복되어 대기가 필요합니다. 약 ${seconds}초 뒤 직접 다시 요청하세요.`,
    `A request may be active, including in another tab, or requests were repeated too quickly. Try again manually in about ${seconds} seconds.`,
    `別のタブを含む依頼が進行中、または繰り返しが速すぎるため待機が必要です。約${seconds}秒後に手動で再依頼してください。`,
  ][index] : messages[failure][index];
  return `${heading} ${[
    "기준 피드백과 타임라인 복기는 그대로 사용할 수 있으며, 대체 문구를 AI 답변으로 표시하지 않습니다.",
    "Criteria feedback and timeline review remain available. No substitute is presented as an AI response.",
    "基準フィードバックとタイムラインの振り返りはそのまま使えます。代替文をAI回答として表示しません。",
  ][index]}`;
}
