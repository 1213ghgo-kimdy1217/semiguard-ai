import { describe, expect, it } from "vitest";
import {
  BOOTH_STALE_MS, createBoothCommandGate, createBoothLineFramer,
  isBoothFrameFresh, isNextBoothFrame, normalizeBoothLampState,
  parseBoothDeviceFrame, serializeBoothLampCommand,
  type BoothDeviceFrame,
} from "./boothProtocol";

const frame = (patch: Partial<BoothDeviceFrame> = {}): BoothDeviceFrame => ({
  kind: "semiguard-experience", version: 2, seq: 1, uptimeMs: 10,
  ledBrightness: 0, commandAck: 0, faultActive: false, watchdogOff: true, ...patch,
});

describe("optional booth v2 protocol", () => {
  it("accepts only the expected version and sanitizes extra fields", () => {
    expect(parseBoothDeviceFrame(JSON.stringify({ ...frame(), extra: "ignored" }))).toEqual(frame());
    for (const patch of [{ kind: "other" }, { version: 1 }, { ledBrightness: 256 },
      { ledBrightness: -1 }, { ledBrightness: 1.5 }, { faultActive: 1 },
      { commandAck: -1 }, { seq: 4294967296 }, { uptimeMs: "10" }, { watchdogOff: 1 }]) {
      expect(parseBoothDeviceFrame(JSON.stringify({ ...frame(), ...patch }))).toBeNull();
    }
    expect(parseBoothDeviceFrame("null")).toBeNull();
    expect(parseBoothDeviceFrame("[]")).toBeNull();
    expect(parseBoothDeviceFrame("{")).toBeNull();
    expect(parseBoothDeviceFrame(" ".repeat(385))).toBeNull();
  });

  it("handles sequence wrap and rejects duplicates, older and ambiguous frames", () => {
    const old = frame({ seq: 0xffffffff });
    expect(isNextBoothFrame(old, frame({ seq: 0 }))).toBe(true);
    expect(isNextBoothFrame(frame({ seq: 50 }), frame({ seq: 50 }))).toBe(false);
    expect(isNextBoothFrame(frame({ seq: 50 }), frame({ seq: 49 }))).toBe(false);
    expect(isNextBoothFrame(frame({ seq: 0 }), frame({ seq: 0x80000000 }))).toBe(false);
  });

  it("serializes only a bounded ASCII command and rejects malformed output", () => {
    expect(serializeBoothLampCommand(3, { lampBrightness: 120.4, faultActive: true })).toBe("EXPERIENCE 3 120 1\n");
    expect(serializeBoothLampCommand(0xffffffff, { lampBrightness: 255, faultActive: false })).toBe("EXPERIENCE 4294967295 255 0\n");
    for (const lampBrightness of [NaN, Infinity, -1, 256]) {
      expect(normalizeBoothLampState({ lampBrightness, faultActive: false })).toBeNull();
      expect(() => serializeBoothLampCommand(1, { lampBrightness, faultActive: false })).toThrow();
    }
    expect(() => serializeBoothLampCommand(-1, { lampBrightness: 0, faultActive: false })).toThrow();
    expect(() => serializeBoothLampCommand(1, { lampBrightness: 0, faultActive: "yes" as unknown as boolean })).toThrow();
  });

  it("frames arbitrary chunks and recovers after an overlong line", () => {
    const f = createBoothLineFramer();
    const a = JSON.stringify(frame());
    expect(f.push(a.slice(0, 7))).toEqual([]);
    expect(f.push(a.slice(7) + "\r\n" + a + "\n")).toEqual([a, a]);
    expect(f.push("x".repeat(500))).toEqual([]);
    expect(f.bufferedLength).toBeLessThanOrEqual(384);
    expect(f.push("ignored\n" + a + "\n")).toEqual([a]);
  });
});

describe("bounded command gate", () => {
  it("continues from the device ACK on reconnect and wraps command identifiers", () => {
    const g = createBoothCommandGate();
    g.accept(frame({ commandAck: 41, ledBrightness: 80 }), 0);
    g.offer({ lampBrightness: 80, faultActive: false }, 0);
    expect(g.next(0)?.id).toBe(42);
    expect(g.accept(frame({ seq: 2, commandAck: 41, ledBrightness: 80 }), 1).acknowledged).toBe(false);
    expect(g.pending?.id).toBe(42);
    g.reset(); g.accept(frame({ commandAck: 0xffffffff }), 10);
    g.offer({ lampBrightness: 20, faultActive: false }, 10);
    expect(g.next(10)?.id).toBe(0);
  });

  it("never emits before a handshake or after sample expiry", () => {
    const g = createBoothCommandGate();
    expect(g.offer({ lampBrightness: 200, faultActive: true }, 100)).toBe(false);
    expect(g.next(100)).toBeNull();
    g.accept(frame(), 100);
    expect(g.offer({ lampBrightness: 200, faultActive: true }, 110)).toBe(true);
    expect(g.next(BOOTH_STALE_MS + 100)).toBeNull();
    expect(isBoothFrameFresh(100, 100 + BOOTH_STALE_MS)).toBe(false);
    expect(isBoothFrameFresh(100, 99)).toBe(false);
  });

  it("coalesces many offers while one command awaits an exact acknowledgement", () => {
    const g = createBoothCommandGate(); g.accept(frame(), 0);
    g.offer({ lampBrightness: 30, faultActive: true }, 1);
    const one = g.next(1)!;
    for (let i = 0; i < 1000; i++) g.offer({ lampBrightness: i % 256, faultActive: true }, 20);
    expect(g.next(101)).toBeNull();
    expect(g.accept(frame({ seq: 2, commandAck: one.id, ledBrightness: 31, faultActive: true, watchdogOff: false }), 102).acknowledged).toBe(false);
    expect(g.pending?.id).toBe(one.id);
    expect(g.accept(frame({ seq: 3, commandAck: one.id, ledBrightness: 30, faultActive: true, watchdogOff: false }), 103).acknowledged).toBe(true);
    expect(g.lastAckAt).toBe(103); expect(g.acknowledgedBrightness).toBe(30);
    const two = g.next(103)!;
    expect(two.lampBrightness).toBe(999 % 256); expect(two.id).toBe(2);
  });

  it("limits rate, refreshes steady output as a watchdog heartbeat, and drops old intent", () => {
    const g = createBoothCommandGate(); g.accept(frame(), 0);
    g.offer({ lampBrightness: 80, faultActive: false }, 0);
    const one = g.next(0)!;
    g.accept(frame({ seq: 2, commandAck: one.id, ledBrightness: 80, watchdogOff: false }), 1);
    g.offer({ lampBrightness: 90, faultActive: false }, 20);
    expect(g.next(99)).toBeNull(); expect(g.next(100)?.lampBrightness).toBe(90);
    g.accept(frame({ seq: 3, commandAck: 2, ledBrightness: 90, watchdogOff: false }), 110);
    g.offer({ lampBrightness: 90, faultActive: false }, 500);
    expect(g.next(599)).toBeNull(); expect(g.next(600)?.lampBrightness).toBe(90);
    g.reset(); g.accept(frame(), 1000); g.offer({ lampBrightness: 200, faultActive: true }, 1001);
    expect(g.next(1402)).toBeNull();
    g.reset(); expect(g.pending).toBeNull(); expect(g.previous).toBeNull(); expect(g.next(1500)).toBeNull();
  });
});
