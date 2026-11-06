import { describe, expect, it } from "vitest";
import {
  initialEtchHandsOn,
  reduceEtchHandsOn,
  etchHandsOnReady,
  initialPhotoHandsOn,
  reducePhotoHandsOn,
  type EtchHandsOnState,
  type PhotoHandsOnState,
} from "./processHandsOn";

function pumpReady() {
  let state = reduceEtchHandsOn(initialEtchHandsOn(), { type: "load" });
  state = reduceEtchHandsOn(state, { type: "pump" });
  for (let count = 0; count < 12; count++)
    state = reduceEtchHandsOn(state, { type: "tick", seconds: 0.25 });
  expect(state.pump).toBe("ready");
  return state;
}
function readyEtch() {
  let state = reduceEtchHandsOn(pumpReady(), { type: "gas" });
  state = reduceEtchHandsOn(state, { type: "rf" });
  expect(etchHandsOnReady(state)).toBe(true);
  return state;
}
const etchTicks = (state: EtchHandsOnState, count: number) => {
  for (let index = 0; index < count; index++)
    state = reduceEtchHandsOn(state, { type: "tick", seconds: 0.25 });
  return state;
};
const photoTicks = (state: PhotoHandsOnState, count: number) => {
  for (let index = 0; index < count; index++)
    state = reducePhotoHandsOn(state, { type: "tick", seconds: 0.25 });
  return state;
};

describe("etch hands-on sequence", () => {
  it("requires loading, pump readiness, gas and RF before starting", () => {
    const empty = initialEtchHandsOn();
    expect(reduceEtchHandsOn(empty, { type: "start" })).toEqual(empty);
    expect(reduceEtchHandsOn(empty, { type: "pump" })).toEqual(empty);
    expect(reduceEtchHandsOn(empty, { type: "gas" })).toEqual(empty);
    expect(reduceEtchHandsOn(empty, { type: "rf" })).toEqual(empty);
    const loaded = reduceEtchHandsOn(empty, { type: "load" });
    const pumping = reduceEtchHandsOn(loaded, { type: "pump" });
    expect(reduceEtchHandsOn(pumping, { type: "start" }).running).toBe(false);
    const pumped = pumpReady();
    expect(reduceEtchHandsOn(pumped, { type: "rf" })).toEqual(pumped);
    const gasOnly = reduceEtchHandsOn(pumped, { type: "gas" });
    expect(reduceEtchHandsOn(gasOnly, { type: "start" }).running).toBe(false);
    expect(reduceEtchHandsOn(readyEtch(), { type: "start" }).running).toBe(
      true
    );
  });

  it.each(["gas-off", "gas-zero", "rf-zero", "rf-off"] as const)(
    "turns off RF and stops progress for %s",
    condition => {
      let active = reduceEtchHandsOn(readyEtch(), { type: "start" });
      active = etchTicks(active, 3);
      const halted =
        condition === "gas-off"
          ? reduceEtchHandsOn(active, { type: "gas" })
          : condition === "rf-off"
            ? reduceEtchHandsOn(active, { type: "rf" })
            : reduceEtchHandsOn(active, {
                type: condition === "gas-zero" ? "gasLevel" : "rfLevel",
                value: 0,
              });
      expect(halted.running).toBe(false);
      expect(halted.rfOn).toBe(false);
      expect(etchHandsOnReady(halted)).toBe(false);
      expect(etchTicks(halted, 20).progress).toBe(halted.progress);
    }
  );

  it("bounds progress, stops all active process inputs at completion, and resets the whole exercise", () => {
    const complete = etchTicks(
      reduceEtchHandsOn(readyEtch(), { type: "start" }),
      200
    );
    expect(complete.progress).toBe(1);
    expect(complete.pumpProgress).toBe(1);
    expect(complete).toMatchObject({
      running: false,
      rfOn: false,
      gasOn: false,
    });
    expect(reduceEtchHandsOn(complete, { type: "start" })).toEqual(complete);
    expect(reduceEtchHandsOn(complete, { type: "gas" })).toEqual(complete);
    expect(etchTicks(complete, 100)).toEqual(complete);
    expect(reduceEtchHandsOn(complete, { type: "reset" })).toEqual(
      initialEtchHandsOn()
    );
  });

  it("pauses without losing progress, while positive control levels do not invent an etch-rate model", () => {
    const low = reduceEtchHandsOn(
      reduceEtchHandsOn(readyEtch(), { type: "gasLevel", value: 10 }),
      { type: "rfLevel", value: 10 }
    );
    const high = reduceEtchHandsOn(
      reduceEtchHandsOn(readyEtch(), { type: "gasLevel", value: 95 }),
      { type: "rfLevel", value: 95 }
    );
    const lowRunning = etchTicks(reduceEtchHandsOn(low, { type: "start" }), 8);
    const highRunning = etchTicks(
      reduceEtchHandsOn(high, { type: "start" }),
      8
    );
    expect(lowRunning.progress).toBe(highRunning.progress);
    const paused = reduceEtchHandsOn(lowRunning, { type: "pause" });
    expect(etchTicks(paused, 12).progress).toBe(lowRunning.progress);
    expect(
      etchTicks(reduceEtchHandsOn(paused, { type: "start" }), 1).progress
    ).toBeGreaterThan(paused.progress);
  });

  it.each([NaN, Infinity, -Infinity, 0, -1])(
    "ignores invalid or non-positive tick seconds %s",
    seconds => {
      const active = reduceEtchHandsOn(readyEtch(), { type: "start" });
      expect(reduceEtchHandsOn(active, { type: "tick", seconds })).toEqual(
        active
      );
    }
  );

  it.each([NaN, Infinity, -Infinity])(
    "normalizes invalid control input %s to zero and leaves a finite stopped state",
    value => {
      const active = reduceEtchHandsOn(readyEtch(), { type: "start" });
      for (const type of ["gasLevel", "rfLevel"] as const) {
        const result = reduceEtchHandsOn(active, { type, value });
        expect(result[type]).toBe(0);
        expect(result).toMatchObject({ running: false, rfOn: false });
        for (const key of [
          "gasLevel",
          "rfLevel",
          "pumpProgress",
          "progress",
        ] as const)
          expect(Number.isFinite(result[key])).toBe(true);
      }
    }
  );

  it("caps a delayed frame and keeps controls within their conceptual 0–100 range", () => {
    const active = reduceEtchHandsOn(readyEtch(), { type: "start" });
    expect(
      reduceEtchHandsOn(active, { type: "tick", seconds: 10000 }).progress
    ).toBe(reduceEtchHandsOn(active, { type: "tick", seconds: 0.25 }).progress);
    expect(
      reduceEtchHandsOn(active, { type: "gasLevel", value: 150.6 }).gasLevel
    ).toBe(100);
    expect(
      reduceEtchHandsOn(active, { type: "rfLevel", value: -20 }).rfLevel
    ).toBe(0);
  });
});

