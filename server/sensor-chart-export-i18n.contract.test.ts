import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("sensor chart image export localization contract", () => {
  it("keeps chart image export failures in Korean, English, and Japanese", () => {
    expect(dashboardSource).toContain('"내보낼 센서 데이터가 없습니다."');
    expect(dashboardSource).toContain('"出力するセンサーデータがありません。"');
    expect(dashboardSource).toContain('"No sensor points are available for image export."');
    expect(dashboardSource).toContain('"센서 차트 이미지 파일을 만들 수 없습니다."');
    expect(dashboardSource).toContain('"センサーチャート画像ファイルを作成できませんでした。"');
    expect(dashboardSource).toContain('"Could not create the sensor chart image file."');
  });

  it("uses a localized chart image filename for Korean, English, and Japanese", () => {
    expect(dashboardSource).toContain('"세미가드_센서구간"');
    expect(dashboardSource).toContain('"セミガード_センサー区間"');
    expect(dashboardSource).toContain('"semiguard_sensor_range"');
  });
});
