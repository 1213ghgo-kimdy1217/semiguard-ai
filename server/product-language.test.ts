import { afterEach, describe, expect, it, vi } from "vitest";
import { readProductLanguage, tr } from "../client/src/lib/productLanguage";
import { etchSignalName } from "../client/src/lib/etchLanguage";
import { localizeLesson } from "../client/src/lib/learningLanguage";
import { processLessons } from "../shared/learningHub";
import { readFileSync } from "node:fs";

afterEach(() => vi.unstubAllGlobals());

describe("trilingual product language", () => {
  it("restores only supported language preferences", () => {
    for (const [stored, expected] of [["ko", "ko"], ["en", "en"], ["ja", "ja"], ["fr", "ko"], [null, "ko"]] as const) {
      vi.stubGlobal("window", { localStorage: { getItem: () => stored } });
      expect(readProductLanguage()).toBe(expected);
    }
    vi.stubGlobal("window", { localStorage: { getItem: () => { throw new Error("blocked"); } } });
    expect(readProductLanguage()).toBe("ko");
  });

  it("keeps signal IDs and lesson answer indexes stable across translations", () => {
    expect(etchSignalName("en", "pressure")).toBe("Chamber pressure");
    expect(etchSignalName("ja", "pressure")).toBe("チャンバー圧力");
    for (const lesson of processLessons) {
      for (const language of ["en", "ja"] as const) {
        const localized = localizeLesson(language, lesson);
        expect(localized.id).toBe(lesson.id);
        expect(localized.answer).toBe(lesson.answer);
        expect(localized.options).toHaveLength(2);
        expect(localized.options[localized.answer]).toBeTruthy();
      }
    }
    expect(tr("en", "가상 데이터", "Synthetic data", "仮想データ")).toBe("Synthetic data");
  });

  it("shares the saved language across public learning and observation routes", () => {
    for (const route of ["Welcome", "EtchTraining", "EtchLive", "LearningHub", "EtchOperations"]) {
      const source = readFileSync(`client/src/pages/${route}.tsx`, "utf8");
      expect(source).toContain("useProductLanguage");
      expect(source).toContain("ProductLanguageSelect");
    }
    const source = readFileSync("client/src/lib/productLanguage.ts", "utf8");
    expect(source).toContain('"semiguard_lang"');
    expect(source).toContain("document.documentElement.lang");
  });
});
