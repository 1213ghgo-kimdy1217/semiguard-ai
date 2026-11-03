import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPrototypeLineFramer, isNextPrototypeFrame, isPrototypeFrameFresh,
  MAX_PROTOTYPE_LINE_LENGTH, parsePrototypeFrame, type PrototypeFrame,
} from "../shared/prototypeProtocol";
import { usePrototypeLink } from "../client/src/hooks/usePrototypeLink";

// Exercise the actual transport callbacks with real Web Streams. Only the small
// React scheduling boundary is replaced; no serial/parser behavior is mocked.
const hookHarness = vi.hoisted(() => ({ latest: null as unknown, cleanups: [] as Array<() => void> }));
vi.mock("react", () => ({
  useState: (initial: unknown) => {
    hookHarness.latest = initial;
    return [initial, (next: unknown) => { hookHarness.latest = next; }];
  },
  useRef: (value: unknown) => ({ current: value }),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (cleanup) hookHarness.cleanups.push(cleanup);
  },
}));

const frame: PrototypeFrame = {
  kind: "semiguard-prototype", version: 1, seq: 2, uptimeMs: 400,
  faultActive: false, ledCommand: "on",
};
const wire = (patch: Record<string, unknown> = {}) => JSON.stringify({ ...frame, ...patch });

describe("prototype wire protocol", () => {
  it("accepts the firmware packet and retains no unrelated input", () => {
    expect(parsePrototypeFrame(wire({ secret: "not forwarded" }))).toEqual(frame);
    expect(parsePrototypeFrame(wire({ faultActive: true, ledCommand: "off" })))
      .toEqual({ ...frame, faultActive: true, ledCommand: "off" });
    expect(parsePrototypeFrame(wire({ resetAck: 42 }))).toEqual({ ...frame, resetAck: 42 });
  });

  it.each(["", "booting...", "{", "null", "[]", "1", '"hello"'])
    ("ignores malformed or non-object input: %s", line => expect(parsePrototypeFrame(line)).toBeNull());

  it.each([-1, 1.2, "2", null, 0x100000000, Number.MAX_SAFE_INTEGER])
    ("rejects an invalid sequence: %s", seq => expect(parsePrototypeFrame(wire({ seq }))).toBeNull());

  it.each([
    { kind: "another-device" }, { version: 2 }, { uptimeMs: -1 }, { uptimeMs: "400" },
    { uptimeMs: 0x100000000 }, { faultActive: "false" }, { faultActive: 0 },
    { ledCommand: true }, { ledCommand: "ON" }, { resetAck: -1 },
    { resetAck: 0x100000000 }, { resetAck: "42" }, { resetAck: 1.5 },
  ])("does not turn a type-invalid packet into current telemetry: %j", patch => {
    expect(parsePrototypeFrame(wire(patch))).toBeNull();
  });

  it("rejects missing fields and oversized JSON", () => {
    const { faultActive: _omitted, ...missing } = frame;
    expect(parsePrototypeFrame(JSON.stringify(missing))).toBeNull();
    expect(parsePrototypeFrame(wire({ padding: "x".repeat(MAX_PROTOTYPE_LINE_LENGTH) }))).toBeNull();
  });

  it("rejects duplicate/backwards packets and accepts uint32 rollover", () => {
    expect(isNextPrototypeFrame(null, frame)).toBe(true);
    expect(isNextPrototypeFrame(frame, { ...frame })).toBe(false);
    expect(isNextPrototypeFrame(frame, { ...frame, seq: 1 })).toBe(false);
    expect(isNextPrototypeFrame(frame, { ...frame, seq: 3 })).toBe(true);
    expect(isNextPrototypeFrame({ ...frame, seq: 0xffffffff }, { ...frame, seq: 0 })).toBe(true);
    expect(isNextPrototypeFrame({ ...frame, seq: 900 }, { ...frame, seq: 0 })).toBe(false);
  });
});

