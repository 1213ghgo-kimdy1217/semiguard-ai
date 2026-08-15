import { afterEach, describe, expect, it, vi } from "vitest";

const KAKAO_TOKEN_ENDPOINT = "https://kauth.kakao.com/oauth/token";

describe("Kakao OAuth credentials", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("constructs the configured client credential exchange without calling the live endpoint", async () => {
    const clientId = process.env.KAKAO_CLIENT_ID;
    const clientSecret = process.env.KAKAO_CLIENT_SECRET;

    expect(clientId, "KAKAO_CLIENT_ID must be configured").toBeTruthy();
    expect(clientSecret, "KAKAO_CLIENT_SECRET must be configured").toBeTruthy();

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId!,
      client_secret: clientSecret!,
      code: "credential-validation-only",
      redirect_uri: "https://semiguardai-jifnzsvd.manus.space/api/oauth/kakao/callback",
    });

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: "invalid_grant" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetch(KAKAO_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const payload = (await response.json()) as { error?: string; error_description?: string };

    expect(fetchMock).toHaveBeenCalledWith(
      KAKAO_TOKEN_ENDPOINT,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }),
    );
    expect(body.get("client_id")).toBe(clientId);
    expect(body.get("client_secret")).toBe(clientSecret);
    expect(body.get("redirect_uri")).toBe("https://semiguardai-jifnzsvd.manus.space/api/oauth/kakao/callback");
    expect(payload.error).toBe("invalid_grant");
    expect(response.status).toBe(400);
  });
});
