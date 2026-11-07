import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("standalone CSV analysis component", () => {
  it("keeps imported records local and labels their provenance", () => {
    const file = readFileSync("client/src/pages/SensorFileAnalysis.tsx", "utf8");
    expect(file).toContain("parseSensorCsv(await file.text())");
    expect(file).toContain("출처·측정 품질은 검증되지 않았습니다");
    expect(file).toContain("실시간 설비 모니터링이 아닙니다");
    expect(file).toContain('htmlFor="csv-inspection-number"');
    expect(file).toContain('min={1} max={selectedRecords.length} step={1} value={inspection + 1}');
    expect(file).toContain('Math.min(selectedRecords.length - 1, Math.floor(Number(event.target.value) || 1) - 1)');
    expect(file).toContain('fileName, recordCount: records.length, notes');
    expect(file).toContain('선택 기록의 센서명·시각·값과 직접 쓴 메모');
    expect(file).toContain('원본 CSV 전체는 포함되지 않습니다');
    expect(file).not.toContain('원본 센서값 없이');
    expect(file).not.toMatch(/\bfetch\(|\baxios\.|XMLHttpRequest/);
  });
});
