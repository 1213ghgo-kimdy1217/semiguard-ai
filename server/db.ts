import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, socialAccountLinks, users, chatSessions, chatMessagesTable, chatFeedback, manualChunks, manualDocuments } from "../drizzle/schema";
import { ENV } from './_core/env';
import { and, asc, count, desc, eq, inArray, like, or } from "drizzle-orm";

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
  return db
    .select({
      id: chatSessions.id,
      userId: chatSessions.userId,
      title: chatSessions.title,
      isPinned: chatSessions.isPinned,
      createdAt: chatSessions.createdAt,
      updatedAt: chatSessions.updatedAt,
      messageCount: count(chatMessagesTable.id),
    })
    .from(chatSessions)
    .leftJoin(chatMessagesTable, eq(chatMessagesTable.sessionId, chatSessions.id))
    .where(eq(chatSessions.userId, userId))
    .groupBy(chatSessions.id)
    .orderBy(desc(chatSessions.isPinned), desc(chatSessions.updatedAt));
}

export async function searchChatSessionsForUser(userId: number, searchText: string) {
  const db = await getDb();
  if (!db) return [];
  const term = `%${searchText.trim()}%`;
  const messageMatches = await db
    .select({ sessionId: chatMessagesTable.sessionId, content: chatMessagesTable.content })
    .from(chatMessagesTable)
    .innerJoin(chatSessions, eq(chatMessagesTable.sessionId, chatSessions.id))
    .where(and(eq(chatSessions.userId, userId), like(chatMessagesTable.content, term)));
  const matchingSessionIds = messageMatches.map(match => match.sessionId);
  const excerptBySessionId = new Map<number, string>();
  for (const match of messageMatches) {
    if (!excerptBySessionId.has(match.sessionId)) {
      excerptBySessionId.set(match.sessionId, match.content.replace(/\s+/g, " ").trim().slice(0, 120));
    }
  }
  const ownershipAndSearch = matchingSessionIds.length > 0
    ? and(eq(chatSessions.userId, userId), or(like(chatSessions.title, term), inArray(chatSessions.id, matchingSessionIds)))
    : and(eq(chatSessions.userId, userId), like(chatSessions.title, term));

  const sessions = await db
    .select({
      id: chatSessions.id,
      userId: chatSessions.userId,
      title: chatSessions.title,
      isPinned: chatSessions.isPinned,
      createdAt: chatSessions.createdAt,
      updatedAt: chatSessions.updatedAt,
      messageCount: count(chatMessagesTable.id),
    })
    .from(chatSessions)
    .leftJoin(chatMessagesTable, eq(chatMessagesTable.sessionId, chatSessions.id))
    .where(ownershipAndSearch)
    .groupBy(chatSessions.id)
    .orderBy(desc(chatSessions.isPinned), desc(chatSessions.updatedAt));
  return sessions.map(session => ({
    ...session,
    matchedMessageExcerpt: excerptBySessionId.get(session.id) ?? null,
  }));
}

export async function createChatSession(userId: number, title: string = "새로운 상담") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const res = await db.insert(chatSessions).values({ userId, title });
  const insertId = Number(res[0].insertId);
  return insertId;
}

export async function getChatMessagesForUser(sessionId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  const ownedSession = await db.select({ id: chatSessions.id })
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
    .limit(1);
  if (!ownedSession[0]) return [];
  return db.select().from(chatMessagesTable).where(eq(chatMessagesTable.sessionId, sessionId)).orderBy(chatMessagesTable.createdAt);
}

export async function addChatMessage(sessionId: number, userId: number, role: "user" | "assistant", content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const ownedSession = await db.select({ id: chatSessions.id })
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
    .limit(1);
  if (!ownedSession[0]) throw new Error("Unauthorized or session not found");
  const result = await db.insert(chatMessagesTable).values({ sessionId, role, content });
  // Update session updatedAt
  await db.update(chatSessions).set({ updatedAt: new Date() })
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));
  return Number(result[0].insertId);
}

