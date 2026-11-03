import { useCallback, useEffect, useRef, useState } from "react";

export type PrototypeCameraStatus =
  | "idle"
  | "requesting"
  | "connected"
  | "ready"
  | "playing"
  | "stopped"
  | "error";
export type PrototypeCameraError =
  | "unsupported"
  | "insecure-context"
  | "iframe-blocked"
  | "permission-denied"
  | "no-device"
  | "device-busy"
  | "constraints"
  | "device-ended"
  | "device-lost"
  | "playback-blocked"
  | "stream-unavailable"
  | "unknown";
export type PrototypeCameraDevice = { deviceId: string; label: string };
export type PrototypeCameraSnapshot = {
  status: PrototypeCameraStatus;
  error: PrototypeCameraError | null;
  devices: PrototypeCameraDevice[];
  selectedDeviceId: string;
  recommendedDeviceId: string | null;
  activeDeviceLabel: string | null;
  width: number;
  height: number;
  supported: boolean;
  secureContext: boolean;
  inIframe: boolean;
  cameraPolicyAllowed: boolean | null;
  stoppedForBackground: boolean;
};

type CameraMediaDevices = Pick<
  MediaDevices,
  "getUserMedia" | "enumerateDevices"
> & {
  addEventListener?: (type: string, listener: EventListener) => void;
  removeEventListener?: (type: string, listener: EventListener) => void;
};
export type PrototypeCameraEnvironment = {
  mediaDevices: CameraMediaDevices | null;
  secureContext: boolean;
  inIframe: boolean;
  cameraPolicyAllowed: boolean | null;
  visibility?: EventTarget & { readonly hidden: boolean };
  page?: EventTarget;
};

function browserCameraEnvironment(): PrototypeCameraEnvironment {
  const doc = typeof document === "undefined" ? undefined : document;
  let inIframe = false;
  if (typeof window !== "undefined") {
    try {
      inIframe = window.self !== window.top;
    } catch {
      inIframe = true;
    }
  }
  const policyDocument = doc as
    | (Document & {
        permissionsPolicy?: { allowsFeature(feature: string): boolean };
        featurePolicy?: { allowsFeature(feature: string): boolean };
      })
    | undefined;
  let cameraPolicyAllowed: boolean | null = null;
  try {
    const policy =
      policyDocument?.permissionsPolicy ?? policyDocument?.featurePolicy;
    if (policy) cameraPolicyAllowed = policy.allowsFeature("camera");
  } catch {
    /* A permission prompt remains authoritative when policy is unavailable. */
  }
  return {
    mediaDevices:
      typeof navigator !== "undefined" && navigator.mediaDevices
        ? navigator.mediaDevices
        : null,
    secureContext: typeof window !== "undefined" && window.isSecureContext,
    inIframe,
    cameraPolicyAllowed,
    visibility: doc,
    page: typeof window !== "undefined" ? window : undefined,
  };
}

export function prototypeCameraError(error: unknown): PrototypeCameraError {
  const name =
    error && typeof error === "object" && "name" in error
      ? String(error.name)
      : "";
  if (
    name === "NotAllowedError" ||
    name === "SecurityError" ||
    name === "PermissionDeniedError"
  )
    return "permission-denied";
  if (name === "NotFoundError" || name === "DevicesNotFoundError")
    return "no-device";
  if (
    name === "NotReadableError" ||
    name === "TrackStartError" ||
    name === "AbortError"
  )
    return "device-busy";
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError")
    return "constraints";
  return "unknown";
}

/**
 * Camera lifetime is independent of the control board's Web Serial connection.
 * No permission request occurs in mount(), selecting a device, or enumerating it.
 * Only start(), called from the user's start/retry button, requests a video stream.
 */
export class PrototypeCameraController {
  private environment: PrototypeCameraEnvironment;
  private snapshot: PrototypeCameraSnapshot;
  private subscribers = new Set<(snapshot: PrototypeCameraSnapshot) => void>();
  private mounted = false;
  private generation = 0;
  private enumeration = 0;
  private stream: MediaStream | null = null;
  private activeDeviceId = "";
  private video: HTMLVideoElement | null = null;
  private videoCleanup: (() => void) | null = null;
  private trackCleanups: Array<() => void> = [];

  constructor(environment: PrototypeCameraEnvironment) {
    this.environment = environment;
    this.snapshot = {
      status: "idle",
      error: null,
      devices: [],
      selectedDeviceId: "",
      recommendedDeviceId: null,
      activeDeviceLabel: null,
      width: 0,
      height: 0,
      supported: Boolean(environment.mediaDevices?.getUserMedia),
      secureContext: environment.secureContext,
      inIframe: environment.inIframe,
      cameraPolicyAllowed: environment.cameraPolicyAllowed,
      stoppedForBackground: false,
    };
  }

