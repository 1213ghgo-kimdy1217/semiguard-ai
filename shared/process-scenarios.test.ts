import { describe, expect, it } from "vitest";
import { processLessons } from "./learningHub";
import { ETCH_SCENARIO_ID } from "./trainingRecord";
import { emptyProcessAttempt, getProcessScenario, processChoiceCriteria, processCriteria, processSample, processSamples, processScenarios, restoreProcessAttempt, scenarioHref, validProcessAnswer, type ProcessAnswer, type ProcessScenario } from "./processScenarios";

const get = (id: string) => getProcessScenario(id)!;
const newScenarios = processScenarios.filter(scenario => scenario.processId !== "etch");
const correctAnswer = (scenario: ProcessScenario): ProcessAnswer => ({
  signal: scenario.expectedSignal, onset: scenario.changeTime === null ? "none" : String(scenario.changeTime),
  comparison: "same-condition", certainty: "uncertain",
  facts: "같은 검사 조건의 가상 참고 기록과 관찰 사실을 비교했습니다.",
  checks: "같은 위치와 조건의 기존 가상 기록을 더 비교하겠습니다.",
});

describe("eight-process scenario catalogue", () => {
  it("uses process-based titles without a conflicting legacy scenario number", () => {
    expect(get("etch").title).toEqual([
      "식각 · 단계별 센서 기록 비교",
      "Etch · comparing sensor records by stage",
      "エッチング・段階別のセンサー記録を比較",
    ]);
    for (const scenario of processScenarios) {
      expect(scenario.title.join(" ")).not.toMatch(/scenario\s*0?1|시나리오\s*1|シナリオ\s*0?1/i);
    }
  });

  it("matches the learning taxonomy in order and retains the existing etch identity", () => {
    expect(processScenarios.map(scenario => scenario.processId)).toEqual(processLessons.map(lesson => lesson.id));
    expect(processScenarios.map(scenario => scenario.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(processScenarios.map(scenario => scenario.id)).size).toBe(8);
    expect(get("etch")).toMatchObject({ id: ETCH_SCENARIO_ID, order: 4, duration: 180 });
    expect(scenarioHref(get("etch"))).toBe("/training");
    for (const scenario of newScenarios) {
      expect(getProcessScenario(scenario.id)).toBe(scenario);
      expect(scenario.duration).toBe(90);
      expect(scenarioHref(scenario)).toBe(`/training/process/${scenario.processId}`);
    }
    expect(getProcessScenario("unknown")).toBeUndefined();
  });

  it("provides three languages and concept-only references for every entry", () => {
    for (const scenario of processScenarios) {
      for (const text of [scenario.title, scenario.equipment, scenario.briefing, scenario.objective, scenario.referenceRule, scenario.referenceTitle, ...scenario.signals.flatMap(signal => [signal.name, signal.location]), ...scenario.events.map(event => event.label)]) {
        expect(text).toHaveLength(3);
        expect(text.every(value => value.trim().length > 0)).toBe(true);
      }
      expect(scenario.referenceUrl).toBe(processLessons.find(lesson => lesson.id === scenario.processId)?.source);
      expect(scenario.referenceTitle[0]).toContain("가상 기록의 출처 아님");
      expect(new Set(scenario.signals.map(signal => signal.id)).size).toBe(scenario.signals.length);
      expect(scenario.events.every(event => event.time >= 0 && event.time <= scenario.duration)).toBe(true);
    }
  });
});

describe("process relative-index records", () => {
  it("replays bounded deterministic records without showing future points", () => {
    for (const scenario of newScenarios) {
      const signal = scenario.signals[0].id;
      expect(processSamples(scenario, signal, 12)).toEqual(processSamples(scenario, signal, 12));
      expect(processSamples(scenario, signal, 12).at(-1)?.time).toBe(12);
      expect(processSamples(scenario, signal, 12)).toHaveLength(13);
      expect(processSamples(scenario, signal, 999)).toHaveLength(91);
      for (const value of [NaN, Infinity, -5]) expect(processSample(scenario, signal, value).time).toBe(0);
      expect(processSample(scenario, signal, 999).time).toBe(90);
      expect(processSample(scenario, signal, 1.9).time).toBe(1);
      expect(() => processSample(scenario, "unknown", 0)).toThrow("Unknown process signal");
    }
    expect(() => processSample(get("etch"), "pressure", 0)).toThrow("existing etch");
  });

  it("treats the oxidation stage change as normal at its matching reference", () => {
    const scenario = get("oxidation");
    expect(scenario.expectedSignal).toBe("none");
    expect(scenario.changeTime).toBeNull();
    const before = processSample(scenario, "film", 29);
    const after = processSample(scenario, "film", 30);
    expect(after.reference - before.reference).toBeGreaterThan(17);
    for (const signal of scenario.signals) expect(processSamples(scenario, signal.id, 90).every(row => row.value >= row.low && row.value <= row.high)).toBe(true);
  });

  it("distinguishes persistent, transient, repeating, region and recovery patterns", () => {
    const wafer = get("wafer");
    expect(processSample(wafer, "surface", 90).value).toBeGreaterThan(processSample(wafer, "surface", 45).value);
    expect(processSample(wafer, "surface", 90).value).toBeGreaterThan(processSample(wafer, "surface", 90).high);
    const photo = get("photo");
    expect(processSample(photo, "position", 35).value).toBeGreaterThan(processSample(photo, "position", 35).high);
    expect(processSample(photo, "position", 45).value).toBeLessThan(processSample(photo, "position", 45).high);
    const deposition = get("deposition");
    expect(processSample(deposition, "film", 47).value).toBeGreaterThan(processSample(deposition, "film", 47).low);
    expect(processSample(deposition, "film", 48).value).toBeLessThan(processSample(deposition, "film", 48).low);
    expect(processSample(deposition, "film", 90).value).toBeLessThan(processSample(deposition, "film", 90).low);
    const metal = get("metal");
    for (const time of [42, 54, 66]) expect(processSample(metal, "connection", time).value).toBeGreaterThan(processSample(metal, "connection", time).high);
    for (const time of [48, 60, 72]) expect(processSample(metal, "connection", time).value).toBeLessThan(processSample(metal, "connection", time).high);
    const eds = get("eds");
    expect(processSample(eds, "die", 59).value).toBeLessThan(processSample(eds, "die", 59).high);
    expect(processSample(eds, "die", 60).value).toBeGreaterThan(processSample(eds, "die", 60).high);
    const packaging = get("packaging");
    expect(processSample(packaging, "connection", 68).value).toBeLessThan(processSample(packaging, "connection", 68).low);
    expect(processSample(packaging, "connection", 90).value).toBeGreaterThan(processSample(packaging, "connection", 90).low);
    for (const scenario of newScenarios) for (const signal of scenario.signals.filter(signal => signal.id !== scenario.expectedSignal)) {
      expect(processSamples(scenario, signal.id, 90).every(row => row.value >= row.low && row.value <= row.high)).toBe(true);
    }
  });
});

describe("process judgments and saved attempts", () => {
  it("accepts coherent no-change answers and evaluates structured choices only", () => {
    for (const scenario of newScenarios) {
      const answer = correctAnswer(scenario);
      expect(validProcessAnswer(scenario, answer)).toBe(true);
      expect(processCriteria(scenario, answer)).toEqual({ signalMatched: 1, onsetMatched: 1, comparisonMatched: 1, certaintyMatched: 1 });
      const { signal, onset, comparison, certainty } = answer;
      expect(processChoiceCriteria(scenario, { signal, onset, comparison, certainty })).toEqual(processCriteria(scenario, answer));
      expect(processCriteria(scenario, { ...answer, comparison: "whole-run", certainty: "certain" })).toMatchObject({ comparisonMatched: 0, certaintyMatched: 0 });
      expect(validProcessAnswer(scenario, { ...answer, facts: " " })).toBe(false);
      expect(validProcessAnswer(scenario, { ...answer, checks: "x".repeat(1201) })).toBe(false);
      expect(validProcessAnswer(scenario, { ...answer, signal: "unknown" })).toBe(false);
      expect(() => processCriteria(scenario, emptyProcessAttempt(scenario).answer)).toThrow();
      expect(() => processChoiceCriteria(scenario, { signal: "unknown", onset, comparison, certainty })).toThrow();
    }
    const oxidation = get("oxidation");
    expect(validProcessAnswer(oxidation, { ...correctAnswer(oxidation), onset: "-1" })).toBe(false);
    expect(validProcessAnswer(oxidation, { ...correctAnswer(oxidation), onset: "30" })).toBe(false);
    expect(validProcessAnswer(oxidation, { ...correctAnswer(oxidation), signal: "film" })).toBe(false);
    const wafer = get("wafer");
    for (const invalid of ["-1", "91", "1.5", "01", "NaN", "none"]) expect(validProcessAnswer(wafer, { ...correctAnswer(wafer), onset: invalid })).toBe(false);
    expect(processCriteria(wafer, { ...correctAnswer(wafer), onset: "30" }).onsetMatched).toBe(1);
    expect(processCriteria(wafer, { ...correctAnswer(wafer), onset: "31" }).onsetMatched).toBe(0);
    expect(validProcessAnswer(get("etch"), correctAnswer(get("etch")))).toBe(false);
  });

  it("restores drafts by scenario and bounds markers and answer times to observations", () => {
    const scenario = get("wafer");
    const initial = emptyProcessAttempt(scenario);
    expect(restoreProcessAttempt(scenario, JSON.stringify(initial))).toEqual(initial);
    expect(restoreProcessAttempt(scenario, "bad")).toBeNull();
    expect(restoreProcessAttempt(scenario, null)).toBeNull();
    expect(restoreProcessAttempt(get("photo"), JSON.stringify(initial))).toBeNull();
    for (const elapsed of [-1, 91, 1.5]) expect(restoreProcessAttempt(scenario, JSON.stringify({ ...initial, elapsed }))).toBeNull();
    for (const marker of [-1, 1, .5]) expect(restoreProcessAttempt(scenario, JSON.stringify({ ...initial, marker }))).toBeNull();
    expect(restoreProcessAttempt(scenario, JSON.stringify({ ...initial, elapsed: 20, answer: correctAnswer(scenario) }))).toBeNull();
    expect(restoreProcessAttempt(scenario, JSON.stringify({ ...initial, submitted: true }))?.submitted).toBe(false);
    const complete = { ...initial, elapsed: 90, marker: 25, answer: correctAnswer(scenario), submitted: true, saveKey: "24b9b384-16f3-40d5-a8af-e0b8d939815a" };
    expect(restoreProcessAttempt(scenario, JSON.stringify(complete))).toEqual(complete);
    expect(restoreProcessAttempt(scenario, JSON.stringify({ ...complete, elapsed: 80 }))?.submitted).toBe(false);
    expect(restoreProcessAttempt(scenario, JSON.stringify({ ...complete, saveKey: "bad" }))?.saveKey).toBeUndefined();
    expect(restoreProcessAttempt(scenario, JSON.stringify({ ...complete, answer: { ...complete.answer, comparison: "same-phase" } }))).toBeNull();
    expect(restoreProcessAttempt(scenario, JSON.stringify({ ...complete, answer: { ...complete.answer, certainty: "maybe" } }))).toBeNull();
    expect(restoreProcessAttempt(scenario, JSON.stringify({ ...complete, answer: { ...complete.answer, signal: "none", onset: "25" } }))).toBeNull();
    const oxidation = get("oxidation");
    expect(restoreProcessAttempt(oxidation, JSON.stringify({ ...emptyProcessAttempt(oxidation), elapsed: 90, answer: correctAnswer(oxidation), submitted: true }))?.submitted).toBe(true);
    expect(restoreProcessAttempt(get("etch"), JSON.stringify(emptyProcessAttempt(get("etch"))))).toBeNull();
  });
});
