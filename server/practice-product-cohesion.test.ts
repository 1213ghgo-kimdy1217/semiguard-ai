import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { processEquipment } from "../shared/processEquipment";
import { processScenarios } from "../shared/processScenarios";
import ProcessEquipmentReference from "../client/src/components/ProcessEquipmentReference";
const read = (path: string) => readFileSync(path, "utf8");
describe("coherent practice product", () => {
  it.each(processScenarios)("connects $processId to official equipment context without claiming real data", scenario => {
    const context = processEquipment[scenario.processId];
    expect(context.sources.length).toBeGreaterThan(0);
    for (const source of context.sources) {
      expect(new URL(source.url).protocol).toBe("https:");
      expect(new URL(source.url).hostname).toMatch(/(?:kla\.com|tel\.com|asml\.com|lamresearch\.com|appliedmaterials\.com|advantest\.com|asmpt\.com)$/);
    }
    for (const language of ["ko", "en", "ja"] as const) {
      const html = renderToStaticMarkup(createElement(ProcessEquipmentReference, { processId: scenario.processId, language }));
      expect(html).toContain(context.name); expect(html).toContain(context.sources[0].url);
      expect(html).toContain('rel="noopener noreferrer"'); expect(html).not.toContain("Scenario 01");
    }
  });
  it("removes obsolete visible labels while preserving stable scenario and storage IDs", () => {
    for (const path of ["components/EtchEquipmentReference", "components/ScenarioJudgmentCoach", "components/PracticeEntryOptions", "pages/LearningHub", "pages/EtchLive", "pages/EtchTraining"])
      expect(read(`client/src/${path}.tsx`)).not.toContain("Scenario 01");
    expect(read("shared/etchScenario.ts")).toContain("semiguard.etch.scenario01.v1");
    expect(read("shared/trainingRecord.ts")).toContain("etch-chamber-a-01");
  });
  it("centres SG in welcome and login without the old vertical offset", () => {
    for (const path of ["Welcome", "Login"]) {
      const page = read(`client/src/pages/${path}.tsx`);
      expect(page).toContain('className="sg-brand-symbol" aria-hidden="true">SG');
      expect(page).not.toContain("S<span>G</span>");
    }
    const css = read("client/src/pages/welcome.css");
    expect(css).not.toContain("translateY(4px)");
    expect(css).toContain("justify-content: center; flex: 0 0 36px");
  });
  it("keeps checkpoint loading explicit, paused and account-bound in both engines", () => {
    const controls = read("client/src/components/TrainingCheckpoint.tsx");
    expect(controls).toContain("query.data?.userId === userId");
    expect(controls).toContain("setReplace(true)");
    expect(controls).toContain("서술형 입력은 비워집니다");
    expect(controls).not.toContain("useEffect");
    for (const page of ["EtchTraining", "ProcessTraining"]) {
      const source = read(`client/src/pages/${page}.tsx`);
      expect(source).toContain("toTrainingDraft("); expect(source).toContain("restoreTrainingDraft(draft)");
      expect(source).toContain("setRunning(false)");
    }
    const migration = read("drizzle/0018_training_drafts.sql");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS");
    expect(migration).not.toMatch(/\b(?:DROP|ALTER|DELETE|UPDATE|INSERT)\b/i);
    expect(migration).not.toMatch(/facts|checks|email|name/);
  });
  it("requires an explicit share choice, uses a fragment and does not auto-send", () => {
    const source = read("client/src/components/TrainingShareControls.tsx");
    expect(source).toContain("consent: true"); expect(source).toContain("disabled={!consent");
    expect(source).toContain("/training/shared#"); expect(source).toContain("자동으로 친구에게 보내지 않습니다");
    expect(read("client/src/pages/SharedTraining.tsx")).not.toContain("useMutation");
  });
});
