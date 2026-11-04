import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BoothCameraOverlay from "../client/src/components/BoothCameraOverlay";
import type { usePrototypeCamera } from "../client/src/hooks/usePrototypeCamera";
import { BOOTH_SIGNALS, BOOTH_RECOVERY_RANGES, BOOTH_ALARM_CLEAR_MS, type SignalKey } from "./boothExperience";

const cameraHook = vi.hoisted(() => vi.fn());
vi.mock("../client/src/hooks/usePrototypeCamera", () => ({ usePrototypeCamera: cameraHook }));

type Camera = ReturnType<typeof usePrototypeCamera>;
const healthy = { pressure: false, gasFlow: false, rfPower: false, chamberAmbientTemp: false };
const values = { pressure: 20, gasFlow: 100, rfPower: 500, chamberAmbientTemp: 35 };
const webcam = { deviceId: "module-apc850", label: "ABKO APC850" };

function camera(overrides: Partial<Camera> = {}): Camera {
  return {
    status: "idle", error: null, devices: [], selectedDeviceId: "", recommendedDeviceId: null,
    activeDeviceLabel: null, activeDeviceId: null, width: 0, height: 0,
    supported: true, secureContext: true, inIframe: false, cameraPolicyAllowed: true,
    stoppedForBackground: false, moduleOnly: true, eligibleModuleDevices: [],
    registeredDeviceId: null, registeredDeviceLabel: null, moduleRegistrationState: "unregistered",
    canStart: false, videoRef: vi.fn(), start: vi.fn(async () => {}), stop: vi.fn(),
    selectDevice: vi.fn(), refreshDevices: vi.fn(async () => {}),
    registerModuleCamera: vi.fn(() => true), forgetModuleCamera: vi.fn(),
    ...overrides,
  };
}

function render(current: Camera, alarms: Record<SignalKey, boolean> = healthy, compact = false) {
  cameraHook.mockReturnValue(current);
  return renderToStaticMarkup(createElement(BoothCameraOverlay, { values, alarms, compact }));
}

function normalGuide(markup: string) {
  const section = markup.match(/<section\b[^>]*class="bc-normal-guide"[^>]*>[\s\S]*?<\/section>/)?.[0];
  expect(section).toBeDefined();
  return section!;
}

function guideCards(markup: string) {
  return [...normalGuide(markup).matchAll(/<div\b[^>]*data-alarm="([^"]+)"[^>]*>([\s\S]*?)<\/div>/g)];
}

beforeEach(() => { cameraHook.mockReset(); });

