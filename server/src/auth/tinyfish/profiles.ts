import { and, eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { accounts, userRoles, users } from "../../db/schema";
import type { SpriteAssignment } from "../../sprites/store";
import { TINYFISH_PROVIDER_ID, type TinyFishClaims } from "./claims";

export type TinyFishProfile = {
  id: string;
  email: string;
  name: string;
  tinyfishUserId: string;
  iss: string;
  clientId: string;
  sprite?: SpriteAssignment;
};

export type TinyFishProfileStore = {
  upsert: (
    claims: TinyFishClaims,
    credential?: string,
  ) => Promise<TinyFishProfile>;
  get: (userId: string) => Promise<TinyFishProfile | null>;
  /** Opaque tfk.* presented at sign-in. Used as Bearer on product backends. Never logged. */
  credentialFor: (userId: string) => Promise<string | undefined>;
};

export function profileFromClaims(claims: TinyFishClaims): TinyFishProfile {
  return {
    id: claims.tinyfish_user_id,
    email: `${claims.tinyfish_user_id}@users.tinyfish.test`,
    name: claims.tinyfish_user_id,
    tinyfishUserId: claims.tinyfish_user_id,
    iss: claims.iss,
    clientId: claims.client_id,
  };
}

export function createMemoryTinyFishProfileStore(): TinyFishProfileStore {
  const rows = new Map<string, TinyFishProfile>();
  const credentials = new Map<string, string>();

  return {
    upsert: async (claims, credential) => {
      const next = profileFromClaims(claims);
      const existing = rows.get(next.tinyfishUserId);
      if (existing) {
        const updated = { ...existing, iss: next.iss, clientId: next.clientId };
        rows.set(next.tinyfishUserId, updated);
        if (credential) credentials.set(next.id, credential);
        return updated;
      }
      rows.set(next.tinyfishUserId, next);
      if (credential) credentials.set(next.id, credential);
      return next;
    },
    get: async (userId) => rows.get(userId) ?? null,
    credentialFor: async (userId) => credentials.get(userId),
  };
}

export function createDatabaseTinyFishProfileStore(
  database: Database,
): TinyFishProfileStore {
  return {
    upsert: async (claims, credential) => {
      const profile = profileFromClaims(claims);
      const now = new Date();

      await database.transaction(async (transaction) => {
        const existingAccount = await transaction
          .select({
            id: accounts.id,
            userId: accounts.userId,
          })
          .from(accounts)
          .where(
            and(
              eq(accounts.providerId, TINYFISH_PROVIDER_ID),
              eq(accounts.accountId, profile.tinyfishUserId),
            ),
          )
          .limit(1);

        if (existingAccount[0]) {
          await transaction
            .update(users)
            .set({
              email: profile.email,
              name: profile.name,
              updatedAt: now,
            })
            .where(eq(users.id, existingAccount[0].userId));
          await transaction
            .update(accounts)
            .set({
              accessToken: credential,
              idToken: profile.iss,
              scope: profile.clientId,
              updatedAt: now,
            })
            .where(eq(accounts.id, existingAccount[0].id));
          return;
        }

        await transaction
          .insert(users)
          .values({
            id: profile.id,
            email: profile.email,
            name: profile.name,
            emailVerified: false,
          })
          .onConflictDoUpdate({
            target: users.id,
            set: {
              email: profile.email,
              name: profile.name,
              updatedAt: now,
            },
          });

        await transaction
          .insert(accounts)
          .values({
            id: `${TINYFISH_PROVIDER_ID}:${profile.tinyfishUserId}`,
            accountId: profile.tinyfishUserId,
            providerId: TINYFISH_PROVIDER_ID,
            userId: profile.id,
            accessToken: credential,
            idToken: profile.iss,
            scope: profile.clientId,
          })
          .onConflictDoUpdate({
            target: [accounts.providerId, accounts.accountId],
            set: {
              accessToken: credential,
              idToken: profile.iss,
              scope: profile.clientId,
              userId: profile.id,
              updatedAt: now,
            },
          });

        await transaction
          .insert(userRoles)
          .values({ userId: profile.id, role: "user" })
          .onConflictDoNothing();
      });

      return profile;
    },
    get: async (userId) => {
      const rows = await database
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          accountId: accounts.accountId,
          iss: accounts.idToken,
          clientId: accounts.scope,
        })
        .from(users)
        .innerJoin(accounts, eq(accounts.userId, users.id))
        .where(
          and(
            eq(users.id, userId),
            eq(accounts.providerId, TINYFISH_PROVIDER_ID),
          ),
        )
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return {
        id: row.id,
        email: row.email,
        name: row.name ?? row.id,
        tinyfishUserId: row.accountId,
        iss: row.iss ?? "",
        clientId: row.clientId ?? "",
      };
    },
    credentialFor: async (userId) => {
      const rows = await database
        .select({ accessToken: accounts.accessToken })
        .from(accounts)
        .where(
          and(
            eq(accounts.userId, userId),
            eq(accounts.providerId, TINYFISH_PROVIDER_ID),
          ),
        )
        .limit(1);
      return rows[0]?.accessToken ?? undefined;
    },
  };
}
