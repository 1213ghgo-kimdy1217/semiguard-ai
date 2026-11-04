import { useCallback, useEffect, useRef, useState } from "react";
import {
  BOOTH_BAUD_RATE, BOOTH_HANDSHAKE_MS, BOOTH_STALE_MS,
  createBoothCommandGate, createBoothLineFramer, isBoothFrameFresh,
  parseBoothDeviceFrame, serializeBoothLampCommand,
  type BoothDeviceFrame, type BoothLampState,
} from "@shared/boothProtocol";
import { parsePrototypeFrame } from "@shared/prototypeProtocol";

export type BoothDeviceStatus = "idle" | "connecting" | "waiting" | "live" | "stale" |
  "disconnected" | "error" | "unsupported-firmware";
type BoothDeviceSnapshot = {
  status: BoothDeviceStatus;
  supported: boolean;
  frame: BoothDeviceFrame | null;
  lastReceivedAt: number | null;
  lastAckAt: number | null;
  acknowledgedBrightness: number | null;
  error: string | null;
};
export type BoothSerialPort = {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
};
type BoothSerialApi = EventTarget & { requestPort(): Promise<BoothSerialPort> };
export type BoothDeviceEnvironment = {
  serial: BoothSerialApi | null;
  secureContext: boolean;
  serialPolicyAllowed: boolean | null;
  now(): number;
  visibility?: EventTarget & { readonly hidden: boolean };
  page?: EventTarget;
};
type Session = {
  generation: number;
  port: BoothSerialPort;
  opened: boolean;
  openedAt: number;
  reader?: ReadableStreamDefaultReader<Uint8Array>;
  writer?: WritableStreamDefaultWriter<Uint8Array>;
  task?: Promise<void>;
  cleanup?: Promise<void>;
  writing: boolean;
  gate: ReturnType<typeof createBoothCommandGate>;
};

function browserEnvironment(): BoothDeviceEnvironment {
  const doc = typeof document === "undefined" ? undefined : document;
  const policyDoc = doc as (Document & {
    permissionsPolicy?: { allowsFeature(name: string): boolean };
    featurePolicy?: { allowsFeature(name: string): boolean };
  }) | undefined;
  let serialPolicyAllowed: boolean | null = null;
  try {
    const policy = policyDoc?.permissionsPolicy ?? policyDoc?.featurePolicy;
    if (policy) serialPolicyAllowed = policy.allowsFeature("serial");
  } catch { /* requestPort remains authoritative when policy inspection is unavailable. */ }
  return {
    serial: typeof navigator === "undefined" ? null :
      (navigator as Navigator & { serial?: BoothSerialApi }).serial ?? null,
    secureContext: typeof window !== "undefined" && window.isSecureContext,
    serialPolicyAllowed, now: () => Date.now(), visibility: doc,
    page: typeof window === "undefined" ? undefined : window,
  };
}

async function settleWithin(operation: Promise<unknown> | undefined, ms: number) {
  if (!operation) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([operation.catch(() => {}), new Promise<void>(resolve => {
    timer = setTimeout(resolve, ms);
  })]);
  if (timer !== undefined) clearTimeout(timer);
}

function closeSession(session: Session): Promise<void> {
  if (session.cleanup) return session.cleanup;
  session.gate.reset();
  session.cleanup = (async () => {
    try { await settleWithin(session.reader?.cancel(), 250); } catch { /* Device removed. */ }
    try { session.reader?.releaseLock(); } catch { /* A pending read is cancelled above. */ }
    session.reader = undefined;
    await settleWithin(session.task, 250);
    try { await settleWithin(session.writer?.abort(), 250); } catch { /* Device removed. */ }
    try { session.writer?.releaseLock(); } catch { /* Pending browser I/O can hold its lock. */ }
    session.writer = undefined;
    if (session.opened) {
      try { await settleWithin(session.port.close(), 500); } catch { /* Already closed. */ }
      session.opened = false;
    }
  })();
  return session.cleanup;
}

/** USB is optional. Only the central purple LED is commanded; fill lights stay steady. */
export class BoothDeviceController {
  private environment: BoothDeviceEnvironment;
  private snapshot: BoothDeviceSnapshot;
  private subscribers = new Set<(snapshot: BoothDeviceSnapshot) => void>();
  private generation = 0;
  private mounted = false;
  private session: Session | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(environment: BoothDeviceEnvironment = browserEnvironment()) {
    this.environment = environment;
    this.snapshot = {
      status: "idle", supported: Boolean(environment.serial && environment.secureContext &&
        environment.serialPolicyAllowed !== false), frame: null, lastReceivedAt: null,
      lastAckAt: null, acknowledgedBrightness: null, error: null,
    };
  }

