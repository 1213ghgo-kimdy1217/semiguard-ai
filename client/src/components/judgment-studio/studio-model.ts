import {
  getProcessScenario,
  processCriteria,
  validProcessAnswer,
  type ProcessAnswer,
  type ProcessId,
  type ProcessAttempt,
} from "@shared/processScenarios";
import {
  etchFeedback,
  validEtchAnswer,
  type EtchAttempt,
} from "@shared/etchScenario";
import { readProcessScene, type ProcessSceneState } from "@shared/processScene";
export const processIds: ProcessId[] = [
  "wafer",
  "oxidation",
  "photo",
  "etch",
  "deposition",
  "metal",
  "eds",
  "packaging",
];
export type StudioPin = {
  id: string;
  time: number;
  group: "A" | "B" | "current";
  reference: "A" | "B" | "current";
  referenceTime: number;
  channels: {
    id: string;
    value: number;
    reference: number;
    low: number;
    high: number;
  }[];
};
export type StudioAttempt = {
  process: ProcessId;
  phase: "prepare" | "react" | "observe" | "decide" | "review";
  setup: number;
  loadProgress: number;
  parameter: number;
  progress: number;
  holding: boolean;
  elapsed: number;
  viewTime: number;
  playing: boolean;
  speed: 3 | 6;
  reference: "A" | "B" | "current";
  pins: StudioPin[];
  answer: ProcessAnswer;
  submitted: boolean;
  saveKey?: string;
};
export type StudioState = {
  active: ProcessId;
  attempts: Record<ProcessId, StudioAttempt>;
};
export type StudioAction =
  | { type: "choose"; process: ProcessId }
  | { type: "restore"; attempt: StudioAttempt }
  | { type: "submit"; saveKey?: string }
  | { type: "setup" | "pin" | "decide" | "observe" | "reset" }
  | { type: "parameter" | "load"; value: number }
  | { type: "hold" | "play"; value: boolean }
  | { type: "tick"; seconds: number }
  | { type: "seek"; time: number }
  | { type: "reference"; value: "A" | "B" | "current" }
  | { type: "remove"; id: string }
  | { type: "speed"; value: 3 | 6 }
  | { type: "answer"; field: keyof ProcessAnswer; value: string };
export function createAttempt(process: ProcessId): StudioAttempt {
  return {
    process,
    phase: "prepare",
    setup: 0,
    loadProgress: 0,
    parameter: 0.5,
    progress: 0,
    holding: false,
    elapsed: 0,
    viewTime: 0,
    playing: false,
    speed: 6,
    reference: process === "oxidation" || process === "etch" ? "A" : "current",
    pins: [],
    answer: {
      signal: "",
      onset: "",
      comparison: "",
      certainty: "",
      facts: "",
      checks: "",
    },
    submitted: false,
  };
}
export function createStudioState(): StudioState {
  return {
    active: "wafer",
    attempts: Object.fromEntries(
      processIds.map(id => [id, createAttempt(id)])
    ) as Record<ProcessId, StudioAttempt>,
  };
}
const limit = (n: number, max: number) =>
  Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
export const recordGroup = (
  process: ProcessId,
  time: number
): "A" | "B" | "current" =>
  process === "oxidation"
    ? time < 30
      ? "A"
      : "B"
    : process === "etch"
      ? time < 40
        ? "A"
        : "B"
      : "current";