describe("bounded serial line framing", () => {
  it("handles every possible split of a firmware packet without emitting partial JSON", () => {
    const packet = wire();
    for (let split = 0; split <= packet.length; split++) {
      const framer = createPrototypeLineFramer();
      expect(framer.push(packet.slice(0, split))).toEqual([]);
      const lines = framer.push(packet.slice(split) + "\r\n");
      expect(lines.map(parsePrototypeFrame)).toEqual([frame]);
      expect(framer.bufferedLength).toBe(0);
    }
  });

  it("handles several packets in one chunk and blank/invalid lines between them", () => {
    const framer = createPrototypeLineFramer();
    const lines = framer.push(`\nboot\r\n${wire()}\n\r\n${wire({ seq: 3 })}\n`);
    expect(lines.map(parsePrototypeFrame).filter(Boolean)).toEqual([frame, { ...frame, seq: 3 }]);
  });

  it("bounds an unterminated line and recovers only at a newline", () => {
    const framer = createPrototypeLineFramer();
    expect(framer.push("x".repeat(100000))).toEqual([]);
    expect(framer.bufferedLength).toBeLessThanOrEqual(MAX_PROTOTYPE_LINE_LENGTH);
    expect(framer.isDiscarding).toBe(true);
    expect(framer.push(wire() + "\n")).toEqual([]);
    expect(framer.push(wire() + "\n").map(parsePrototypeFrame)).toEqual([frame]);
  });

  it("discards an oversized complete line without losing the next packet", () => {
    const framer = createPrototypeLineFramer();
    const lines = framer.push(`${"x".repeat(MAX_PROTOTYPE_LINE_LENGTH + 1)}\n${wire()}\n`);
    expect(lines.map(parsePrototypeFrame)).toEqual([frame]);
  });

  it("accepts a line at its limit with CRLF and never exceeds the string bound", () => {
    const framer = createPrototypeLineFramer(3);
    expect(framer.push("abc\r")).toEqual([]);
    expect(framer.bufferedLength).toBe(3);
    expect(framer.push("\n")).toEqual(["abc"]);
    expect(framer.push("a😀x")).toEqual([]);
    expect(framer.bufferedLength).toBeLessThanOrEqual(3);
    expect(framer.push("\nabc\n")).toEqual(["abc"]);
  });

  it("reset prevents fragments from different connections being joined", () => {
    const framer = createPrototypeLineFramer();
    framer.push('{"kind":');
    framer.reset();
    expect(framer.push(wire() + "\n").map(parsePrototypeFrame)).toEqual([frame]);
    expect(() => createPrototypeLineFramer(0)).toThrow(RangeError);
  });
});

describe("current observation freshness", () => {
  it("has no current reading before connection or after a two-second gap", () => {
    expect(isPrototypeFrameFresh(null, 10000)).toBe(false);
    expect(isPrototypeFrameFresh(10000, 11999)).toBe(true);
    expect(isPrototypeFrameFresh(10000, 12000)).toBe(false);
    expect(isPrototypeFrameFresh(10000, 50000)).toBe(false);
    expect(isPrototypeFrameFresh(10000, 9999)).toBe(false);
  });
});

