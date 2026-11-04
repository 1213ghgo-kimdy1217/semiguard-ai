import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BoothNormalGuide } from "../client/src/components/BoothMissionFeedback";
import { applyBoothAction, BOOTH_ALARM_CLEAR_MS, BOOTH_RECOVERY_RANGES, BOOTH_SIGNALS, createBoothState, getBoothSnapshot, stepBoothState, type BoothSnapshot } from "./boothExperience";
import { matchingQualityPercent, missionFeedbackMarker, recoveryGuideStage, shouldOpenMissionCompletion, type MissionFeedbackMarker } from "./boothMissionFeedback";

function completedMission(seed = 91): { active: BoothSnapshot; won: BoothSnapshot } {
  let state = applyBoothAction(createBoothState(seed), { type: "start-mission" });
  // A deterministic plant setting exercises a real successful engine transition.
  state = applyBoothAction(state, { type: "set-control", control: "matching", value: state.matchingOptimum });
  let active = getBoothSnapshot(state);
  for (let tick = 0; tick < 850 && state.mission.status === "active"; tick++) {
    active = getBoothSnapshot(state);
    state = stepBoothState(state, 100);
  }
  expect(state.mission.status).toBe("won");
  return { active, won: getBoothSnapshot(state) };
}

describe("recovery mission completion feedback", () => {
  it("announces a genuine active-to-won transition once, not every following tick", () => {
    const { active, won } = completedMission();
    expect(shouldOpenMissionCompletion(missionFeedbackMarker(active), missionFeedbackMarker(won))).toBe(true);
    expect(shouldOpenMissionCompletion(missionFeedbackMarker(won), missionFeedbackMarker(won))).toBe(false);
    expect(shouldOpenMissionCompletion(null, missionFeedbackMarker(won))).toBe(false);
  });

  it("does not celebrate initial normal values, reset, cancellation, or timeouts", () => {
    const normal = getBoothSnapshot(createBoothState());
    const active = applyBoothAction(createBoothState(), { type: "start-mission" });
    expect(shouldOpenMissionCompletion(null, missionFeedbackMarker(normal))).toBe(false);
    for (const action of [{ type: "reset" }, { type: "clear-fault" }, { type: "set-mode", mode: "free" }] as const) {
      expect(shouldOpenMissionCompletion(missionFeedbackMarker(getBoothSnapshot(active)), missionFeedbackMarker(getBoothSnapshot(applyBoothAction(active, action))))).toBe(false);
    }
    let timedOut = active;
    for (let tick = 0; tick < 90; tick++) timedOut = stepBoothState(timedOut, 1_000);
    expect(timedOut.mission.status).toBe("failed");
    expect(shouldOpenMissionCompletion(missionFeedbackMarker(getBoothSnapshot(active)), missionFeedbackMarker(getBoothSnapshot(timedOut)))).toBe(false);
  });

  it("can announce a later successful attempt after a previous result was closed", () => {
    const first = completedMission(11), next = completedMission(92);
    expect(shouldOpenMissionCompletion(missionFeedbackMarker(first.won), missionFeedbackMarker(next.active))).toBe(false);
    expect(shouldOpenMissionCompletion(missionFeedbackMarker(next.active), missionFeedbackMarker(next.won))).toBe(true);
    const sameEvent: MissionFeedbackMarker = { mode: "mission", status: "active", successEventId: 7 };
    expect(shouldOpenMissionCompletion(sameEvent, { ...sameEvent, status: "won" })).toBe(false);
  });
});

describe("normal-value guidance", () => {
  it("does not round an unstable matching value up to the 87 percent threshold", () => {
    expect(matchingQualityPercent(.866)).toBe("86.6");
    expect(matchingQualityPercent(.86999)).toBe("86.9");
    expect(matchingQualityPercent(.87)).toBe("87.0");
  });
  it("renders every current value, target, normal band, and exact recovery band from the engine", () => {
    const snapshot = getBoothSnapshot(createBoothState());
    snapshot.alarms = { pressure: true, gasFlow: true, rfPower: true, chamberAmbientTemp: true };
    const markup = renderToStaticMarkup(createElement(BoothNormalGuide, { snapshot, language: "ko", onRecommended: () => {} }));
    for (const signal of BOOTH_SIGNALS) {
      expect(markup).toContain(`${signal.normal[0]}–${signal.normal[1]} ${signal.unit}`);
      expect(markup).toContain(`${BOOTH_RECOVERY_RANGES[signal.key][0]}–${BOOTH_RECOVERY_RANGES[signal.key][1]}`);
      expect(markup).toContain(`<strong>${signal.target} <small>${signal.unit}</small></strong>`);
    }
    expect(markup).toContain(`${BOOTH_ALARM_CLEAR_MS / 1000}초`);
    expect(markup).toContain("기본 운전값 맞추기");
  });

  it("explains matching versus a running five-second hold even while all values look normal", () => {
    const snapshot = getBoothSnapshot(createBoothState());
    snapshot.mode = "mission"; snapshot.mission.status = "active";
    expect(recoveryGuideStage(snapshot)).toBe("matching");
    snapshot.mission.stableMs = 100;
    expect(recoveryGuideStage(snapshot)).toBe("holding");
    snapshot.alarms.rfPower = true;
    expect(recoveryGuideStage(snapshot)).toBe("abnormal");
    snapshot.mission.status = "won";
    expect(recoveryGuideStage(snapshot)).toBe("complete");
  });

  it("keeps the compact control guide brief while recovery criteria remain available on demand", () => {
    const snapshot = getBoothSnapshot(createBoothState());
    snapshot.mode = "mission"; snapshot.mission.status = "active"; snapshot.matchingQuality = .866;
    const markup = renderToStaticMarkup(createElement(BoothNormalGuide, { snapshot, language: "ko", onRecommended: () => {}, compact: true }));
    expect(markup).not.toContain("<table");
    expect(markup).not.toContain("현재");
    expect(markup).toContain("수치는 정상 · RF 매칭을 안정화해요");
    expect(markup).toContain("86.6%");
    expect(markup).toContain('data-stable="false"');
    const details = markup.match(/<details\b[^>]*>[\s\S]*?<\/details>/)?.[0];
    expect(details).toBeDefined();
    expect(details).not.toMatch(/<details[^>]*\bopen\b/);
    expect(details).toContain("정상 판정 기준");
    expect(details).toContain(`${BOOTH_ALARM_CLEAR_MS / 1000}초`);
    for (const signal of BOOTH_SIGNALS) {
      expect(details).toContain(`${BOOTH_RECOVERY_RANGES[signal.key][0]}–${BOOTH_RECOVERY_RANGES[signal.key][1]} ${signal.unit}`);
    }
  });
});
