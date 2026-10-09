import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readme = readFileSync(resolve(root, "README.md"), "utf8");
const aiUsage = readFileSync(resolve(root, "AI_USAGE.md"), "utf8");
function markdownFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(file) : entry.name.endsWith(".md") ? [file] : [];
  });
}

describe("current product documentation and historical archive", () => {
  it("introduces judgment training and separates the four learning modes", () => {
    expect(readme).toContain("반도체 신입 엔지니어를 위한 AI 장비 판단 훈련 플랫폼");
    for (const mode of ["8대 공정 학습", "8대 공정 판단 연습", "실시간 자유 분석", "4센서 대시보드"]) {
      expect(readme).toContain(mode);
    }
    expect(readme).toContain("로그인 없는 30초 샘플");
    expect(readme).toContain("선택 답안");
    expect(readme).toContain("7일 후 만료");
    expect(readme).not.toContain("현재 우선 제품은 가상 센서 데이터로 판단 과정을 연습하는 Scenario 01입니다");
    expect(readme).not.toContain("semiguardai-jifnzsvd.manus.space");
  });

  it("states the AI, storage, manufacturer-reference and simulation boundaries", () => {
    expect(readme).toContain("교육용 가상 데이터");
    expect(readme).toContain("실제 팹 연결·장비 제어·고장 확정 진단은 제공하지 않으며");
    expect(readme).toContain("생성형 AI가 점수나 정답을 결정하지 않습니다");
    expect(readme).toContain("준비된 문구를 AI가 생성한 답변처럼 표시하지 않습니다");
    expect(readme).toContain("서술형 원문과 AI 코칭 원문은 학습 기록 DB에 저장하지 않습니다");
    expect(readme).toContain("가상 지수·기준 띠·변화 시점의 출처가 아닙니다");
    expect(aiUsage).toContain("OGQ는 AI 모델이 아닙니다");
    expect(aiUsage).toContain("모든 사실 오류를 막는 보장은 아닙니다");
    expect(aiUsage).toContain("서로 다른 창의 계정 로그는 동일 장비의 연속 데이터로 취급하지 않습니다");
  });

  it("preserves necessary configuration and icons while keeping old drafts off the root", () => {
    expect(readdirSync(root).filter(name => name.endsWith(".md")).sort()).toEqual(["AI_USAGE.md", "README.md"]);
    for (const filename of ["LICENSE", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml",
      "components.json", "drizzle.config.ts", "tsconfig.json", "vite.config.ts", "vitest.config.ts", "vercel.json"]) {
      expect(existsSync(resolve(root, filename)), filename).toBe(true);
    }
    for (const icon of ["app.svg", "app-192.png", "app-512.png", "apple-touch-180.png"]) {
      expect(existsSync(resolve(root, "client/public/icons", icon)), icon).toBe(true);
    }
    expect(readFileSync(resolve(root, ".gitignore"), "utf8")).toContain("/.audit-current.json");
    expect(readFileSync(resolve(root, ".gitignore"), "utf8")).toContain("/.audit-production-current.json");
  });

  it("labels the archive and historical documents without rewriting the cumulative work log", () => {
    const files = markdownFiles(resolve(root, "docs/archive/legacy"));
    expect(files).toHaveLength(46);
    expect(readFileSync(resolve(root, "docs/archive/README.md"), "utf8")).toContain("원본 그대로 옮겼습니다");
    for (const file of files) {
      if (basename(file) === "todo.md") continue;
      expect(readFileSync(file, "utf8"), file).toMatch(/^> \*\*과거 개발·제출 기록\*\*/);
    }
  });

  it("removes obsolete public credentials and provider identifiers from archived documents", () => {
    for (const filename of ["PRESENTATION_10_MIN_SCRIPT.md", "PRESENTATION_DEMO_SCRIPT.md", "README.md"]) {
      const content = readFileSync(resolve(root, "docs/archive/legacy", filename), "utf8");
      expect(content).not.toMatch(/`TEST-2026-V1`\s*\/\s*`\d+`/);
      expect(content).not.toMatch(/\| 비밀번호\s*\|\s*`\d+`/);
    }
    const oauthRecord = readFileSync(resolve(root, "docs/archive/legacy/oauth-verification.md"), "utf8");
    expect(oauthRecord).not.toMatch(/google_\d{10,}/);
    expect(oauthRecord).toContain("계정 식별자 제거");
  });

  it("keeps all current and archived relative document links resolvable", () => {
    const files = [resolve(root, "README.md"), resolve(root, "AI_USAGE.md"), ...markdownFiles(resolve(root, "docs"))];
    for (const file of files) {
      for (const match of readFileSync(file, "utf8").matchAll(/\]\(([^\s)]+)\)/g)) {
        const target = match[1];
        if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(target)) continue;
        const relative = decodeURIComponent(target.split("#")[0]);
        expect(existsSync(resolve(dirname(file), relative)), `${file} -> ${target}`).toBe(true);
      }
    }
  });
});