  getSnapshot = () => this.snapshot;
  subscribe = (subscriber: (snapshot: BoothDeviceSnapshot) => void) => {
    this.subscribers.add(subscriber);
    return () => { this.subscribers.delete(subscriber); };
  };
  private publish(patch: Partial<BoothDeviceSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    if (this.mounted) this.subscribers.forEach(listener => listener(this.snapshot));
  }
  private clearObservation(status: BoothDeviceStatus, error: string | null = null) {
    this.publish({ status, frame: null, lastReceivedAt: null, lastAckAt: null,
      acknowledgedBrightness: null, error });
  }
  private active(session: Session) {
    return this.mounted && this.session === session && session.generation === this.generation;
  }
  private fail(session: Session, status: BoothDeviceStatus, error: string) {
    if (!this.active(session)) return;
    this.generation += 1;
    this.session = null;
    this.clearObservation(status, error);
    void closeSession(session);
  }

  connect = async (): Promise<void> => {
    const env = this.environment;
    if (!this.mounted) return;
    if (!env.secureContext || !env.serial || env.serialPolicyAllowed === false) {
      const message = !env.secureContext ? "USB 연결은 HTTPS 또는 localhost에서 열어 주세요." :
        env.serialPolicyAllowed === false ? "현재 창에서 USB 권한을 사용할 수 없어요. 새 창에서 열어 주세요." :
          "이 브라우저는 USB 연결을 지원하지 않아요. 데스크톱 Chrome 또는 Edge에서 열어 주세요.";
      this.clearObservation("error", message); return;
    }
    const token = ++this.generation;
    const previous = this.session;
    this.session = null;
    this.clearObservation("connecting");
    let session: Session | null = null;
    try {
      // Keep requestPort inside the click gesture, before awaiting old cleanup.
      const selection = env.serial.requestPort();
      void selection.catch(() => {});
      if (previous) await closeSession(previous);
      const port = await selection;
      if (!this.mounted || this.generation !== token) return;
      session = { generation: token, port, opened: false, openedAt: 0, writing: false,
        gate: createBoothCommandGate() };
      await port.open({ baudRate: BOOTH_BAUD_RATE });
      session.opened = true;
      if (!this.mounted || this.generation !== token) { await closeSession(session); return; }
      if (!port.readable || !port.writable) throw new Error("serial-stream-unavailable");
      const reader = port.readable.getReader();
      session.reader = reader;
      session.writer = port.writable.getWriter();
      session.openedAt = env.now();
      this.session = session;
      this.clearObservation("waiting");
      const current = session;
      current.task = (async () => {
        const decoder = new TextDecoder();
        const framer = createBoothLineFramer();
        try {
          while (this.active(current)) {
            const { value, done } = await reader.read();
            if (done) break;
            for (const line of framer.push(decoder.decode(value, { stream: true }))) {
              if (!this.active(current)) break;
              const frame = parseBoothDeviceFrame(line);
              if (frame) {
                const result = current.gate.accept(frame, env.now());
                if (result.accepted) this.publish({ status: "live", frame,
                  lastReceivedAt: current.gate.freshAt, lastAckAt: current.gate.lastAckAt,
                  acknowledgedBrightness: frame.watchdogOff ? null : current.gate.acknowledgedBrightness,
                  error: null });
              } else if (parsePrototypeFrame(line)) {
                this.fail(current, "unsupported-firmware",
                  "기존 모형 펌웨어가 연결됐어요. 밝기 연동용 체험 펌웨어를 확인해 주세요. 명령은 보내지 않았어요.");
              }
            }
          }
          if (this.active(current)) this.fail(current, "disconnected", "USB 연결이 끝났어요. 케이블과 보드를 확인해 주세요.");
        } catch {
          if (this.active(current)) this.fail(current, "disconnected", "USB 읽기가 중단됐어요. 다시 연결해 주세요.");
        } finally {
          framer.reset();
          try { reader.releaseLock(); } catch { /* Cancelled or removed. */ }
          current.reader = undefined;
          void closeSession(current);
        }
      })();
    } catch (error) {
      if (session) await closeSession(session);
      if (!this.mounted || this.generation !== token) return;
      this.session = null;
      const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
      const cancelled = name === "NotFoundError";
      this.clearObservation(cancelled ? "idle" : "error", cancelled ? null :
        name === "SecurityError" || name === "NotAllowedError" ?
          "USB 권한이 허용되지 않았어요. 새 창과 브라우저 권한을 확인해 주세요." :
          "USB 연결을 열지 못했어요. 다른 시리얼 프로그램을 닫고 포트와 케이블을 확인해 주세요.");
    }
  };