  getSnapshot = () => this.snapshot;
  subscribe = (subscriber: (snapshot: PrototypeCameraSnapshot) => void) => {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  };
  private publish(patch: Partial<PrototypeCameraSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.subscribers.forEach(subscriber => subscriber(this.snapshot));
  }

  private deviceChanged: EventListener = () => {
    void this.refreshDevices(true);
  };
  private visibilityChanged: EventListener = () => {
    if (this.environment.visibility?.hidden) this.stop(true);
  };
  private pageHidden: EventListener = () => {
    this.stop(true);
  };

  mount() {
    if (this.mounted) return;
    this.mounted = true;
    this.environment.mediaDevices?.addEventListener?.(
      "devicechange",
      this.deviceChanged
    );
    this.environment.visibility?.addEventListener(
      "visibilitychange",
      this.visibilityChanged
    );
    this.environment.page?.addEventListener("pagehide", this.pageHidden);
    void this.refreshDevices();
  }

  dispose() {
    this.mounted = false;
    this.generation += 1;
    this.enumeration += 1;
    this.environment.mediaDevices?.removeEventListener?.(
      "devicechange",
      this.deviceChanged
    );
    this.environment.visibility?.removeEventListener(
      "visibilitychange",
      this.visibilityChanged
    );
    this.environment.page?.removeEventListener("pagehide", this.pageHidden);
    this.releaseStream();
    this.publish({
      status: this.snapshot.status === "idle" ? "idle" : "stopped",
      error: null,
      width: 0,
      height: 0,
      activeDeviceLabel: null,
    });
  }

  selectDevice = (deviceId: string) => {
    // Selection is not permission or capture consent. A separate start click confirms it.
    this.publish({
      selectedDeviceId:
        typeof deviceId === "string" && deviceId.length <= 512 ? deviceId : "",
    });
  };

  async refreshDevices(checkRemoval = false) {
    const media = this.environment.mediaDevices;
    if (
      !this.mounted ||
      !this.environment.secureContext ||
      !media?.enumerateDevices
    )
      return;
    const request = ++this.enumeration;
    try {
      const allDevices = await media.enumerateDevices();
      if (!this.mounted || request !== this.enumeration) return;
      const devices = allDevices
        .filter(device => device.kind === "videoinput")
        .map(device => ({ deviceId: device.deviceId, label: device.label }));
      const recommended =
        devices.find(device => /APC[\s_-]?850/i.test(device.label)) ??
        devices.find(device => /ABKO|앱코/i.test(device.label));
      this.publish({
        devices,
        recommendedDeviceId: recommended?.deviceId ?? null,
      });
      if (
        checkRemoval &&
        this.stream &&
        this.activeDeviceId &&
        !devices.some(device => device.deviceId === this.activeDeviceId)
      ) {
        this.fail("device-lost");
      }
    } catch {
      // Device names may be hidden before permission. Starting remains an explicit choice.
    }
  }

  private stopTracks(stream: MediaStream) {
    stream.getTracks().forEach(track => {
      try {
        track.stop();
      } catch {
        /* Device already removed. */
      }
    });
  }
  private detachVideo() {
    this.videoCleanup?.();
    this.videoCleanup = null;
    if (this.video) {
      try {
        this.video.pause();
      } catch {
        /* Detached mock / media element. */
      }
      this.video.srcObject = null;
    }
  }
  private releaseStream() {
    this.trackCleanups.forEach(cleanup => cleanup());
    this.trackCleanups = [];
    this.detachVideo();
    const stream = this.stream;
    this.stream = null;
    this.activeDeviceId = "";
    if (stream) this.stopTracks(stream);
  }
  private fail(error: PrototypeCameraError) {
    this.generation += 1;
    this.releaseStream();
    this.publish({
      status: "error",
      error,
      activeDeviceLabel: null,
      width: 0,
      height: 0,
      stoppedForBackground: false,
    });
  }

  stop = (forBackground = false) => {
    this.generation += 1;
    this.releaseStream();
    this.publish({
      status: "stopped",
      error: null,
      width: 0,
      height: 0,
      activeDeviceLabel: null,
      stoppedForBackground: forBackground,
    });
  };

