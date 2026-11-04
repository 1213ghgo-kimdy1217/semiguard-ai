import { describe, expect, it } from "vitest";
import {
  MODULE_CAMERA_STORAGE_KEY, createModuleCameraRegistration,
  isEligibleModuleCamera, isRegisteredModuleCameraPresent,
  readModuleCameraRegistration, recommendedModuleCameraId,
} from "./moduleCameraPolicy";

const apc = { deviceId: "module-apc-850", label: "ABKO APC850" };
const usb = { deviceId: "external-usb", label: "USB 2.0 Camera" };

describe("module webcam candidates", () => {
  it("requires an identifiable non-default device and an external candidate label", () => {
    expect(isEligibleModuleCamera(apc)).toBe(true);
    expect(isEligibleModuleCamera(usb)).toBe(true);
    expect(isEligibleModuleCamera({ deviceId: "usb-video", label: "USB Video Device" })).toBe(true);
    expect(isEligibleModuleCamera({ deviceId: "usb-webcam", label: "USB2.0 HD UVC WebCam" })).toBe(true);
    expect(isEligibleModuleCamera({ deviceId: "fullwidth", label: "앱코 ＡＰＣ８５０" })).toBe(true);
    for (const deviceId of ["", "default", "DEFAULT", "communications", " spaces ", "x".repeat(513)]) {
      expect(isEligibleModuleCamera({ deviceId, label: apc.label }), deviceId).toBe(false);
    }
    for (const label of ["", " ", "Camera 1", "HD Webcam", "ABKO Camera", "x".repeat(513), "USB Camera\n"]) {
      expect(isEligibleModuleCamera({ deviceId: apc.deviceId, label }), label).toBe(false);
    }
  });

  it("rejects built-in, IR and virtual cameras even if a name also mentions USB or APC850", () => {
    for (const label of [
      "Integrated USB Camera", "Built-in USB Camera", "USB Internal Camera",
      "USB Laptop Camera", "USB Notebook Camera", "USB Front Camera", "USB User-facing Camera",
      "APC850 IR Camera", "USB Infrared Camera", "USB Depth Camera", "USB RGB-D Camera",
      "USB Virtual Camera", "OBS USB Camera", "Snap Camera USB", "DroidCam USB Camera",
      "ManyCam USB Camera", "USB FaceTime HD Camera", "USB EasyCamera", "HP TrueVision USB Camera",
      "USB Windows Hello Camera", "내장 USB 카메라", "노트북 USB 웹캠", "전면 USB 카메라", "가상 USB 카메라",
    ]) expect(isEligibleModuleCamera({ deviceId: "wrong-device", label }), label).toBe(false);
  });

  it("only recommends one distinct APC850 and does not recommend the first/default/generic webcam", () => {
    expect(recommendedModuleCameraId([usb])).toBeNull();
    expect(recommendedModuleCameraId([{ deviceId: "default", label: apc.label }])).toBeNull();
    expect(recommendedModuleCameraId([usb, apc])).toBe(apc.deviceId);
    expect(recommendedModuleCameraId([apc, { ...apc }])).toBe(apc.deviceId);
    expect(recommendedModuleCameraId([apc, { ...apc, deviceId: "second-apc" }])).toBeNull();
    expect(recommendedModuleCameraId([{ deviceId: "built-in", label: "Integrated APC850 Camera" }])).toBeNull();
  });
});

describe("explicit module camera registration", () => {
  it("creates a bounded preference only for an eligible explicit candidate", () => {
    const registration = createModuleCameraRegistration(usb);
    expect(registration).toEqual({ version: 1, ...usb });
    expect(registration).not.toBe(usb);
    expect(createModuleCameraRegistration({ deviceId: "laptop", label: "Integrated Camera" })).toBeNull();
    expect(MODULE_CAMERA_STORAGE_KEY).toBe("semiguard.module-camera.v1");
  });

  it("requires the exact registered ID and normalized label, without fallback on removal or ID rotation", () => {
    const registration = createModuleCameraRegistration(apc)!;
    expect(isRegisteredModuleCameraPresent(registration, [usb, apc])).toBe(true);
    expect(isRegisteredModuleCameraPresent(registration, [{ ...apc, label: "  abko   apc850 " }])).toBe(true);
    expect(isRegisteredModuleCameraPresent(registration, [usb])).toBe(false);
    expect(isRegisteredModuleCameraPresent(registration, [{ ...apc, deviceId: "rotated-id" }])).toBe(false);
    expect(isRegisteredModuleCameraPresent(registration, [{ ...apc, label: "USB Camera" }])).toBe(false);
    expect(isRegisteredModuleCameraPresent(registration, [{ ...apc, label: "" }])).toBe(false);
    expect(isRegisteredModuleCameraPresent(registration, [{ ...apc, label: "Integrated APC850 Camera" }])).toBe(false);
    expect(isRegisteredModuleCameraPresent(null, [apc])).toBe(false);
    expect(isRegisteredModuleCameraPresent({ ...registration, version: 2 } as never, [apc])).toBe(false);
  });

  it("reads only the current valid format and fails closed on corrupt or untrusted preferences", () => {
    const registration = createModuleCameraRegistration(apc)!;
    expect(readModuleCameraRegistration(JSON.stringify(registration))).toEqual(registration);
    for (const raw of [
      null, "", "not JSON", "null", "[]", "{}", "x".repeat(2049),
      JSON.stringify({ ...registration, version: 2 }),
      JSON.stringify({ ...registration, deviceId: "default" }),
      JSON.stringify({ ...registration, label: "Integrated Camera" }),
      JSON.stringify({ ...registration, label: "" }),
      JSON.stringify({ ...registration, label: "x".repeat(513) }),
      JSON.stringify({ ...registration, deviceId: "x".repeat(513) }),
      JSON.stringify({ ...registration, deviceId: 123 }),
    ]) expect(readModuleCameraRegistration(raw), String(raw).slice(0, 80)).toBeNull();
  });
});
