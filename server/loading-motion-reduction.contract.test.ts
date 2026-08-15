import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

describe("대기 화면 모션 감소 접근성 계약", () => {
  it("인증·대시보드 대기 로딩 아이콘이 동작 감소 환경에서 회전을 중지한다", () => {
    expect(appSource.match(/animate-spin motion-reduce:animate-none/g)?.length).toBe(2);
  });
});
