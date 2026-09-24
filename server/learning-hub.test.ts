import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { processLessons, processOverviewSource, etchEquipmentSource } from "../shared/learningHub";

describe("process learning guide", () => {
  it("has eight unique lessons with valid self-check answers", () => {
    expect(processLessons).toHaveLength(8);
    expect(new Set(processLessons.map(p => p.id)).size).toBe(8);
    for (const lesson of processLessons) {
      expect(lesson.options[lesson.answer]).toBeTruthy();
      expect(lesson.observe).toBeTruthy();
      expect(lesson.misconception).toBeTruthy();
    }
  });
  it("uses official sources and preserves fictional equipment boundaries", () => {
    expect(new URL(processOverviewSource).hostname).toBe("semiconductor.samsung.com");
    expect(new URL(etchEquipmentSource).hostname).toBe("www.lamresearch.com");
    const source = readFileSync("client/src/components/EtchEquipmentReference.tsx", "utf8");
    expect(source).toContain("디지털 트윈이 아닙니다");
    expect(source).toContain("실제 장비 로그가 아닙니다");
  });
  it("connects public optional learning and does not invent other scenarios", () => {
    const app = readFileSync("client/src/App.tsx", "utf8");
    const page = readFileSync("client/src/pages/LearningHub.tsx", "utf8");
    expect(app).toContain('path={"/learn"}');
    expect(page).toContain('p.id === "etch"');
    expect(page).toContain("관찰 시나리오는 아직 없습니다");
    expect(page).toContain("학습을 건너뛰고");
  });
});
