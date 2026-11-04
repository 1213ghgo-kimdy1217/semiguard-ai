import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import KiyoEquipmentView from "../client/src/components/KiyoEquipmentView";
import { applyBoothAction, createBoothState, getBoothSnapshot, stepBoothState } from "./boothExperience";

function renderModel(overrides: Partial<Parameters<typeof KiyoEquipmentView>[0]> = {}) {
  return renderToStaticMarkup(createElement(KiyoEquipmentView, {
    view: "cutaway", active: true, ledOn: true, language: "ko", demo: true,
    ...overrides,
  }));
}

function group(markup: string, name: string) {
  const result = markup.match(new RegExp(`<g\\b[^>]*data-concept-part="${name}"[^>]*>[\\s\\S]*?<\\/g>`));
  expect(result, `Missing ${name}`).not.toBeNull();
  return result![0];
}

describe("existing Kiyo model driven by the booth scenario", () => {
  it("renders the scenario's changing purple brightness while fill lights stay steady", () => {
    let state = applyBoothAction(createBoothState(91), { type: "inject-fault" });
    const purple: string[] = [], fill: string[] = [];
    for (let tick = 0; tick < 8; tick++) {
      state = stepBoothState(state, 100);
      const snapshot = getBoothSnapshot(state);
      const markup = renderModel({ processValues: snapshot.values,
        signalAlarms: snapshot.alarms, lampBrightness: snapshot.lampBrightness });
      const lamp = group(markup, "purple-plasma-lamp");
      expect(lamp).toContain(`data-lamp-brightness="${snapshot.lampBrightness}"`);
      purple.push(lamp);
      fill.push(group(markup, "steady-white-fill-lights"));
    }
    expect(new Set(purple).size).toBeGreaterThan(1);
    expect(new Set(fill).size).toBe(1);
  });

  it("keeps pressure, flow, RF and ambient temperature values and alarms in their numbered order", () => {
    const markup = renderModel({
      processValues: { pressure: 21.2, gasFlow: 99.4, rfPower: 123, chamberAmbientTemp: 34.8 },
      signalAlarms: { pressure: false, gasFlow: false, rfPower: true, chamberAmbientTemp: false },
    });
    const options = [...markup.matchAll(/<button\b[^>]*class="kev-signal-option"[^>]*data-alarm="([^"]+)"[^>]*>[\s\S]*?<\/button>/g)];
    expect(options).toHaveLength(4);
    expect(options.map(option => option[1])).toEqual(["false", "false", "true", "false"]);
    for (const [index, value, unit] of [[0, "21.2", "mTorr"], [1, "99.4", "sccm"], [2, "123", "W"], [3, "34.8", "°C"]] as const) {
      expect(options[index][0]).toContain(`>${index + 1}</span>`);
      expect(options[index][0]).toContain(`${value} <small>${unit}</small>`);
    }
    const healthy = renderModel({ signalAlarms: { pressure: false, gasFlow: false, rfPower: false, chamberAmbientTemp: false } });
    expect(healthy).not.toMatch(/class="kev-signal-option"[^>]*data-alarm="true"/);
  });

  it("bounds the model brightness and shows inactive purple output as off", () => {
    expect(group(renderModel({ lampBrightness: 900 }), "purple-plasma-lamp")).toContain('data-lamp-brightness="255"');
    expect(group(renderModel({ lampBrightness: -20 }), "purple-plasma-lamp")).toContain('data-lamp-brightness="0"');
    expect(group(renderModel({ lampBrightness: 200, active: false }), "purple-plasma-lamp")).toContain('data-lamp-brightness="0"');
  });
});
