import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ETCH_STORAGE_KEY, restoreEtchAttempt, type EtchAttempt } from "@shared/etchScenario";
import { getProcessScenario, restoreProcessAttempt, type ProcessAttempt, type ProcessId } from "@shared/processScenarios";
import { readProcessScene } from "@shared/processScene";
import { restoreTrainingDraft, toTrainingDraft, type TrainingDraft } from "@shared/trainingDraft";
import { toProcessTrainingSubmission, toTrainingSubmission } from "@shared/trainingRecord";
import { trpc } from "../../lib/trpc";
import { createAttempt, recordGroup, toStudioAttempt, type StudioAttempt, type StudioPin } from "./studio-model";

type CanonicalAttempt = EtchAttempt | ProcessAttempt;
type SaveStatus = "idle" | "saving" | "saved" | "failed";
const restoredReview = Symbol("restoredReview");
type RestoredAttempt = StudioAttempt & { [restoredReview]?: "idle" | "saved" };
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const reference = z.enum(["A", "B", "current"]);
const sessionSchema = z.object({
  version: z.literal(1),
  attempt: z.unknown(),
  phase: z.enum(["prepare", "react", "observe", "decide", "review"]),
  setup: z.number().int().min(0).max(3),
  loadProgress: z.number().min(0).max(1),
  progress: z.number().min(0).max(1),
  parameter: z.number().min(0).max(1),
  viewTime: z.number().int().min(0).max(180),
  speed: z.union([z.literal(3), z.literal(6)]),
  reference,
  pins: z.array(z.object({
    time: z.number().int().min(0).max(180),
    reference,
    referenceTime: z.number().int().min(0).max(180),
  })).max(4),
  savedKey: z.string().regex(uuid).optional(),
});

const storageKey = (userId: number, processId: ProcessId) =>
  `semiguard.judgment-studio.v1.${processId}.${userId}`;

