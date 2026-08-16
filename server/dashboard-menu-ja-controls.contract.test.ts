import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard menu Japanese controls contract", () => {
  it("localizes theme, audio, demo, PDF, and logout controls in the side menu", () => {
    expect(dashboardSource).toContain('lang === "ja" ? "ライト"');
    expect(dashboardSource).toContain('lang === "ja" ? "ミュート解除"');
    expect(dashboardSource).toContain('lang === "ja" ? "警告音量"');
    expect(dashboardSource).toContain('lang === "ja" ? "デモ自動実行"');
    expect(dashboardSource).toContain('lang === "ja" ? "PDFレポートを出力"');
    expect(dashboardSource).toContain('lang === "ja" ? "ログアウト"');
  });

  it("localizes the matching header actions and PDF outcome messages", () => {
    expect(dashboardSource).toContain('lang === "ja" ? "ライトモード"');
    expect(dashboardSource).toContain('lang === "ja" ? "音声をオン"');
    expect(dashboardSource).toContain('lang === "ja" ? "デモ実行中"');
    expect(dashboardSource).toContain('lang === "ja" ? "構造化レポートを新しいウィンドウで開きました。印刷画面でPDFとして保存してください。"');
    expect(dashboardSource).toContain('lang === "ja" ? "ログアウトに失敗しました"');
  });
});
