export type CoachReviewTarget = { source: "onset" | "marker" | "overview"; time: number };
type ReviewAttempt = { elapsed: number; submitted: boolean; marker: number | null; answer: { onset: string } };

// Navigation is derived from the completed local attempt, never from AI prose.
export function coachReviewTargets(attempt: ReviewAttempt, duration: number): CoachReviewTarget[] {
  if (!Number.isInteger(duration) || duration <= 0 || !attempt.submitted || attempt.elapsed !== duration) return [];
  const validTime = (value: number) => Number.isInteger(value) && value >= 0 && value <= duration;
  const targets: CoachReviewTarget[] = [];
  if (/^(0|[1-9]\d{0,2})$/.test(attempt.answer.onset) && validTime(Number(attempt.answer.onset))) {
    targets.push({ source: "onset", time: Number(attempt.answer.onset) });
  }
  if (attempt.marker !== null && validTime(attempt.marker)) targets.push({ source: "marker", time: attempt.marker });
  targets.push({ source: "overview", time: duration });
  return targets;
}
