import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { sessions } from "../../db/schema";
import { sign, verify } from "../signed-value";
import { TINYFISH_SESSION_LABEL } from "./claims";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type TinyFishSessionStore = {
  create: (userId: string) => Promise<string>;
  userIdFor: (cookieValue: string | undefined) => Promise<string | null>;
  revoke: (cookieValue: string | undefined) => Promise<void>;
};

export function createMemoryTinyFishSessionStore(
  encryptionKey: string,
): TinyFishSessionStore {
  const rows = new Map<string, { userId: string; expiresAt: number }>();

  return {
    create: async (userId) => {
      const token = randomUUID();
      rows.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
      return sign(token, encryptionKey, TINYFISH_SESSION_LABEL);
    },
    userIdFor: async (cookieValue) => {
      const token = verify(cookieValue, encryptionKey, TINYFISH_SESSION_LABEL);
      if (!token) return null;
      const row = rows.get(token);
      if (!row || row.expiresAt <= Date.now()) {
        if (token) rows.delete(token);
        return null;
      }
      return row.userId;
    },
    revoke: async (cookieValue) => {
      const token = verify(cookieValue, encryptionKey, TINYFISH_SESSION_LABEL);
      if (token) rows.delete(token);
    },
  };
}

export function createDatabaseTinyFishSessionStore(
  database: Database,
  encryptionKey: string,
): TinyFishSessionStore {
  return {
    create: async (userId) => {
      const token = randomUUID();
      await database.insert(sessions).values({
        id: randomUUID(),
        userId,
        token,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      });
      return sign(token, encryptionKey, TINYFISH_SESSION_LABEL);
    },
    userIdFor: async (cookieValue) => {
      const token = verify(cookieValue, encryptionKey, TINYFISH_SESSION_LABEL);
      if (!token) return null;
      const rows = await database
        .select({
          userId: sessions.userId,
          expiresAt: sessions.expiresAt,
        })
        .from(sessions)
        .where(eq(sessions.token, token))
        .limit(1);
      const row = rows[0];
      if (!row || row.expiresAt.getTime() <= Date.now()) {
        return null;
      }
      return row.userId;
    },
    revoke: async (cookieValue) => {
      const token = verify(cookieValue, encryptionKey, TINYFISH_SESSION_LABEL);
      if (!token) return;
      await database.delete(sessions).where(eq(sessions.token, token));
    },
  };
}
