import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PrototypeCameraController,
  type PrototypeCameraEnvironment,
} from "../client/src/hooks/usePrototypeCamera";

class FakeTrack extends EventTarget {
  readyState: MediaStreamTrackState = "live";
  label: string;
  kind: string;
  deviceId: string;
  stop = vi.fn(() => {
    this.readyState = "ended";
  });
  constructor(deviceId: string, label: string, kind = "video") {
    super();
    this.deviceId = deviceId;
    this.label = label;
    this.kind = kind;
  }
  getSettings = () => ({ deviceId: this.deviceId });
  end() {
    this.readyState = "ended";
    this.dispatchEvent(new Event("ended"));
  }
}
function cameraStream(
  deviceId = "cam-a",
  label = "USB camera A",
  withAudio = false
) {
  const video = new FakeTrack(deviceId, label);
  const audio = new FakeTrack("mic-a", "Unexpected audio", "audio");
  const tracks = withAudio ? [video, audio] : [video];
  return {
    video,
    audio,
    stream: {
      getTracks: () => tracks,
      getVideoTracks: () => [video],
      getAudioTracks: () => (withAudio ? [audio] : []),
    } as unknown as MediaStream,
  };
}
class FakeVideo extends EventTarget {
  srcObject: MediaProvider | null = null;
  muted = false;
  playsInline = false;
  videoWidth = 0;
  videoHeight = 0;
  readyState = 0;
  paused = true;
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  metadata(width = 1280, height = 720) {
    this.videoWidth = width;
    this.videoHeight = height;
    this.readyState = 1;
    this.dispatchEvent(new Event("loadedmetadata"));
  }
  playing() {
    this.readyState = 4;
    this.paused = false;
    this.dispatchEvent(new Event("playing"));
  }
}
class FakeVisibility extends EventTarget {
  hidden = false;
  hide() {
    this.hidden = true;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}
function device(
  deviceId: string,
  label: string,
  kind: MediaDeviceKind = "videoinput"
): MediaDeviceInfo {
  return { deviceId, label, kind, groupId: "", toJSON: () => ({}) };
}
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const flush = async () => {
  for (let turn = 0; turn < 12; turn++) await Promise.resolve();
};
const mounted: PrototypeCameraController[] = [];
function fixture(overrides: Partial<PrototypeCameraEnvironment> = {}) {
  const capture = cameraStream();
  const media = Object.assign(new EventTarget(), {
    getUserMedia: vi.fn(
      async (_constraints: MediaStreamConstraints) => capture.stream
    ),
    enumerateDevices: vi.fn(async () => [
      device("cam-a", "USB camera A"),
      device("abko", "ABKO APC850"),
      device("mic", "Microphone", "audioinput"),
    ]),
  });
  const visibility = new FakeVisibility();
  const page = new EventTarget();
  const controller = new PrototypeCameraController({
    mediaDevices: media,
    secureContext: true,
    inIframe: false,
    cameraPolicyAllowed: true,
    visibility,
    page,
    ...overrides,
  });
  const video = new FakeVideo();
  controller.bindVideo(video as unknown as HTMLVideoElement);
  controller.mount();
  mounted.push(controller);
  return { controller, media, video, visibility, page, capture };
}
afterEach(() => {
  mounted.splice(0).forEach(controller => controller.dispose());
});

describe("explicit, video-only camera access", () => {
  it("does not request permission on mount, discovery, recommendation, or selection", async () => {
    const { controller, media } = fixture();
    await flush();
    expect(media.getUserMedia).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({
      status: "idle",
      selectedDeviceId: "",
      recommendedDeviceId: "abko",
    });
    expect(controller.getSnapshot().devices).toHaveLength(2);
    controller.selectDevice("abko");
    await controller.refreshDevices();
    expect(media.getUserMedia).not.toHaveBeenCalled();
    await controller.start();
    expect(media.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: false,
        video: expect.objectContaining({ deviceId: { exact: "abko" } }),
      })
    );
  });

