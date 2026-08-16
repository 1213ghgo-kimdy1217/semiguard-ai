import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const demoSource = readFileSync(resolve(process.cwd(), "client/src/pages/JudgeDemo.tsx"), "utf8");

describe("read-only judge demo contract", () => {
  it("keeps the demo publicly reachable without passing through the protected dashboard route", () => {
    expect(appSource).toContain('const JudgeDemo = lazy(() => import("./pages/JudgeDemo"));');
    expect(appSource).toContain('<Route path={"/demo"}>');
    expect(appSource).toContain('<Route path={"/"}>');
  });

  it("guides judges through risk signal, sensor evidence, and recommended inspection steps", () => {
    expect(demoSource).toContain('steps: ["위험 신호", "센서 근거", "권장 점검"]');
    expect(demoSource).toContain("const [step, setStep] = useState<DemoStep>(1)");
    expect(demoSource).toContain("text.riskTitle");
    expect(demoSource).toContain("text.evidenceTitle");
    expect(demoSource).toContain("text.actionTitle");
  });

  it("labels simulation data and omits mutation or export controls from the demo", () => {
    expect(demoSource).toContain("text.simulated");
    expect(demoSource).toContain("text.privacy");
    expect(demoSource).toContain("text.noControl");
    expect(demoSource).not.toContain("injectNormal");
    expect(demoSource).not.toContain("exportSelectedPeriodCsv");
    expect(demoSource).not.toContain("saveThresholds");
  });

  it("keeps the public demo localized in Korean, English, and Japanese", () => {
    expect(demoSource).toContain('type DemoLanguage = "ko" | "en" | "ja"');
    expect(demoSource).toContain('value="ko"');
    expect(demoSource).toContain('value="en"');
    expect(demoSource).toContain('value="ja"');
  });
});
