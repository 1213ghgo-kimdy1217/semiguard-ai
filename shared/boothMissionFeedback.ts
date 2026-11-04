import type { BoothSnapshot } from "./boothExperience";

export type MissionFeedbackMarker = Pick<BoothSnapshot, "mode"> & {
  status: BoothSnapshot["mission"]["status"];
  successEventId: number | null;
};

export function missionFeedbackMarker(snapshot: BoothSnapshot): MissionFeedbackMarker {
  return {
    mode: snapshot.mode,
    status: snapshot.mission.status,
    successEventId: snapshot.events.findLast(event => event.type === "success")?.id ?? null,
  };
}

/** A prior result or normal/reset state must never trigger a new celebration. */
export function shouldOpenMissionCompletion(previous: MissionFeedbackMarker | null, current: MissionFeedbackMarker): boolean {
  return previous?.mode === "mission" && previous.status === "active" &&
    current.mode === "mission" && current.status === "won" &&
    current.successEventId !== null && current.successEventId !== previous.successEventId;
}

export type RecoveryGuideStage = "normal" | "abnormal" | "matching" | "holding" | "complete";
/** Floor avoids displaying the stable threshold before the engine reaches it. */
export function matchingQualityPercent(quality: number): string {
  return (Math.floor(Math.max(0, Math.min(1, quality)) * 1_000) / 10).toFixed(1);
}
export function recoveryGuideStage(snapshot: BoothSnapshot): RecoveryGuideStage {
  if (snapshot.mode === "mission" && snapshot.mission.status === "won") return "complete";
  if (Object.values(snapshot.alarms).some(Boolean)) return "abnormal";
  if (snapshot.mode === "mission" && snapshot.mission.status === "active") {
    return snapshot.mission.stableMs > 0 ? "holding" : "matching";
  }
  return "normal";
}