  start = async () => {
    if (!this.mounted) return;
    if (!this.environment.secureContext) {
      this.fail("insecure-context");
      return;
    }
    if (!this.environment.mediaDevices?.getUserMedia) {
      this.fail("unsupported");
      return;
    }
    if (this.environment.cameraPolicyAllowed === false) {
      this.fail("iframe-blocked");
      return;
    }
    if (this.environment.visibility?.hidden) {
      this.stop(true);
      return;
    }
    const token = ++this.generation;
    const deviceId = this.snapshot.selectedDeviceId;
    this.releaseStream();
    this.publish({
      status: "requesting",
      error: null,
      width: 0,
      height: 0,
      activeDeviceLabel: null,
      stoppedForBackground: false,
    });
    try {
      const stream = await this.environment.mediaDevices.getUserMedia({
        audio: false,
        video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
      });
      if (
        !this.mounted ||
        token !== this.generation ||
        this.environment.visibility?.hidden
      ) {
        this.stopTracks(stream);
        return;
      }
      // The request is video-only; also discard unexpected audio tracks defensively.
      stream.getAudioTracks().forEach(track => track.stop());
      const tracks = stream.getVideoTracks();
      if (
        !tracks.length ||
        tracks.every(track => track.readyState === "ended")
      ) {
        this.stopTracks(stream);
        this.fail("no-device");
        return;
      }
      this.stream = stream;
      const track = tracks.find(candidate => candidate.readyState !== "ended")!;
      this.activeDeviceId = track.getSettings().deviceId ?? deviceId;
      tracks.forEach(candidate => {
        const ended = () => {
          if (
            this.mounted &&
            token === this.generation &&
            this.stream === stream
          )
            this.fail("device-ended");
        };
        candidate.addEventListener("ended", ended);
        this.trackCleanups.push(() =>
          candidate.removeEventListener("ended", ended)
        );
      });
      this.publish({
        status: "connected",
        activeDeviceLabel: track.label || null,
      });
      this.attachCurrentStream();
      void this.refreshDevices();
    } catch (error) {
      if (!this.mounted || token !== this.generation) return;
      this.fail(prototypeCameraError(error));
    }
  };

  bindVideo = (video: HTMLVideoElement | null) => {
    if (this.video === video) return;
    const removed = this.video !== null && video === null;
    this.detachVideo();
    this.video = video;
    // Ref detachment happens during React's commit, before passive-effect cleanup.
    // Cancel pending consent immediately so a late stream cannot open in that gap.
    if (removed && (this.stream || this.snapshot.status === "requesting"))
      this.stop();
    if (video && this.stream) this.attachCurrentStream();
  };

  private attachCurrentStream() {
    const video = this.video;
    const stream = this.stream;
    if (!video || !stream) return;
    this.detachVideo();
    const token = this.generation;
    const current = () =>
      this.mounted &&
      token === this.generation &&
      this.video === video &&
      this.stream === stream &&
      video.srcObject === stream;
    const metadata = () => {
      if (!current() || video.readyState < 1) return;
      const width = video.videoWidth;
      const height = video.videoHeight;
      this.publish({
        width,
        height,
        status:
          this.snapshot.status === "playing"
            ? "playing"
            : width > 0 && height > 0
              ? "ready"
              : "connected",
      });
    };
    const playing = () => {
      if (
        !current() ||
        video.paused ||
        video.readyState < 2 ||
        !video.videoWidth ||
        !video.videoHeight
      )
        return;
      this.publish({
        status: "playing",
        width: video.videoWidth,
        height: video.videoHeight,
        error: null,
      });
    };
    const waiting = () => {
      if (current())
        this.publish({
          status:
            this.snapshot.width && this.snapshot.height ? "ready" : "connected",
        });
    };
    const failed = () => {
      if (current()) this.fail("stream-unavailable");
    };
    video.addEventListener("loadedmetadata", metadata);
    video.addEventListener("loadeddata", metadata);
    video.addEventListener("playing", playing);
    video.addEventListener("waiting", waiting);
    video.addEventListener("stalled", waiting);
    video.addEventListener("pause", waiting);
    video.addEventListener("error", failed);
    this.videoCleanup = () => {
      video.removeEventListener("loadedmetadata", metadata);
      video.removeEventListener("loadeddata", metadata);
      video.removeEventListener("playing", playing);
      video.removeEventListener("waiting", waiting);
      video.removeEventListener("stalled", waiting);
      video.removeEventListener("pause", waiting);
      video.removeEventListener("error", failed);
    };
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    try {
      void video.play().catch(error => {
        if (!current()) return;
        const denied =
          error &&
          typeof error === "object" &&
          "name" in error &&
          error.name === "NotAllowedError";
        this.fail(denied ? "playback-blocked" : "stream-unavailable");
      });
    } catch {
      if (current()) this.fail("stream-unavailable");
    }
    // Resolving play() is deliberately not treated as proof of received video.
  }
}

export function usePrototypeCamera() {
  const controllerRef = useRef<PrototypeCameraController | null>(null);
  if (!controllerRef.current)
    controllerRef.current = new PrototypeCameraController(
      browserCameraEnvironment()
    );
  const controller = controllerRef.current;
  const [snapshot, setSnapshot] = useState(controller.getSnapshot);
  useEffect(() => {
    const unsubscribe = controller.subscribe(setSnapshot);
    controller.mount();
    setSnapshot(controller.getSnapshot());
    return () => {
      unsubscribe();
      controller.dispose();
    };
  }, [controller]);
  const videoRef = useCallback(
    (video: HTMLVideoElement | null) => controller.bindVideo(video),
    [controller]
  );
  return {
    ...snapshot,
    videoRef,
    start: controller.start,
    stop: controller.stop,
    selectDevice: controller.selectDevice,
    refreshDevices: () => controller.refreshDevices(),
  };
}
