import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, socialAccountLinks, users, chatSessions, chatMessagesTable, chatFeedback, manualChunks, manualDocuments } from "../drizzle/schema";
import { ENV } from './_core/env';
import { and, eq, desc, like, or } from "drizzle-orm";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export type SocialProvider = "google" | "naver" | "kakao";

export async function getSocialAccountLink(provider: SocialProvider, providerUserId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not configured");
  }

  const result = await db
    .select()
    .from(socialAccountLinks)
    .where(and(
      eq(socialAccountLinks.provider, provider),
      eq(socialAccountLinks.providerUserId, providerUserId),
    ))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getSocialAccountLinksForUser(userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not configured");
  }

  return db
    .select({
      provider: socialAccountLinks.provider,
      email: socialAccountLinks.email,
      providerUserId: socialAccountLinks.providerUserId,
      createdAt: socialAccountLinks.createdAt,
    })
    .from(socialAccountLinks)
    .where(eq(socialAccountLinks.userId, userId));
}

export async function createSocialAccountLink(input: {
  userId: number;
  provider: SocialProvider;
  providerUserId: string;
  email?: string | null;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not configured");
  }

  await db.insert(socialAccountLinks).values({
    userId: input.userId,
    provider: input.provider,
    providerUserId: input.providerUserId,
    email: input.email ?? null,
  });
}

export async function deleteSocialAccountLink(userId: number, provider: SocialProvider) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not configured");
  }

  await db
    .delete(socialAccountLinks)
    .where(and(
      eq(socialAccountLinks.userId, userId),
      eq(socialAccountLinks.provider, provider),
    ));
}

export async function touchUser(userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not configured");
  }

  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not configured");
  }

  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByBadgeNumber(badgeNumber: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not configured");
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.badgeNumber, badgeNumber))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createLocalUser(input: {
  badgeNumber: string;
  name: string;
  dateOfBirth: string;
  passwordHash: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not configured");
  }

  const openId = `local_${input.badgeNumber}`;
  await db.insert(users).values({
    openId,
    badgeNumber: input.badgeNumber,
    name: input.name,
    dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00.000Z`),
    passwordHash: input.passwordHash,
    loginMethod: "password",
    lastSignedIn: new Date(),
  });

  return getUserByOpenId(openId);
}

// TODO: add feature queries here as your schema grows.



export async function getChatSessions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatSessions).where(eq(chatSessions.userId, userId)).orderBy(desc(chatSessions.updatedAt));
}

export async function createChatSession(userId: number, title: string = "새로운 상담") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const res = await db.insert(chatSessions).values({ userId, title });
  const insertId = Number(res[0].insertId);
  return insertId;
}

export async function getChatMessagesForSession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatMessagesTable).where(eq(chatMessagesTable.sessionId, sessionId)).orderBy(chatMessagesTable.createdAt);
}

export async function addChatMessage(sessionId: number, role: "user" | "assistant", content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(chatMessagesTable).values({ sessionId, role, content });
  // Update session updatedAt
  await db.update(chatSessions).set({ updatedAt: new Date() }).where(eq(chatSessions.id, sessionId));
  return Number(result[0].insertId);
}

export async function updateSessionTitle(sessionId: number, title: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(chatSessions).set({ title }).where(eq(chatSessions.id, sessionId));
}

export async function deleteChatSession(sessionId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  // Verify ownership
  const session = await db.select().from(chatSessions).where(eq(chatSessions.id, sessionId)).limit(1);
  if (session.length === 0 || session[0].userId !== userId) {
    throw new Error("Unauthorized or session not found");
  }
  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.sessionId, sessionId));
  await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));
}

export async function deleteAllChatSessions(userId: number) {
  const db = await getDb();
  if (!db) return;
  // 사용자의 모든 세션 조회
  const sessions = await db.select().from(chatSessions).where(eq(chatSessions.userId, userId));
  for (const session of sessions) {
    await db.delete(chatMessagesTable).where(eq(chatMessagesTable.sessionId, session.id));
  }
  await db.delete(chatSessions).where(eq(chatSessions.userId, userId));
}

export type FeedbackReasonCode = "inaccurate" | "insufficient" | "irrelevant" | "other";

export async function createChatFeedback(input: {
  userId: number;
  sessionId: number;
  messageId?: number;
  messageContent: string;
  feedbackType: "like" | "dislike";
  reasonCode?: FeedbackReasonCode;
  reasonText?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const ownedSession = await db.select({ id: chatSessions.id }).from(chatSessions)
    .where(and(eq(chatSessions.id, input.sessionId), eq(chatSessions.userId, input.userId))).limit(1);
  if (ownedSession.length === 0) throw new Error("Unauthorized session");

  const result = await db.insert(chatFeedback).values({
    userId: input.userId,
    sessionId: input.sessionId,
    messageId: input.messageId ?? null,
    messageContent: input.messageContent.slice(0, 12000),
    feedbackType: input.feedbackType,
    reasonCode: input.reasonCode ?? null,
    reasonText: input.reasonText?.slice(0, 500) ?? null,
  });
  return Number(result[0].insertId);
}

export async function getRecentChatFeedbackForUser(userId: number, limit = 12) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatFeedback)
    .where(eq(chatFeedback.userId, userId))
    .orderBy(desc(chatFeedback.createdAt))
    .limit(Math.min(Math.max(limit, 1), 30));
}

export async function getChatFeedbackForSession(userId: number, sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatFeedback)
    .where(and(eq(chatFeedback.userId, userId), eq(chatFeedback.sessionId, sessionId)))
    .orderBy(desc(chatFeedback.createdAt));
}

export async function createManualDocumentWithChunks(input: {
  userId: number;
  title: string;
  sourceType?: "text" | "upload";
  fileKey?: string;
  chunks: Array<{ content: string; keywords?: string }>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const documentResult = await db.insert(manualDocuments).values({
    userId: input.userId,
    title: input.title.slice(0, 255),
    sourceType: input.sourceType ?? "text",
    fileKey: input.fileKey ?? null,
  });
  const documentId = Number(documentResult[0].insertId);
  const safeChunks = input.chunks
    .map((chunk, chunkIndex) => ({
      documentId,
      chunkIndex,
      content: chunk.content.trim().slice(0, 12000),
      keywords: chunk.keywords?.slice(0, 512) ?? null,
    }))
    .filter(chunk => chunk.content.length > 0);
  if (safeChunks.length > 0) await db.insert(manualChunks).values(safeChunks);
  return documentId;
}

export async function getManualDocumentsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(manualDocuments)
    .where(eq(manualDocuments.userId, userId))
    .orderBy(desc(manualDocuments.updatedAt));
}

export async function searchManualChunksForUser(userId: number, query: string, limit = 3) {
  const db = await getDb();
  if (!db) return [];
  const terms = Array.from(new Set(
    query.toLowerCase().split(/[\s,./!?()[\]{}:;"'`~|\\]+/).map(term => term.trim()).filter(term => term.length >= 2),
  )).slice(0, 5);
  if (terms.length === 0) return [];
  const termConditions = terms.flatMap(term => [
    like(manualChunks.content, `%${term}%`),
    like(manualChunks.keywords, `%${term}%`),
  ]);
  return db.select({
    documentId: manualDocuments.id,
    documentTitle: manualDocuments.title,
    chunkIndex: manualChunks.chunkIndex,
    content: manualChunks.content,
  })
    .from(manualChunks)
    .innerJoin(manualDocuments, eq(manualChunks.documentId, manualDocuments.id))
    .where(and(eq(manualDocuments.userId, userId), or(...termConditions)))
    .limit(Math.min(Math.max(limit, 1), 5));
}
