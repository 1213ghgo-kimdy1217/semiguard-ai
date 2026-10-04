export const trainingReviewCriteria = ["signalMatched", "onsetMatched", "comparisonMatched", "certaintyMatched"] as const;
export type TrainingReviewCriterion = typeof trainingReviewCriteria[number];
export type TrainingReviewFilter = "all" | TrainingReviewCriterion;
export type TrainingReviewRecord = Record<TrainingReviewCriterion, number>;

/** The API supplies newest-first, owner-bound records. Never infer ability from this window. */
export function summarizeTrainingReview(records: readonly TrainingReviewRecord[]) {
  const recent = records.slice(0, 20);
  return trainingReviewCriteria.map(key => ({ key,
    reviewed: recent.filter(record => record[key] === 0 || record[key] === 1).length,
    revisit: recent.filter(record => record[key] === 0).length,
  }));
}

/** Read-only filtering: missing or unexpected values are not invented as mismatches. */
export function filterTrainingReview<T extends TrainingReviewRecord>(records: readonly T[], filter: TrainingReviewFilter): T[] {
  const recent = records.slice(0, 20);
  return filter === "all" ? recent : recent.filter(record => record[filter] === 0);
}
