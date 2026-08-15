import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const authMeSource = routerSource.split("me: publicProcedure.query")[1]?.split("logout: publicProcedure.mutation")[0] ?? "";

describe("auth.me safe profile contract", () => {
  it("returns only the approved client-safe user profile fields", () => {
    expect(authMeSource).toContain("const { id, openId, name, email, loginMethod, role } = ctx.user;");
    expect(authMeSource).toContain("return { id, openId, name, email, loginMethod, role };");
  });

  it("does not return credential or personal registration fields", () => {
    expect(authMeSource).not.toContain("passwordHash");
    expect(authMeSource).not.toContain("dateOfBirth");
    expect(authMeSource).not.toContain("badgeNumber");
  });
});
