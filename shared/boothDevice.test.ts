import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoothDeviceController, type BoothSerialPort } from "../client/src/hooks/useBoothDevice";

const controllers: BoothDeviceController[] = [];
const frame = (seq = 0, commandAck = 0, ledBrightness = 0, faultActive = false) =>
  JSON.stringify({ kind: "semiguard-experience", version: 2, seq, uptimeMs: seq * 100,
    commandAck, ledBrightness, faultActive, watchdogOff: commandAck === 0 });

function rig(options: { secure?: boolean; policy?: boolean; serial?: boolean } = {}) {
  const writes: string[] = [];
  let incoming!: ReadableStreamDefaultController<Uint8Array>;
  const port: BoothSerialPort = {
    readable: new ReadableStream<Uint8Array>({ start(controller) { incoming = controller; } }),
    writable: new WritableStream<Uint8Array>({ write(value) { writes.push(new TextDecoder().decode(value)); } }),
    open: vi.fn(async () => {}), close: vi.fn(async () => {}),
  };
  const serial = Object.assign(new EventTarget(), { requestPort: vi.fn(async () => port) });
  const visibility = Object.assign(new EventTarget(), { hidden: false });
  const page = new EventTarget();
  const controller = new BoothDeviceController({ serial: options.serial === false ? null : serial,
    secureContext: options.secure ?? true, serialPolicyAllowed: options.policy ?? true,
    now: () => Date.now(), visibility, page });
  controllers.push(controller);
  controller.mount();
  return { controller, port, serial, visibility, page, writes,
    receive: async (line: string) => {
      incoming.enqueue(new TextEncoder().encode(`${line}\n`));
      await Promise.resolve(); await Promise.resolve();
    } };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(async () => {
  controllers.splice(0).forEach(controller => controller.unmount());
  await vi.advanceTimersByTimeAsync(600);
  vi.useRealTimers();
});

describe("BoothDeviceController optional USB", () => {
  it("requests a port only on connect and sends no commands before the v2 handshake", async () => {
    const r = rig();
    expect(r.serial.requestPort).not.toHaveBeenCalled();
    await r.controller.connect();
    expect(r.port.open).toHaveBeenCalledWith({ baudRate: 115200 });
    expect(r.controller.getSnapshot().status).toBe("waiting");
    expect(r.controller.sendState({ lampBrightness: 200, faultActive: true })).toBe(false);
    await r.receive("not a device frame");
    await vi.advanceTimersByTimeAsync(7900);
    expect(r.writes).toEqual([]);
    expect(r.controller.getSnapshot().status).toBe("waiting");
    await vi.advanceTimersByTimeAsync(100);
    expect(r.controller.getSnapshot().status).toBe("error");
    expect(r.writes).toEqual([]);
  });

  it("marks legacy firmware unsupported without issuing a command", async () => {
    const r = rig(); await r.controller.connect();
    await r.receive(JSON.stringify({ kind: "semiguard-prototype", version: 1, seq: 1,
      uptimeMs: 20, faultActive: false, ledCommand: "off" }));
    expect(r.controller.getSnapshot().status).toBe("unsupported-firmware");
    expect(r.controller.sendState({ lampBrightness: 255, faultActive: true })).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(r.writes).toEqual([]);
  });

  it("coalesces changing brightness and reports only a matching device ACK", async () => {
    const r = rig(); await r.controller.connect(); await r.receive(frame());
    expect(r.controller.getSnapshot().status).toBe("live");
    r.controller.sendState({ lampBrightness: 100, faultActive: false });
    await vi.advanceTimersByTimeAsync(100);
    expect(r.writes).toEqual(["EXPERIENCE 1 100 0\n"]);
    for (let brightness = 101; brightness <= 200; brightness++) {
      r.controller.sendState({ lampBrightness: brightness, faultActive: true });
    }
    await vi.advanceTimersByTimeAsync(100);
    expect(r.writes).toHaveLength(1);
    await r.receive(frame(1, 1, 99)); // Correct id, wrong output is not an ACK.
    expect(r.controller.getSnapshot().lastAckAt).toBeNull();
    await r.receive(frame(2, 1, 100));
    expect(r.controller.getSnapshot().acknowledgedBrightness).toBe(100);
    expect(r.controller.getSnapshot().lastAckAt).toBe(200);
    await vi.advanceTimersByTimeAsync(100);
    expect(r.writes).toEqual(["EXPERIENCE 1 100 0\n", "EXPERIENCE 2 200 1\n"]);
  });

  it("stops and discards intent when the tab is hidden or the component is removed", async () => {
    const r = rig(); await r.controller.connect(); await r.receive(frame());
    r.controller.sendState({ lampBrightness: 220, faultActive: true });
    r.visibility.hidden = true;
    r.visibility.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(r.writes).toEqual([]);
    expect(r.controller.getSnapshot().status).toBe("disconnected");

    const removed = rig(); await removed.controller.connect(); await removed.receive(frame());
    removed.controller.sendState({ lampBrightness: 220, faultActive: true });
    removed.controller.unmount();
    await vi.advanceTimersByTimeAsync(1000);
    expect(removed.writes).toEqual([]);
  });

  it("stops after two seconds without a fresh frame or matching ACK", async () => {
    const r = rig(); await r.controller.connect(); await r.receive(frame());
    r.controller.sendState({ lampBrightness: 100, faultActive: false });
    await vi.advanceTimersByTimeAsync(100);
    expect(r.writes).toHaveLength(1);
    // Fresh device frames alone must not hide a missing command acknowledgement.
    for (let seq = 1; seq <= 8; seq++) {
      await vi.advanceTimersByTimeAsync(250);
      if (seq < 8) await r.receive(frame(seq));
    }
    expect(r.controller.getSnapshot().status).toBe("stale");
    expect(r.controller.getSnapshot().acknowledgedBrightness).toBeNull();
    expect(r.writes).toHaveLength(1);
  });

  it("explains insecure, unsupported and iframe policy failures without opening a port", async () => {
    for (const options of [{ secure: false }, { serial: false }, { policy: false }]) {
      const r = rig(options); await r.controller.connect();
      expect(r.controller.getSnapshot().supported).toBe(false);
      expect(r.controller.getSnapshot().status).toBe("error");
      expect(r.controller.getSnapshot().error).toBeTruthy();
      expect(r.serial.requestPort).not.toHaveBeenCalled();
      expect(r.writes).toEqual([]);
    }
  });
});
