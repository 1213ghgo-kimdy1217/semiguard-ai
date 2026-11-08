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
const compact = (node: ts.Node | undefined) => node?.getText().replace(/\s+/g, "");
function variables(root: ts.Node) {
  return new Map(nodes(root, ts.isVariableDeclaration)
    .filter(item => ts.isIdentifier(item.name) && item.initializer)
    .map(item => [item.name.getText(), item.initializer!]));
}
function payloadValue(payload: ts.Expression, name: string) {
  if (!ts.isObjectLiteralExpression(payload)) return undefined;
  const property = payload.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText() === name);
  return property && ts.isPropertyAssignment(property) ? property.initializer : undefined;
}
function ancestors(node: ts.Node) {
  const result: ts.Node[] = [];
  for (let current = node.parent; current; current = current.parent) result.push(current);
  return result;
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
    const module = html.match(/<script\b[^>]*type="module"[^>]*src="([^"]+)"/)?.[1];
    expect(module).toBe("/src/model-preview-main.tsx");
    const entry = parse("client/src/model-preview-main.tsx");
    const importedPage = nodes(entry, ts.isImportDeclaration).find(item =>
      ts.isStringLiteral(item.moduleSpecifier) && /\/pages\/EtchLive(?:\.tsx)?$/.test(item.moduleSpecifier.text));
    expect(importedPage?.importClause?.name?.text).toBe("EtchLive");
    const mount = opening(entry, "EtchLive");
    expect(mount).toBeDefined();
    const wrappers = ancestors(mount!).filter((node): node is ts.JsxElement => ts.isJsxElement(node))
      .map(node => node.openingElement.tagName.getText());
    expect(wrappers).toEqual(expect.arrayContaining(["PracticeAccess", "AccountSessionProvider", "QueryClientProvider", "trpc.Provider"]));
    expect(nodes(entry, ts.isPropertyAssignment).some(node => node.name.getText() === "url" &&
      ts.isStringLiteral(node.initializer) && node.initializer.text === "/api/trpc")).toBe(true);
    expect(html).not.toContain("experience-preview.html");
    expect(html).not.toContain("chatgpt.site");
  });
  it("shares live values and freezes camera/model evidence to the completed attempt during review", () => {
    const page = parse("client/src/pages/EtchLive.tsx");
    const values = variables(page);
    expect(call(values.get("liveSnapshot")!, "getBoothSnapshot")).toBeDefined();
    const display = values.get("displaySnapshot");
    expect(display && ts.isConditionalExpression(display)).toBe(true);
    if (display && ts.isConditionalExpression(display)) {
      expect(compact(display.condition)).toBe('stage==="review"&&completedAttempt');
      expect(compact(display.whenTrue)).toBe("completedAttempt.finalSnapshot");
      expect(compact(display.whenFalse)).toBe("liveSnapshot");
    }
    function resolved(expression: ts.Expression | undefined): string | undefined {
      if (!expression) return undefined;
      if (ts.isIdentifier(expression) && values.has(expression.text)) return resolved(values.get(expression.text));
      return compact(expression);
    }
    const camera = opening(page, "BoothCameraOverlay")!;
    const model = opening(page, "KiyoEquipmentView")!;
    expect(camera).toBeDefined();
    expect(model).toBeDefined();
    expect(resolved(attribute(camera, "values"))).toBe("displaySnapshot.values");
    expect(resolved(attribute(camera, "alarms"))).toBe("displaySnapshot.alarms");
    expect(compact(attribute(camera, "valuesFrozen"))).toBe('stage==="review"');
    expect(resolved(attribute(model, "processValues"))).toBe("displaySnapshot.values");
    expect(resolved(attribute(model, "signalAlarms"))).toBe("displaySnapshot.alarms");
    const brightness = attribute(model, "lampBrightness");
    expect(brightness && ts.isConditionalExpression(brightness)).toBe(true);
    if (brightness && ts.isConditionalExpression(brightness)) {
      expect(compact(brightness.condition)).toBe('stage==="experience"');
      expect(compact(brightness.whenTrue)).toBe("displaySnapshot.lampBrightness");
      expect(compact(brightness.whenFalse)).toBe("0");
    }
    // Webcam availability must depend on page visibility, not lamp-port freshness.
    const dependencies = new Set<string>();
    const visitDependencies = (expression: ts.Expression | undefined) => {
      if (!expression) return;
      for (const id of nodes(expression, ts.isIdentifier)) {
        if (dependencies.has(id.text)) continue;
        dependencies.add(id.text);
        visitDependencies(values.get(id.text));
      }
    };
    expect(values.has("cameraActive")).toBe(true);
    visitDependencies(values.get("cameraActive"));
    expect(dependencies.has("pageVisible")).toBe(true);
    expect(dependencies.has("device")).toBe(false);
  });
  it("keeps contextual questions available while observing and passes only the displayed snapshot", () => {
    const page = parse("client/src/pages/EtchLive.tsx");
    const assistants = nodes(page, ts.isJsxSelfClosingElement).filter(node => node.tagName.getText() === "BoothLearningAssistant");
    expect(assistants).toHaveLength(1);
    const assistant = assistants[0];
    expect(compact(attribute(assistant, "snapshot"))).toBe("displaySnapshot");
    expect(compact(attribute(assistant, "stage"))).toBe("stage");
    expect(ancestors(assistant).some(node => ts.isJsxElement(node) && Boolean(attribute(node.openingElement, "hidden")))).toBe(false);
    expect(ancestors(assistant).some(node => ts.isConditionalExpression(node) ||
      (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken))).toBe(false);
  });
  it("keeps a 100ms USB heartbeat using live lamp state during a run and explicit OFF otherwise", () => {
    const page = parse("client/src/pages/EtchLive.tsx");
    const values = variables(page);
    expect(compact(values.get("latestSnapshotRef"))).toBe("useRef(liveSnapshot)");
    expect(nodes(page, ts.isBinaryExpression).some(node =>
      compact(node.left) === "latestSnapshotRef.current" && compact(node.right) === "liveSnapshot" &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken)).toBe(true);
    const command = call(page, "device.sendState")!;
    expect(command).toBeDefined();
    const payload = command.arguments[0];
    expect(ts.isConditionalExpression(payload)).toBe(true);
    if (ts.isConditionalExpression(payload)) {
      expect(compact(payload.condition)).toBe("runningRef.current&&!terminal(latest)");
      expect(compact(values.get("latest"))).toBe("latestSnapshotRef.current");
      expect(compact(payloadValue(payload.whenTrue, "lampBrightness"))).toBe("latest.lampBrightness");
      expect(compact(payloadValue(payload.whenTrue, "faultActive"))).toBe("latest.faultActive");
      expect(compact(payloadValue(payload.whenFalse, "lampBrightness"))).toBe("0");
      expect(compact(payloadValue(payload.whenFalse, "faultActive"))).toBe("false");
    }
    const interval = ancestors(command).find((node): node is ts.CallExpression =>
      ts.isCallExpression(node) && node.expression.getText() === "window.setInterval");
    expect(compact(interval?.arguments[1])).toBe("100");
    const effect = ancestors(command).find((node): node is ts.CallExpression =>
      ts.isCallExpression(node) && node.expression.getText() === "useEffect");
    expect(compact(effect?.arguments[1])).toBe("[device.sendState]");
  });
  it("links training to the same equipment's live page", () => {
    const training = readFileSync("client/src/pages/EtchTraining.tsx", "utf8");
    expect(training).toContain('href="/live"');
    expect(training).not.toContain('href="/dashboard"');
    expect(training).toContain("8대 공정 판단 연습");
    expect(training).toContain("장비 모형 실습");
    expect(training).toContain('<PracticeLearningOptions language={language}');
    const options = readFileSync("client/src/components/PracticeEntryOptions.tsx", "utf8");
    expect(options).toContain("8대 공정 학습");
    expect(options).toContain("4센서 대시보드");
  });
});
