import { useCallback, useEffect, useRef, useState } from "react";
import {
  createPrototypeLineFramer,
  isNextPrototypeFrame,
  isPrototypeFrameFresh,
  parsePrototypeFrame,
  PROTOTYPE_BAUD_RATE,
  PROTOTYPE_HANDSHAKE_AFTER_MS,
  type PrototypeFrame,
} from "@shared/prototypeProtocol";

export type PrototypeLinkMode = "disconnected" | "usb" | "demo";
export type PrototypeLinkStatus = "idle" | "connecting" | "waiting" | "live" | "stale" | "disconnected" | "error";
type LinkSnapshot = {
  mode: PrototypeLinkMode;
  status: PrototypeLinkStatus;
  frame: PrototypeFrame | null;
  lastReceivedAt: number | null;
  error: string | null;
};

// Local structural types keep this feature optional in browsers without Web Serial.
type PrototypeSerialPort = {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
};
type PrototypeSerialApi = EventTarget & { requestPort(): Promise<PrototypeSerialPort> };
type SerialSession = {
  generation: number;
  port: PrototypeSerialPort;
  openedAt: number;
  opened: boolean;
  reader?: ReadableStreamDefaultReader<Uint8Array>;
  writer?: WritableStreamDefaultWriter<Uint8Array>;
  readTask?: Promise<void>;
  cleanup?: Promise<void>;
  previous: PrototypeFrame | null;
};
type PendingReset = {
  generation: number;
  id: number;
  baseline: PrototypeFrame | null;
  timer: ReturnType<typeof setTimeout>;
  resolve(): void;
  reject(error: Error): void;
};
type DemoSession = { generation: number; startedAt: number; seq: number; faultActive: boolean };

const initialSnapshot: LinkSnapshot = {
  mode: "disconnected", status: "idle", frame: null, lastReceivedAt: null, error: null,
};

function serialApi(): PrototypeSerialApi | null {
  if (typeof navigator === "undefined" || globalThis.isSecureContext === false) return null;
  return (navigator as Navigator & { serial?: PrototypeSerialApi }).serial ?? null;
}

/** Cancel both streams before closing; safe to call repeatedly or during a read. */
function cleanupSession(session: SerialSession): Promise<void> {
  if (session.cleanup) return session.cleanup;
  session.cleanup = (async () => {
    // A removed device or a broken stream sink may never settle cancellation.
    // Release its locks and bound cleanup waits so reconnect stays possible.
    const settleWithin = async (operation: Promise<unknown> | undefined, ms = 250) => {
      if (!operation) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        operation.catch(() => {}),
        new Promise<void>(resolve => { timer = setTimeout(resolve, ms); }),
      ]);
      if (timer !== undefined) clearTimeout(timer);
    };
    try { await settleWithin(session.reader?.cancel()); } catch { /* Already disconnected. */ }
    try { session.reader?.releaseLock(); } catch { /* Released by read loop. */ }
    session.reader = undefined;
    await settleWithin(session.readTask);
    try { await settleWithin(session.writer?.abort()); } catch { /* A disconnected write rejects. */ }
    try { session.writer?.releaseLock(); } catch { /* Stream may already be unlocked. */ }
    session.writer = undefined;
    if (session.opened) {
      try { await settleWithin(session.port.close(), 500); } catch { /* Port may already be closed. */ }
      session.opened = false;
    }
  })();
  return session.cleanup;
}

