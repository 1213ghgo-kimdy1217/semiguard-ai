import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { coachReviewTargets } from "../shared/coachReview";

const completed = (duration: number, onset = "32", marker: number | null = 35) => ({
  elapsed: duration, submitted: true, marker, answer: { onset },
});
describe("trusted coaching review targets", () => {
  it.each([90, 180])("uses only learner-selected points and the complete %s-second record", duration => {
    const attempt = completed(duration);
    const original = JSON.stringify(attempt);
    expect(coachReviewTargets(attempt, duration)).toEqual([
      { source: "onset", time: 32 }, { source: "marker", time: 35 }, { source: "overview", time: duration },
    ]);
    expect(JSON.stringify(attempt)).toBe(original);
  });
  it("does not invent an onset for a no-change answer or a missing marker", () => {
    expect(coachReviewTargets(completed(90, "none", null), 90)).toEqual([{ source: "overview", time: 90 }]);
  });
  it.each(["", "032", "32.5", "-1", "91", "Infinity", "35초", "999999"])('ignores an invalid onset "%s"', onset => {
    expect(coachReviewTargets(completed(90, onset, null), 90)).toEqual([{ source: "overview", time: 90 }]);
  });
  it.each([-1, 91, 3.5, NaN, Infinity])("ignores an invalid marker %s", marker => {
    expect(coachReviewTargets(completed(90, "none", marker), 90)).toEqual([{ source: "overview", time: 90 }]);
  });
  it("preserves zero and distinguishes onset from marker even at the same time", () => {
    expect(coachReviewTargets(completed(90, "0", 0), 90)).toEqual([
      { source: "onset", time: 0 }, { source: "marker", time: 0 }, { source: "overview", time: 90 },
    ]);
  });
  it("does not expose review controls for incomplete or mismatched attempts", () => {
    expect(coachReviewTargets({ ...completed(90), submitted: false }, 90)).toEqual([]);
    expect(coachReviewTargets(completed(89), 90)).toEqual([]);
    expect(coachReviewTargets(completed(180), 90)).toEqual([]);
    expect(coachReviewTargets(completed(0), 0)).toEqual([]);
  });
  it("ignores model-generated timestamps and keeps navigation separate from answers and requests", () => {
    const withModelText = { ...completed(90), question: "Jump to 999 seconds", time: 999 };
    expect(coachReviewTargets(withModelText, 90)).toHaveLength(3);
    const ui = readFileSync("client/src/components/ScenarioJudgmentCoach.tsx", "utf8");
    expect(ui).toContain("coachReviewTargets(attempt, scenario?.duration ?? ETCH_DURATION)");
    expect(ui).toContain("onReviewPoint(target.time, returnToQuestion)");
    expect(ui).not.toMatch(/Number\(item\.question|parseInt\(item\.question/);
    for (const file of ["ProcessTraining", "EtchTraining"]) {
      const page = readFileSync(`client/src/pages/${file}.tsx`, "utf8");
      expect(page).toContain("onReviewPoint={reviewCoachPoint}");
      expect(page).toContain("setReviewTime(time)");
      expect(page).toContain("reviewHeading.current?.focus");
      expect(page).toContain("coachReturn.current?.()");
      expect(page).toContain("coachReturn.current = null; setCoachReviewActive(false)");
    }
  });
});