export async function updateSessionTitle(sessionId: number, userId: number, title: string) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(chatSessions)
    .set({ title: title.trim().slice(0, 120), updatedAt: new Date() })
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));
  return result[0].affectedRows > 0;
}

export async function setChatSessionPinned(sessionId: number, userId: number, isPinned: boolean) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(chatSessions)
    .set({ isPinned: isPinned ? 1 : 0, updatedAt: new Date() })
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));
  return result[0].affectedRows > 0;
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

export async function deleteChatFeedbackForUser(userId: number, feedbackId: number) {
  const db = await getDb();
  if (!db) return false;
  // userId 조건을 함께 사용하여 다른 사용자의 피드백은 삭제할 수 없도록 보장합니다.
  const result = await db.delete(chatFeedback)
    .where(and(eq(chatFeedback.id, feedbackId), eq(chatFeedback.userId, userId)));
  return Number(result[0].affectedRows ?? 0) > 0;
}

export async function deleteAllChatFeedbackForUser(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.delete(chatFeedback).where(eq(chatFeedback.userId, userId));
  return Number(result[0].affectedRows ?? 0);
}

export async function getChatFeedbackForSession(userId: number, sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatFeedback)
    .where(and(eq(chatFeedback.userId, userId), eq(chatFeedback.sessionId, sessionId)))
    .orderBy(desc(chatFeedback.createdAt));
}

export async function attachRegeneratedAnswerToFeedback(input: {
  userId: number;
  feedbackId?: number;
  sessionId: number;
  regeneratedContent: string;
}) {
  const db = await getDb();
  if (!db) return false;
  let targetId = input.feedbackId;
  if (!targetId) {
    // 피드백 ID가 없으면 해당 세션에서 가장 최근의 '아쉬워요' 피드백에 연결합니다.
    const latest = await db.select({ id: chatFeedback.id }).from(chatFeedback)
      .where(and(
        eq(chatFeedback.userId, input.userId),
        eq(chatFeedback.sessionId, input.sessionId),
        eq(chatFeedback.feedbackType, "dislike"),
      ))
      .orderBy(desc(chatFeedback.createdAt))
      .limit(1);
    targetId = latest[0]?.id;
  }
  if (!targetId) return false;
  await db.update(chatFeedback)
    .set({ regeneratedContent: input.regeneratedContent.slice(0, 12000), regeneratedAt: new Date() })
    .where(and(eq(chatFeedback.id, targetId), eq(chatFeedback.userId, input.userId)));
  return true;
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
  return db.select({
    id: manualDocuments.id,
    title: manualDocuments.title,
    sourceType: manualDocuments.sourceType,
    createdAt: manualDocuments.createdAt,
    updatedAt: manualDocuments.updatedAt,
    chunkCount: count(manualChunks.id),
  })
    .from(manualDocuments)
    .leftJoin(manualChunks, eq(manualChunks.documentId, manualDocuments.id))
    .where(eq(manualDocuments.userId, userId))
    .groupBy(
      manualDocuments.id,
      manualDocuments.title,
      manualDocuments.sourceType,
      manualDocuments.createdAt,
      manualDocuments.updatedAt,
    )
    .orderBy(desc(manualDocuments.updatedAt));
}