describe("module camera UI without a connected module webcam", () => {
  it("shows disconnected state without presenting the laptop or browser default as a camera source", () => {
    const current = camera({ devices: [{ deviceId: "laptop", label: "Integrated Camera" }] });
    const markup = render(current);
    expect(cameraHook).toHaveBeenCalledWith({ moduleOnly: true });
    expect(markup).toContain("모듈 카메라 미연결");
    expect(markup).toContain("모듈 카메라가 연결되지 않았어요");
    expect(markup).not.toContain("Integrated Camera");
    expect(markup).not.toMatch(/<option\b[^>]*value="(?:default|laptop)"/);
    expect(markup).not.toContain("브라우저 기본 카메라");
    expect(markup).not.toContain('class="bc-video-badge"');
    expect(markup).not.toContain('class="bc-active-device"');
    expect(markup).not.toContain('class="bc-status is-live"');
    expect(markup).toMatch(/<button\b[^>]*disabled=""[^>]*>모듈 카메라 연결<\/button>/);
    expect(current.start).not.toHaveBeenCalled();
    expect(current.registerModuleCamera).not.toHaveBeenCalled();
  });

  it("keeps an unplugged registered module visibly disconnected even if another USB webcam exists", () => {
    const alternate = { deviceId: "other-usb", label: "USB Camera" };
    const current = camera({
      status: "error", error: "device-lost", devices: [alternate], eligibleModuleDevices: [alternate],
      selectedDeviceId: webcam.deviceId, registeredDeviceId: webcam.deviceId,
      registeredDeviceLabel: webcam.label, moduleRegistrationState: "missing",
    });
    const markup = render(current);
    expect(markup).toContain("모듈 카메라 미연결");
    expect(markup).toContain("등록한 ABKO APC850을 찾지 못했어요");
    expect(markup).toContain("다른 카메라로 전환하지 않습니다");
    expect(markup).not.toContain('class="bc-video-badge"');
    expect(markup).not.toContain('class="bc-active-device"');
    expect(markup).toMatch(/<button\b[^>]*disabled=""[^>]*>모듈 카메라 연결<\/button>/);
    expect(current.start).not.toHaveBeenCalled();
    expect(current.selectDevice).not.toHaveBeenCalled();
  });

  it("shows all targets, normal ranges and recovery criteria outside the video before connection", () => {
    const markup = render(camera());
    const guide = normalGuide(markup);
    expect(guide).toContain("목표값과 정상 범위");
    expect(guide).not.toContain('aria-hidden="true"');
    expect(guide).not.toMatch(/\bhidden(?:=|\s|>)/);
    expect(guideCards(markup)).toHaveLength(4);
    // Keep the expected booth targets explicit: these are what visitors need to see.
    for (const target of ["목표 20 mTorr", "목표 100 sccm", "목표 500 W", "목표 35 °C"]) {
      expect(guide).toContain(target);
    }
    for (const signal of BOOTH_SIGNALS) {
      expect(guide).toContain(`정상 ${signal.normal[0]}–${signal.normal[1]} ${signal.unit}`);
      expect(guide).toContain(`${signal.number} · ${signal.label}: ${BOOTH_RECOVERY_RANGES[signal.key][0]}–${BOOTH_RECOVERY_RANGES[signal.key][1]} ${signal.unit}`);
    }
    expect(guide).toContain(`${(BOOTH_ALARM_CLEAR_MS / 1000).toFixed(1)}초 유지하면 흰색으로 돌아와요`);
  });

  it("uses supplied alarm flags in the visible guide, including the normal-value recovery hold", () => {
    const bad = guideCards(render(camera(), { ...healthy, rfPower: true }));
    expect(bad.map(card => card[1])).toEqual(["false", "false", "true", "false"]);
    expect(bad[2][2]).toContain("3 · RF 전력");
    expect(bad[2][2]).toContain("목표 500 W");
    expect(bad[2][2]).toContain("복구 필요");
    expect(bad.filter(card => card[2].includes("복구 필요"))).toHaveLength(1);
    const recovered = guideCards(render(camera(), healthy));
    expect(recovered.map(card => card[1])).toEqual(["false", "false", "false", "false"]);
    expect(recovered.every(card => card[2].includes("<b>정상</b>"))).toBe(true);
  });

  it("shows live source and overlay only after the registered module is actually playing", () => {
    const registered = {
      devices: [webcam], eligibleModuleDevices: [webcam], selectedDeviceId: webcam.deviceId,
      registeredDeviceId: webcam.deviceId, registeredDeviceLabel: webcam.label,
      moduleRegistrationState: "ready" as const, canStart: true,
    };
    const awaitingPlayback = render(camera({ ...registered, status: "ready", width: 1280, height: 720 }));
    expect(awaitingPlayback).toContain("모듈 카메라 연결 중");
    expect(awaitingPlayback).not.toContain('class="bc-video-badge"');
    expect(awaitingPlayback).not.toContain('class="bc-active-device"');
    const playing = render(camera({ ...registered, status: "playing", width: 1280, height: 720,
      activeDeviceId: webcam.deviceId, activeDeviceLabel: webcam.label }));
    expect(playing).toContain("모듈 카메라 실시간");
    expect(playing).toContain('class="bc-video-badge"');
    expect(playing).toContain('class="bc-active-device">현재 영상 · ABKO APC850');
    expect(playing).toContain("카메라 실시간 · 수치는 교육용 모의");
  });

  it("keeps compact setup clear without rendering duplicate value guides or a registration form", () => {
    const current = camera({ devices: [{ deviceId: "laptop", label: "Integrated Camera" }] });
    const markup = render(current, healthy, true);
    expect(markup).toContain('class="bc-camera bc-camera-compact"');
    expect(markup).toContain("모듈 카메라 미연결");
    expect(markup).toContain("모듈 웹캠을 PC에 USB로 연결한 뒤 등록하세요");
    expect(markup).toContain(">모듈 카메라 등록</button>");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('class="bc-normal-guide"');
    expect(markup).not.toContain('class="bc-source"');
    expect(markup).not.toContain('class="bc-footnote"');
    expect(markup).not.toContain('class="bc-module-registration"');
    expect(markup).not.toContain('class="bc-calibration"');
    expect(markup).not.toContain("Integrated Camera");
    expect(current.start).not.toHaveBeenCalled();
    expect(current.registerModuleCamera).not.toHaveBeenCalled();
  });

  it("prioritizes the live feed in compact mode while keeping camera settings closed", () => {
    const markup = render(camera({
      status: "playing", width: 1280, height: 720, devices: [webcam], eligibleModuleDevices: [webcam],
      selectedDeviceId: webcam.deviceId, registeredDeviceId: webcam.deviceId,
      registeredDeviceLabel: webcam.label, moduleRegistrationState: "ready", canStart: true,
      activeDeviceId: webcam.deviceId, activeDeviceLabel: webcam.label,
    }), healthy, true);
    expect(markup).toContain("모듈 카메라 실시간");
    expect(markup).toContain(">영상 중지</button>");
    expect(markup).toContain(">카메라 설정</button>");
    expect(markup).toContain('class="bc-video-badge"');
    expect(markup).toContain('class="bc-calibration"');
    expect(markup).not.toContain('class="bc-module-registration"');
    expect(markup).not.toContain('class="bc-normal-guide"');
    expect(markup).toContain("--bc-aspect:1.7777777777777777");
  });

  it("labels end-of-run values as recorded even when the module video remains live", () => {
    cameraHook.mockReturnValue(camera({
      status: "playing", width: 1280, height: 720, devices: [webcam], eligibleModuleDevices: [webcam],
      selectedDeviceId: webcam.deviceId, registeredDeviceId: webcam.deviceId,
      registeredDeviceLabel: webcam.label, moduleRegistrationState: "ready", canStart: true,
      activeDeviceId: webcam.deviceId, activeDeviceLabel: webcam.label,
    }));
    const markup = renderToStaticMarkup(createElement(BoothCameraOverlay, {
      values, alarms: healthy, compact: true, valuesFrozen: true,
    }));
    expect(markup).toContain("카메라 실시간 · 수치는 종료 시점 기록");
    expect(markup).not.toContain("카메라 실시간 · 수치는 교육용 모의");
    expect(markup).toContain('class="bc-video-badge"');
    expect(markup).toContain('aria-label="실물 교육용 챔버 카메라" class="is-playing"');
  });
});