  disconnect = async (): Promise<void> => {
    this.generation += 1;
    const session = this.session;
    this.session = null;
    this.clearObservation("disconnected");
    // No final command is queued: the firmware watchdog switches purple output off.
    if (session) await closeSession(session);
  };

  sendState = (state: BoothLampState): boolean => {
    const session = this.session;
    return Boolean(session && this.active(session) &&
      this.snapshot.status === "live" && session.gate.offer(state, this.environment.now()));
  };

  private pump = () => {
    const session = this.session;
    if (!session || !this.active(session)) return;
    const now = this.environment.now();
    if (session.gate.freshAt === null) {
      if (now - session.openedAt >= BOOTH_HANDSHAKE_MS) this.fail(session, "error",
        "체험 펌웨어의 응답을 확인하지 못했어요. 펌웨어와 115200 통신 설정을 확인해 주세요. 명령은 보내지 않았어요.");
      return;
    }
    if (!isBoothFrameFresh(session.gate.freshAt, now)) {
      this.fail(session, "stale", "2초 동안 새 응답이 없어 밝기 전송을 멈췄어요. 보드를 다시 연결해 주세요."); return;
    }
    const pending = session.gate.pending;
    if (pending && now - pending.sentAt >= BOOTH_STALE_MS) {
      this.fail(session, "stale", "램프 명령의 처리 응답이 없어 전송을 멈췄어요. 보드와 드라이버를 확인해 주세요."); return;
    }
    if (session.writing || !session.writer) return;
    const command = session.gate.next(now);
    if (!command || !this.active(session)) return;
    session.writing = true;
    const bytes = new TextEncoder().encode(serializeBoothLampCommand(command.id, command));
    void session.writer.write(bytes).catch(() => {
      this.fail(session, "error", "USB 쓰기가 중단됐어요. 다시 연결해 주세요.");
    }).finally(() => { session.writing = false; });
  };

  private hidden: EventListener = () => {
    if (this.environment.visibility?.hidden) void this.disconnect();
  };
  private pageHidden: EventListener = () => { void this.disconnect(); };
  private deviceDisconnected: EventListener = event => {
    const session = this.session;
    const port = (event as Event & { port?: BoothSerialPort }).port;
    if (session && (event.target === (session.port as unknown) || port === session.port)) void this.disconnect();
  };

  mount() {
    if (this.mounted) return;
    this.mounted = true;
    this.timer = setInterval(this.pump, 100);
    this.environment.serial?.addEventListener("disconnect", this.deviceDisconnected);
    this.environment.visibility?.addEventListener("visibilitychange", this.hidden);
    this.environment.page?.addEventListener("pagehide", this.pageHidden);
  }
  unmount() {
    this.mounted = false;
    this.generation += 1;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.environment.serial?.removeEventListener("disconnect", this.deviceDisconnected);
    this.environment.visibility?.removeEventListener("visibilitychange", this.hidden);
    this.environment.page?.removeEventListener("pagehide", this.pageHidden);
    const session = this.session; this.session = null;
    this.snapshot = { ...this.snapshot, status: "disconnected", frame: null,
      lastReceivedAt: null, lastAckAt: null, acknowledgedBrightness: null, error: null };
    if (session) void closeSession(session);
  }
}

export function useBoothDevice() {
  const controllerRef = useRef<BoothDeviceController | null>(null);
  if (!controllerRef.current) controllerRef.current = new BoothDeviceController();
  const controller = controllerRef.current;
  const [snapshot, setSnapshot] = useState(controller.getSnapshot);
  useEffect(() => {
    controller.mount();
    setSnapshot(controller.getSnapshot());
    const unsubscribe = controller.subscribe(setSnapshot);
    return () => { unsubscribe(); controller.unmount(); };
  }, [controller]);
  const connect = useCallback(() => controller.connect(), [controller]);
  const disconnect = useCallback(() => controller.disconnect(), [controller]);
  const sendState = useCallback((value: BoothLampState) => controller.sendState(value), [controller]);
  return { ...snapshot, connected: snapshot.status === "live" &&
    isBoothFrameFresh(snapshot.lastReceivedAt, Date.now()), connect, disconnect, sendState };
}
