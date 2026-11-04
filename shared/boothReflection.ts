import {
  BOOTH_CONTROL_LIMITS, BOOTH_SCENARIOS, getBoothScenario,
  type BoothControls, type BoothEvent, type BoothSnapshot, type BoothValues,
  type BoothScenarioId, type SignalKey,
} from "./boothExperience";

export const BOOTH_REFLECTION_STORAGE_KEY = "semiguard.booth-reflections.v1";
export const BOOTH_REFLECTION_LIMIT = 10;
export const BOOTH_REFLECTION_FIELD_LIMIT = 3000;
export const BOOTH_ATTEMPT_SAMPLE_LIMIT = 360;
export type BoothOutcome = "won" | "failed" | "ended" | "cancelled";
export type BoothAttemptSample = BoothValues & { elapsed: number };
export type BoothAttempt = Readonly<{
  version: 1;
  id: string;
  scenarioId: BoothScenarioId;
  scenarioTitle: string;
  outcome: BoothOutcome;
  completedAt: string;
  durationMs: number;
  score: number | null;
  values: Readonly<BoothValues>;
  controls: Readonly<BoothControls>;
  events: readonly BoothEvent[];
  samples: readonly BoothAttemptSample[];
  /** Detached and recursively frozen at runtime, suitable for the review dashboard. */
  finalSnapshot: BoothSnapshot;
}>;
export type BoothReflectionFields = {
  observation: string;
  reasoning: string;
  debrief: string;
};
export type BoothReflectionRecord = Readonly<{
  version: 1;
  attempt: BoothAttempt;
  fields: BoothReflectionFields;
  status: "draft" | "submitted";
  updatedAt: string;
  submittedAt: string | null;
}>;
export type ReflectionStorageIssue = "unavailable" | "invalid";
type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "getItem" | "setItem">;
const SIGNAL_KEYS: SignalKey[] = ["pressure", "gasFlow", "rfPower", "chamberAmbientTemp"];
const CONTROL_KEYS = ["rfSetpoint", "gasSetpoint", "exhaustValve", "matching"] as const;
const OUTCOMES: BoothOutcome[] = ["won", "failed", "ended", "cancelled"];
const EVENT_TYPES: BoothEvent["type"][] = ["control", "fault", "clear", "mission", "success", "timeout", "reset", "mode"];
const MAX_DOCUMENT_LENGTH = 2_000_000;
const MAX_DURATION = 3_600_000;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const number = (value: unknown, min = 0, max = MAX_DURATION): value is number => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const text = (value: unknown, limit: number): value is string => typeof value === "string" && value.length <= limit;
const iso = (value: unknown): value is string => text(value, 40) && Number.isFinite(Date.parse(value));
const validScenario = (value: unknown): value is BoothScenarioId => BOOTH_SCENARIOS.some(item => item.id === value);
const frozen = <T>(value: T): T => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(item => frozen(item));
    Object.freeze(value);
  }
  return value;
};
function values(value: unknown): BoothValues | null {
  if (!object(value) || !SIGNAL_KEYS.every(key => number(value[key], -100, 10_000))) return null;
  return { pressure: value.pressure as number, gasFlow: value.gasFlow as number, rfPower: value.rfPower as number, chamberAmbientTemp: value.chamberAmbientTemp as number };
}
function controls(value: unknown): BoothControls | null {
  if (!object(value) || !CONTROL_KEYS.every(key => number(value[key], BOOTH_CONTROL_LIMITS[key].min, BOOTH_CONTROL_LIMITS[key].max))) return null;
  return { rfSetpoint: value.rfSetpoint as number, gasSetpoint: value.gasSetpoint as number, exhaustValve: value.exhaustValve as number, matching: value.matching as number };
}
function event(value: unknown, durationMs: number): BoothEvent | null {
  if (!object(value) || !number(value.id, 0, Number.MAX_SAFE_INTEGER) || !number(value.atMs, 0, durationMs) ||
    !EVENT_TYPES.includes(value.type as BoothEvent["type"]) || !text(value.message, 300)) return null;
  const result: BoothEvent = { id: value.id, atMs: value.atMs, type: value.type as BoothEvent["type"], message: value.message };
  if (CONTROL_KEYS.includes(value.control as typeof CONTROL_KEYS[number]) && number(value.value, -10_000, 10_000)) {
    result.control = value.control as typeof CONTROL_KEYS[number]; result.value = value.value;
  }
  return result;
}
function sample(value: unknown, durationMs: number): BoothAttemptSample | null {
  if (!object(value) || !number(value.elapsed, 0, durationMs / 1000 + .001)) return null;
  const clean = values(value);
  return clean ? { elapsed: value.elapsed, ...clean } : null;
}

