import { describe, it, expect } from "vitest";
import {
  initialGenericHandsOn,
  reduceGenericHandsOn as reduce,
  type GenericHandsOnState,
} from "./processHandsOn";
function ready() {
  let state = initialGenericHandsOn();
  for (let step = 0; step < 3; step++)
    state = reduce(state, { type: "advance", step });
  return state;
}
describe("isolated equipment concept exercise", () => {
  it("cannot run before preparation or skip ahead", () => {
    const state = initialGenericHandsOn();
    expect(reduce(state, { type: "start" })).toBe(state);
    expect(reduce(state, { type: "advance", step: 2 })).toBe(state);
    expect(reduce(ready(), { type: "advance", step: 3 }).stage).toBe(3);
  });
  it("freezes die and pad selection when preparation finishes", () => {
    let state = reduce(initialGenericHandsOn(), { type: "select", value: 2 });
    expect(state.selection).toBe(5);
    state = reduce(state, { type: "advance", step: 0 });
    state = reduce(state, { type: "select", value: 2 });
    expect(state.selection).toBe(2);
    state = reduce(state, { type: "advance", step: 1 });
    state = reduce(state, { type: "advance", step: 2 });
    expect(reduce(state, { type: "select", value: 10 })).toBe(state);
  });
  it("pauses without losing progress", () => {
    let state = reduce(ready(), { type: "start" });
    state = reduce(state, { type: "tick", seconds: 0.2 });
    expect(state.progress).toBeGreaterThan(0);
    state = reduce(state, { type: "pause" });
    expect(reduce(state, { type: "tick", seconds: 0.2 })).toBe(state);
    expect(
      reduce(reduce(state, { type: "start" }), { type: "tick", seconds: 0.2 })
        .progress
    ).toBeGreaterThan(state.progress);
  });
  it("completes once and stops", () => {
    let state = reduce(ready(), { type: "start" });
    for (let i = 0; i < 30; i++)
      state = reduce(state, { type: "tick", seconds: 0.25 });
    expect(state.progress).toBe(1);
    expect(state.running).toBe(false);
    expect(reduce(state, { type: "start" })).toBe(state);
    expect(reduce(state, { type: "tick", seconds: 0.25 })).toBe(state);
  });
  it("visual intensity does not invent a physical rate", () => {
    const a = reduce(ready(), { type: "level", value: 0 }),
      b = reduce(ready(), { type: "level", value: 100 });
    expect(
      reduce(reduce(a, { type: "start" }), { type: "tick", seconds: 0.25 })
        .progress
    ).toBe(
      reduce(reduce(b, { type: "start" }), { type: "tick", seconds: 0.25 })
        .progress
    );
  });
  it("switching film and implantation clears previous progress", () => {
    const current = { ...ready(), running: true, progress: 0.8, selection: 9 };
    const switched = reduce(current, { type: "mode", value: "implant" });
    expect(switched).toEqual({ ...initialGenericHandsOn(), mode: "implant" });
    expect(reduce(switched, { type: "reset" }).mode).toBe("implant");
  });
  it.each([NaN, Infinity, -Infinity, 0, -1])(
    "ignores invalid ticks %s",
    seconds => {
      const state = reduce(ready(), { type: "start" });
      expect(reduce(state, { type: "tick", seconds })).toBe(state);
    }
  );
  it("bounds background ticks and selections", () => {
    const state = reduce(ready(), { type: "start" });
    expect(
      reduce(state, { type: "tick", seconds: 3600 }).progress
    ).toBeLessThan(0.1);
    const selectable = reduce(initialGenericHandsOn(), {
      type: "advance",
      step: 0,
    });
    expect(reduce(selectable, { type: "select", value: 500 }).selection).toBe(
      15
    );
    expect(reduce(selectable, { type: "select", value: -500 }).selection).toBe(
      0
    );
    expect(reduce(selectable, { type: "level", value: NaN })).toBe(selectable);
  });
  it("does not mutate supplied state", () => {
    const state = Object.freeze({ ...ready() }) as GenericHandsOnState;
    const next = reduce(state, { type: "start" });
    expect(state.running).toBe(false);
    expect(next.running).toBe(true);
  });
});