describe("photo hands-on sequence", () => {
  it("requires exposure before development and captures the chosen alignment at exposure", () => {
    const initial = initialPhotoHandsOn();
    expect(reducePhotoHandsOn(initial, { type: "develop" })).toEqual(initial);
    const aligned = reducePhotoHandsOn(initial, {
      type: "offset",
      value: -13.6,
    });
    expect(aligned.offset).toBe(-14);
    const exposing = reducePhotoHandsOn(aligned, { type: "expose" });
    expect(exposing).toMatchObject({
      phase: "exposing",
      exposureOffset: -14,
      exposureProgress: 0,
    });
    expect(reducePhotoHandsOn(exposing, { type: "develop" })).toEqual(exposing);
    expect(reducePhotoHandsOn(exposing, { type: "offset", value: 30 })).toEqual(
      exposing
    );
    const midway = photoTicks(exposing, 3);
    expect(reducePhotoHandsOn(midway, { type: "expose" })).toEqual(midway);
  });

  it("keeps the exposed alignment snapshot through development and bounds completion", () => {
    const shifted = reducePhotoHandsOn(initialPhotoHandsOn(), {
      type: "offset",
      value: 31,
    });
    const exposed = photoTicks(
      reducePhotoHandsOn(shifted, { type: "expose" }),
      40
    );
    expect(exposed).toMatchObject({
      phase: "exposed",
      exposureOffset: 31,
      exposureProgress: 1,
    });
    expect(reducePhotoHandsOn(exposed, { type: "offset", value: 0 })).toEqual(
      exposed
    );
    const developing = reducePhotoHandsOn(exposed, { type: "develop" });
    expect(reducePhotoHandsOn(developing, { type: "expose" })).toEqual(
      developing
    );
    const complete = photoTicks(developing, 100);
    expect(complete).toMatchObject({
      phase: "complete",
      exposureOffset: 31,
      exposureProgress: 1,
      developmentProgress: 1,
    });
    expect(photoTicks(complete, 100)).toEqual(complete);
    expect(
      reducePhotoHandsOn(complete, { type: "offset", value: -36 })
    ).toEqual(complete);
    expect(reducePhotoHandsOn(complete, { type: "reset" })).toEqual(
      initialPhotoHandsOn()
    );
  });

  it.each([NaN, Infinity, -Infinity])(
    "ignores invalid alignment input %s",
    value => {
      const state = initialPhotoHandsOn();
      expect(reducePhotoHandsOn(state, { type: "offset", value })).toEqual(
        state
      );
    }
  );

  it.each([NaN, Infinity, -Infinity, 0, -3])(
    "ignores invalid or non-positive exposure ticks %s",
    seconds => {
      const exposing = reducePhotoHandsOn(initialPhotoHandsOn(), {
        type: "expose",
      });
      expect(reducePhotoHandsOn(exposing, { type: "tick", seconds })).toEqual(
        exposing
      );
    }
  );

  it("clamps alignment and caps long frames without jumping over the phase sequence", () => {
    expect(
      reducePhotoHandsOn(initialPhotoHandsOn(), { type: "offset", value: 1000 })
        .offset
    ).toBe(36);
    expect(
      reducePhotoHandsOn(initialPhotoHandsOn(), {
        type: "offset",
        value: -1000,
      }).offset
    ).toBe(-36);
    const exposing = reducePhotoHandsOn(initialPhotoHandsOn(), {
      type: "expose",
    });
    const result = reducePhotoHandsOn(exposing, {
      type: "tick",
      seconds: 10000,
    });
    expect(result.phase).toBe("exposing");
    expect(result.exposureProgress).toBeGreaterThan(0);
    expect(result.exposureProgress).toBeLessThan(1);
    expect(result.developmentProgress).toBe(0);
  });

  it("leaves input states unchanged", () => {
    const etch = Object.freeze(initialEtchHandsOn());
    const photo = Object.freeze(initialPhotoHandsOn());
    expect(reduceEtchHandsOn(etch, { type: "load" }).loaded).toBe(true);
    expect(reducePhotoHandsOn(photo, { type: "offset", value: 0 }).offset).toBe(
      0
    );
    expect(etch.loaded).toBe(false);
    expect(photo.offset).toBe(24);
  });
});