  it("keeps stream permission, metadata, and actual playback separate", async () => {
    const { controller, video, capture } = fixture();
    await controller.start();
    await flush();
    expect(video.srcObject).toBe(capture.stream);
    expect(video.muted).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({
      status: "connected",
      width: 0,
      height: 0,
    });
    // play() already resolved, but that alone is not proof of received video.
    video.dispatchEvent(new Event("playing"));
    expect(controller.getSnapshot().status).toBe("connected");
    video.metadata();
    expect(controller.getSnapshot()).toMatchObject({
      status: "ready",
      width: 1280,
      height: 720,
    });
    video.playing();
    expect(controller.getSnapshot().status).toBe("playing");
    video.dispatchEvent(new Event("waiting"));
    expect(controller.getSnapshot().status).toBe("ready");
  });

  it("stops all tracks and removes srcObject on explicit stop", async () => {
    const { controller, capture, video } = fixture();
    await controller.start();
    controller.stop();
    expect(capture.video.stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
    expect(controller.getSnapshot()).toMatchObject({
      status: "stopped",
      width: 0,
      height: 0,
      activeDeviceLabel: null,
    });
    video.metadata();
    video.playing();
    expect(controller.getSnapshot().status).toBe("stopped");
  });

  it("discards any unexpected audio track while requesting audio:false", async () => {
    const { controller, media } = fixture();
    const capture = cameraStream("a", "video only", true);
    media.getUserMedia.mockResolvedValue(capture.stream);
    await controller.start();
    expect(capture.audio.stop).toHaveBeenCalledTimes(1);
    expect(capture.video.stop).not.toHaveBeenCalled();
  });
});

