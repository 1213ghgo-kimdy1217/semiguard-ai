import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("anomaly history date filter locale contract", () => {
  it("keeps native start and end date controls aligned with the selected KO, EN, or JA locale", () => {
    const dateLocale = 'lang={lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US"}';

    expect(dashboardSource).toMatch(new RegExp(`value=\\{dateStart\\}\\s+${dateLocale.replace(/[{}()?+*^$|\\.]/g, "\\$&")}\\s+aria-label=\\{lang === "ko" \\? "이상 이력 시작일"`));
    expect(dashboardSource).toMatch(new RegExp(`value=\\{dateEnd\\}\\s+${dateLocale.replace(/[{}()?+*^$|\\.]/g, "\\$&")}\\s+aria-label=\\{lang === "ko" \\? "이상 이력 종료일"`));
  });
});
