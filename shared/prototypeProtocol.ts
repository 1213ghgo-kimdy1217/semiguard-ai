/** Wire protocol for the teaching prototype. No field is a pressure measurement. */
export type PrototypeFrame = {
  kind: "semiguard-prototype";
  version: 1;
  seq: number;
  uptimeMs: number;
  faultActive: boolean;
  /** Firmware's LED command, not an independent optical feedback measurement. */
  ledCommand: "on" | "off";
  /** Last RESET request actually processed by firmware; zero / absent means none. */
  resetAck?: number;
};

export const PROTOTYPE_BAUD_RATE = 115200;
export const MAX_PROTOTYPE_LINE_LENGTH = 384;
export const PROTOTYPE_STALE_AFTER_MS = 2000;
export const PROTOTYPE_HANDSHAKE_AFTER_MS = 8000;
const UINT32_MAX = 0xffffffff;

function isUint32(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= UINT32_MAX;
}

/** Invalid or unrelated lines never produce telemetry. */
export function parsePrototypeFrame(line: string): PrototypeFrame | null {
  if (line.length > MAX_PROTOTYPE_LINE_LENGTH) return null;
  let value: unknown;
  try { value = JSON.parse(line); } catch { return null; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const frame = value as Record<string, unknown>;
  if (
    frame.kind !== "semiguard-prototype" || frame.version !== 1 ||
    !isUint32(frame.seq) || !isUint32(frame.uptimeMs) ||
    typeof frame.faultActive !== "boolean" ||
    (frame.ledCommand !== "on" && frame.ledCommand !== "off") ||
    (frame.resetAck !== undefined && !isUint32(frame.resetAck))
  ) return null;
  // Construct a clean object: unrelated properties are never passed into the UI.
  return {
    kind: "semiguard-prototype", version: 1,
    seq: frame.seq, uptimeMs: frame.uptimeMs,
    faultActive: frame.faultActive, ledCommand: frame.ledCommand,
    ...(frame.resetAck !== undefined ? { resetAck: frame.resetAck } : {}),
  };
}

/** Reject duplicate / older packets, while allowing a uint32 counter to wrap. */
export function isNextPrototypeFrame(previous: PrototypeFrame | null, next: PrototypeFrame): boolean {
  if (!previous) return true;
  const distance = (next.seq - previous.seq + 0x100000000) % 0x100000000;
  return distance > 0 && distance < 0x80000000;
}

/** A stale sample is historical evidence, never a current observation. */
export function isPrototypeFrameFresh(lastReceivedAt: number | null, now: number): boolean {
  return lastReceivedAt !== null && now >= lastReceivedAt && now - lastReceivedAt < PROTOTYPE_STALE_AFTER_MS;
}

/**
 * A serial read is not a message: one read may contain half a JSON line or many.
 * An overlong line is discarded through its newline, then parsing can recover.
 * Storage stays bounded even when an unterminated or malformed stream arrives.
 */
export function createPrototypeLineFramer(maxLineLength = MAX_PROTOTYPE_LINE_LENGTH) {
  if (!Number.isInteger(maxLineLength) || maxLineLength < 1 || maxLineLength > 65536) {
    throw new RangeError("Invalid maximum prototype line length");
  }
  let pending = "";
  let discarding = false;
  let carriageReturn = false;
  return {
    push(chunk: string): string[] {
      const lines: string[] = [];
      for (const character of chunk) {
        if (character === "\n") {
          if (!discarding) {
            if (pending.trim()) lines.push(pending);
          }
          pending = "";
          discarding = false;
          carriageReturn = false;
        } else if (!discarding) {
          // Hold one CR separately so a maximum-length CRLF line still fits.
          if (carriageReturn) {
            carriageReturn = false;
            if (pending.length >= maxLineLength) {
              pending = "";
              discarding = true;
              continue;
            }
            pending += "\r";
          }
          if (character === "\r") {
            carriageReturn = true;
          } else if (pending.length + character.length > maxLineLength) {
            pending = "";
            discarding = true;
          } else {
            pending += character;
          }
        }
      }
      return lines;
    },
    reset() { pending = ""; discarding = false; carriageReturn = false; },
    get bufferedLength() { return pending.length; },
    get isDiscarding() { return discarding; },
  };
}
