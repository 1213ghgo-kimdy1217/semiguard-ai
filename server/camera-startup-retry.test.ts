import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PrototypeCameraController,
  type PrototypeCameraEnvironment,
} from "../client/src/hooks/usePrototypeCamera";
import { MODULE_CAMERA_STORAGE_KEY } from "../shared/moduleCameraPolicy";

const MODULE_ID = "registered-usb-camera";
const MODULE_LABEL = "USB 2.0 Camera (2ce5:c672)";

class Track extends EventTarget {
  readyState: MediaStreamTrackState = "live";
  constructor(public deviceId = MODULE_ID, public label = MODULE_LABEL) { super(); }
  stop = vi.fn(() => { this.readyState = "ended"; });
  getSettings = () => ({ deviceId: this.deviceId });
}

function capture(id = MODULE_ID, label = MODULE_LABEL) {
  const track = new Track(id, label);
  return {
    track,
    stream: {
      getTracks: () => [track],
      getVideoTracks: () => [track],
      getAudioTracks: () => [],
    } as unknown as MediaStream,
  };
}

class Video extends EventTarget {
  srcObject: MediaProvider | null = null;
  paused = true;
  muted = false;
  playsInline = false;
  readyState = 0;
  videoWidth = 0;
  videoHeight = 0;
  pause = vi.fn(() => { this.paused = true; });
  play = vi.fn(async () => { this.paused = false; });
}

const device = (deviceId: string, label: string) => ({
  deviceId, label, kind: "videoinput", groupId: "", toJSON: () => ({}),
}) as MediaDeviceInfo;
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const mounted: PrototypeCameraController[] = [];

function fixture(moduleOnly = true) {
  const stream = capture();
  const media = Object.assign(new EventTarget(), {
    enumerateDevices: vi.fn(async () => [
      device("laptop", "Integrated Camera"),
      device(MODULE_ID, MODULE_LABEL),
      device("other-usb", "USB Video Device"),
    ]),
    getUserMedia: vi.fn(async (_constraints: MediaStreamConstraints) => stream.stream),
  });
  const visibility = Object.assign(new EventTarget(), { hidden: false });
  const registration = JSON.stringify({ version: 1, deviceId: MODULE_ID, label: MODULE_LABEL });
  const stored = new Map([[MODULE_CAMERA_STORAGE_KEY, registration]]);
  const environment: PrototypeCameraEnvironment = {
    mediaDevices: media,
    secureContext: true,
    inIframe: false,
    cameraPolicyAllowed: true,
    visibility,
    storage: {
      getItem: key => stored.get(key) ?? null,
      setItem: (key, value) => { stored.set(key, value); },
      removeItem: key => { stored.delete(key); },
    },
  };
  const controller = new PrototypeCameraController(environment, { moduleOnly });
  const video = new Video();
  controller.bindVideo(video as unknown as HTMLVideoElement);
  controller.mount();
  mounted.push(controller);
  return { controller, media, video, stream, visibility };
}

afterEach(() => {
  mounted.splice(0).forEach(controller => controller.dispose());
});

