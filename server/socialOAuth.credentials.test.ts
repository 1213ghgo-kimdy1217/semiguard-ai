import { describe, expect, it } from "vitest";

const KAKAO_TOKEN_ENDPOINT = "https://kauth.kakao.com/oauth/token";

describe("Kakao OAuth credentials", () => {
  it("accepts the configured client credentials at the token endpoint", async () => {
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

    const response = await fetch(KAKAO_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const payload = (await response.json()) as { error?: string; error_description?: string };

    // Kakao should reject the intentionally fake authorization code, but it
    // must not reject the client itself. This validates the configured secret
    // without exchanging a real user's authorization code.
    expect(payload.error, payload.error_description).not.toBe("invalid_client");
    expect(response.status).toBeGreaterThanOrEqual(400);
  }, 15_000);
});
