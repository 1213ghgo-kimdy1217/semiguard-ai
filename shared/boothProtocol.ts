/** Optional USB protocol for the educational LED. No field measures RF power. */
import { createPrototypeLineFramer } from "./prototypeProtocol";

export const BOOTH_BAUD_RATE = 115200;
export const BOOTH_HANDSHAKE_MS = 8000;
export const BOOTH_STALE_MS = 2000;
export const BOOTH_COMMAND_INTERVAL_MS = 100;
export const BOOTH_HEARTBEAT_MS = 500;
export const BOOTH_DESIRED_MAX_AGE_MS = 400;
export const BOOTH_MAX_LINE_LENGTH = 384;
const UINT32_MAX = 0xffffffff;

export type BoothLampState = { lampBrightness: number; faultActive: boolean };
export type BoothDeviceFrame = {
  kind: "semiguard-experience";
  version: 2;
  seq: number;
  uptimeMs: number;
  /** Firmware output command, not optical feedback or a power measurement. */
  ledBrightness: number;
  commandAck: number;
  faultActive: boolean;
  watchdogOff?: boolean;
};
export type BoothLampCommand = BoothLampState & { id: number; sentAt: number };

function isUint32(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= UINT32_MAX;
}
function isByte(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 255;
}

export function normalizeBoothLampState(value: BoothLampState): BoothLampState | null {
  if (!value || typeof value !== "object" || typeof value.faultActive !== "boolean" ||
    typeof value.lampBrightness !== "number" || !Number.isFinite(value.lampBrightness) ||
    value.lampBrightness < 0 || value.lampBrightness > 255) return null;
  return { lampBrightness: Math.round(value.lampBrightness), faultActive: value.faultActive };
}

export function parseBoothDeviceFrame(line: string): BoothDeviceFrame | null {
  if (line.length > BOOTH_MAX_LINE_LENGTH) return null;
  let value: unknown;
  try { value = JSON.parse(line); } catch { return null; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const f = value as Record<string, unknown>;
  if (f.kind !== "semiguard-experience" || f.version !== 2 ||
    !isUint32(f.seq) || !isUint32(f.uptimeMs) || !isUint32(f.commandAck) ||
    !isByte(f.ledBrightness) || typeof f.faultActive !== "boolean" ||
    (f.watchdogOff !== undefined && typeof f.watchdogOff !== "boolean")) return null;
  return { kind: "semiguard-experience", version: 2, seq: f.seq, uptimeMs: f.uptimeMs,
    commandAck: f.commandAck, ledBrightness: f.ledBrightness, faultActive: f.faultActive,
    ...(f.watchdogOff !== undefined ? { watchdogOff: f.watchdogOff } : {}) };
}

export function isNextBoothFrame(previous: BoothDeviceFrame | null, next: BoothDeviceFrame): boolean {
  if (!previous) return true;
  const distance = (next.seq - previous.seq + 0x100000000) % 0x100000000;
  return distance > 0 && distance < 0x80000000;
}

export function isBoothFrameFresh(receivedAt: number | null, now: number): boolean {
  return receivedAt !== null && now >= receivedAt && now - receivedAt < BOOTH_STALE_MS;
}

export function serializeBoothLampCommand(id: number, value: BoothLampState): string {
  const state = normalizeBoothLampState(value);
  if (!isUint32(id) || !state) throw new RangeError("Invalid booth lamp command");
  return `EXPERIENCE ${id} ${state.lampBrightness} ${state.faultActive ? 1 : 0}\n`;
}

export function createBoothLineFramer() {
  return createPrototypeLineFramer(BOOTH_MAX_LINE_LENGTH);
}

/**
 * Exactly one desired state and one in-flight command: slow USB never builds a
 * queue of old flicker frames. A valid fresh v2 frame must arrive before output.
 */
export function createBoothCommandGate() {
  let previous: BoothDeviceFrame | null = null;
  let receivedAt: number | null = null;
  let desired: { value: BoothLampState; at: number } | null = null;
  let pending: BoothLampCommand | null = null;
  let lastSent: BoothLampCommand | null = null;
  let lastAckAt: number | null = null;
  let acknowledgedBrightness: number | null = null;
  let id = 0;
  return {
    accept(frame: BoothDeviceFrame, now: number) {
      if (!isNextBoothFrame(previous, frame)) return { accepted: false, acknowledged: false };
      // Some boards do not reset when a port opens. Continue from their last ACK
      // so an old periodic frame cannot acknowledge a reused command identifier.
      if (!previous) id = frame.commandAck;
      previous = frame;
      receivedAt = now;
      const acknowledged = pending !== null && frame.commandAck === pending.id &&
        frame.ledBrightness === pending.lampBrightness && frame.faultActive === pending.faultActive &&
        frame.watchdogOff !== true;
      if (acknowledged) {
        lastAckAt = now;
        acknowledgedBrightness = frame.ledBrightness;
        pending = null;
      }
      return { accepted: true, acknowledged };
    },
    offer(value: BoothLampState, now: number): boolean {
      const clean = normalizeBoothLampState(value);
      if (!clean || !isBoothFrameFresh(receivedAt, now)) return false;
      desired = { value: clean, at: now };
      return true;
    },
    next(now: number): BoothLampCommand | null {
      if (!isBoothFrameFresh(receivedAt, now) || pending || !desired ||
        now < desired.at || now - desired.at > BOOTH_DESIRED_MAX_AGE_MS) return null;
      if (lastSent && (now < lastSent.sentAt || now - lastSent.sentAt < BOOTH_COMMAND_INTERVAL_MS)) return null;
      const unchanged = lastSent && lastSent.lampBrightness === desired.value.lampBrightness &&
        lastSent.faultActive === desired.value.faultActive;
      if (lastSent && unchanged && now - lastSent.sentAt < BOOTH_HEARTBEAT_MS) return null;
      id = (id + 1) >>> 0;
      pending = { id, sentAt: now, ...desired.value };
      lastSent = pending;
      return { ...pending };
    },
    get freshAt() { return receivedAt; },
    get lastAckAt() { return lastAckAt; },
    get acknowledgedBrightness() { return acknowledgedBrightness; },
    get pending() { return pending ? { ...pending } : null; },
    get previous() { return previous; },
    reset() {
      previous = null; receivedAt = null; desired = null; pending = null; lastSent = null;
      lastAckAt = null; acknowledgedBrightness = null; id = 0;
    },
  };
}