/** Capture engine-relative times, never Date.now offsets, before resetting a run. */
export function captureBoothAttempt(input: {
  id: string;
  scenarioId: BoothScenarioId | string;
  scenarioTitle: string;
  outcome: BoothOutcome;
  snapshot: BoothSnapshot;
  samples?: readonly BoothAttemptSample[];
  startedAtMs?: number;
  afterEventId?: number;
  durationMs?: number;
  completedAt?: string;
}): BoothAttempt {
  const start = input.startedAtMs ?? 0;
  const duration = input.durationMs ?? (input.snapshot.mode === "mission" ? input.snapshot.mission.elapsedMs : Math.max(0, input.snapshot.elapsedMs - start));
  const events = input.snapshot.events.filter(item => item.atMs >= start && item.id > (input.afterEventId ?? -1))
    .map(item => ({ ...item, atMs: item.atMs - start })).filter(item => item.atMs <= duration).slice(-50);
  const samples = (input.samples ?? []).filter(item => item.elapsed * 1000 >= start)
    .map(item => ({ ...item, elapsed: (item.elapsed * 1000 - start) / 1000 }))
    .filter(item => item.elapsed <= duration / 1000 + .001).slice(-BOOTH_ATTEMPT_SAMPLE_LIMIT);
  const result = readBoothAttempt({
    version: 1, id: input.id, scenarioId: input.scenarioId, scenarioTitle: input.scenarioTitle,
    outcome: input.outcome, completedAt: input.completedAt ?? new Date().toISOString(),
    durationMs: duration, score: input.outcome === "won" ? input.snapshot.mission.score : null,
    values: { ...input.snapshot.values }, controls: { ...input.snapshot.controls }, events, samples,
    finalSnapshot: { ...input.snapshot, elapsedMs: duration, events,
      mission: { ...input.snapshot.mission, elapsedMs: duration } },
  });
  if (!result) throw new RangeError("Invalid completed booth attempt");
  return result;
}

/** Stored scenario metadata is reconstructed from the current catalog, not trusted text. */
export function readBoothAttempt(value: unknown): BoothAttempt | null {
  if (!object(value) || value.version !== 1 || !text(value.id, 120) || !value.id.trim() ||
    !validScenario(value.scenarioId) || !text(value.scenarioTitle, 160) || !value.scenarioTitle.trim() ||
    !OUTCOMES.includes(value.outcome as BoothOutcome) || !iso(value.completedAt) ||
    !number(value.durationMs) || !(value.outcome === "won" ? number(value.score, 0, 100) : value.score === null) ||
    !Array.isArray(value.events) || value.events.length > 50 || !Array.isArray(value.samples) || value.samples.length > BOOTH_ATTEMPT_SAMPLE_LIMIT || !object(value.finalSnapshot)) return null;
  const finalValues = values(value.values), finalControls = controls(value.controls), source = value.finalSnapshot;
  const alarms = source.alarms, recovery = source.recovery;
  if (!finalValues || !finalControls || !object(alarms) || !SIGNAL_KEYS.every(key => typeof alarms[key] === "boolean") ||
    !object(recovery) || !["gasDelivery", "exhaust", "matching", "values", "ready"].every(key => typeof recovery[key] === "boolean") ||
    !object(source.mission) || !number(source.lampBrightness, 0, 255) || !number(source.matchingQuality, 0, 1) || typeof source.faultActive !== "boolean" ||
    !["normal", "fault", "stabilizing", "success", "failed", "cancelled"].includes(source.phase as string) || !["free", "mission"].includes(source.mode as string) ||
    !number(source.mission.durationMs, 1, MAX_DURATION) || !number(source.mission.stableMs, 0, MAX_DURATION) || !number(source.mission.goalMs, 1, MAX_DURATION) || !number(source.mission.controlActions, 0, 100_000)) return null;
  const durationMs = value.durationMs;
  const events = value.events.map(item => event(item, durationMs));
  const samples = value.samples.map(item => sample(item, durationMs));
  if (events.some(item => item === null) || samples.some(item => item === null)) return null;
  const cleanEvents = events as BoothEvent[], cleanSamples = samples as BoothAttemptSample[];
  const scenario = getBoothScenario(value.scenarioId);
  const outcome = value.outcome as BoothOutcome;
  const score = outcome === "won" ? value.score as number | null : null;
  const finalSnapshot: BoothSnapshot = {
    selectedScenario: scenario.id,
    scenario: { ...scenario, hints: [...scenario.hints], focusSignals: [...scenario.focusSignals], requiredControls: [...scenario.requiredControls] },
    recovery: { gasDelivery: recovery.gasDelivery as boolean, exhaust: recovery.exhaust as boolean, matching: recovery.matching as boolean, values: recovery.values as boolean, ready: recovery.ready as boolean },
    values: { ...finalValues }, controls: { ...finalControls },
    alarms: { pressure: alarms.pressure as boolean, gasFlow: alarms.gasFlow as boolean, rfPower: alarms.rfPower as boolean, chamberAmbientTemp: alarms.chamberAmbientTemp as boolean },
    lampBrightness: source.lampBrightness, matchingQuality: source.matchingQuality, faultActive: source.faultActive,
    mode: source.mode as BoothSnapshot["mode"],
    phase: outcome === "won" ? "success" : outcome === "failed" ? "failed" : outcome === "cancelled" ? "cancelled" : source.phase as BoothSnapshot["phase"],
    mission: { scenarioId: scenario.id, durationMs: source.mission.durationMs,
      status: outcome === "ended" ? "idle" : outcome, elapsedMs: durationMs,
      remainingMs: Math.max(0, source.mission.durationMs - durationMs),
      stableMs: Math.min(source.mission.stableMs, source.mission.goalMs), goalMs: source.mission.goalMs,
      score, controlActions: source.mission.controlActions },
    events: cleanEvents.map(item => ({ ...item })), elapsedMs: durationMs,
  };
  return frozen({ version: 1, id: value.id.trim(), scenarioId: scenario.id, scenarioTitle: value.scenarioTitle.trim(),
    outcome, completedAt: value.completedAt, durationMs, score, values: finalValues, controls: finalControls,
    events: cleanEvents, samples: cleanSamples, finalSnapshot });
}

