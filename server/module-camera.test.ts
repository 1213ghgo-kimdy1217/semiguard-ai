import { afterEach, describe, expect, it, vi } from "vitest";
import { PrototypeCameraController, type PrototypeCameraEnvironment } from "../client/src/hooks/usePrototypeCamera";
import { MODULE_CAMERA_STORAGE_KEY } from "../shared/moduleCameraPolicy";

class Track extends EventTarget {
  readyState: MediaStreamTrackState = "live";
  constructor(public deviceId = "module", public label = "ABKO APC850") { super(); }
  stop = vi.fn(() => { this.readyState = "ended"; });
  getSettings = () => ({ deviceId: this.deviceId });
}
function capture(id = "module", label = "ABKO APC850") {
  const video = new Track(id, label), audio = new Track("audio", "Microphone");
  return { video, audio, stream: {
    getTracks: () => [video, audio], getVideoTracks: () => [video], getAudioTracks: () => [audio],
  } as unknown as MediaStream };
}
const device = (deviceId: string, label: string) => ({ deviceId, label, kind: "videoinput", groupId: "", toJSON: () => ({}) }) as MediaDeviceInfo;
class Video extends EventTarget {
  srcObject: MediaProvider | null = null;
  paused = true; muted = false; playsInline = false; readyState = 0; videoWidth = 0; videoHeight = 0;
  pause = vi.fn(() => { this.paused = true; });
  play = vi.fn(async () => { this.paused = false; });
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const mounted: PrototypeCameraController[] = [];
function fixture(devices = [device("laptop", "Integrated Camera"), device("module", "ABKO APC850")], persisted: string | null = null) {
  const stream = capture();
  const stored = new Map<string, string>();
  if (persisted !== null) stored.set(MODULE_CAMERA_STORAGE_KEY, persisted);
  const storage = {
    getItem: vi.fn((key: string) => stored.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { stored.set(key, value); }),
    removeItem: vi.fn((key: string) => { stored.delete(key); }),
  };
  const media = Object.assign(new EventTarget(), {
    enumerateDevices: vi.fn(async () => devices),
    getUserMedia: vi.fn(async (_constraints: MediaStreamConstraints) => stream.stream),
  });
  const environment: PrototypeCameraEnvironment = { mediaDevices: media, secureContext: true, inIframe: false, cameraPolicyAllowed: true, storage };
  const controller = new PrototypeCameraController(environment, { moduleOnly: true });
  const video = new Video();
  controller.bindVideo(video as unknown as HTMLVideoElement);
  controller.mount(); mounted.push(controller);
  return { controller, media, video, stream, storage, stored };
}
afterEach(() => { mounted.splice(0).forEach(controller => controller.dispose()); });

describe("registered module camera only", () => {
  it("proposes APC850 but never opens it or the laptop camera before explicit registration", async () => {
    const { controller, media } = fixture(); await flush();
    expect(controller.getSnapshot()).toMatchObject({ recommendedDeviceId: "module", registeredDeviceId: null, canStart: false });
    expect(controller.getSnapshot().eligibleModuleDevices.map(d => d.deviceId)).toEqual(["module"]);
    await controller.start();
    expect(media.getUserMedia).not.toHaveBeenCalled();
    expect(controller.registerModuleCamera("laptop")).toBe(false);
    expect(controller.registerModuleCamera("module")).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({ canStart: true, error: null, moduleRegistrationState: "ready" });
    expect(media.getUserMedia).not.toHaveBeenCalled();
  });

  it.each([
    [device("", "")], [device("default", "")], [device("laptop", "Integrated Camera")], [],
  ])("does not activate a default device to reveal names or work around absence: %j", async (...items) => {
    const devices = Array.isArray(items[0]) ? [] : items as MediaDeviceInfo[];
    const { controller, media, video } = fixture(devices); await flush();
    await controller.start();
    expect(controller.getSnapshot().canStart).toBe(false);
    expect(media.getUserMedia).not.toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
  });

  it("uses the registered exact ID and verifies the returned ID before attaching", async () => {
    const { controller, media, video, stream } = fixture(); await flush();
    controller.registerModuleCamera("module"); await controller.start();
    expect(media.getUserMedia).toHaveBeenCalledTimes(1);
    expect(media.getUserMedia).toHaveBeenCalledWith(expect.objectContaining({
      audio: false, video: expect.objectContaining({ deviceId: { exact: "module" } }),
    }));
    expect(video.srcObject).toBe(stream.stream);
    expect(controller.getSnapshot()).toMatchObject({ activeDeviceId: "module", activeDeviceLabel: "ABKO APC850" });
  });

  it.each([["laptop", "Integrated Camera"], ["", "ABKO APC850"], ["module", "Integrated Camera"]])(
    "stops mismatched or built-in returned tracks without displaying them: %s %s", async (id, label) => {
      const { controller, media, video } = fixture(); await flush(); controller.registerModuleCamera("module");
      const wrong = capture(id, label); media.getUserMedia.mockResolvedValue(wrong.stream);
      await controller.start();
      expect(wrong.video.stop).toHaveBeenCalled(); expect(wrong.audio.stop).toHaveBeenCalled();
      expect(video.srcObject).toBeNull(); expect(video.play).not.toHaveBeenCalled();
      expect(controller.getSnapshot()).toMatchObject({ status: "error", error: "constraints", activeDeviceId: null });
    },
  );

  it("stops on unplug, preserves the missing binding, and never falls back to laptop", async () => {
    const { controller, media, video, stream } = fixture(); await flush(); controller.registerModuleCamera("module"); await controller.start();
    media.enumerateDevices.mockResolvedValue([device("laptop", "Integrated Camera")]);
    media.dispatchEvent(new Event("devicechange")); await flush();
    expect(stream.video.stop).toHaveBeenCalled(); expect(video.srcObject).toBeNull();
    expect(controller.getSnapshot()).toMatchObject({ moduleRegistrationState: "missing", registeredDeviceId: "module", canStart: false });
    await controller.start(); expect(media.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("does not retry an exact camera failure with default constraints", async () => {
    const { controller, media } = fixture(); await flush(); controller.registerModuleCamera("module");
    media.getUserMedia.mockRejectedValue(new DOMException("not found", "NotFoundError"));
    await controller.start();
    expect(media.getUserMedia).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().error).toBe("no-device");
  });

  it("restores an existing binding only when both current ID and label match", async () => {
    const registered = JSON.stringify({ version: 1, deviceId: "module", label: "ABKO APC850" });
    const { controller, media } = fixture(undefined, registered); await flush();
    expect(controller.getSnapshot()).toMatchObject({ canStart: true, selectedDeviceId: "module", moduleRegistrationState: "ready" });
    expect(media.getUserMedia).not.toHaveBeenCalled();
    media.enumerateDevices.mockResolvedValue([device("module", "USB Different Camera"), device("replacement", "ABKO APC850")]);
    await controller.refreshDevices();
    expect(controller.getSnapshot()).toMatchObject({ registeredDeviceId: "module", moduleRegistrationState: "missing", canStart: false });
    await controller.start(); expect(media.getUserMedia).not.toHaveBeenCalled();
  });

  it("stops current capture on candidate selection and retains the explicit registered target", async () => {
    const { controller, media, video, stream } = fixture([device("module", "ABKO APC850"), device("other", "USB Camera")]);
    await flush(); controller.registerModuleCamera("module"); await controller.start();
    controller.selectDevice("other");
    expect(stream.video.stop).toHaveBeenCalled(); expect(video.srcObject).toBeNull();
    expect(controller.getSnapshot()).toMatchObject({ selectedDeviceId: "other", registeredDeviceId: "module", activeDeviceId: null });
    expect(controller.getSnapshot().canStart).toBe(false);
    await controller.start();
    expect(media.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("clears active display immediately while revalidating discovery before a new request", async () => {
    const { controller, media, video } = fixture(); await flush();
    controller.registerModuleCamera("module"); await controller.start(); await flush();
    let resolve!: (devices: MediaDeviceInfo[]) => void;
    media.enumerateDevices.mockReturnValue(new Promise<MediaDeviceInfo[]>(yes => { resolve = yes; }));
    const next = capture(); media.getUserMedia.mockResolvedValue(next.stream);
    const starting = controller.start();
    expect(controller.getSnapshot()).toMatchObject({ status: "requesting", activeDeviceId: null, activeDeviceLabel: null, canStart: false });
    expect(video.srcObject).toBeNull(); expect(media.getUserMedia).toHaveBeenCalledTimes(1);
    resolve([device("module", "ABKO APC850")]); await starting;
    expect(controller.getSnapshot()).toMatchObject({ status: "connected", activeDeviceId: "module" });
  });

  it.each(["", "laptop"])("does not silently replace the selected invalid candidate '%s' with the stored binding", async selection => {
    const { controller, media } = fixture(); await flush(); controller.registerModuleCamera("module");
    controller.selectDevice(selection); await controller.start();
    expect(media.getUserMedia).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({ status: "error", error: "constraints", activeDeviceId: null });
  });

  it("invalidates pending capture when registration is forgotten or controller is disposed", async () => {
    const { controller, media, video } = fixture(); await flush(); controller.registerModuleCamera("module");
    let resolve!: (stream: MediaStream) => void;
    media.getUserMedia.mockReturnValue(new Promise<MediaStream>(yes => { resolve = yes; }));
    const starting = controller.start(); await flush();
    controller.forgetModuleCamera(); controller.dispose();
    const late = capture(); resolve(late.stream); await starting;
    expect(late.video.stop).toHaveBeenCalled(); expect(video.srcObject).toBeNull();
    expect(controller.getSnapshot()).toMatchObject({ registeredDeviceId: null, canStart: false });
  });

  it("does not trust cached discovery when current enumeration fails", async () => {
    const { controller, media } = fixture(); await flush(); controller.registerModuleCamera("module");
    media.enumerateDevices.mockRejectedValue(new Error("device discovery unavailable"));
    await controller.start(); expect(media.getUserMedia).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({ moduleRegistrationState: "missing", canStart: false });
  });

  it("does not capture when a discovery result arrives after disposal", async () => {
    const { controller, media, video } = fixture(); await flush(); controller.registerModuleCamera("module");
    let resolve!: (devices: MediaDeviceInfo[]) => void;
    media.enumerateDevices.mockReturnValue(new Promise<MediaDeviceInfo[]>(yes => { resolve = yes; }));
    const starting = controller.start(); controller.dispose();
    resolve([device("module", "ABKO APC850")]); await starting;
    expect(media.getUserMedia).not.toHaveBeenCalled(); expect(video.srcObject).toBeNull();
    expect(controller.getSnapshot()).toMatchObject({ canStart: false, activeDeviceId: null, status: "stopped" });
  });

  it("discards the pending old stream when another module device is registered", async () => {
    const { controller, media, video } = fixture([device("module", "ABKO APC850"), device("other", "USB Camera")]);
    await flush(); controller.registerModuleCamera("module");
    let resolve!: (stream: MediaStream) => void;
    media.getUserMedia.mockReturnValue(new Promise<MediaStream>(yes => { resolve = yes; }));
    const starting = controller.start(); await flush();
    expect(controller.registerModuleCamera("other")).toBe(true);
    const late = capture(); resolve(late.stream); await starting;
    expect(late.video.stop).toHaveBeenCalled(); expect(video.srcObject).toBeNull();
    expect(controller.getSnapshot()).toMatchObject({ registeredDeviceId: "other", selectedDeviceId: "other", canStart: true, activeDeviceId: null });
    expect(media.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("keeps explicit registration usable in memory when browser storage is unavailable", async () => {
    const { controller, storage } = fixture(); await flush();
    storage.setItem.mockImplementation(() => { throw new Error("storage blocked"); });
    expect(controller.registerModuleCamera("module")).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({ registeredDeviceId: "module", canStart: true });
    controller.forgetModuleCamera(); expect(controller.getSnapshot().canStart).toBe(false);
  });
});