describe("selected camera startup compatibility retry", () => {
  it.each([
    "NotReadableError",
    "TrackStartError",
    "AbortError",
    "OverconstrainedError",
    "ConstraintNotSatisfiedError",
  ])("retries %s once with the same exact device and no format preferences", async name => {
    const { controller, media, video, stream } = fixture();
    await flush();
    media.getUserMedia.mockRejectedValueOnce(new DOMException("startup failed", name));

    await controller.start();

    expect(media.getUserMedia).toHaveBeenCalledTimes(2);
    expect(media.getUserMedia.mock.calls[0][0]).toEqual({
      audio: false,
      video: {
        deviceId: { exact: MODULE_ID },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
    });
    expect(media.getUserMedia.mock.calls[1][0]).toEqual({
      audio: false,
      video: { deviceId: { exact: MODULE_ID } },
    });
    expect(video.srcObject).toBe(stream.stream);
    expect(controller.getSnapshot()).toMatchObject({
      status: "connected", activeDeviceId: MODULE_ID, error: null,
    });
  });

  it.each([
    "NotAllowedError", "SecurityError", "PermissionDeniedError",
    "NotFoundError", "DevicesNotFoundError", "NotSupportedError", "UnknownError",
  ])("does not retry permission, absence or unsupported failures: %s", async name => {
    const { controller, media, video } = fixture();
    await flush();
    media.getUserMedia.mockRejectedValueOnce(new DOMException("camera unavailable", name));

    await controller.start();

    expect(media.getUserMedia).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().status).toBe("error");
    expect(video.srcObject).toBeNull();
  });

  it("reports the final failure without looping when the retry also fails", async () => {
    const { controller, media, video } = fixture();
    await flush();
    media.getUserMedia
      .mockRejectedValueOnce(new DOMException("preferred format failed", "NotReadableError"))
      .mockRejectedValueOnce(new DOMException("device still unavailable", "AbortError"));

    await controller.start();

    expect(media.getUserMedia).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot()).toMatchObject({ status: "error", error: "device-busy" });
    expect(video.srcObject).toBeNull();
    expect(video.play).not.toHaveBeenCalled();
  });

  it.each(["", "default", "communications"])("does not retry a browser-default request: '%s'", async selected => {
    const { controller, media } = fixture(false);
    await flush();
    controller.selectDevice(selected);
    media.getUserMedia.mockRejectedValueOnce(new DOMException("startup failed", "NotReadableError"));

    await controller.start();

    expect(media.getUserMedia).toHaveBeenCalledTimes(1);
    if (!selected) expect(media.getUserMedia.mock.calls[0][0].video).not.toHaveProperty("deviceId");
    expect(controller.getSnapshot()).toMatchObject({ status: "error", error: "device-busy" });
  });

  it("also retains an explicitly selected device in the general camera view", async () => {
    const { controller, media, video, stream } = fixture(false);
    await flush();
    controller.selectDevice(MODULE_ID);
    media.getUserMedia.mockRejectedValueOnce(new DOMException("startup failed", "NotReadableError"));

    await controller.start();

    expect(media.getUserMedia).toHaveBeenCalledTimes(2);
    expect(media.getUserMedia.mock.calls[1][0]).toEqual({
      audio: false, video: { deviceId: { exact: MODULE_ID } },
    });
    expect(video.srcObject).toBe(stream.stream);
  });

  it.each(["stop", "dispose", "hidden", "forget", "select", "register"] as const)(
    "does not retry a failed request after %s", async action => {
      const { controller, media, video, visibility } = fixture();
      await flush();
      let reject!: (reason: unknown) => void;
      media.getUserMedia.mockImplementationOnce(() =>
        new Promise<MediaStream>((_, no) => { reject = no; })
      );
      const starting = controller.start();
      await flush();
      expect(media.getUserMedia).toHaveBeenCalledTimes(1);

      if (action === "stop") controller.stop();
      if (action === "dispose") controller.dispose();
      if (action === "hidden") {
        visibility.hidden = true;
        visibility.dispatchEvent(new Event("visibilitychange"));
      }
      if (action === "forget") controller.forgetModuleCamera();
      if (action === "select") controller.selectDevice("other-usb");
      if (action === "register") expect(controller.registerModuleCamera("other-usb")).toBe(true);
      reject(new DOMException("late startup failure", "NotReadableError"));
      await starting;

      expect(media.getUserMedia).toHaveBeenCalledTimes(1);
      expect(video.srcObject).toBeNull();
    }
  );

  it("does not retry if general-view selection changes while the first request is pending", async () => {
    const { controller, media, video } = fixture(false);
    await flush();
    controller.selectDevice(MODULE_ID);
    let reject!: (reason: unknown) => void;
    media.getUserMedia.mockImplementationOnce(() =>
      new Promise<MediaStream>((_, no) => { reject = no; })
    );
    const starting = controller.start();
    await flush();
    controller.selectDevice("other-usb");
    reject(new DOMException("late startup failure", "NotReadableError"));
    await starting;

    expect(media.getUserMedia).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({
      selectedDeviceId: "other-usb", status: "stopped", activeDeviceId: null,
    });
    expect(video.srcObject).toBeNull();
  });

  it("rejects a different or built-in camera returned by the compatibility retry", async () => {
    const { controller, media, video } = fixture();
    await flush();
    const wrong = capture("laptop", "Integrated Camera");
    media.getUserMedia
      .mockRejectedValueOnce(new DOMException("startup failed", "NotReadableError"))
      .mockResolvedValueOnce(wrong.stream);

    await controller.start();

    expect(media.getUserMedia).toHaveBeenCalledTimes(2);
    expect(wrong.track.stop).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
    expect(video.play).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({ status: "error", error: "constraints" });
  });

  it("discards a retry stream that resolves after cancellation", async () => {
    const { controller, media, video } = fixture();
    await flush();
    let resolve!: (stream: MediaStream) => void;
    media.getUserMedia
      .mockRejectedValueOnce(new DOMException("startup failed", "NotReadableError"))
      .mockImplementationOnce(() => new Promise<MediaStream>(yes => { resolve = yes; }));
    const starting = controller.start();
    await flush();
    expect(media.getUserMedia).toHaveBeenCalledTimes(2);
    controller.stop();
    const late = capture();
    resolve(late.stream);
    await starting;

    expect(late.track.stop).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
    expect(controller.getSnapshot().status).toBe("stopped");
  });
});