describe("camera cancellation and device-switch races", () => {
  it("stops a permission result that arrives after the user stopped waiting", async () => {
    const { controller, media, video } = fixture();
    const permission = deferred<MediaStream>();
    const late = cameraStream("late");
    media.getUserMedia.mockReturnValue(permission.promise);
    const starting = controller.start();
    expect(controller.getSnapshot().status).toBe("requesting");
    controller.stop();
    permission.resolve(late.stream);
    await starting;
    expect(late.video.stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
    expect(controller.getSnapshot().status).toBe("stopped");
  });

  it("stops a permission result that arrives after unmount", async () => {
    const { controller, media, video } = fixture();
    const permission = deferred<MediaStream>();
    const late = cameraStream("late");
    media.getUserMedia.mockReturnValue(permission.promise);
    const starting = controller.start();
    controller.dispose();
    permission.resolve(late.stream);
    await starting;
    expect(late.video.stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
    expect(controller.getSnapshot().status).toBe("stopped");
  });

  it("cancels pending consent as soon as the video ref is removed, before effect cleanup", async () => {
    const { controller, media } = fixture();
    const permission = deferred<MediaStream>();
    const late = cameraStream("late");
    media.getUserMedia.mockReturnValue(permission.promise);
    const starting = controller.start();
    controller.bindVideo(null);
    permission.resolve(late.stream);
    await starting;
    expect(late.video.stop).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().status).toBe("stopped");
  });

  it("does not let an older permission response replace the newly chosen camera", async () => {
    const { controller, media, video } = fixture();
    const first = deferred<MediaStream>();
    const second = deferred<MediaStream>();
    const oldCamera = cameraStream("old", "Old camera");
    const newCamera = cameraStream("new", "New camera");
    media.getUserMedia
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    controller.selectDevice("old");
    const firstStart = controller.start();
    controller.selectDevice("new");
    const secondStart = controller.start();
    second.resolve(newCamera.stream);
    await secondStart;
    first.resolve(oldCamera.stream);
    await firstStart;
    expect(oldCamera.video.stop).toHaveBeenCalledTimes(1);
    expect(newCamera.video.stop).not.toHaveBeenCalled();
    expect(video.srcObject).toBe(newCamera.stream);
    expect(controller.getSnapshot()).toMatchObject({
      status: "connected",
      activeDeviceLabel: "New camera",
    });
  });

  it("ignores an old play rejection after a camera switch", async () => {
    const { controller, media, video } = fixture();
    const play = deferred<void>();
    const next = cameraStream("next", "Next camera");
    video.play.mockReturnValueOnce(play.promise).mockResolvedValue(undefined);
    await controller.start();
    media.getUserMedia.mockResolvedValue(next.stream);
    await controller.start();
    play.reject(new DOMException("old playback", "NotAllowedError"));
    await flush();
    expect(controller.getSnapshot()).toMatchObject({
      status: "connected",
      activeDeviceLabel: "Next camera",
      error: null,
    });
    expect(next.video.stop).not.toHaveBeenCalled();
  });

  it("keeps a late permission rejection from replacing the stopped state", async () => {
    const { controller, media } = fixture();
    const permission = deferred<MediaStream>();
    media.getUserMedia.mockReturnValue(permission.promise);
    const starting = controller.start();
    controller.stop();
    permission.reject(new DOMException("denied later", "NotAllowedError"));
    await starting;
    expect(controller.getSnapshot()).toMatchObject({
      status: "stopped",
      error: null,
    });
  });
});

describe("camera removal, permissions and lifecycle cleanup", () => {
  it.each([
    ["NotAllowedError", "permission-denied"],
    ["SecurityError", "permission-denied"],
    ["NotFoundError", "no-device"],
    ["NotReadableError", "device-busy"],
    ["OverconstrainedError", "constraints"],
    ["SomethingElse", "unknown"],
  ])("reports %s without leaving a capture active", async (name, code) => {
    const { controller, media, video } = fixture();
    media.getUserMedia.mockRejectedValue(
      new DOMException("private browser detail", name)
    );
    await controller.start();
    expect(controller.getSnapshot()).toMatchObject({
      status: "error",
      error: code,
      width: 0,
      height: 0,
    });
    expect(video.srcObject).toBeNull();
  });

  it.each([
    [{ secureContext: false }, "insecure-context"],
    [{ mediaDevices: null }, "unsupported"],
    [{ inIframe: true, cameraPolicyAllowed: false }, "iframe-blocked"],
  ] as const)(
    "explains an unavailable context without asking for a camera: %j",
    async (environment, code) => {
      const { controller, media } = fixture(environment);
      await controller.start();
      expect(media.getUserMedia).not.toHaveBeenCalled();
      expect(controller.getSnapshot()).toMatchObject({
        status: "error",
        error: code,
      });
    }
  );

  it("treats a hardware-ended track as unavailable, with no automatic restart", async () => {
    const { controller, media, capture, video } = fixture();
    await controller.start();
    capture.video.end();
    expect(controller.getSnapshot()).toMatchObject({
      status: "error",
      error: "device-ended",
      width: 0,
      height: 0,
    });
    expect(video.srcObject).toBeNull();
    expect(media.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("refreshes device names and stops when the active camera disappears", async () => {
    const { controller, media, capture, video } = fixture();
    await controller.start();
    await flush();
    media.enumerateDevices.mockResolvedValue([device("other", "Other camera")]);
    media.dispatchEvent(new Event("devicechange"));
    await flush();
    expect(controller.getSnapshot()).toMatchObject({
      status: "error",
      error: "device-lost",
    });
    expect(capture.video.stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
    expect(media.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("stops on page visibility loss without automatically resuming", async () => {
    const { controller, media, visibility, capture, video } = fixture();
    await controller.start();
    visibility.hide();
    expect(controller.getSnapshot()).toMatchObject({
      status: "stopped",
      stoppedForBackground: true,
    });
    expect(capture.video.stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
    visibility.hidden = false;
    visibility.dispatchEvent(new Event("visibilitychange"));
    expect(media.getUserMedia).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().status).toBe("stopped");
  });

  it("cleans up active capture and all listeners when its parent unmounts", async () => {
    const { controller, media, capture, video, visibility, page } = fixture();
    await controller.start();
    await flush();
    const enumerations = media.enumerateDevices.mock.calls.length;
    controller.dispose();
    expect(capture.video.stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
    media.dispatchEvent(new Event("devicechange"));
    visibility.hide();
    page.dispatchEvent(new Event("pagehide"));
    capture.video.end();
    await flush();
    expect(media.enumerateDevices).toHaveBeenCalledTimes(enumerations);
    expect(controller.getSnapshot().status).toBe("stopped");
  });

  it("does not mistake a rejected play() for a connected live video", async () => {
    const { controller, video, capture } = fixture();
    video.play.mockRejectedValue(
      new DOMException("autoplay denied", "NotAllowedError")
    );
    await controller.start();
    await flush();
    expect(controller.getSnapshot()).toMatchObject({
      status: "error",
      error: "playback-blocked",
    });
    expect(capture.video.stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
  });
});
