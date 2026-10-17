export const TRAINING_HISTORY_PAGE_SIZE = 5;

export function trainingHistoryPage<T>(records: readonly T[], requested: number) {
  const pages = Math.max(1, Math.ceil(records.length / TRAINING_HISTORY_PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number.isFinite(requested) ? Math.floor(requested) : 1));
  const start = (page - 1) * TRAINING_HISTORY_PAGE_SIZE;
  return { page, pages, start, records: records.slice(start, start + TRAINING_HISTORY_PAGE_SIZE) };
}
