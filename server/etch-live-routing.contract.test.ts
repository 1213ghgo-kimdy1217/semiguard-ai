import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function nodes<T extends ts.Node>(root: ts.Node, is: (node: ts.Node) => node is T): T[] {
  const found: T[] = [];
  const visit = (node: ts.Node) => { if (is(node)) found.push(node); ts.forEachChild(node, visit); };
  visit(root);
  return found;
}
function parse(file: string) {
  return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function attribute(opening: ts.JsxOpeningLikeElement, name: string) {
  const attr = opening.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.getText() === name);
  if (!attr || !ts.isJsxAttribute(attr) || !attr.initializer) return undefined;
  return ts.isJsxExpression(attr.initializer) ? attr.initializer.expression : attr.initializer;
}
function element(root: ts.Node, name: string) {
  return nodes(root, ts.isJsxElement).find(item => item.openingElement.tagName.getText() === name);
}
function opening(root: ts.Node, name: string) {
  return nodes(root, (node): node is ts.JsxOpeningLikeElement => ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
    .find(item => item.tagName.getText() === name);
}
function call(root: ts.Node, name: string) {
  return nodes(root, ts.isCallExpression).find(item => item.expression.getText() === name);
}

describe("live observation integration", () => {
  it("mounts the integrated experience on the existing protected /live route", () => {
    const app = parse("client/src/App.tsx");
    const routes = nodes(app, ts.isJsxElement).filter(item => item.openingElement.tagName.getText() === "Route");
    const routeFor = (path: string) => routes.find(item => {
      const value = attribute(item.openingElement, "path");
      return value && ts.isStringLiteral(value) && value.text === path;
    });
    expect(routeFor("/dashboard")).toBeDefined();
    expect(routeFor("/dashboard/legacy")).toBeDefined();
    const live = routeFor("/live");
    expect(live).toBeDefined();
    const access = element(live!, "PracticeAccess");
    expect(access).toBeDefined();
    expect(opening(access!, "EtchLive")).toBeDefined();
    expect(opening(live!, "EtchExperience")).toBeUndefined();
    const page = parse("client/src/pages/EtchLive.tsx");
    expect(call(page, "useBoothDevice")).toBeDefined();
    expect(call(page, "getBoothSnapshot")).toBeDefined();
    expect(call(page, "usePrototypeLink")).toBeUndefined();
  });
  it("keeps the existing model-preview entry on the same integrated screen", () => {
    const html = readFileSync("client/model-preview.html", "utf8");
    const module = html.match(/<script\b[^>]*type="module"[^>]*>([\s\S]*?)<\/script>/)?.[1];
    expect(module).toBeDefined();
    const entry = ts.createSourceFile("model-preview.js", module!, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const importedPage = nodes(entry, ts.isImportDeclaration).find(item =>
      ts.isStringLiteral(item.moduleSpecifier) && item.moduleSpecifier.text.endsWith("/pages/EtchLive.tsx"));
    expect(importedPage?.importClause?.name?.text).toBe("EtchLive");
    const mount = call(entry, "React.createElement");
    expect(mount?.arguments[0].getText()).toBe("EtchLive");
    expect(html).not.toContain("experience-preview.html");
    expect(html).not.toContain("chatgpt.site");
  });
  it("uses one scenario for camera readouts, the Kiyo model and the USB lamp", () => {
    const page = parse("client/src/pages/EtchLive.tsx");
    const declarations = nodes(page, ts.isVariableDeclaration);
    const variables = new Map(declarations.filter(item => ts.isIdentifier(item.name) && item.initializer)
      .map(item => [item.name.getText(), item.initializer!]));
    const scenario = declarations.find(item => item.initializer && call(item.initializer, "getBoothSnapshot"))?.name.getText();
    expect(scenario).toBeDefined();
    function resolved(expression: ts.Expression | undefined): string | undefined {
      if (!expression) return undefined;
      if (ts.isIdentifier(expression) && variables.has(expression.text)) return resolved(variables.get(expression.text));
      return expression.getText().replace(/\s+/g, "");
    }
    const camera = opening(page, "BoothCameraOverlay")!;
    const model = opening(page, "KiyoEquipmentView")!;
    expect(camera).toBeDefined();
    expect(model).toBeDefined();
    expect(resolved(attribute(camera, "values"))).toBe(`${scenario}.values`);
    expect(resolved(attribute(camera, "alarms"))).toBe(`${scenario}.alarms`);
    expect(resolved(attribute(model, "processValues"))).toBe(`${scenario}.values`);
    expect(resolved(attribute(model, "signalAlarms"))).toBe(`${scenario}.alarms`);
    expect(resolved(attribute(model, "lampBrightness"))).toBe(`${scenario}.lampBrightness`);
    const deviceName = declarations.find(item => item.initializer && call(item.initializer, "useBoothDevice"))?.name.getText();
    const lampCommand = call(page, `${deviceName}.sendState`);
    const payload = lampCommand?.arguments[0];
    expect(payload && ts.isObjectLiteralExpression(payload)).toBe(true);
    if (payload && ts.isObjectLiteralExpression(payload)) {
      const value = (name: string) => payload.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText() === name);
      const brightness = value("lampBrightness"), fault = value("faultActive");
      expect(brightness && ts.isPropertyAssignment(brightness) && resolved(brightness.initializer)).toBe(`${scenario}.lampBrightness`);
      expect(fault && ts.isPropertyAssignment(fault) && resolved(fault.initializer)).toBe(`${scenario}.faultActive`);
    }
    // Webcam availability must depend on page visibility, not lamp-port freshness.
    const dependencies = new Set<string>();
    const visitDependencies = (expression: ts.Expression | undefined) => {
      if (!expression) return;
      for (const id of nodes(expression, ts.isIdentifier)) {
        if (dependencies.has(id.text)) continue;
        dependencies.add(id.text);
        visitDependencies(variables.get(id.text));
      }
    };
    expect(variables.has("cameraAllowed")).toBe(true);
    visitDependencies(variables.get("cameraAllowed"));
    expect(dependencies.has(deviceName!)).toBe(false);
  });
  it("links training to the same equipment's live page", () => {
    const training = readFileSync("client/src/pages/EtchTraining.tsx", "utf8");
    expect(training).toContain('href="/live"');
    expect(training).not.toContain('href="/dashboard"');
    expect(training).toContain("8대 공정 판단 연습");
    expect(training).toContain("실시간 자유 분석");
    expect(training).toContain('<PracticeLearningOptions language={language}');
    const options = readFileSync("client/src/components/PracticeEntryOptions.tsx", "utf8");
    expect(options).toContain("8대 공정 학습");
    expect(options).toContain("4센서 대시보드");
  });
});