function readSession(key: string) {
  try {
    const parsed = sessionSchema.safeParse(JSON.parse(sessionStorage.getItem(key) ?? "null"));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function makePin(
  processId: ProcessId,
  elapsed: number,
  time: number,
  referenceKind: StudioPin["reference"],
  referenceTime: number
): StudioPin {
  const scenario = getProcessScenario(processId)!;
  const current = readProcessScene(scenario, time, elapsed);
  const baseline = readProcessScene(scenario, referenceTime, elapsed);
  return {
    id: `${time}:${referenceKind}`,
    time,
    group: recordGroup(processId, time),
    reference: referenceKind,
    referenceTime,
    channels: current.channels.map((channel, index) => ({
      id: channel.id,
      value: channel.value,
      reference: baseline.channels[index].reference,
      low: baseline.channels[index].low,
      high: baseline.channels[index].high,
    })),
  };
}

function canonicalFields(a: StudioAttempt): CanonicalAttempt {
  const fields: EtchAttempt = {
    version: 1,
    elapsed: Math.floor(a.elapsed),
    marker: a.pins.at(-1)?.time ?? null,
    answer: a.answer,
    submitted: a.submitted,
    saveKey: a.saveKey,
  };
  return a.process === "etch"
    ? fields
    : { ...fields, scenarioId: getProcessScenario(a.process)!.id };
}

function restoreCanonical(processId: ProcessId, raw: string | null) {
  return processId === "etch"
    ? restoreEtchAttempt(raw)
    : restoreProcessAttempt(getProcessScenario(processId)!, raw);
}

function fromCanonical(
  processId: ProcessId,
  attempt: CanonicalAttempt,
  phase: StudioAttempt["phase"],
  savedKey?: string
): RestoredAttempt {
  const initial = createAttempt(processId);
  const duration = getProcessScenario(processId)!.duration;
  const observe = attempt.elapsed > 0 || phase === "observe" || phase === "decide";
  const key = attempt.submitted
    ? attempt.saveKey && uuid.test(attempt.saveKey) ? attempt.saveKey : crypto.randomUUID()
    : undefined;
  return {
    ...initial,
    phase: attempt.submitted ? "review" : phase === "decide" && attempt.elapsed === duration ? "decide" : observe ? "observe" : "prepare",
    setup: observe || attempt.submitted ? 3 : initial.setup,
    loadProgress: observe || attempt.submitted ? 1 : initial.loadProgress,
    progress: observe || attempt.submitted ? 1 : initial.progress,
    elapsed: attempt.elapsed,
    viewTime: attempt.elapsed,
    pins: attempt.marker === null ? [] : [makePin(processId, attempt.elapsed, attempt.marker, "current", attempt.marker)],
    answer: attempt.answer,
    submitted: attempt.submitted,
    saveKey: key,
    [restoredReview]: key ? key === savedKey ? "saved" : "idle" : undefined,
  };
}

export function restoreStudioSession(userId: number, processId: ProcessId): StudioAttempt {
  const snapshot = readSession(storageKey(userId, processId));
  if (snapshot) {
    const canonical = restoreCanonical(processId, JSON.stringify(snapshot.attempt));
    if (canonical) {
      const restored = fromCanonical(processId, canonical, snapshot.phase, snapshot.savedKey);
      const preparation = restored.phase === "prepare";
      const availableB = processId === "oxidation" ? restored.elapsed >= 30 : processId === "etch" && restored.elapsed >= 40;
      const pins = snapshot.pins
        .filter(pin => pin.time <= restored.elapsed && pin.referenceTime <= restored.elapsed && (pin.reference !== "B" || availableB))
        .map(pin => makePin(processId, restored.elapsed, pin.time, pin.reference, pin.referenceTime));
      return {
        ...restored,
        phase: preparation && snapshot.phase === "react" ? "react" : restored.phase,
        setup: preparation ? snapshot.phase === "react" ? 3 : Math.min(2, snapshot.setup) : restored.setup,
        loadProgress: preparation ? snapshot.loadProgress : restored.loadProgress,
        progress: preparation && snapshot.phase === "react" ? snapshot.progress : restored.progress,
        parameter: snapshot.parameter,
        viewTime: Math.min(snapshot.viewTime, restored.elapsed),
        speed: snapshot.speed,
        reference: processId === "etch" || processId === "oxidation"
          ? snapshot.reference === "B" && availableB ? "B" : "A"
          : "current",
        pins: (pins.at(-1)?.time ?? null) === canonical.marker ? pins : restored.pins,
      };
    }
  }
  try {
    const scenarioId = getProcessScenario(processId)!.id;
    const legacyKey = processId === "etch"
      ? `${ETCH_STORAGE_KEY}.${userId}`
      : `semiguard.process-training.v1.${scenarioId}.${userId}`;
    const canonical = restoreCanonical(processId, sessionStorage.getItem(legacyKey));
    if (canonical) return fromCanonical(processId, canonical, "prepare");
  } catch { /* Tab storage can be unavailable. */ }
  return createAttempt(processId);
}

export function captureStudioCheckpoint(a: StudioAttempt): TrainingDraft {
  const stage = a.phase === "decide" ? "decision" : a.phase === "observe" ? "observe" : "brief";
  return toTrainingDraft(getProcessScenario(a.process)!.id, canonicalFields(a), stage);
}

export function restoreStudioCheckpoint(processId: ProcessId, draft: TrainingDraft): StudioAttempt {
  const restored = restoreTrainingDraft(draft);
  if (restored.scenarioId !== getProcessScenario(processId)!.id) throw new Error("Checkpoint belongs to another process");
  return fromCanonical(processId, restored, draft.stage === "decision" ? "decide" : draft.stage === "observe" ? "observe" : "prepare");
}

function writeSession(key: string, a: StudioAttempt, saveStatus: SaveStatus) {
  try {
    const savedKey = a.saveKey && (
      saveStatus === "saved" || readSession(key)?.savedKey === a.saveKey
    ) ? a.saveKey : undefined;
    sessionStorage.setItem(key, JSON.stringify({
      version: 1,
      attempt: canonicalFields(a),
      phase: a.phase,
      setup: a.setup,
      loadProgress: a.loadProgress,
      progress: a.progress,
      parameter: a.parameter,
      viewTime: Math.floor(a.viewTime),
      speed: a.speed,
      reference: a.reference,
      pins: a.pins.map(({ time, reference, referenceTime }) => ({ time, reference, referenceTime })),
      savedKey,
    }));
  } catch { /* The open tab still holds the current attempt. */ }
}

function markSessionSaved(key: string, attemptKey: string) {
  const snapshot = readSession(key);
  if (!snapshot || !snapshot.attempt || typeof snapshot.attempt !== "object" ||
    !("saveKey" in snapshot.attempt) || snapshot.attempt.saveKey !== attemptKey) return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ ...snapshot, savedKey: attemptKey }));
  } catch { /* A later retry still uses the same key while this tab is open. */ }
}

