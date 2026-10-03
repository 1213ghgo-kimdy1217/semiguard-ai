import { TRPCError } from "@trpc/server";
import { desc, eq, sql } from "drizzle-orm";
import { trainingDrafts } from "../drizzle/schema";
import { trainingDraftSchema, type TrainingDraft } from "../shared/trainingDraft";
import { getDb } from "./db";

const fields = { scenarioId: trainingDrafts.scenarioId, elapsed: trainingDrafts.elapsed, marker: trainingDrafts.marker,
  stage: trainingDrafts.stage, signal: trainingDrafts.signal, onset: trainingDrafts.onset,
  comparison: trainingDrafts.comparison, certainty: trainingDrafts.certainty, updatedAt: trainingDrafts.updatedAt };
const unavailable = () => new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Practice checkpoint storage is unavailable." });

/** Read-only check of this deployment's DB. No connection identifiers or records returned. */
export async function inspectDraftStorage() {
  try {
    const database = await getDb();
    if (!database) return { ready: false };
    await database.execute(sql`SELECT id, user_id, scenario_id, elapsed, marker, stage, signal, onset,
      comparison, certainty, updated_at FROM training_drafts LIMIT 0`);
    const [rows] = await database.execute(sql`SELECT INDEX_NAME AS name, SEQ_IN_INDEX AS position,
      COLUMN_NAME AS col, NON_UNIQUE AS nonUnique, SUB_PART AS prefix FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'training_drafts'`);
    const indexes = rows as unknown as { name: string; position: number; col: string; nonUnique: number; prefix: number | null }[];
    const groups = new Map<string, typeof indexes>();
    for (const row of indexes) groups.set(row.name, [...(groups.get(row.name) ?? []), row]);
    const ownerKey = (group: typeof indexes) => group.length === 2
      && group.every(row => Number(row.nonUnique) === 0 && row.prefix === null)
      && group.some(row => Number(row.position) === 1 && row.col === "user_id")
      && group.some(row => Number(row.position) === 2 && row.col === "scenario_id");
    const uniqueKeys = Array.from(groups.values()).filter(group => group.some(row => Number(row.nonUnique) === 0));
    // Upserts must never collide on a global scenario/choice key belonging to another owner.
    const ready = uniqueKeys.some(ownerKey) && uniqueKeys.every(group => ownerKey(group)
      || (group.length === 1 && group[0].col === "id" && group[0].prefix === null));
    return { ready };
  } catch { return { ready: false }; }
}

export async function getTrainingDrafts(userId: number) {
  try {
    const database = await getDb();
    if (!database) throw unavailable();
    const rows = await database.select(fields).from(trainingDrafts).where(eq(trainingDrafts.userId, userId))
      .orderBy(desc(trainingDrafts.updatedAt)).limit(8);
    return rows.flatMap(row => {
      // Remove the DB timestamp before validating the strictly allowlisted checkpoint.
      const { updatedAt, ...choices } = row;
      const clean = trainingDraftSchema.safeParse({ ...choices, version: 1 });
      return clean.success ? [{ ...clean.data, updatedAt }] : [];
    });
  } catch { throw unavailable(); }
}

export async function saveTrainingDraft(userId: number, raw: TrainingDraft) {
  const { version: _version, ...choices } = trainingDraftSchema.parse(raw);
  if (!(await inspectDraftStorage()).ready) throw unavailable();
  try {
    const database = await getDb();
    if (!database) throw unavailable();
    await database.insert(trainingDrafts).values({ userId, ...choices })
      .onDuplicateKeyUpdate({ set: { ...choices, updatedAt: new Date() } });
    return { saved: true } as const;
  } catch { throw unavailable(); }
}
