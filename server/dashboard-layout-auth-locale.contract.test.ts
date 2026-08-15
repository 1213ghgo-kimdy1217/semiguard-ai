import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const layoutSource = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

describe("dashboard layout unauthenticated locale contract", () => {
  it("uses the persisted app language for the unauthenticated guidance", () => {
    expect(layoutSource).toContain('const [layoutLanguage] = useState<"ko" | "en" | "ja">');
    expect(layoutSource).toContain("로그인이 필요합니다");
    expect(layoutSource).toContain("ログインが必要です");
    expect(layoutSource).toContain("Sign in to continue");
    expect(layoutSource).toContain("{authCopy.title}");
    expect(layoutSource).toContain("{authCopy.description}");
  });

  it("keeps useLocation unconditional to preserve React hook order", () => {
    expect(layoutSource).toContain("const [, setLocation] = useLocation();");
    const unauthenticatedBranch = layoutSource.split("if (!user) {")[1]?.split("return (")[0] ?? "";
    expect(unauthenticatedBranch).not.toContain("useLocation");
  });
});