export function usePrototypeLink() {
  const [snapshot, setSnapshot] = useState<LinkSnapshot>(initialSnapshot);
  const snapshotRef = useRef(snapshot);
  const mounted = useRef(true);
  const generation = useRef(0);
  const sessionRef = useRef<SerialSession | null>(null);
  const demoRef = useRef<DemoSession | null>(null);
  const demoTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resetRef = useRef<PendingReset | null>(null);

  const publish = useCallback((next: LinkSnapshot) => {
    snapshotRef.current = next;
    if (mounted.current) setSnapshot(next);
  }, []);

  const stopDemo = useCallback(() => {
    if (demoTimer.current !== null) clearInterval(demoTimer.current);
    demoTimer.current = null;
    demoRef.current = null;
  }, []);

  const rejectReset = useCallback((message: string) => {
    const pending = resetRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    resetRef.current = null;
    pending.reject(new Error(message));
  }, []);

  const acceptFrame = useCallback((frame: PrototypeFrame, token: number, mode: "usb" | "demo") => {
    if (!mounted.current || generation.current !== token) return;
    publish({ mode, status: "live", frame, lastReceivedAt: Date.now(), error: null });
    const pending = resetRef.current;
    if (pending && pending.generation === token && frame.resetAck === pending.id && !frame.faultActive && isNextPrototypeFrame(pending.baseline, frame)) {
      // Keep the deadline until write AND explicit board acknowledgement settle.
      pending.resolve();
    }
  }, [publish]);

  const emitDemo = useCallback(() => {
    const demo = demoRef.current;
    if (!demo || demo.generation !== generation.current) return;
    const frame: PrototypeFrame = {
      kind: "semiguard-prototype", version: 1, seq: demo.seq++ >>> 0,
      uptimeMs: (Date.now() - demo.startedAt) >>> 0,
      faultActive: demo.faultActive, ledCommand: demo.faultActive ? "off" : "on",
    };
    acceptFrame(frame, demo.generation, "demo");
  }, [acceptFrame]);

  const disconnect = useCallback(async () => {
    generation.current += 1;
    stopDemo();
    rejectReset("연결이 종료되어 초기화 확인을 중단했습니다.");
    const session = sessionRef.current;
    sessionRef.current = null;
    publish({ ...initialSnapshot, status: "disconnected" });
    if (session) await cleanupSession(session);
  }, [publish, rejectReset, stopDemo]);

  const connectUsb = useCallback(async () => {
    const api = serialApi();
    if (!api) {
      publish({ ...initialSnapshot, status: "error", error: "USB 연결은 HTTPS에서 데스크톱 Chrome 또는 지원 브라우저로 열어주세요." });
      return;
    }
    const token = ++generation.current;
    stopDemo();
    rejectReset("새 USB 연결을 시작하여 초기화 확인을 중단했습니다.");
    const previousSession = sessionRef.current;
    sessionRef.current = null;
    publish({ ...initialSnapshot, mode: "usb", status: "connecting" });
    let session: SerialSession | null = null;
    try {
      // Request in the original click gesture, before awaiting any old-port cleanup.
      const selection = api.requestPort();
      void selection.catch(() => {});
      if (previousSession) await cleanupSession(previousSession);
      const port = await selection;
      if (!mounted.current || generation.current !== token) return;
      session = { generation: token, port, openedAt: 0, opened: false, previous: null };
      await port.open({ baudRate: PROTOTYPE_BAUD_RATE });
      session.opened = true;
      if (!mounted.current || generation.current !== token) { await cleanupSession(session); return; }
      if (!port.readable || !port.writable) throw new Error("선택한 USB 포트에서 읽기와 쓰기 스트림을 열 수 없습니다.");
      session.reader = port.readable.getReader();
      session.writer = port.writable.getWriter();
      session.openedAt = Date.now();
      sessionRef.current = session;
      publish({ ...initialSnapshot, mode: "usb", status: "waiting" });
      const activeSession = session;
      activeSession.readTask = (async () => {
        const decoder = new TextDecoder();
        const framer = createPrototypeLineFramer();
        let readError: string | null = null;
        try {
          while (mounted.current && generation.current === token) {
            const { value, done } = await activeSession.reader!.read();
            if (done) break;
            for (const line of framer.push(decoder.decode(value, { stream: true }))) {
              const frame = parsePrototypeFrame(line);
              if (frame && isNextPrototypeFrame(activeSession.previous, frame)) {
                activeSession.previous = frame;
                acceptFrame(frame, token, "usb");
              }
            }
          }
        } catch {
          readError = "USB 수신이 중단되었습니다. 케이블과 보드를 확인하고 다시 연결하세요.";
        } finally {
          framer.reset();
          try { activeSession.reader?.releaseLock(); } catch { /* Port removed. */ }
          activeSession.reader = undefined;
          if (mounted.current && generation.current === token) {
            generation.current += 1;
            sessionRef.current = null;
            rejectReset("USB 수신이 종료되어 초기화 응답을 확인하지 못했습니다.");
            publish({ ...initialSnapshot, status: "disconnected", error: readError });
          }
          // Do not await this read task from itself.
          void cleanupSession(activeSession);
        }
      })();
    } catch (error) {
      if (previousSession) await cleanupSession(previousSession);
      if (session) await cleanupSession(session);
      if (!mounted.current || generation.current !== token) return;
      sessionRef.current = null;
      const cancelled = error instanceof DOMException && error.name === "NotFoundError";
      publish({ ...initialSnapshot, status: cancelled ? "idle" : "error", error: cancelled ? null : "USB 연결을 열지 못했습니다. 다른 시리얼 프로그램을 닫고 포트와 케이블을 확인하세요." });
    }
  }, [acceptFrame, publish, rejectReset, stopDemo]);

  const startDemo = useCallback(() => {
    const token = ++generation.current;
    stopDemo();
    rejectReset("화면 데모로 전환하여 USB 초기화 확인을 중단했습니다.");
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) void cleanupSession(session);
    demoRef.current = { generation: token, startedAt: Date.now(), seq: 0, faultActive: false };
    emitDemo();
    demoTimer.current = setInterval(emitDemo, 200);
  }, [emitDemo, rejectReset, stopDemo]);

  const toggleDemoFault = useCallback(() => {
    if (snapshotRef.current.mode !== "demo" || !demoRef.current) return;
    demoRef.current.faultActive = !demoRef.current.faultActive;
    emitDemo();
  }, [emitDemo]);

  const reset = useCallback(async () => {
    if (snapshotRef.current.mode === "demo" && demoRef.current) {
      demoRef.current.faultActive = false;
      emitDemo();
      return;
    }
    const session = sessionRef.current;
    if (!session?.writer || session.generation !== generation.current) {
      throw new Error("초기화하려면 먼저 프로토타입을 연결하세요.");
    }
    if (resetRef.current) throw new Error("이전 초기화 명령의 응답을 기다리는 중입니다.");
    const random = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
    const id = random === session.previous?.resetAck ? (random === 0xffffffff ? 1 : random + 1) : random;
    let resolveConfirmation!: () => void;
    let rejectConfirmation!: (error: Error) => void;
    const confirmation = new Promise<void>((resolve, reject) => { resolveConfirmation = resolve; rejectConfirmation = reject; });
    void confirmation.catch(() => {});
    let pending!: PendingReset;
    const deadline = new Promise<never>((_resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("3초 동안 보드에서 초기화 요청과 일치하는 완료 응답을 받지 못했습니다."));
      }, 3000);
      pending = { generation: session.generation, id, baseline: session.previous, timer, resolve: resolveConfirmation, reject: rejectConfirmation };
      resetRef.current = pending;
    });
    try {
      // The same deadline covers a stuck write and a missing board response.
      await Promise.race([
        Promise.all([session.writer.write(new TextEncoder().encode(`RESET ${id}\n`)), confirmation]),
        deadline,
      ]);
    } catch (error) {
      rejectReset("초기화 명령을 완료하지 못했습니다.");
      if (mounted.current && generation.current === session.generation) {
        generation.current += 1;
        sessionRef.current = null;
        publish({ ...initialSnapshot, status: "error", error: "초기화 완료를 확인하지 못해 USB 연결을 종료했습니다. 보드를 확인하고 다시 연결하세요." });
        void cleanupSession(session);
      }
      throw error;
    } finally {
      clearTimeout(pending.timer);
      if (resetRef.current === pending) resetRef.current = null;
    }
  }, [emitDemo, publish, rejectReset]);

  useEffect(() => {
    mounted.current = true;
    const watcher = setInterval(() => {
      const session = sessionRef.current;
      const current = snapshotRef.current;
      if (!session || current.mode !== "usb") return;
      const now = Date.now();
      if (current.lastReceivedAt !== null && !isPrototypeFrameFresh(current.lastReceivedAt, now) && current.status !== "stale") {
        publish({ ...current, status: "stale", frame: null, error: "2초 이상 새 신호를 받지 못했습니다. 표시할 현재 데이터가 없습니다." });
      } else if (current.lastReceivedAt === null && now - session.openedAt >= PROTOTYPE_HANDSHAKE_AFTER_MS && !current.error) {
        publish({ ...current, status: "waiting", frame: null, error: "8초 동안 올바른 보드 신호가 없습니다. 펌웨어 업로드와 115200 설정을 확인하고 시리얼 모니터를 닫아주세요." });
      }
    }, 250);
    const api = serialApi();
    const onDisconnect = (event: Event) => {
      const session = sessionRef.current;
      const port = (event as Event & { port?: PrototypeSerialPort }).port;
      if (session && ((event.target as unknown) === session.port || port === session.port)) void disconnect();
    };
    api?.addEventListener("disconnect", onDisconnect);
    return () => {
      mounted.current = false;
      generation.current += 1;
      clearInterval(watcher);
      stopDemo();
      rejectReset("화면을 떠나 초기화 확인을 중단했습니다.");
      api?.removeEventListener("disconnect", onDisconnect);
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) void cleanupSession(session);
    };
  }, [disconnect, publish, rejectReset, stopDemo]);

  return { ...snapshot, canSerial: serialApi() !== null, connectUsb, disconnect, startDemo, toggleDemoFault, reset };
}
