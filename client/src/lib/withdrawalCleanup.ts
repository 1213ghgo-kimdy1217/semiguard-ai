export const WITHDRAWAL_COMPLETION_KEY = "semiguard:withdrawal-confirmed:v1";
export function withdrawalWasConfirmed(raw: string | null, now = Date.now()) {
  const at = Number(raw);
  return raw !== null && Number.isFinite(at) && at > 0 && at <= now && now - at <= 300000;
}

/** Only this account's practice drafts in this tab; never clear all browser storage. */
export function clearWithdrawnDrafts(storage: Pick<Storage, "length" | "key" | "removeItem">, userId: number) {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key === `semiguard.etch.scenario01.v1.${userId}`
      || (key?.startsWith("semiguard.process-training.v1.") && key.endsWith(`.${userId}`))) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}
