import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ProcessObservationScene from "../client/src/components/ProcessObservationScene";
import { getProcessScenario, processScenarios } from "../shared/processScenarios";
import { readProcessScene } from "../shared/processScene";

const languages = ["ko", "en", "ja"] as const;
const languageIndex = { ko: 0, en: 1, ja: 2 } as const;

describe("picture-first process observation", () => {
  it.each(processScenarios)("shows the original $processId readings as named diagram controls", scenario => {
    const scene = readProcessScene(scenario, 66, 66);
    const html = renderToStaticMarkup(createElement(ProcessObservationScene, {
      scenario, time: 66, observedUntil: 66, language: "ko",
      selectedSignal: scenario.signals[0].id, onSignalChange: vi.fn(), onTimeChange: vi.fn(),
    }));
    expect(html).toContain('role="img"');
    expect(html).toContain("<title");
    expect(html).not.toMatch(/NaN|Infinity|<iframe|<image|<img/);
    for (const channel of scene.channels) {
      expect(html).toContain(channel.name[0]);
      expect(html).toContain(channel.value.toFixed(1));
    }
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).not.toMatch(/data-(?:answer|correct|expected|severity)=/);
    expect(html).not.toMatch(/changeTime|expectedSignal/);
  });

  it.each(languages)("keeps the eight diagrams' channel controls readable in %s", language => {
    for (const scenario of processScenarios) {
      const html = renderToStaticMarkup(createElement(ProcessObservationScene, {
        scenario, time: 20, observedUntil: 20, language,
        selectedSignal: scenario.signals.at(-1)!.id, onSignalChange: vi.fn(),
      }));
      for (const signal of scenario.signals) expect(html).toContain(signal.name[languageIndex[language]]);
      expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
      expect(html).toContain("<svg");
    }
  });

  it.each(processScenarios)("caps the $processId picture and timeline at the observed record", scenario => {
    const capped = readProcessScene(scenario, scenario.duration, 19);
    const future = renderToStaticMarkup(createElement(ProcessObservationScene, {
      scenario, time: scenario.duration, observedUntil: 19, language: "en",
      selectedSignal: scenario.signals[0].id, onSignalChange: vi.fn(), onTimeChange: vi.fn(),
    }));
    const current = renderToStaticMarkup(createElement(ProcessObservationScene, {
      scenario, time: 19, observedUntil: 19, language: "en",
      selectedSignal: scenario.signals[0].id, onSignalChange: vi.fn(), onTimeChange: vi.fn(),
    }));
    expect(future).toContain('type="range"');
    expect(future).toContain('max="19"');
    expect(future).toContain('value="19"');
    for (const channel of capped.channels) expect(future).toContain(channel.value.toFixed(1));
    // React's generated accessibility IDs differ across renders; the visible
    // readings and range must still correspond to the same observed point.
    const values = (html: string) => {
      const controls = html.match(/<div class="pv-measurements"[^>]*>([\s\S]*?)<\/div>/)![1];
      return Array.from(controls.matchAll(/data-value="([^"]+)"/g), match => match[1]);
    };
    expect(values(future)).toEqual(capped.channels.map(channel => channel.value.toFixed(1)));
    expect(values(future)).toEqual(values(current));
  });

  it("does not reveal the scored onset or a fault verdict during early observation", () => {
    const scenario = getProcessScenario("etch")!;
    const html = renderToStaticMarkup(createElement(ProcessObservationScene, {
      scenario, time: 180, observedUntil: 39, language: "ko", selectedSignal: "pressure", onSignalChange: vi.fn(),
    }));
    expect(html).not.toMatch(/00:70|01:10|정답|고장 확정|이상 발생|편차 시작/);
    expect(html).not.toMatch(/data-(?:fault|correct|expected|severity)=/);
    expect(html).not.toContain("NaN");
  });

  it("provides an unavailable timeline at zero observed time and a valid selection fallback", () => {
    const scenario = getProcessScenario("photo")!;
    const html = renderToStaticMarkup(createElement(ProcessObservationScene, {
      scenario, time: 90, observedUntil: 0, language: "en", selectedSignal: "unknown-old-view",
      onSignalChange: vi.fn(), onTimeChange: vi.fn(),
    }));
    expect(html).toContain('data-time="0"');
    const range = html.match(/<input\b[^>]*type="range"[^>]*>/)![0];
    expect(range).toContain('max="0"');
    expect(range).toContain('disabled=""');
    const selected = html.match(/<button\b[^>]*aria-pressed="true"[^>]*>/g) ?? [];
    expect(selected).toHaveLength(1);
    expect(selected[0]).toContain('data-signal="position"');
  });
});