describe("prototype USB and explicitly selected demo transport", () => {
  let link: ReturnType<typeof usePrototypeLink> | null = null;
  const current = () => hookHarness.latest as ReturnType<typeof usePrototypeLink>;
  const flush = async () => { for (let turn = 0; turn < 12; turn++) await Promise.resolve(); };
  function makePort(pendingWrite = false) {
    let incoming!: ReadableStreamDefaultController<Uint8Array>;
    let finishWrite: () => void = () => {};
    const writes: string[] = [];
    const port = {
      readable: new ReadableStream<Uint8Array>({ start(controller) { incoming = controller; } }),
      writable: new WritableStream<Uint8Array>({ write(bytes) {
        writes.push(new TextDecoder().decode(bytes));
        if (pendingWrite) return new Promise<void>(resolve => { finishWrite = resolve; });
      } }),
      open: vi.fn(async (_options: { baudRate: number }) => {}),
      close: vi.fn(async () => {}),
    };
    return { port, writes, finishWrite: () => finishWrite(), send: (text: string) => incoming.enqueue(new TextEncoder().encode(text)) };
  }
  function installSerial(port: ReturnType<typeof makePort>["port"]) {
    const api = Object.assign(new EventTarget(), { requestPort: vi.fn(async () => port) });
    vi.stubGlobal("navigator", { serial: api });
    return api;
  }
  beforeEach(() => {
    hookHarness.cleanups = [];
    hookHarness.latest = null;
    vi.useFakeTimers();
    vi.setSystemTime(10000);
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", {});
  });
  afterEach(async () => {
    if (link) await link.disconnect();
    link = null;
    hookHarness.cleanups.forEach(cleanup => cleanup());
    await flush();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("starts without data and does not start demo or request a port by itself", () => {
    const fixture = makePort();
    const api = installSerial(fixture.port);
    link = usePrototypeLink();
    expect(current()).toMatchObject({ mode: "disconnected", status: "idle", frame: null, lastReceivedAt: null });
    expect(api.requestPort).not.toHaveBeenCalled();
    link.startDemo();
    expect(current()).toMatchObject({ mode: "demo", status: "live", frame: { faultActive: false } });
    link.toggleDemoFault();
    expect(current()).toMatchObject({ mode: "demo", frame: { faultActive: true, ledCommand: "off" } });
    expect(api.requestPort).not.toHaveBeenCalled();
  });

  it("handles chunked USB data and never lets invalid/duplicate packets refresh freshness", async () => {
    const fixture = makePort();
    installSerial(fixture.port);
    link = usePrototypeLink();
    await link.connectUsb();
    expect(fixture.port.open).toHaveBeenCalledWith({ baudRate: 115200 });
    expect(current()).toMatchObject({ mode: "usb", status: "waiting", frame: null });
    const packet = wire();
    fixture.send(packet.slice(0, 20));
    await flush();
    expect(current().lastReceivedAt).toBeNull();
    fixture.send(packet.slice(20) + "\r\n");
    await flush();
    expect(current()).toMatchObject({ mode: "usb", status: "live", frame, lastReceivedAt: 10000 });
    await vi.advanceTimersByTimeAsync(1500);
    fixture.send(`not-json\n${wire()}\n${wire({ seq: -1 })}\n`);
    await flush();
    expect(current().lastReceivedAt).toBe(10000);
    await vi.advanceTimersByTimeAsync(500);
    expect(current()).toMatchObject({ mode: "usb", status: "stale", frame: null, lastReceivedAt: 10000 });
    fixture.send(wire({ seq: 3 }) + "\n");
    await flush();
    expect(current()).toMatchObject({ status: "live", frame: { seq: 3 }, lastReceivedAt: 12000 });
    await link.disconnect();
    expect(current()).toMatchObject({ mode: "disconnected", frame: null });
    expect(fixture.port.readable.locked).toBe(false);
    expect(fixture.port.writable.locked).toBe(false);
    expect(fixture.port.close).toHaveBeenCalledTimes(1);
  });

  it("reports a missing handshake after eight seconds without fabricating a frame", async () => {
    const fixture = makePort();
    installSerial(fixture.port);
    link = usePrototypeLink();
    await link.connectUsb();
    fixture.send("booting\n");
    await vi.advanceTimersByTimeAsync(8000);
    expect(current()).toMatchObject({ mode: "usb", status: "waiting", frame: null, lastReceivedAt: null });
    expect(current().error).toContain("8초");
  });

  it("waits for normal board telemetry before confirming RESET", async () => {
    const fixture = makePort();
    installSerial(fixture.port);
    link = usePrototypeLink();
    await link.connectUsb();
    fixture.send(wire({ faultActive: true, ledCommand: "off" }) + "\n");
    await flush();
    let confirmed = false;
    const reset = link.reset().then(() => { confirmed = true; });
    await flush();
    expect(fixture.writes).toHaveLength(1);
    expect(fixture.writes[0]).toMatch(/^RESET [1-9]\d{0,9}\n$/);
    const resetId = Number(fixture.writes[0].trim().split(" ")[1]);
    expect(current().frame?.faultActive).toBe(true);
    expect(confirmed).toBe(false);
    // A physical-button recovery or normal periodic packet is not a command ACK.
    fixture.send(wire({ seq: 3 }) + "\n");
    await flush();
    expect(confirmed).toBe(false);
    fixture.send(wire({ seq: 4, resetAck: resetId === 1 ? 2 : 1 }) + "\n");
    await flush();
    expect(confirmed).toBe(false);
    fixture.send(wire({ seq: 5, resetAck: resetId, faultActive: true, ledCommand: "off" }) + "\n");
    await flush();
    expect(confirmed).toBe(false);
    fixture.send(wire({ seq: 6, resetAck: resetId }) + "\n");
    await reset;
    expect(current().frame?.faultActive).toBe(false);
    expect(confirmed).toBe(true);
  });

  it("times out an unacknowledged RESET without making a fault normal", async () => {
    const fixture = makePort();
    installSerial(fixture.port);
    link = usePrototypeLink();
    await link.connectUsb();
    fixture.send(wire({ faultActive: true, ledCommand: "off" }) + "\n");
    await flush();
    const outcome = link.reset().then(() => "confirmed", () => "rejected");
    await flush();
    await vi.advanceTimersByTimeAsync(3000);
    expect(await outcome).toBe("rejected");
    expect(current().frame).toBeNull();
    expect(current().error).toContain("초기화");
  });

  it("bounds the entire RESET even when write never settles, then releases stream locks", async () => {
    const fixture = makePort(true);
    installSerial(fixture.port);
    link = usePrototypeLink();
    await link.connectUsb();
    fixture.send(wire({ faultActive: true, ledCommand: "off" }) + "\n");
    await flush();
    const outcome = link.reset().then(() => "confirmed", () => "rejected");
    await flush();
    const resetId = Number(fixture.writes[0].trim().split(" ")[1]);
    // Even an early matching ACK must not remove the write deadline.
    fixture.send(wire({ seq: 3, resetAck: resetId }) + "\n");
    await flush();
    await vi.advanceTimersByTimeAsync(3000);
    expect(await outcome).toBe("rejected");
    expect(current()).toMatchObject({ mode: "disconnected", status: "error", frame: null });
    await vi.advanceTimersByTimeAsync(1000);
    expect(fixture.port.readable.locked).toBe(false);
    expect(fixture.port.writable.locked).toBe(false);
    expect(fixture.port.close).toHaveBeenCalledTimes(1);
    fixture.finishWrite();
    await flush();
  });

  it("ignores a USB selection that finishes after switching to explicit demo", async () => {
    const fixture = makePort();
    const api = installSerial(fixture.port);
    let select!: (port: typeof fixture.port) => void;
    api.requestPort.mockImplementation(() => new Promise(resolve => { select = resolve; }));
    link = usePrototypeLink();
    const connecting = link.connectUsb();
    link.startDemo();
    select(fixture.port);
    await connecting;
    expect(fixture.port.open).not.toHaveBeenCalled();
    expect(current()).toMatchObject({ mode: "demo", status: "live" });
  });

  it("closes a port that finishes opening after a newer connection generation", async () => {
    const fixture = makePort();
    installSerial(fixture.port);
    let finishOpen!: () => void;
    fixture.port.open.mockImplementation(() => new Promise(resolve => { finishOpen = resolve; }));
    link = usePrototypeLink();
    const connecting = link.connectUsb();
    await flush();
    link.startDemo();
    finishOpen();
    await connecting;
    expect(fixture.port.close).toHaveBeenCalledTimes(1);
    expect(current()).toMatchObject({ mode: "demo", status: "live" });
  });

  it("releases an existing port even when the next picker throws synchronously", async () => {
    const fixture = makePort();
    const api = installSerial(fixture.port);
    link = usePrototypeLink();
    await link.connectUsb();
    api.requestPort.mockImplementation(() => { throw new Error("picker unavailable"); });
    await link.connectUsb();
    expect(current()).toMatchObject({ mode: "disconnected", status: "error", frame: null });
    expect(fixture.port.readable.locked).toBe(false);
    expect(fixture.port.writable.locked).toBe(false);
    expect(fixture.port.close).toHaveBeenCalledTimes(1);
  });
});
