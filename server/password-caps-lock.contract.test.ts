import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const loginSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Login.tsx"),
  "utf8"
);
const signupSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Signup.tsx"),
  "utf8"
);

describe("password Caps Lock warning contract", () => {
  it("detects and announces Caps Lock state on login", () => {
    expect(loginSource).toContain(
      "const [capsLockOn, setCapsLockOn] = useState(false);"
    );
    expect(loginSource).toContain('event.getModifierState("CapsLock")');
    expect(loginSource).toContain("{loginUi.capsLockWarning}");
    expect(loginSource).toContain(
      '{capsLockOn && <p className="text-xs font-medium text-amber-300" role="status" aria-live="polite" aria-atomic="true">{loginUi.capsLockWarning}</p>}'
    );
  });

  it("reuses the state detector for both signup password fields with all locales", () => {
    expect(signupSource).toContain(
      "const handleCapsLock = (event: React.KeyboardEvent<HTMLInputElement>)"
    );
    expect(signupSource).toContain("onKeyDown={handleCapsLock}");
    expect(signupSource).toContain("Caps Lock이 켜져 있습니다.");
    expect(signupSource).toContain("Caps Lock is on.");
    expect(signupSource).toContain("Caps Lockがオンになっています。");
    expect(
      signupSource.match(/aria-live="polite" aria-atomic="true">\{copy\.capsLockWarning\}/g)
    ).toHaveLength(2);
  });
});