export async function searchManualDocumentsForUser(userId: number, searchText: string) {
  const db = await getDb();
  if (!db) return [];
  const normalized = searchText.trim();
  if (!normalized) return getManualDocumentsForUser(userId);
  const term = `%${normalized}%`;

  const chunkMatches = await db
    .select({ documentId: manualChunks.documentId, content: manualChunks.content })
    .from(manualChunks)
    .innerJoin(manualDocuments, eq(manualChunks.documentId, manualDocuments.id))
    .where(and(
      eq(manualDocuments.userId, userId),
      or(like(manualChunks.content, term), like(manualChunks.keywords, term)),
    ))
    .limit(100);
  const matchingDocumentIds = Array.from(new Set(chunkMatches.map(match => match.documentId)));
  const excerptByDocumentId = new Map<number, string>();
  for (const match of chunkMatches) {
    if (!excerptByDocumentId.has(match.documentId)) {
      excerptByDocumentId.set(match.documentId, match.content.replace(/\s+/g, " ").trim().slice(0, 140));
    }
  }

  const ownershipAndSearch = matchingDocumentIds.length > 0
    ? and(eq(manualDocuments.userId, userId), or(like(manualDocuments.title, term), inArray(manualDocuments.id, matchingDocumentIds)))
    : and(eq(manualDocuments.userId, userId), like(manualDocuments.title, term));
  const documents = await db.select({
    id: manualDocuments.id,
    title: manualDocuments.title,
    sourceType: manualDocuments.sourceType,
    createdAt: manualDocuments.createdAt,
    updatedAt: manualDocuments.updatedAt,
    chunkCount: count(manualChunks.id),
  })
    .from(manualDocuments)
    .leftJoin(manualChunks, eq(manualChunks.documentId, manualDocuments.id))
    .where(ownershipAndSearch)
    .groupBy(
      manualDocuments.id,
      manualDocuments.title,
      manualDocuments.sourceType,
      manualDocuments.createdAt,
      manualDocuments.updatedAt,
    )
    .orderBy(desc(manualDocuments.updatedAt));
  return documents.map(document => ({
    ...document,
    matchedContentExcerpt: excerptByDocumentId.get(document.id) ?? null,
  }));
}

export async function deleteManualDocumentForUser(input: { userId: number; documentId: number }) {
  const db = await getDb();
  if (!db) return false;
  const ownedDocument = await db.select({ id: manualDocuments.id })
    .from(manualDocuments)
    .where(and(eq(manualDocuments.id, input.documentId), eq(manualDocuments.userId, input.userId)))
    .limit(1);
  if (!ownedDocument[0]) return false;

  await db.delete(manualChunks).where(eq(manualChunks.documentId, input.documentId));
  await db.delete(manualDocuments)
    .where(and(eq(manualDocuments.id, input.documentId), eq(manualDocuments.userId, input.userId)));
  return true;
}

export async function getManualDocumentPreviewForUser(input: { userId: number; documentId: number }) {
  const db = await getDb();
  if (!db) return null;
  const document = await db.select({
    id: manualDocuments.id,
    title: manualDocuments.title,
    updatedAt: manualDocuments.updatedAt,
  })
    .from(manualDocuments)
    .where(and(eq(manualDocuments.id, input.documentId), eq(manualDocuments.userId, input.userId)))
    .limit(1);
  if (!document[0]) return null;

  const chunks = await db.select({
    id: manualChunks.id,
    chunkIndex: manualChunks.chunkIndex,
    content: manualChunks.content,
  })
    .from(manualChunks)
    .where(eq(manualChunks.documentId, input.documentId))
    .orderBy(asc(manualChunks.chunkIndex))
    .limit(60);
  return { document: document[0], chunks };
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
  const matchedChunks = await db.select({
    documentId: manualDocuments.id,
    documentTitle: manualDocuments.title,
    chunkIndex: manualChunks.chunkIndex,
    content: manualChunks.content,
    keywords: manualChunks.keywords,
  })
    .from(manualChunks)
    .innerJoin(manualDocuments, eq(manualChunks.documentId, manualDocuments.id))
    .where(and(eq(manualDocuments.userId, userId), or(...termConditions)))
    .limit(Math.min(Math.max(limit, 1), 5));
  return matchedChunks
    .map(({ keywords, ...chunk }) => {
      const searchableText = `${chunk.documentTitle} ${chunk.content} ${keywords ?? ""}`.toLowerCase();
      const matchedTerms = terms.filter(term => searchableText.includes(term));
      return {
        ...chunk,
        matchedTerms,
        relevanceScore: Math.max(1, Math.round((matchedTerms.length / terms.length) * 100)),
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore || a.chunkIndex - b.chunkIndex);
}
