import { describe, expect, it } from "vitest";
import {
  applyBoothAction, BOOTH_MAX_TICK_MS, BOOTH_MISSION_DURATION_MS, BOOTH_RECOVERY_RANGES, BOOTH_SIGNALS,
  createBoothState, getBoothSnapshot, stepBoothState, type BoothState,
} from "./boothExperience";

function advance(initial: BoothState, ms: number): BoothState {
  let state = initial;
  for (let passed = 0; passed < ms; passed += 100) state = stepBoothState(state, Math.min(100, ms - passed));
  return state;
}
function start(seed = 37) {
  return applyBoothAction(createBoothState(seed), { type: "start-mission" });
}
function match(state: BoothState) {
  return applyBoothAction(state, { type: "set-control", control: "matching", value: Math.round(state.matchingOptimum) });
}

describe("one coherent educational booth state", () => {
  it("keeps healthy jitter bounded, seeded and reproducible without alarms", () => {
    const a = advance(createBoothState(123), 30_000);
    const b = advance(createBoothState(123), 30_000);
    expect(a).toEqual(b);
    expect(a.values.pressure).toBeGreaterThan(19);
    expect(a.values.pressure).toBeLessThan(21);
    expect(a.values.gasFlow).toBeGreaterThan(99);
    expect(a.values.gasFlow).toBeLessThan(101);
    expect(a.values.rfPower).toBeGreaterThan(495);
    expect(a.values.rfPower).toBeLessThan(505);
    expect(Object.values(a.alarms).some(Boolean)).toBe(false);
    expect(advance(createBoothState(999), 30_000).values).not.toEqual(a.values);
  });

  it("uses gas and exhaust together to change pressure instead of random independent cards", () => {
    const base = createBoothState(55);
    const higherFlow = advance(applyBoothAction(base, { type: "set-control", control: "gasSetpoint", value: 125 }), 10_000);
    const openValve = advance(applyBoothAction(base, { type: "set-control", control: "exhaustValve", value: 75 }), 10_000);
    expect(higherFlow.values.gasFlow).toBeGreaterThan(124);
    expect(higherFlow.values.pressure).toBeGreaterThan(24);
    expect(higherFlow.alarms.gasFlow).toBe(true);
    expect(higherFlow.alarms.pressure).toBe(true);
    expect(openValve.values.pressure).toBeLessThan(14);
    expect(openValve.values.gasFlow).toBeCloseTo(100, 0);
    // Immutable updates leave the starting state and its nested controls intact.
    expect(base.controls.gasSetpoint).toBe(100);
    expect(base.values.pressure).toBe(20);
  });

  it("faults make RF and its brightness breathe, while unaffected gas stays normal", () => {
    let state = applyBoothAction(createBoothState(91), { type: "inject-fault" });
    const brightness: number[] = [];
    const rf: number[] = [];
    for (let n = 0; n < 60; n++) {
      state = stepBoothState(state, 100);
      if (n > 10) { brightness.push(state.lampBrightness); rf.push(state.values.rfPower); }
    }
    expect(state.alarms.rfPower).toBe(true);
    expect(state.alarms.gasFlow).toBe(false);
    expect(Math.max(...brightness) - Math.min(...brightness)).toBeGreaterThan(20);
    expect(Math.max(...rf) - Math.min(...rf)).toBeGreaterThan(30);
    expect(brightness.every(value => Number.isInteger(value) && value >= 0 && value <= 255)).toBe(true);
    for (let n = 1; n < rf.length; n++) {
      // The light always comes from this same RF snapshot, not a second timer.
      expect(Math.sign(brightness[n] - brightness[n - 1]) || 0).toBe(Math.sign(rf[n] - rf[n - 1]) || 0);
    }
  });

  it("clears the RF alarm only after recovery, so its red overlay returns to white", () => {
    const bad = advance(applyBoothAction(createBoothState(11), { type: "inject-fault" }), 2_000);
    expect(getBoothSnapshot(bad).alarms.rfPower).toBe(true);
    const tuned = match(bad);
    const firstTick = stepBoothState(tuned, 100);
    expect(firstTick.alarms.rfPower).toBe(true);
    const recovered = advance(tuned, 3_000);
    expect(recovered.alarms.rfPower).toBe(false);
    expect(recovered.faultActive).toBe(false);
    expect(getBoothSnapshot(recovered).phase).toBe("normal");
  });

  it("requires adjustment and the complete five-second stable interval to win", () => {
    let state = advance(start(), 2_000);
    expect(state.mission.status).toBe("active");
    expect(state.mission.stableMs).toBe(0);
    state = match(state);
    state = advance(state, 4_900);
    expect(state.mission.status).toBe("active");
    state = advance(state, 2_000);
    expect(state.mission.status).toBe("won");
    expect(state.mission.stableMs).toBe(5_000);
    expect(state.mission.score).toBeGreaterThanOrEqual(30);
    expect(state.mission.score).toBeLessThanOrEqual(100);
    expect(getBoothSnapshot(state).phase).toBe("success");
    expect(state.events.some(event => event.type === "success")).toBe(true);
  });

  it("resets the stability interval when another control disturbs the process", () => {
    let state = advance(match(start(3)), 3_000);
    expect(state.mission.stableMs).toBeGreaterThan(0);
    state = applyBoothAction(state, { type: "set-control", control: "exhaustValve", value: 20 });
    state = advance(state, 2_000);
    expect(state.alarms.pressure).toBe(true);
    expect(state.mission.stableMs).toBe(0);
    expect(state.mission.status).toBe("active");
  });

  it("never awards success for reset, direct clear, or switching modes", () => {
    for (const action of [{ type: "reset" } as const, { type: "clear-fault" } as const, { type: "set-mode", mode: "free" } as const]) {
      const stopped = advance(applyBoothAction(advance(start(6), 1_000), action), 10_000);
      expect(stopped.mission.status).toBe("cancelled");
      expect(stopped.mission.score).toBeNull();
      expect(stopped.events.some(event => event.type === "success")).toBe(false);
    }
  });

  it("times out when the injected cause is left unresolved", () => {
    const state = advance(start(8), BOOTH_MISSION_DURATION_MS + 2_000);
    expect(state.mission.status).toBe("failed");
    expect(state.mission.remainingMs).toBe(0);
    expect(state.mission.score).toBeNull();
    expect(state.events.filter(event => event.type === "timeout")).toHaveLength(1);
  });

  it("awards a full stable interval at the exact deadline even when a timer tick crosses it", () => {
    const settled = advance(match(start(61)), 3_000);
    const nearDeadline: BoothState = { ...settled, mission: { ...settled.mission,
      status: "active", elapsedMs: 89_950, remainingMs: 50, stableMs: 4_950 } };
    const finished = stepBoothState(nearDeadline, 100);
    expect(finished.mission.status).toBe("won");
    expect(finished.mission.elapsedMs).toBe(BOOTH_MISSION_DURATION_MS);
    expect(finished.mission.stableMs).toBe(5_000);
    expect(finished.events.filter(event => event.type === "success")).toHaveLength(1);
    expect(advance(finished, 2_000).events.filter(event => event.type === "success")).toHaveLength(1);
  });

  it("does not count stability earned after the deadline", () => {
    const settled = advance(match(start(62)), 3_000);
    const nearDeadline: BoothState = { ...settled, mission: { ...settled.mission,
      status: "active", elapsedMs: 89_950, remainingMs: 50, stableMs: 4_949 } };
    const finished = stepBoothState(nearDeadline, 100);
    expect(finished.mission.status).toBe("failed");
    expect(finished.mission.elapsedMs).toBe(BOOTH_MISSION_DURATION_MS);
    expect(finished.mission.score).toBeNull();
    expect(finished.events.some(event => event.type === "success")).toBe(false);
  });

  it("publishes recovery ranges that contain each target and fit inside the normal range", () => {
    for (const signal of BOOTH_SIGNALS) {
      const [low, high] = BOOTH_RECOVERY_RANGES[signal.key];
      expect(low).toBeGreaterThanOrEqual(signal.normal[0]);
      expect(high).toBeLessThanOrEqual(signal.normal[1]);
      expect(signal.target).toBeGreaterThanOrEqual(low);
      expect(signal.target).toBeLessThanOrEqual(high);
    }
  });

  it("returns to live free-play status after a completed mission", () => {
    const won = advance(match(start(22)), 8_000);
    expect(won.mission.status).toBe("won");
    const free = applyBoothAction(won, { type: "set-mode", mode: "free" });
    expect(getBoothSnapshot(free).phase).toBe("normal");
    const faultAgain = applyBoothAction(free, { type: "inject-fault" });
    expect(getBoothSnapshot(faultAgain).phase).toBe("fault");
  });

  it("does not reuse an old win when returning to mission selection after free-play changes", () => {
    const won = advance(match(start(22)), 8_000);
    expect(won.mission.status).toBe("won");
    const free = applyBoothAction(won, { type: "set-mode", mode: "free" });
    const changed = advance(applyBoothAction(free, { type: "set-control", control: "rfSetpoint", value: 300 }), 3_000);
    expect(changed.alarms.rfPower).toBe(true);
    const ready = applyBoothAction(changed, { type: "set-mode", mode: "mission" });
    expect(ready.mission.status).toBe("idle");
    expect(ready.mission.score).toBeNull();
    expect(ready.mission.remainingMs).toBe(BOOTH_MISSION_DURATION_MS);
    expect(getBoothSnapshot(ready).phase).toBe("fault");
    expect(ready.events.filter(event => event.type === "success")).toHaveLength(1);
    const retry = applyBoothAction(ready, { type: "start-mission" });
    expect(retry.mission.status).toBe("active");
    expect(retry.controls.rfSetpoint).toBe(500);
  });

  it("validates ticks/controls, clamps runaway ticks, and bounds replay memory", () => {
    const state = createBoothState(7);
    for (const delta of [NaN, Infinity, -50, 0]) expect(stepBoothState(state, delta)).toBe(state);
    expect(stepBoothState(state, 1e9).elapsedMs).toBe(BOOTH_MAX_TICK_MS);
    expect(stepBoothState(state, 1_000)).toEqual(advance(state, 1_000));
    expect(applyBoothAction(state, { type: "set-control", control: "rfSetpoint", value: NaN })).toBe(state);
    expect(applyBoothAction(state, { type: "set-control", control: "rfSetpoint", value: 1e9 }).controls.rfSetpoint).toBe(700);
    let current = state;
    for (let n = 0; n < 150; n++) {
      current = stepBoothState(current, 400);
      current = applyBoothAction(current, { type: "set-control", control: "gasSetpoint", value: n % 2 ? 100 : 101 });
    }
    expect(current.events).toHaveLength(50);
    expect(current.events[49].id).toBeGreaterThan(current.events[0].id);
  });

  it("snapshot callers cannot mutate the engine's live values or timeline", () => {
    const state = applyBoothAction(createBoothState(12), { type: "inject-fault" });
    const shot = getBoothSnapshot(state);
    shot.values.rfPower = 10;
    shot.controls.matching = 0;
    shot.events[0].message = "changed";
    expect(state.values.rfPower).toBe(500);
    expect(state.controls.matching).toBe(50);
    expect(state.events[0].message).not.toBe("changed");
  });
});
