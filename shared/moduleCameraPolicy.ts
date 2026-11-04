/**
 * A label can identify a candidate, not prove where a webcam is physically mounted.
 * The operator must register the module's camera explicitly; this policy never
 * grants capture consent and never substitutes a browser's default device.
 */
export type ModuleCameraDevice = { deviceId: string; label: string };
export type ModuleCameraRegistration = {
  version: 1;
  deviceId: string;
  label: string;
};

export const MODULE_CAMERA_STORAGE_KEY = "semiguard.module-camera.v1";
const MAX_DEVICE_ID_LENGTH = 512;
const MAX_LABEL_LENGTH = 512;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

function normalizedLabel(label: string): string {
  return label.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 &&
    value.length <= MAX_DEVICE_ID_LENGTH && value.trim() === value &&
    !CONTROL_CHARACTER.test(value) && !/^(?:default|communications)$/i.test(value);
}

function validLabel(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 &&
    value.length <= MAX_LABEL_LENGTH && value.trim().length > 0 &&
    !CONTROL_CHARACTER.test(value);
}

const EXCLUDED_LABEL = /\b(?:integrated|built[\s_-]*in|internal|laptop|notebook|front(?:[\s_-]*facing)?|user[\s_-]*facing|ir|infrared|depth|rgb[\s_-]*d|virtual|obs|snap[\s_-]*cam(?:era)?|droidcam|manycam|facetime|easycamera|true[\s_-]*vision|windows[\s_-]*hello)\b|내장|노트북|전면|가상/;
const APC850_LABEL = /\bapc[\s_-]*850\b/;
const EXTERNAL_USB_LABEL = /\busb(?:[\s_-]*[0-9](?:\.[0-9])?)?\b/;
const CAMERA_LABEL = /\b(?:camera|web[\s_-]*cam|video)\b|카메라|웹캠/;

/** Eligible candidates still require an explicit, separate registration action. */
export function isEligibleModuleCamera(device: ModuleCameraDevice): boolean {
  if (!device || !validId(device.deviceId) || !validLabel(device.label)) return false;
  const label = normalizedLabel(device.label);
  if (EXCLUDED_LABEL.test(label)) return false;
  return APC850_LABEL.test(label) ||
    (EXTERNAL_USB_LABEL.test(label) && CAMERA_LABEL.test(label));
}

/** Recommend only one unambiguous purchased-model candidate, without registering it. */
export function recommendedModuleCameraId(devices: readonly ModuleCameraDevice[]): string | null {
  const ids = new Set(devices
    .filter(device => isEligibleModuleCamera(device) && APC850_LABEL.test(normalizedLabel(device.label)))
    .map(device => device.deviceId));
  return ids.size === 1 ? Array.from(ids)[0] : null;
}

export function createModuleCameraRegistration(device: ModuleCameraDevice): ModuleCameraRegistration | null {
  return isEligibleModuleCamera(device)
    ? { version: 1, deviceId: device.deviceId, label: device.label.trim() }
    : null;
}

/** Browser preferences are untrusted. Unknown versions and corrupt data fail closed. */
export function readModuleCameraRegistration(raw: string | null): ModuleCameraRegistration | null {
  if (!raw || raw.length > 2048) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const candidate = value as Record<string, unknown>;
    if (candidate.version !== 1 || !validId(candidate.deviceId) || !validLabel(candidate.label)) return null;
    return createModuleCameraRegistration({ deviceId: candidate.deviceId, label: candidate.label });
  } catch {
    return null;
  }
}

/** A missing/reidentified device is unavailable; another webcam never replaces it. */
export function isRegisteredModuleCameraPresent(
  registration: ModuleCameraRegistration | null | undefined,
  devices: readonly ModuleCameraDevice[],
): boolean {
  if (!registration || registration.version !== 1 || !isEligibleModuleCamera(registration)) return false;
  return devices.some(device => isEligibleModuleCamera(device) &&
    device.deviceId === registration.deviceId &&
    normalizedLabel(device.label) === normalizedLabel(registration.label));
}
