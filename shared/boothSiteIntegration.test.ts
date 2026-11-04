import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import KiyoEquipmentView from "../client/src/components/KiyoEquipmentView";
import {
  applyBoothAction,
  createBoothState,
  getBoothSnapshot,
  stepBoothState,
} from "./boothExperience";

function renderModel(
  overrides: Partial<Parameters<typeof KiyoEquipmentView>[0]> = {}
) {
  return renderToStaticMarkup(
    createElement(KiyoEquipmentView, {
      view: "cutaway",
      active: true,
      ledOn: true,
      language: "ko",
      demo: true,
      ...overrides,
    })
  );
}

function group(markup: string, name: string) {
  const result = markup.match(
    new RegExp(`<g\\b[^>]*data-concept-part="${name}"[^>]*>[\\s\\S]*?<\\/g>`)
  );
  expect(result, `Missing ${name}`).not.toBeNull();
  return result![0];
}

describe("existing Kiyo model driven by the booth scenario", () => {
  it("renders the scenario's changing purple brightness while fill lights stay steady", () => {
    let state = applyBoothAction(createBoothState(91), {
      type: "inject-fault",
    });
    const purple: string[] = [],
      fill: string[] = [];
    for (let tick = 0; tick < 8; tick++) {
      state = stepBoothState(state, 100);
      const snapshot = getBoothSnapshot(state);
      const markup = renderModel({
        processValues: snapshot.values,
        signalAlarms: snapshot.alarms,
        lampBrightness: snapshot.lampBrightness,
      });
      const lamp = group(markup, "purple-plasma-lamp");
      expect(lamp).toContain(
        `data-lamp-brightness="${snapshot.lampBrightness}"`
      );
      purple.push(lamp);
      fill.push(group(markup, "steady-white-fill-lights"));
    }
    expect(new Set(purple).size).toBeGreaterThan(1);
    expect(new Set(fill).size).toBe(1);
  });

  it("keeps pressure, flow, RF and ambient temperature values and alarms in their numbered order", () => {
    const markup = renderModel({
      processValues: {
        pressure: 21.2,
        gasFlow: 99.4,
        rfPower: 123,
        chamberAmbientTemp: 34.8,
      },
      signalAlarms: {
        pressure: false,
        gasFlow: false,
        rfPower: true,
        chamberAmbientTemp: false,
      },
    });
    const options = [
      ...markup.matchAll(
        /<button\b[^>]*class="kev-signal-option"[^>]*data-alarm="([^"]+)"[^>]*>[\s\S]*?<\/button>/g
      ),
    ];
    expect(options).toHaveLength(4);
    expect(options.map(option => option[1])).toEqual([
      "false",
      "false",
      "true",
      "false",
    ]);
    for (const [index, value, unit] of [
      [0, "21.2", "mTorr"],
      [1, "99.4", "sccm"],
      [2, "123", "W"],
      [3, "34.8", "°C"],
    ] as const) {
      expect(options[index][0]).toContain(`>${index + 1}</span>`);
      expect(options[index][0]).toContain(`${value} <small>${unit}</small>`);
    }
    const healthy = renderModel({
      signalAlarms: {
        pressure: false,
        gasFlow: false,
        rfPower: false,
        chamberAmbientTemp: false,
      },
    });
    expect(healthy).not.toMatch(
      /class="kev-signal-option"[^>]*data-alarm="true"/
    );
  });

  it("bounds the model brightness and shows inactive purple output as off", () => {
    expect(
      group(renderModel({ lampBrightness: 900 }), "purple-plasma-lamp")
    ).toContain('data-lamp-brightness="255"');
    expect(
      group(renderModel({ lampBrightness: -20 }), "purple-plasma-lamp")
    ).toContain('data-lamp-brightness="0"');
    expect(
      group(
        renderModel({ lampBrightness: 200, active: false }),
        "purple-plasma-lamp"
      )
    ).toContain('data-lamp-brightness="0"');
  });

  it("shows every numbered name and supplied value in the compact observation view, including the exterior", () => {
    const values = {
      pressure: 19.8,
      gasFlow: 101.2,
      rfPower: 382,
      chamberAmbientTemp: 36.4,
    };
    const alarms = {
      pressure: false,
      gasFlow: false,
      rfPower: true,
      chamberAmbientTemp: false,
    };
    for (const view of ["exterior", "cutaway"] as const) {
      const markup = renderModel({
        view,
        compact: true,
        demo: false,
        processValues: values,
        signalAlarms: alarms,
        selectedSignal: "gasFlow",
      });
      const callouts = [
        ...markup.matchAll(
          /<button\b[^>]*class="kev-compact-callout"[^>]*>[\s\S]*?<\/button>/g
        ),
      ].map(item => item[0]);
      expect(callouts).toHaveLength(4);
      for (const [index, key, name, value, unit] of [
        [0, "pressure", "챔버 압력", "19.8", "mTorr"],
        [1, "gasFlow", "가스 유량", "101.2", "sccm"],
        [2, "rfPower", "RF 전력", "382", "W"],
        [3, "chamberAmbientTemp", "챔버 주변 온도", "36.4", "°C"],
      ] as const) {
        expect(callouts[index]).toContain(`data-signal="${key}"`);
        expect(callouts[index]).toContain(
          `kev-callout-number">${index + 1}</span>`
        );
        expect(callouts[index]).toContain(name);
        expect(callouts[index]).toContain(`${value} <small>${unit}</small>`);
        expect(callouts[index]).not.toContain('disabled=""');
      }
      expect(callouts[1]).toContain('aria-pressed="true"');
      expect(callouts[2]).toContain('data-alarm="true"');
      expect(callouts[2]).toContain("복구 필요");
      expect(
        callouts.filter(card => card.includes('data-alarm="true"'))
      ).toHaveLength(1);
      expect(markup).not.toContain('class="kev-signal-detail"');
      if (view === "cutaway") {
        // Markers are present for compact mode, but stay hidden until the cover finishes opening.
        expect(markup).toContain(
          'class="kev-screen-markers" visibility="hidden" data-ready="false"'
        );
        expect([...markup.matchAll(/data-signal-marker=/g)]).toHaveLength(4);
      }
    }
  });

  it("uses cleared alarms in compact callouts without retaining a previous RF alarm", () => {
    const markup = renderModel({
      compact: true,
      demo: false,
      processValues: {
        pressure: 20,
        gasFlow: 100,
        rfPower: 500,
        chamberAmbientTemp: 35,
      },
      signalAlarms: {
        pressure: false,
        gasFlow: false,
        rfPower: false,
        chamberAmbientTemp: false,
      },
    });
    const callouts = [
      ...markup.matchAll(
        /<button\b[^>]*class="kev-compact-callout"[^>]*>[\s\S]*?<\/button>/g
      ),
    ].map(item => item[0]);
    expect(callouts).toHaveLength(4);
    expect(
      callouts.every(
        card => card.includes('data-alarm="false"') && card.includes("정상")
      )
    ).toBe(true);
    expect(callouts[2]).toContain("500 <small>W</small>");
  });
});
