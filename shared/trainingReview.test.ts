import { describe, expect, it } from "vitest";
import { filterTrainingReview, summarizeTrainingReview, trainingReviewCriteria } from "./trainingReview";

const record = (id: number) => ({ id, signalMatched: 1, onsetMatched: 1, comparisonMatched: 1, certaintyMatched: 1 });

describe("recent saved-choice review, not a competency assessment", () => {
  it("keeps all four dimensions with zero counts for empty history", () => {
    expect(summarizeTrainingReview([])).toEqual(trainingReviewCriteria.map(key => ({ key, reviewed: 0, revisit: 0 })));
    expect(filterTrainingReview([], "all")).toEqual([]);
  });
  it("counts mismatches independently without treating one record as four attempts", () => {
    const rows = [record(3), { ...record(2), onsetMatched: 0, certaintyMatched: 0 }, { ...record(1), onsetMatched: 0 }];
    expect(summarizeTrainingReview(rows)).toEqual([
      { key: "signalMatched", reviewed: 3, revisit: 0 }, { key: "onsetMatched", reviewed: 3, revisit: 2 },
      { key: "comparisonMatched", reviewed: 3, revisit: 0 }, { key: "certaintyMatched", reviewed: 3, revisit: 1 },
    ]);
  });
  it("only uses the latest twenty supplied records and preserves their order", () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ ...record(25 - i), onsetMatched: i < 20 ? 1 : 0 }));
    expect(summarizeTrainingReview(rows).find(x => x.key === "onsetMatched")).toEqual({ key: "onsetMatched", reviewed: 20, revisit: 0 });
    expect(filterTrainingReview(rows, "all").map(x => x.id)).toEqual(rows.slice(0, 20).map(x => x.id));
    expect(filterTrainingReview(rows, "onsetMatched")).toEqual([]);
  });
  it.each(trainingReviewCriteria)("filters only explicit mismatches for %s", key => {
    const rows = [record(3), { ...record(2), [key]: 0 }, record(1)];
    expect(filterTrainingReview(rows, key).map(x => x.id)).toEqual([2]);
  });
  it("does not guess a mismatch from a marker, a no-deviation answer or a missing criterion", () => {
    const rows = [{ ...record(1), signal: "none", onset: -1, marker: null },
      { ...record(2), onsetMatched: undefined }, { ...record(3), onsetMatched: 2 }] as any;
    expect(summarizeTrainingReview(rows).find(x => x.key === "onsetMatched")).toEqual({ key: "onsetMatched", reviewed: 1, revisit: 0 });
    expect(filterTrainingReview(rows, "onsetMatched")).toEqual([]);
  });
  it("does not mutate saved records or include prose and identity in summaries", () => {
    const row = Object.freeze({ ...record(1), onsetMatched: 0, userId: 41, facts: "private draft" });
    const rows = Object.freeze([row]);
    expect(filterTrainingReview(rows, "onsetMatched")[0]).toBe(row);
    expect(JSON.stringify(summarizeTrainingReview(rows))).not.toMatch(/private|userId|facts/);
    expect(row.onsetMatched).toBe(0);
  });
});