export function useStudioPersistence({ a, userId }: { a: StudioAttempt; userId: number }) {
  const utils = trpc.useUtils();
  const { mutateAsync } = trpc.training.saveAttempt.useMutation({ retry: false });
  const key = storageKey(userId, a.process);
  const completed = toStudioAttempt(a);
  const canonicalAttempt: CanonicalAttempt | null = completed ? { ...completed, saveKey: a.saveKey } : null;
  const restored = (a as RestoredAttempt)[restoredReview];
  const statusKey = a.saveKey && canonicalAttempt ? `${key}:${a.saveKey}` : null;
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});
  const saveStatus = statusKey ? statuses[statusKey] ?? restored ?? "idle" : "idle";
  const saving = useRef(new Set<string>());
  const started = useRef(new Set<string>());
  const latest = useRef({ key, a, saveStatus });
  const lastWrite = useRef({ key: "", time: 0 });
  useEffect(() => {
    const previous = latest.current;
    if (previous.key !== key) writeSession(previous.key, previous.a, previous.saveStatus);
    latest.current = { key, a, saveStatus };
    const now = Date.now();
    if (lastWrite.current.key !== key || !a.holding && !a.playing || now - lastWrite.current.time >= 500) {
      writeSession(key, a, saveStatus);
      lastWrite.current = { key, time: now };
    }
  }, [key, a, saveStatus]);
  useEffect(() => {
    const flush = () => {
      const current = latest.current;
      writeSession(current.key, current.a, current.saveStatus);
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      // A withdrawal may already have removed the tab's account-scoped data.
      if (readSession(latest.current.key)) flush();
    };
  }, []);

  const retrySave = useCallback(async () => {
    const attemptKey = canonicalAttempt?.saveKey;
    if (!canonicalAttempt || !attemptKey || !statusKey || latest.current.key !== key ||
      saveStatus === "saved" || saving.current.has(statusKey)) return;
    saving.current.add(statusKey);
    started.current.add(statusKey);
    writeSession(key, a, "saving");
    setStatuses(previous => ({ ...previous, [statusKey]: "saving" }));
    try {
      const attempt = "scenarioId" in canonicalAttempt
        ? toProcessTrainingSubmission(canonicalAttempt)
        : toTrainingSubmission(canonicalAttempt);
      const result = await mutateAsync({ attemptKey, attempt });
      if (result.saved !== true) throw new Error("Attempt save was not confirmed");
      markSessionSaved(key, attemptKey);
      setStatuses(previous => ({ ...previous, [statusKey]: "saved" }));
      void utils.training.history.invalidate();
      void utils.training.progress.invalidate();
    } catch {
      setStatuses(previous => ({ ...previous, [statusKey]: "failed" }));
    } finally {
      saving.current.delete(statusKey);
    }
  }, [a, canonicalAttempt, key, mutateAsync, saveStatus, statusKey, utils]);

  useEffect(() => {
    if (statusKey && !restored && !started.current.has(statusKey)) void retrySave();
  }, [statusKey, restored, retrySave]);

  return { canonicalAttempt, saveStatus, retrySave };
}