export function emptyBoothReflectionFields(): BoothReflectionFields {
  return { observation: "", reasoning: "", debrief: "" };
}
export function validateBoothReflection(fields: BoothReflectionFields): (keyof BoothReflectionFields)[] {
  return (["observation", "reasoning", "debrief"] as const).filter(key =>
    fields[key].trim().replace(/\s/g, "").length < 3 || !/[A-Za-z0-9가-힣ぁ-んァ-ン一-龯]/.test(fields[key]) || fields[key].length > BOOTH_REFLECTION_FIELD_LIMIT);
}
export function createBoothReflectionRecord(attempt: BoothAttempt, fields: BoothReflectionFields, status: "draft" | "submitted", now = new Date().toISOString()): BoothReflectionRecord {
  const clean = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.slice(0, BOOTH_REFLECTION_FIELD_LIMIT)])) as BoothReflectionFields;
  return { version: 1, attempt, fields: clean, status, updatedAt: now, submittedAt: status === "submitted" ? now : null };
}
function record(value: unknown): BoothReflectionRecord | null {
  if (!object(value)) return null;
  const sourceFields = value.fields;
  if (value.version !== 1 || !object(sourceFields) || !["observation", "reasoning", "debrief"].every(key => text(sourceFields[key], BOOTH_REFLECTION_FIELD_LIMIT)) ||
    !["draft", "submitted"].includes(value.status as string) || !iso(value.updatedAt) || !(value.submittedAt === null || iso(value.submittedAt))) return null;
  const attempt = readBoothAttempt(value.attempt);
  const fields: BoothReflectionFields = { observation: sourceFields.observation as string, reasoning: sourceFields.reasoning as string, debrief: sourceFields.debrief as string };
  if (!attempt || value.status === "submitted" && (validateBoothReflection(fields).length > 0 || value.submittedAt === null)) return null;
  return { version: 1, attempt, fields, status: value.status as "draft" | "submitted", updatedAt: value.updatedAt, submittedAt: value.submittedAt as string | null };
}
export function readBoothReflections(raw: string | null): { records: BoothReflectionRecord[]; issue: ReflectionStorageIssue | null } {
  if (raw === null) return { records: [], issue: null };
  if (raw.length > MAX_DOCUMENT_LENGTH) return { records: [], issue: "invalid" };
  try {
    const value: unknown = JSON.parse(raw);
    if (!object(value) || value.version !== 1 || !Array.isArray(value.records) || value.records.length > BOOTH_REFLECTION_LIMIT) return { records: [], issue: "invalid" };
    const records = value.records.map(record);
    if (records.some(item => item === null)) return { records: [], issue: "invalid" };
    return { records: records as BoothReflectionRecord[], issue: null };
  } catch { return { records: [], issue: "invalid" }; }
}
export function loadBoothReflections(storage: ReadStorage): { records: BoothReflectionRecord[]; issue: ReflectionStorageIssue | null } {
  try { return readBoothReflections(storage.getItem(BOOTH_REFLECTION_STORAGE_KEY)); }
  catch { return { records: [], issue: "unavailable" }; }
}
export function saveBoothReflection(storage: WriteStorage, value: BoothReflectionRecord): { ok: true; record: BoothReflectionRecord } | { ok: false; issue: ReflectionStorageIssue } {
  const clean = record(value);
  if (!clean) return { ok: false, issue: "invalid" };
  const previous = loadBoothReflections(storage);
  if (previous.issue) return { ok: false, issue: previous.issue };
  const records = [clean, ...previous.records.filter(item => item.attempt.id !== clean.attempt.id)].slice(0, BOOTH_REFLECTION_LIMIT);
  try { storage.setItem(BOOTH_REFLECTION_STORAGE_KEY, JSON.stringify({ version: 1, records })); return { ok: true, record: clean }; }
  catch { return { ok: false, issue: "unavailable" }; }
}
