/** Camera coordinates are relative to the displayed video, not its outer panel. */
export type BoothCameraSignal = "pressure" | "gasFlow" | "rfPower" | "chamberAmbientTemp";
export type OverlayPoint = { x: number; y: number };
export type OverlayPart = "marker" | "card";
export type BoothCameraLayout = Record<BoothCameraSignal, Record<OverlayPart, OverlayPoint>>;

export const BOOTH_CAMERA_SIGNALS: readonly BoothCameraSignal[] = [
  "pressure", "gasFlow", "rfPower", "chamberAmbientTemp",
];

export function defaultBoothCameraLayout(): BoothCameraLayout {
  return {
    pressure: { marker: { x: .55, y: .56 }, card: { x: .76, y: .53 } },
    gasFlow: { marker: { x: .55, y: .20 }, card: { x: .76, y: .19 } },
    rfPower: { marker: { x: .22, y: .43 }, card: { x: .19, y: .20 } },
    chamberAmbientTemp: { marker: { x: .85, y: .65 }, card: { x: .76, y: .83 } },
  };
}

const unit = (v: number) => Math.min(1, Math.max(0, v));

/** Stored layouts are untrusted and may come from an older UI version. */
export function readBoothCameraLayout(raw: string | null): BoothCameraLayout {
  const result = defaultBoothCameraLayout();
  if (!raw || raw.length > 5000) return result;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return result;
    for (const key of BOOTH_CAMERA_SIGNALS) {
      const entry = (data as Record<string, unknown>)[key];
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      for (const part of ["marker", "card"] as const) {
        const point = (entry as Record<string, unknown>)[part];
        if (!point || typeof point !== "object" || Array.isArray(point)) continue;
        const { x, y } = point as Record<string, unknown>;
        if (typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y)) {
          result[key][part] = { x: unit(x), y: unit(y) };
        }
      }
    }
  } catch { /* A corrupt browser preference never blocks camera access. */ }
  return result;
}

export function boothOverlayBox(part: OverlayPart, width: number, height: number) {
  const w = Math.max(1, width), h = Math.max(1, height);
  return part === "marker"
    ? { width: Math.min(42, Math.max(1, w - 8)), height: Math.min(42, Math.max(1, h - 8)) }
    : { width: Math.max(1, Math.min(192, Math.max(112, w * .23), w - 12)), height: Math.max(1, Math.min(66, Math.max(52, h * .25), h - 12)) };
}

/** Keep the entire hit target / readout visible, including on a narrow phone. */
export function fitBoothOverlayPoint(point: OverlayPoint, part: OverlayPart, width: number, height: number): OverlayPoint {
  const w = Math.max(1, width), h = Math.max(1, height);
  const box = boothOverlayBox(part, w, h);
  const mx = Math.min(.5, (box.width / 2 + 3) / w);
  const my = Math.min(.5, (box.height / 2 + 3) / h);
  return { x: Math.max(mx, Math.min(1 - mx, point.x)), y: Math.max(my, Math.min(1 - my, point.y)) };
}

export function cameraLayoutStorageKey(device: string, width: number, height: number) {
  const ratio = width > 0 && height > 0 ? (width / height).toFixed(3) : "1.778";
  return `semiguard.camera-overlay.v1:${encodeURIComponent(device.slice(0, 512) || "default")}:${ratio}`;
}
