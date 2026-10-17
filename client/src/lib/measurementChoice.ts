// A local preference timestamp only. Never an identifier or permission to collect.
export const MEASUREMENT_CHOICE_KEY = "semiguard:measurement-choice:v1";
const lifetime = 30 * 86400000;

export function hasRecentMeasurementChoice(raw: string | null, now = Date.now()) {
  try {
    const value = JSON.parse(raw ?? "null");
    return Number.isFinite(value?.expires) && value.expires > now && value.expires <= now + lifetime;
  } catch { return false; }
}

/** Respect previous explicit choices, including a refusal, without enabling anything. */
export function hasLegacyMeasurementChoice(practice: string | null, google: string | null, now = Date.now()) {
  try {
    const value = JSON.parse(practice ?? "null");
    if (typeof value?.enabled === "boolean" && Number.isFinite(value.revision)
      && value.revision <= now && value.revision > now - lifetime) return true;
  } catch { /* Check the independent Google choice too. */ }
  try {
    const value = JSON.parse(google ?? "null");
    return typeof value?.enabled === "boolean" && typeof value.qa === "boolean"
      && hasRecentMeasurementChoice(google, now);
  } catch { return false; }
}
