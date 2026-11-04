import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function parse(file: string) {
  return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function nodes<T extends ts.Node>(root: ts.Node, is: (node: ts.Node) => node is T): T[] {
  const result: T[] = [];
  const visit = (node: ts.Node) => { if (is(node)) result.push(node); ts.forEachChild(node, visit); };
  visit(root);
  return result;
}
function openings(root: ts.Node, name: string) {
  return nodes(root, (node): node is ts.JsxOpeningLikeElement => ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
    .filter(node => node.tagName.getText() === name);
}
function attr(node: ts.JsxOpeningLikeElement, name: string): ts.JsxAttribute | undefined {
  return node.attributes.properties.find((item): item is ts.JsxAttribute => ts.isJsxAttribute(item) && item.name.getText() === name);
}
function attributeValue(node: ts.JsxOpeningLikeElement, name: string) {
  const value = attr(node, name)?.initializer;
  return value && ts.isJsxExpression(value) ? value.expression : value;
}
function ancestors(node: ts.Node) {
  const result: ts.Node[] = [];
  for (let current = node.parent; current; current = current.parent) result.push(current);
  return result;
}
function detailsFor(node: ts.Node) {
  return ancestors(node).filter((item): item is ts.JsxElement => ts.isJsxElement(item) && item.openingElement.tagName.getText() === "details");
}
function literalAttribute(node: ts.JsxOpeningLikeElement, name: string, value: string) {
  const expression = attributeValue(node, name);
  return expression && ts.isStringLiteral(expression) && expression.text === value;
}
function isTrueAttribute(node: ts.JsxOpeningLikeElement, name: string) {
  const item = attr(node, name);
  return Boolean(item && (!item.initializer || attributeValue(node, name)?.kind === ts.SyntaxKind.TrueKeyword));
}
const compact = (node: ts.Node | undefined) => node?.getText().replace(/\s+/g, "");
function expectVisible(node: ts.Node) {
  expect(detailsFor(node), "Core dashboard content must stay outside disclosures").toHaveLength(0);
  expect(ancestors(node).some(item => ts.isConditionalExpression(item) ||
    (ts.isBinaryExpression(item) && item.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)),
  "Core dashboard content must remain mounted through briefing, exercise and review").toBe(false);
  const elements = ancestors(node).filter((item): item is ts.JsxElement => ts.isJsxElement(item));
  expect(elements.some(item => Boolean(attr(item.openingElement, "hidden") || attr(item.openingElement, "inert")))).toBe(false);
}

describe("booth dashboard and completed-run review", () => {
  it("keeps current values, targets and normal bands together outside collapsed content", () => {
    const page = parse("client/src/pages/EtchLive.tsx");
    const maps = nodes(page, ts.isCallExpression).filter(node => node.expression.getText() === "BOOTH_SIGNALS.map");
    const valueMaps = maps.filter(node => {
      const properties = nodes(node, ts.isPropertyAccessExpression).map(item => item.name.text);
      return properties.includes("target") && properties.includes("normal") && properties.includes("values");
    });
    expect(valueMaps, "One visible source of the four live values and their targets").toHaveLength(1);
    expectVisible(valueMaps[0]);
  });

  it("exposes all four process controls and all four trend cards on the dashboard", () => {
    const page = parse("client/src/pages/EtchLive.tsx");
    const controls = nodes(page, ts.isVariableDeclaration).find(node => node.name.getText() === "CONTROLS")?.initializer;
    expect(controls && ts.isArrayLiteralExpression(controls)).toBe(true);
    if (controls && ts.isArrayLiteralExpression(controls)) {
      expect(controls.elements.map(item => ts.isStringLiteral(item) ? item.text : "").sort())
        .toEqual(["exhaustValve", "gasSetpoint", "matching", "rfSetpoint"]);
    }
    const controlMaps = nodes(page, ts.isCallExpression).filter(node => node.expression.getText() === "CONTROLS.map");
    expect(controlMaps).toHaveLength(1);
    expectVisible(controlMaps[0]);
    const sliders = openings(page, "input").filter(node => literalAttribute(node, "type", "range"));
    expect(sliders).toHaveLength(1); // The template is repeated for each of the four controls above.
    expect(ancestors(sliders[0])).toContain(controlMaps[0]);
    expect(compact(attributeValue(sliders[0], "value"))).toBe("displaySnapshot.controls[control]");
    expect(compact(attributeValue(sliders[0], "disabled"))).toBe('stage!=="experience"');
    for (const bound of ["min", "max", "step"]) {
      expect(compact(attributeValue(sliders[0], bound))).toBe(`limits.${bound}`);
    }
    const chartMaps = nodes(page, ts.isCallExpression).filter(node =>
      node.expression.getText() === "BOOTH_SIGNALS.map" && openings(node, "LineChart").length > 0);
    expect(chartMaps).toHaveLength(1);
    expectVisible(chartMaps[0]);
    const chart = openings(chartMaps[0], "LineChart")[0];
    expect(compact(attributeValue(chart, "data"))).toBe("[...chartPoints]");
    expect(detailsFor(chart)).toHaveLength(0);
    const line = openings(chartMaps[0], "Line")[0];
    expect(compact(attributeValue(line, "dataKey"))).toBe("signal.key");
  });

  it("starts with the combined challenge and keeps scenario selection available before a run", () => {
    const page = parse("client/src/pages/EtchLive.tsx");
    const initialEngine = nodes(page, ts.isFunctionDeclaration).find(node => node.name?.text === "initialEngine");
    expect(initialEngine).toBeDefined();
    expect(compact(initialEngine?.parameters[0].initializer)).toBe('"combined"');
    const selector = openings(page, "select").find(node => literalAttribute(node, "id", "booth-scenario"));
    expect(selector).toBeDefined();
    expect(compact(attributeValue(selector!, "disabled"))).toBe('stage!=="brief"');
    expect(nodes(page, ts.isIdentifier).some(node => node.text === "BOOTH_SCENARIOS")).toBe(true);
  });

  it("opens reflection only for a completed attempt and keeps recorded graphs and actions together", () => {
    const page = parse("client/src/pages/EtchLive.tsx");
    const reflection = openings(page, "BoothReflection");
    expect(reflection).toHaveLength(1);
    expect(compact(attributeValue(reflection[0], "attempt"))).toBe("completedAttempt");
    const wrapper = ancestors(reflection[0]).find((node): node is ts.JsxElement =>
      ts.isJsxElement(node) && Boolean(attr(node.openingElement, "hidden")));
    expect(wrapper).toBeDefined();
    expect(compact(attributeValue(wrapper!.openingElement, "hidden"))).toBe('stage!=="review"');
    const component = parse("client/src/components/BoothReflection.tsx");
    expect(nodes(component, ts.isIfStatement).some(node => compact(node.expression) === "!attempt" &&
      nodes(node.thenStatement, ts.isReturnStatement).some(statement => statement.expression?.kind === ts.SyntaxKind.NullKeyword))).toBe(true);

    const declarations = nodes(page, ts.isVariableDeclaration);
    for (const [name, evidence] of [["chartPoints", "samples"], ["runEvents", "events"]]) {
      const expression = declarations.find(node => node.name.getText() === name)?.initializer;
      expect(expression && ts.isConditionalExpression(expression)).toBe(true);
      if (expression && ts.isConditionalExpression(expression)) {
        expect(compact(expression.condition)).toBe('stage==="review"&&completedAttempt');
        expect(compact(expression.whenTrue)).toBe(`completedAttempt.${evidence}`);
      }
    }
    const capture = nodes(page, ts.isCallExpression).find(node => node.expression.getText() === "captureBoothAttempt");
    expect(capture, "A completed run must capture immutable evidence before opening review").toBeDefined();
    expect(nodes(page, ts.isCallExpression).some(node => node.expression.getText() === "setCompletedAttempt" &&
      compact(node.arguments[0]) === "attempt")).toBe(true);
  });

  it("preserves continuous completion feedback and strict module-only camera capture", () => {
    const page = parse("client/src/pages/EtchLive.tsx");
    const feedback = openings(page, "BoothMissionFeedback");
    expect(feedback).toHaveLength(1);
    expect(detailsFor(feedback[0])).toHaveLength(0);
    expect(ancestors(feedback[0]).some(node => ts.isConditionalExpression(node) ||
      (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken))).toBe(false);
    const camera = openings(page, "BoothCameraOverlay");
    expect(camera).toHaveLength(1);
    expect(isTrueAttribute(camera[0], "compact")).toBe(true);
    const source = parse("client/src/components/BoothCameraOverlay.tsx");
    const hook = nodes(source, ts.isCallExpression).find(node => node.expression.getText() === "usePrototypeCamera");
    const options = hook?.arguments[0];
    expect(options && ts.isObjectLiteralExpression(options)).toBe(true);
    if (options && ts.isObjectLiteralExpression(options)) {
      const mode = options.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText() === "moduleOnly");
      expect(mode && ts.isPropertyAssignment(mode) && mode.initializer.kind === ts.SyntaxKind.TrueKeyword).toBe(true);
    }
  });
});
