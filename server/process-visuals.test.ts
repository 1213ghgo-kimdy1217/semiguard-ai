import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { processLessons } from "../shared/learningHub";
import { processVisuals } from "../shared/processVisuals";
import ProcessConceptFigure from "../client/src/components/ProcessConceptFigure";

describe("original process concept illustrations", () => {
  it("covers all eight processes with explanations and observation prompts in three languages", () => {
    expect(Object.keys(processVisuals)).toEqual(processLessons.map(lesson => lesson.id));
    for (const lesson of processLessons) {
      for (const language of ["ko", "en", "ja"] as const) {
        const copy = processVisuals[lesson.id][language];
        expect(copy.labels).toHaveLength(3);
        expect(new Set(copy.labels).size).toBe(3);
        expect(copy.explanation.length).toBeGreaterThan(20);
        expect(copy.observe.length).toBeGreaterThan(15);
        const html = renderToStaticMarkup(createElement(ProcessConceptFigure, { processId: lesson.id, language }));
        expect(html).toContain('<svg');
        expect(html).toContain('role="img"');
        expect(html).toContain('aria-labelledby=');
        expect(html).toContain(lesson.source);
        expect(html).toContain(copy.labels[0]);
        expect(html).not.toContain('<img');
        expect(html).not.toContain('onClick');
      }
    }
  });

  it("gives every visible diagram unique accessible names without React rendering warnings", () => {
    const warnings = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const html = renderToStaticMarkup(createElement("div", null, ...processLessons.map(lesson => createElement(ProcessConceptFigure, { key: lesson.id, processId: lesson.id, language: "ko" }))));
      const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
      expect(ids).toHaveLength(16);
      expect(new Set(ids).size).toBe(16);
      const names = [...html.matchAll(/aria-labelledby="([^"]+)"/g)].flatMap(match => match[1].split(" "));
      expect(names).toEqual(ids);
      expect(warnings).not.toHaveBeenCalled();
    } finally {
      warnings.mockRestore();
    }
  });

  it("keeps diagrams visible outside lesson disclosures and captions their limitations", () => {
    const page = readFileSync("client/src/pages/LearningHub.tsx", "utf8");
    expect(page.indexOf('<ProcessConceptFigure')).toBeLessThan(page.indexOf('<details>'));
    const source = readFileSync("client/src/components/ProcessConceptFigure.tsx", "utf8");
    expect(source).toContain('useId');
    expect(source).toContain('축척·실제 장비 구조 아님');
    expect(source).toContain('not to scale or an actual equipment layout');
    expect(source).toContain('縮尺・実際の装置構造ではありません');
    expect(processVisuals.deposition.ko.explanation).toContain('연속 작업 순서가 아닙니다');
    expect(processVisuals.packaging.ko.explanation).toContain('개념 예시');
    expect(processVisuals.eds.ko.explanation).toContain('실제 검사 데이터가 아닙니다');
  });

  it("makes the first screen identify the audience, training activity, and simulated scope", () => {
    const page = readFileSync("client/src/pages/Welcome.tsx", "utf8");
    expect(page).toContain('반도체 신입 엔지니어를 위한');
    expect(page).toContain('판단 훈련 플랫폼');
    expect(page).toContain('가상 데이터를 관찰하고, 내 판단과 근거를 기록하세요.');
    expect(page).toContain('sg-training-preview');
    expect(page).toContain('교육용 시뮬레이션 · 실제 장비 연결 없음');
    expect(page).toContain('AI 코칭과 타임라인');
    expect(page).not.toContain('href="/dashboard"');
  });
});
