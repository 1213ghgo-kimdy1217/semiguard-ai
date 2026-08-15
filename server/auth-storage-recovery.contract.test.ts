import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const useAuthSource = readFileSync(resolve(process.cwd(), "client/src/_core/hooks/useAuth.ts"), "utf8");

describe("restricted browser storage auth recovery contract", () => {
  it("does not let localStorage write failures interrupt auth state calculation", () => {
    expect(useAuthSource).toContain("try {\n      localStorage.setItem(");
    expect(useAuthSource).toContain("제한된 저장소 환경에서도 서버 기반 인증 상태는 계속 사용할 수 있습니다.");
    expect(useAuthSource).toContain("user: meQuery.data ?? null,");
  });
});
