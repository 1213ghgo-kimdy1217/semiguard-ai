import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const notFoundSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/NotFound.tsx"),
  "utf8"
);

describe("404 장식 아이콘 접근성 계약", () => {
  it("장식 애니메이션은 동작 감소 환경을 존중하고 보조기기에서 숨긴다", () => {
    expect(notFoundSource).toMatch(
      /aria-hidden="true"\s+className="absolute inset-0 rounded-full bg-red-100 animate-pulse motion-reduce:animate-none"/
    );
    expect(notFoundSource).toMatch(/<AlertCircle\s+aria-hidden="true"/);
  });
});
