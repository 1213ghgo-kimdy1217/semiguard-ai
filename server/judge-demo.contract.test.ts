import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(
  resolve(process.cwd(), "client/src/App.tsx"),
  "utf8"
);
const demoSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/JudgeDemo.tsx"),
  "utf8"
);

describe("read-only judge demo contract", () => {
  it("keeps the demo publicly reachable without passing through the protected dashboard route", () => {
    expect(appSource).toContain(
      'const JudgeDemo = lazy(() => import("./pages/JudgeDemo"));'
    );
    expect(appSource).toContain('<Route path={"/demo"}>');
    expect(appSource).toContain('<Route path={"/"}>');
  });

  it("guides judges through risk signal, sensor evidence, and recommended inspection steps", () => {
    expect(demoSource).toContain(
      'steps: ["위험 신호", "센서 근거", "권장 점검"]'
    );
    expect(demoSource).toContain(
      "const [step, setStep] = useState<DemoStep>(1)"
    );
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

  it("shows localized mock sensor observations and labels actual fab pilots as future support", () => {
    expect(demoSource).toContain("const mockSensorTrace = [");
    expect(demoSource).toContain("text.mockTrace");
    expect(demoSource).toContain("12개 관측값");
    expect(demoSource).toContain("Planned for future support");
    expect(demoSource).toContain("今後サポート予定");
    expect(demoSource).toContain("text.futurePilotDescription");
  });

  it("keeps the demo mode visible and lets judges reset the flow to the first step", () => {
    expect(demoSource).toContain("const resetDemo = () => {");
    expect(demoSource).toContain("setStep(1);");
    expect(demoSource).toContain("text.demoMode");
    expect(demoSource).toContain("text.demoModeDescription");
    expect(demoSource).toContain("text.reset");
    expect(demoSource).toMatch(/disabled\s+aria-disabled="true"/);
  });

  it("gives reset feedback, a closeable demo mode banner, and a soft accessible future-pilot tooltip", () => {
    expect(demoSource).toContain(
      "const [showDemoBanner, setShowDemoBanner] = useState(true)"
    );
    expect(demoSource).toMatch(
      /const \[notice, setNotice\] =\s*useState<\s*"reset" \|\s*"shareSuccess" \|\s*"shareError" \|\s*null\s*>\(null\);/
    );
    expect(demoSource).toContain('setNotice("reset");');
    expect(demoSource).toContain("text.resetComplete");
    expect(demoSource).toContain("text.closeDemoMode");
    expect(demoSource).toContain("text.showDemoMode");
    expect(demoSource).toContain('role="tooltip"');
    expect(demoSource).toContain("judge-demo-future-pilot-tooltip");
  });

  it("keeps the public demo localized in Korean, English, and Japanese", () => {
    expect(demoSource).toContain('type DemoLanguage = "ko" | "en" | "ja"');
    expect(demoSource).toContain('value="ko"');
    expect(demoSource).toContain('value="en"');
    expect(demoSource).toContain('value="ja"');
    expect(demoSource).toContain('evidenceLabel: "센서 근거"');
    expect(demoSource).toContain('evidenceLabel: "Sensor evidence"');
    expect(demoSource).toContain('evidenceLabel: "センサー根拠"');
    expect(demoSource).toContain("{text.evidenceLabel}");
    expect(demoSource).toContain('safeNextStep: "안전한 다음 점검"');
    expect(demoSource).toContain('safeNextStep: "Safe next step"');
    expect(demoSource).toContain('safeNextStep: "安全な次の点検"');
    expect(demoSource).toContain("{text.safeNextStep}");
    expect(demoSource).not.toContain(">SAFE NEXT STEP<");
  });
});
