import { expect, it } from "vitest";
import {
  getStudioReview,
  reduceAttempt,
  toStudioAttempt,
} from "../client/src/components/judgment-studio/studio-model";
import { restoreStudioCheckpoint } from "../client/src/components/judgment-studio/useStudioPersistence";
import { ETCH_DURATION } from "../shared/etchScenario";
import { toTrainingRecord, toTrainingSubmission } from "../shared/trainingRecord";

it("resumes a partial etch decision and preserves the completed judgment while reviewing another time", () => {
  const attemptKey = "6fdcc8d8-662f-4daf-a3b9-d264fcdf495e";
  let attempt = restoreStudioCheckpoint("etch", {
    version: 1,
    scenarioId: "etch-chamber-a-01",
    elapsed: 90,
    marker: 72,
    stage: "decision",
    signal: "pressure",
    onset: "70",
    comparison: "same-phase",
    certainty: "uncertain",
  });
  expect(attempt).toMatchObject({
    phase: "observe",
    viewTime: 90,
    playing: false,
    answer: { facts: "", checks: "" },
  });
  expect(reduceAttempt(attempt, { type: "submit", saveKey: attemptKey })).toBe(attempt);

  attempt = reduceAttempt(attempt, { type: "play", value: true });
  for (let tick = 0; tick < 60; tick++) {
    attempt = reduceAttempt(attempt, { type: "tick", seconds: 0.25 });
  }
  expect(attempt.elapsed).toBe(ETCH_DURATION);
  attempt = reduceAttempt(attempt, { type: "decide" });
  attempt = reduceAttempt(attempt, { type: "answer", field: "facts", value: "Pressure differs from its same-phase reference." });
  attempt = reduceAttempt(attempt, { type: "answer", field: "checks", value: "Compare flow at the same time and phase." });
  attempt = reduceAttempt(attempt, { type: "submit", saveKey: attemptKey });

  const feedback = { signalMatched: 1, onsetMatched: 1, comparisonMatched: 1, certaintyMatched: 1 };
  expect(getStudioReview(attempt)?.criteria).toEqual(feedback);
  const reviewed = reduceAttempt(attempt, { type: "seek", time: 40 });
  expect(reviewed.viewTime).toBe(40);
  const completed = toStudioAttempt(reviewed);
  expect(completed?.saveKey).toBe(attemptKey);
  const submission = toTrainingSubmission(completed!);
  expect(submission).not.toHaveProperty("answer");
  expect(toTrainingRecord(submission)).toMatchObject({
    scenarioId: "etch-chamber-a-01",
    signal: "pressure",
    onset: 70,
    marker: 72,
    ...feedback,
  });
});
