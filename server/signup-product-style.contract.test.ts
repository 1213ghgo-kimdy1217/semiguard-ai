import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const signup = readFileSync("client/src/pages/Signup.tsx", "utf8");
const css = readFileSync("client/src/pages/signup.css", "utf8");

describe("signup product design", () => {
  it("uses the training workspace visual language without changing signup behavior", () => {
    expect(signup).toContain('import "./signup.css"');
    expect(signup).toContain('className="sg-signup-intro"');
    expect(signup).toContain('className="sg-signup-card"');
    expect(signup).toContain('fetch("/api/trpc/auth.signup"');
    expect(css).toContain(".sg-signup{");
    expect(css).toContain("#e4aa55");
    expect(css).toContain("@media(max-width:800px)");
    expect(css).toContain("grid-template-columns:minmax(0,1fr)");
    expect(css).toContain("overflow-wrap:anywhere");
    expect(css).toContain("@media(prefers-reduced-motion:reduce)");
  });

  it("explains account access and the synthetic training scope in every language", () => {
    expect(signup).toContain("첫 화면에서는 서비스 소개를 볼 수 있습니다. 공정 학습과 샘플 관찰도 로그인이 필요합니다.");
    expect(signup).toContain("Before sign-in, read the service introduction. Process learning and sample observation also require sign-in.");
    expect(signup).toContain("ログイン前はサービス紹介をご覧いただけます。工程学習とサンプル観察にもログインが必要です。");
    expect(signup).toContain("실제 장비 연결·제어 없음");
  });
});
