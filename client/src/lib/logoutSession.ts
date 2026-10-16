export const LOGOUT_SIGNAL_KEY = "semiguard:session-logout:v1";

type LocalLogout = {
  cancelQueries: () => Promise<unknown>;
  clearFallback: () => void;
  clearCache: () => void;
  navigate: () => void;
};

/** Session-only cleanup: saved attempts and per-account drafts are not deleted. */
export async function finishLocalLogout(ports: LocalLogout) {
  try { await ports.cancelQueries(); } catch { /* Navigation must still finish. */ }
  try { ports.clearFallback(); } catch { /* Restricted browser storage. */ }
  ports.clearCache();
  ports.navigate();
}

/** Do not claim logout or clear the user's screen when the server rejects it. */
export async function requestLogout(ports: LocalLogout & {
  request: () => Promise<{ success: boolean }>;
  notify: () => void;
}) {
  const result = await ports.request();
  if (result.success !== true) throw new Error("Logout was not confirmed");
  try { ports.notify(); } catch { /* Peer signaling must not block this tab's logout. */ }
  await finishLocalLogout(ports);
}

export function isLogoutSignal(raw: string | null) {
  if (!raw) return false;
  try {
    const value = JSON.parse(raw);
    return value?.type === "logout" && Number.isFinite(value.at);
  } catch { return false; }
}
