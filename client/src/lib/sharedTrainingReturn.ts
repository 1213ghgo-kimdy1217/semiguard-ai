const sharedTrainingPath = "/training/shared";
const pendingShareKey = "semiguard.shared-training-return.v1";
const pendingShareLifetime = 15 * 60_000;

export function isSharedTrainingToken(token: string) {
  return token.length >= 100 && token.length <= 3000 &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
}

export function rememberSharedTrainingReturn(hash: string) {
  try {
    const token = hash.startsWith("#") ? hash.slice(1) : "";
    if (!isSharedTrainingToken(token)) {
      window.sessionStorage.removeItem(pendingShareKey);
      return;
    }
    // Keep the intended record in this tab across password sign-in or OAuth.
    window.sessionStorage.setItem(pendingShareKey, JSON.stringify({
      token,
      expiresAt: Date.now() + pendingShareLifetime,
    }));
  } catch { /* The original link can still be reopened after signing in. */ }
}

export function consumeSharedTrainingReturn() {
  try {
    const storage = window.sessionStorage;
    const pending = storage.getItem(pendingShareKey);
    storage.removeItem(pendingShareKey);
    if (!pending) return null;
    const { token, expiresAt } = JSON.parse(pending);
    const now = Date.now();
    if (typeof token === "string" && isSharedTrainingToken(token) &&
        typeof expiresAt === "number" && expiresAt > now && expiresAt <= now + pendingShareLifetime) {
      return `${sharedTrainingPath}#${token}`;
    }
  } catch { /* Invalid or blocked tab storage must never interrupt sign-in. */ }
  return null;
}
