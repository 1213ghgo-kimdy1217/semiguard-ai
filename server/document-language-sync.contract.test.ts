import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pageSources = {
  dashboard: readFileSync(
    resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
    "utf8"
  ),
  judgeDemo: readFileSync(
    resolve(process.cwd(), "client/src/pages/JudgeDemo.tsx"),
    "utf8"
  ),
  login: readFileSync(
    resolve(process.cwd(), "client/src/pages/Login.tsx"),
    "utf8"
  ),
  signup: readFileSync(
    resolve(process.cwd(), "client/src/pages/Signup.tsx"),
    "utf8"
  ),
  notFound: readFileSync(
    resolve(process.cwd(), "client/src/pages/NotFound.tsx"),
    "utf8"
  ),
};

describe("document language sync contract", () => {
  it("synchronizes the HTML lang attribute in every localized page", () => {
    for (const source of Object.values(pageSources)) {
      expect(source).toContain("document.documentElement.lang");
    }
  });

  it("keeps Korean, English, and Japanese BCP 47 locale values available", () => {
    for (const source of Object.values(pageSources)) {
      expect(source).toContain("ko-KR");
      expect(source).toContain("en-US");
      expect(source).toContain("ja-JP");
    }
  });
});
