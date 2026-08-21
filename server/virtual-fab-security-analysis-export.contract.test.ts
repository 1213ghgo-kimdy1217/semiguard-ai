import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("virtual fab demo, security status, and analysis export contract", () => {
  it("loads a client-side, read-only virtual fab risk scenario without equipment control", () => {
    expect(dashboardSource).toContain(
      "const [virtualFabDemoActive, setVirtualFabDemoActive] = useState(false)"
    );
    expect(dashboardSource).toContain("const loadVirtualFabDemo = () => {");
    expect(dashboardSource).toContain('riskLevel: "danger", isAnomaly: true');
    expect(dashboardSource).toContain("가상 팹 위험 시나리오");
    expect(dashboardSource).toContain("실제 설비 제어는 수행하지 않습니다.");
    expect(dashboardSource).toContain(
      "파일럿 승인 전 읽기 전용 시연 데이터이며 설비를 제어하지 않습니다."
    );
    expect(dashboardSource).toContain("실제 팹 파일럿 연동은 추후 지원 예정");
    expect(dashboardSource).toContain("실제 팹 파일럿 연동, 추후 지원 예정");
    expect(dashboardSource).toContain('role="note"');
    expect(dashboardSource).toContain('aria-describedby="actual-fab-pilot-help"');
    expect(dashboardSource).toContain('id="actual-fab-pilot-help"');
    expect(dashboardSource).toContain("IT/OT 보안 승인, 현장 담당자 협의 후 별도 검토합니다.");
    expect(dashboardSource).toContain("IT/OTセキュリティ承認、現場担当者との協議後に個別検討します。");
    expect(dashboardSource).toContain("IT/OT security approval, and on-site operator alignment.");
    expect(dashboardSource).toContain("cursor-not-allowed");
  });

  it("makes virtual and read-only data status explicit in the analysis header", () => {
    expect(dashboardSource).toContain('role="status" aria-live="polite"');
    expect(dashboardSource).toContain("가상 · 승인 전 · 읽기 전용");
    expect(dashboardSource).toContain("파일럿과 보안 승인 전");
    expect(dashboardSource).toContain("읽기 전용 분석");
    expect(dashboardSource).toContain("설비 제어 없음");
  });

  it("groups virtual-fab risk injections and announces the last injected level", () => {
    expect(dashboardSource).toContain('role="group" aria-label={t.simulatorTitle}');
    expect(dashboardSource).toContain('role="status" aria-live="polite" aria-atomic="true"');
    expect(dashboardSource).toContain('`가상 팹 ${t[lastInjectedMode]} 단계 주입 완료`');
    expect(dashboardSource).toContain('`仮想ファブに${t[lastInjectedMode]}レベルを注入しました`');
    expect(dashboardSource).toContain('`Virtual fab ${t[lastInjectedMode]} level injected`');
  });

  it("exports the visible LLM anomaly analysis as text or a print-to-PDF report", () => {
    expect(dashboardSource).toContain("function downloadLlmAnalysisText");
    expect(dashboardSource).toContain("function openLlmAnalysisPdf");
    expect(dashboardSource).toContain('exportCurrentLlmAnalysis("text")');
    expect(dashboardSource).toContain('exportCurrentLlmAnalysis("pdf")');
    expect(dashboardSource).toContain(
      "현재 AI 이상 분석 결과를 TXT 파일로 저장"
    );
    expect(dashboardSource).toContain("현재 AI 이상 분석 결과를 PDF로 저장");
    expect(dashboardSource).toContain(
      "AI 분석 결과를 텍스트 파일로 저장했습니다."
    );
    expect(dashboardSource).toContain(
      "AI 분석 보고서를 준비했습니다. 인쇄 창에서 PDF로 저장하세요."
    );
  });
});
