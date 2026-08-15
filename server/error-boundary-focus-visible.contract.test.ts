import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const errorBoundarySource = readFileSync(resolve(process.cwd(), "client/src/components/ErrorBoundary.tsx"), "utf8");

describe("오류 복구 버튼 키보드 포커스 계약", () => {
  it("다시 시도·로그인 이동·새로고침 제어에 포커스 링을 제공한다", () => {
    expect(errorBoundarySource.match(/focus-visible:ring-2 focus-visible:ring-cyan-200/g)).toHaveLength(3);
  });
});
