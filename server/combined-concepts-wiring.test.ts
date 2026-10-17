import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("combined process concept wiring", () => {
  it("continues photo review into the existing direct etch briefing, not the chooser", () => {
    const page = readFileSync("client/src/pages/ProcessTraining.tsx", "utf8");
    const app = readFileSync("client/src/App.tsx", "utf8");
    expect(page).toContain('href={nextScenario.processId === "etch" ? "/training/etch" : scenarioHref(nextScenario)}');
    expect(app).toContain('<Route path={"/training/etch"}>');
    expect(app).toContain('key="etch-direct" entry="brief"');
    expect(page).toContain('toProcessTrainingSubmission(completed)');
  });
  it("preserves EDS and packaging context mounts", () => {
    const text = readFileSync("client/src/components/ProcessEvidenceReview.tsx", "utf8");
    expect(text).toContain("<EdsObservationWorkspace");
    expect(text).toContain("<PackagingObservationWorkspace");
  });
  it("preserves deposition and metal mounts and original tools", () => {
    const text = readFileSync("client/src/components/ProcessEvidenceWorkspaces.tsx", "utf8");
    for (const token of ["<InspectionConceptRecord", "<MetalLayerConcept", "pe-classifier", "pe-window-grid", "onInteraction()", "onTimeChange(window.end)"]) expect(text).toContain(token);
  });
  it("mounts etch only on observed/review record horizons", () => {
    const text = readFileSync("client/src/pages/EtchTraining.tsx", "utf8");
    expect(text).toContain("<EtchChamberConcept time={shownTime} observedUntil={attempt.elapsed}");
    expect(text).toContain("<EtchChamberConcept time={reviewTime} observedUntil={attempt.elapsed}");
  });
});
