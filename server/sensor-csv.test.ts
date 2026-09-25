import { describe, expect, it } from "vitest";
import { parseSensorCsv } from "../shared/sensorCsv";

const header = "timestamp,sensor,value,unit,normal_low,normal_high,location";

describe("read-only sensor record import", () => {
  it("keeps timestamps, units, and supplied ranges without inventing a baseline", () => {
    const records = parseSensorCsv([
      header,
      "2026-09-24T00:00:03Z,pressure,103.5,Pa,95,105,chamber",
      "2026-09-24T00:00:00Z,pressure,100,Pa,95,105,chamber",
      "2026-09-24T00:00:00Z,rf,400,W,,,generator",
    ].join("\n"));
    expect(records.map(row => row.sensor)).toEqual(["pressure", "rf", "pressure"]);
    expect(records[0]).toMatchObject({ value: 100, unit: "Pa", low: 95, high: 105 });
    expect(records[1]).toMatchObject({ value: 400, unit: "W", low: null, high: null });
  });

  it("parses quoted sensor labels and Windows line endings", () => {
    const records = parseSensorCsv(`\uFEFF${header}\r\n2026-09-24T00:00:00+09:00,"Chamber, A",1.5,Pa,1,2,"Etch, left"\r\n`);
    expect(records[0]).toMatchObject({ sensor: "Chamber, A", location: "Etch, left" });
  });

  it("rejects ambiguous, inconsistent, and malformed records", () => {
    for (const csv of [
      "sensor,value\npressure,100",
      `${header}\n2026-09-24 00:00:00,pressure,100,Pa,95,105,chamber`,
      `${header}\n2026-09-24T00:00:00Z,pressure,NaN,Pa,95,105,chamber`,
      `${header}\n2026-09-24T00:00:00Z,pressure,100,Pa,105,95,chamber`,
      `${header}\n2026-09-24T00:00:00Z,pressure,100,Pa,95,,chamber`,
      `${header}\n2026-09-24T00:00:00Z,pressure,100,Pa,95,105,chamber\n2026-09-24T00:00:03Z,pressure,101,kPa,95,105,chamber`,
      `${header}\n2026-09-24T00:00:00Z,pressure,100,Pa,95,105,chamber\n2026-09-24T00:00:00Z,pressure,101,Pa,95,105,chamber`,
      `${header}\n2026-09-24T00:00:00Z,"broken,100,Pa,95,105,chamber`,
    ]) expect(() => parseSensorCsv(csv)).toThrow();
  });
});
