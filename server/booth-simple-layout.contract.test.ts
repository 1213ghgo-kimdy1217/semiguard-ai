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

describe("essential booth experience layout", () => {
  it("keeps current values, targets and normal bands together outside collapsed content", () => {
    const page = parse("client/src/pages/EtchLive.tsx");
    const maps = nodes(page, ts.isCallExpression).filter(node => node.expression.getText() === "BOOTH_SIGNALS.map");
    const valueMaps = maps.filter(node => {
      const properties = nodes(node, ts.isPropertyAccessExpression).map(item => item.name.text);
      return properties.includes("target") && properties.includes("normal") && properties.includes("values");
    });
    expect(valueMaps, "One visible source of the four live values and their targets").toHaveLength(1);
    expect(detailsFor(valueMaps[0])).toHaveLength(0);
    expect(ancestors(valueMaps[0]).some(node => ts.isConditionalExpression(node) ||
      (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken))).toBe(false);
    const enclosingElements = ancestors(valueMaps[0]).filter((item): item is ts.JsxElement => ts.isJsxElement(item));
    expect(enclosingElements.some(item => isTrueAttribute(item.openingElement, "hidden") || isTrueAttribute(item.openingElement, "inert"))).toBe(false);
  });

  it("keeps the main RF matching control visible and secondary controls and charts opt-in", () => {
    const page = parse("client/src/pages/EtchLive.tsx");
    const sliders = openings(page, "input").filter(node => literalAttribute(node, "type", "range"));
    const primary = sliders.filter(node => detailsFor(node).length === 0);
    expect(primary).toHaveLength(1);
    expect(literalAttribute(primary[0], "id", "live-control-matching")).toBe(true);
    const charts = openings(page, "LineChart");
    expect(charts.length).toBeGreaterThan(0);
    for (const node of [...sliders.filter(item => detailsFor(item).length > 0), ...charts]) {
      const disclosure = detailsFor(node)[0];
      expect(disclosure, "Secondary tools must be in a disclosure").toBeDefined();
      expect(attr(disclosure.openingElement, "open"), "Secondary tools must start closed").toBeUndefined();
    }
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
