import { describe, expect, it } from "vitest";
import { boothOverlayBox, cameraLayoutStorageKey, defaultBoothCameraLayout, fitBoothOverlayPoint, readBoothCameraLayout } from "./boothCameraLayout";

describe("camera overlay layout", () => {
  it("rejects malformed preferences and keeps a fresh independent default", () => {
    const bad = readBoothCameraLayout('{"pressure":{"marker":{"x":"bad","y":0}}}');
    expect(bad.pressure.marker).toEqual(defaultBoothCameraLayout().pressure.marker);
    bad.pressure.marker.x = .9;
    expect(defaultBoothCameraLayout().pressure.marker.x).toBe(.55);
    expect(readBoothCameraLayout("not json")).toEqual(defaultBoothCameraLayout());
  });
  it("accepts valid partial preferences and bounds every stored coordinate", () => {
    const layout = readBoothCameraLayout('{"rfPower":{"card":{"x":-10,"y":12}},"extra":{"x":1}}');
    expect(layout.rfPower.card).toEqual({ x: 0, y: 1 });
    expect(layout.pressure).toEqual(defaultBoothCameraLayout().pressure);
  });
  it("keeps full readouts within the video when its aspect ratio or width changes", () => {
    for (const [w, h] of [[320, 180], [1920, 1080], [300, 400], [80, 45]]) {
      for (const part of ["marker", "card"] as const) {
        const p = fitBoothOverlayPoint({ x: 0, y: 1 }, part, w, h);
        const box = boothOverlayBox(part, w, h);
        expect(p.x * w - box.width / 2).toBeGreaterThanOrEqual(2.99);
        expect(p.y * h + box.height / 2).toBeLessThanOrEqual(h - 2.99);
      }
    }
  });
  it("stores each camera and video ratio separately without leaking identifiers into a URL", () => {
    const a = cameraLayoutStorageKey("APC850/private?", 1920, 1080);
    expect(a).not.toEqual(cameraLayoutStorageKey("other", 1920, 1080));
    expect(a).not.toEqual(cameraLayoutStorageKey("APC850/private?", 640, 480));
    expect(a).not.toContain("private?");
  });
});
