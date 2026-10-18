import type { User } from "../drizzle/schema";
import { ENV } from "./_core/env";

/** Aggregate reports only. Never changes the account's role or other permissions. */
export function canReadPracticeMetrics(user: Pick<User, "id" | "role"> | null): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  const configured = ENV.practiceMetricsReaderUserId;
  // One canonical positive MySQL INT id. Empty, lists, wildcards and malformed values deny access.
  if (!/^[1-9][0-9]{0,9}$/.test(configured)) return false;
  const id = Number(configured);
  return String(id) === configured && id <= 2147483647 && user.id === id;
}
