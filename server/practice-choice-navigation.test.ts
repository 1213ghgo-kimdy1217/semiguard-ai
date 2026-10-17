import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { focusPracticeSection } from "../client/src/lib/practiceNavigation";

const page = readFileSync("client/src/pages/EtchTraining.tsx", "utf8").replace(/\r\n/g, "\n");

describe("practice choice navigation", () => {
  it("focuses before scrolling on every request, including the same section twice", () => {
    const calls: string[] = [];
    const target = {
      focus: vi.fn(() => { calls.push("focus"); }),
      scrollIntoView: vi.fn(() => { calls.push("scroll"); }),
    };
    focusPracticeSection(target);
    focusPracticeSection(target);
    expect(calls).toEqual(["focus", "scroll", "focus", "scroll"]);
    expect(target.focus).toHaveBeenNthCalledWith(2, { preventScroll: true });
    expect(target.scrollIntoView).toHaveBeenNthCalledWith(2, { block: "start", behavior: "auto" });
  });

  it("does nothing while a section is not mounted", () => {
    expect(() => focusPracticeSection(null)).not.toThrow();
  });

  it("waits for the current account workspace to render before initial focus", () => {
    const effect = page.match(/useEffect\(\(\) => \{\n    if \(!storageKey[\s\S]*?\}, \[stage, storageKey, expectedStorageKey\]\);/)?.[0];
    expect(effect).toBeDefined();
    expect(effect).toContain('if (!storageKey || storageKey !== expectedStorageKey) return;');
    expect(effect).toContain('stage === "home" && historyReturn.current ? historyHeading.current : heading.current');
    expect(effect).toContain('focusPracticeSection(target)');
    expect(effect?.indexOf("return;")).toBeLessThan(effect!.indexOf("focusPracticeSection"));
  });

  it("gives the header and brand an explicit same-screen action without resetting an answer", () => {
    const action = page.match(/const openPracticeChoices = \(\) => \{([\s\S]*?)\n  \};/)?.[1];
    expect(action).toBeDefined();
    expect(action).toContain('historyReturn.current = false;');
    expect(action).toContain('if (stage === "home") focusPracticeSection(heading.current);');
    expect(action).toContain('move("home");');
    expect(action).not.toMatch(/setAttempt|reset|setConsent|mutate|sessionStorage/);
    expect(page.match(/onClick=\{openPracticeChoices\}/g)).toHaveLength(2);
    expect(page).toContain('l("연습 방식 선택", "Practice options", "練習方法を選ぶ")');
    expect(page).not.toContain('l("선택 화면",');
    expect(page).toContain('const openPracticeHistory = () => { historyReturn.current = true; move("home"); };');
    expect(page).toContain('if (next !== "observe" && next !== "decision") setRunning(false)');
  });

  it("places the unchanged optional measurement and storage disclosures after the home cards", () => {
    const home = page.slice(page.indexOf('{stage === "home" ? <>'), page.indexOf('{stage === "brief" ? <>'));
    expect(home).toContain('<PracticeMeasurementConsent />');
    expect(home.indexOf('<PracticeMeasurementConsent />')).toBeGreaterThan(home.indexOf('<PracticeLearningOptions'));
    expect(home.indexOf('{storageDisclosure}')).toBeGreaterThan(home.indexOf('<PracticeMeasurementConsent />'));
    expect(home.indexOf('<PracticeMeasurementConsent />')).toBeLessThan(home.indexOf('<AccountPracticeBenefits'));
    expect(page).toContain('{stage !== "home" ? <PracticeMeasurementConsent /> : null}');
    expect(page).toContain('{stage !== "home" && stage !== "sensor-brief" ? storageDisclosure : null}');
  });
});
