import { desc, eq } from "drizzle-orm";
import { trainingAttempts } from "../drizzle/schema";
import { toTrainingRecord } from "../shared/trainingRecord";
import { getDb } from "./db";

export async function saveTrainingAttempt(userId: number, attemptKey: string, attempt: unknown) {
  const database = await getDb();
  if (!database) throw new Error("학습 기록 데이터베이스를 사용할 수 없습니다.");
  const record = toTrainingRecord(attempt);
  await database.insert(trainingAttempts).values({ userId, attemptKey, ...record })
    .onDuplicateKeyUpdate({ set: { attemptKey } });
  return { saved: true } as const;
}

export async function getTrainingAttempts(userId: number) {
  const database = await getDb();
  if (!database) throw new Error("학습 기록 데이터베이스를 사용할 수 없습니다.");
  return database.select({ id: trainingAttempts.id, scenarioId: trainingAttempts.scenarioId,
    signal: trainingAttempts.signal, onset: trainingAttempts.onset, marker: trainingAttempts.marker,
    signalMatched: trainingAttempts.signalMatched, onsetMatched: trainingAttempts.onsetMatched,
    comparisonMatched: trainingAttempts.comparisonMatched, certaintyMatched: trainingAttempts.certaintyMatched,
    createdAt: trainingAttempts.createdAt })
    .from(trainingAttempts).where(eq(trainingAttempts.userId, userId))
    .orderBy(desc(trainingAttempts.createdAt), desc(trainingAttempts.id)).limit(20);
}