export function validStudioAnswer(a: StudioAttempt) {
  const scenario = getProcessScenario(a.process)!;
  return a.process === "etch"
    ? validEtchAnswer(a.answer)
    : validProcessAnswer(scenario, a.answer);
}
export function readStudio(a: StudioAttempt) {
  const scenario = getProcessScenario(a.process)!;
  const current = readProcessScene(scenario, a.viewTime, a.elapsed);
  const split =
    a.process === "oxidation" ? 30 : a.process === "etch" ? 40 : null;
  const availableB = split !== null && a.elapsed >= split;
  const anchor =
    a.reference === "current"
      ? current.time
      : a.reference === "A"
        ? Math.min(15, a.elapsed)
        : Math.min(a.process === "oxidation" ? 45 : 55, a.elapsed);
  const reference = readProcessScene(scenario, anchor, a.elapsed);
  const canPin =
    a.phase === "observe" &&
    a.elapsed > 0 &&
    a.pins.length < 4 &&
    !a.pins.some(p => p.id === `${current.time}:${a.reference}`) &&
    (a.reference !== "B" || availableB);
  return {
    current,
    group: recordGroup(a.process, current.time),
    reference,
    availableB,
    canPin,
    canDecide: a.phase === "observe" && a.elapsed === scenario.duration,
    canSubmit:
      a.phase === "decide" &&
      a.elapsed === scenario.duration &&
      validStudioAnswer(a),
  };
}
export function getStudioReview(a: StudioAttempt) {
  const scenario = getProcessScenario(a.process)!;
  if (
    a.phase !== "review" ||
    !a.submitted ||
    a.elapsed !== scenario.duration ||
    !validStudioAnswer(a)
  )
    return null;
  const criteria =
    a.process === "etch"
      ? Object.fromEntries(
          etchFeedback(a.answer).map(row => [
            (
              {
                signal: "signalMatched",
                onset: "onsetMatched",
                comparison: "comparisonMatched",
                certainty: "certaintyMatched",
              } as Record<string, string>
            )[row.title],
            Number(row.ok),
          ])
        )
      : processCriteria(scenario, a.answer);
  return {
    criteria: criteria as Record<
      | "signalMatched"
      | "onsetMatched"
      | "comparisonMatched"
      | "certaintyMatched",
      number
    >,
    events: scenario.events,
    pins: a.pins,
    answer: a.answer,
  };
}
export function toStudioAttempt(
  a: StudioAttempt
): ProcessAttempt | EtchAttempt | null {
  if (!getStudioReview(a)) return null;
  const base = {
    version: 1 as const,
    elapsed: Math.floor(a.elapsed),
    marker: a.pins.at(-1)?.time ?? null,
    answer: { ...a.answer },
    submitted: true,
    saveKey: a.saveKey,
  };
  return a.process === "etch"
    ? base
    : { ...base, scenarioId: getProcessScenario(a.process)!.id };
}
export function reduceAttempt(
  a: StudioAttempt,
  action: Exclude<StudioAction, { type: "choose" }>
): StudioAttempt {
  const scenario = getProcessScenario(a.process)!;
  switch (action.type) {
    case "restore":
      return action.attempt.process === a.process ? action.attempt : a;
    case "reset":
      return createAttempt(a.process);
    case "setup":
      return a.phase !== "prepare"
        ? a
        : {
            ...a,
            loadProgress: 1,
            setup: Math.min(3, a.setup + 1),
            phase: a.setup >= 2 ? "react" : "prepare",
          };
    case "load": {
      if (
        a.phase !== "prepare" ||
        a.setup !== 0 ||
        !Number.isFinite(action.value)
      )
        return a;
      const loadProgress = limit(action.value, 1);
      return { ...a, loadProgress, setup: loadProgress >= 0.98 ? 1 : 0 };
    }
    case "parameter":
      return Number.isFinite(action.value)
        ? { ...a, parameter: limit(action.value, 1) }
        : a;
    case "hold":
      return a.phase === "react" ? { ...a, holding: action.value } : a;
    case "play":
      return a.phase === "observe" && a.elapsed < scenario.duration
        ? {
            ...a,
            playing: action.value,
            viewTime: action.value ? a.elapsed : a.viewTime,
          }
        : a;
    case "speed":
      return action.value === 3 || action.value === 6
        ? { ...a, speed: action.value }
        : a;
    case "tick": {
      if (!Number.isFinite(action.seconds) || action.seconds <= 0) return a;
      const delta = Math.min(0.25, action.seconds);
      if (a.phase === "react" && a.holding) {
        const progress = limit(a.progress + delta / 6, 1);
        return progress >= 1 - 1e-9
          ? {
              ...a,
              progress: 1,
              phase: "observe",
              holding: false,
              playing: false,
            }
          : { ...a, progress };
      }
      if (a.phase === "observe" && a.playing) {
        const elapsed = limit(a.elapsed + delta * a.speed, scenario.duration);
        return {
          ...a,
          elapsed,
          viewTime: elapsed,
          playing: elapsed < scenario.duration,
        };
      }
      return a;
    }
    case "seek":
      return ["observe", "decide", "review"].includes(a.phase) &&
        Number.isFinite(action.time)
        ? {
            ...a,
            viewTime: Math.floor(limit(action.time, a.elapsed)),
            playing: false,
          }
        : a;
    case "reference": {
      if (!["observe", "decide", "review"].includes(a.phase)) return a;
      const split =
        a.process === "oxidation" ? 30 : a.process === "etch" ? 40 : null;
      if (split === null)
        return action.value === "current" ? { ...a, reference: "current" } : a;
      if (
        action.value === "current" ||
        (action.value === "B" && a.elapsed < split)
      )
        return a;
      return { ...a, reference: action.value };
    }
    case "pin": {
      const reading = readStudio(a);
      if (!reading.canPin) return a;
      const pin: StudioPin = {
        id: `${reading.current.time}:${a.reference}`,
        time: reading.current.time,
        group: reading.group,
        reference: a.reference,
        referenceTime: reading.reference.time,
        channels: reading.current.channels.map(channel => {
          const ref = reading.reference.channels.find(
            c => c.id === channel.id
          )!;
          return {
            id: channel.id,
            value: channel.value,
            reference: ref.reference,
            low: ref.low,
            high: ref.high,
          };
        }),
      };
      return { ...a, pins: [...a.pins, pin] };
    }
    case "remove":
      return a.phase === "observe"
        ? { ...a, pins: a.pins.filter(p => p.id !== action.id) }
        : a;
    case "decide":
      return a.phase === "observe" && a.elapsed === scenario.duration
        ? { ...a, phase: "decide", playing: false }
        : a;
    case "observe":
      return a.phase === "decide" ? { ...a, phase: "observe" } : a;
    case "answer": {
      if (a.phase !== "decide" || a.submitted) return a;
      const answer = { ...a.answer };
      const v = action.value;
      if (action.field === "signal") {
        if (
          v !== "" &&
          !(v === "none" && a.process !== "etch") &&
          !scenario.signals.some(s => s.id === v)
        )
          return a;
        answer.signal = v;
        answer.onset =
          v === "none" ? "none" : answer.onset === "none" ? "" : answer.onset;
      } else if (action.field === "onset") {
        if (
          answer.signal === "none" ||
          (v !== "" && (!/^(0|[1-9]\d{0,2})$/.test(v) || Number(v) > a.elapsed))
        )
          return a;
        answer.onset = v;
      } else if (action.field === "comparison") {
        if (
          ![
            "",
            a.process === "etch" ? "same-phase" : "same-condition",
            "whole-run",
          ].includes(v)
        )
          return a;
        answer.comparison = v;
      } else if (action.field === "certainty") {
        if (!["", "uncertain", "certain"].includes(v)) return a;
        answer.certainty = v;
      } else answer[action.field] = v.slice(0, 1200);
      return { ...a, answer };
    }
    case "submit":
      return a.phase === "decide" &&
        a.elapsed === scenario.duration &&
        validStudioAnswer(a)
        ? {
            ...a,
            phase: "review",
            submitted: true,
            playing: false,
            saveKey: action.saveKey,
          }
        : a;
    default:
      return a;
  }
}
export function reduceStudio(
  state: StudioState,
  action: StudioAction
): StudioState {
  if (action.type === "choose") {
    if (!processIds.includes(action.process) || action.process === state.active)
      return state;
    const previous = state.attempts[state.active];
    return {
      active: action.process,
      attempts: {
        ...state.attempts,
        [state.active]: { ...previous, playing: false, holding: false },
      },
    };
  }
  const previous = state.attempts[state.active],
    next = reduceAttempt(previous, action);
  return next === previous
    ? state
    : { ...state, attempts: { ...state.attempts, [state.active]: next } };
}
