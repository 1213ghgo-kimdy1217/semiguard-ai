import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("free analysis source selection", () => {
  it("keeps imported records separate from simulation and does not upload files", () => {
    const live = readFileSync("client/src/pages/EtchLive.tsx", "utf8");
    const file = readFileSync("client/src/pages/SensorFileAnalysis.tsx", "utf8");
    expect(live).toContain("가변 가상 스트림");
    expect(live).toContain("기록 CSV 분석");
    expect(live).toContain("<SensorFileAnalysis />");
    expect(file).toContain("parseSensorCsv(await file.text())");
    expect(file).toContain("출처·측정 품질은 검증되지 않았습니다");
    expect(file).toContain("실시간 설비 모니터링이 아닙니다");
    expect(file).not.toMatch(/\bfetch\(|\baxios\.|XMLHttpRequest/);
  });
});
