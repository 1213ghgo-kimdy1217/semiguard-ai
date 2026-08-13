import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, socialAccountLinks, users, chatSessions, chatMessagesTable } from "../drizzle/schema";
import { ENV } from './_core/env';
import { and, eq, desc } from "drizzle-orm";

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
  await db.insert(chatMessagesTable).values({ sessionId, role, content });
  // Update session updatedAt
  await db.update(chatSessions).set({ updatedAt: new Date() }).where(eq(chatSessions.id, sessionId));
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
