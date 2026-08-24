import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  createDatabaseTinyFishProfileStore,
  liveClaimsFor,
  TINYFISH_PROVIDER_ID,
} from "../src/auth/tinyfish";
import { decryptSecret, isSecretEnvelope } from "../src/credentials";
import { createDatabase } from "../src/db/client";
import { accounts, users } from "../src/db/schema";
import { TEST_POOL } from "./support/database";

const key = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://openbot:openbot@localhost:5432/openbot";
const database = createDatabase(databaseUrl, TEST_POOL);
const store = createDatabaseTinyFishProfileStore(database, key);
const createdUserIds: string[] = [];

afterEach(async () => {
  for (const userId of createdUserIds.splice(0)) {
    await database.delete(users).where(eq(users.id, userId));
  }
});

afterAll(async () => {
  await database.$client.close();
});

function track(userId: string) {
  createdUserIds.push(userId);
  return userId;
}

describe("TinyFish access token at rest", () => {
  test("new writes of access_token are ciphertext and decrypt on read", async () => {
    const token = `tf_new_write_${randomUUID().slice(0, 8)}`;
    const claims = liveClaimsFor(token);
    const profile = await store.upsert(claims, {
      value: token,
      header: "X-API-Key",
      kind: "api_key",
    });
    track(profile.id);

    const rows = await database
      .select({ accessToken: accounts.accessToken })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, profile.id),
          eq(accounts.providerId, TINYFISH_PROVIDER_ID),
        ),
      )
      .limit(1);
    const stored = rows[0]?.accessToken;
    if (!stored) throw new Error("expected a stored access token");

    expect(stored).not.toContain(token);
    expect(isSecretEnvelope(stored)).toBe(true);
    expect(await store.credentialFor(profile.id)).toBe(token);
    expect(await store.credentialPresentationFor(profile.id)).toEqual({
      value: token,
      header: "X-API-Key",
      kind: "api_key",
    });
  });

  test("migrates a leftover plaintext row on read", async () => {
    const userId = track(`tfu_leftover_${randomUUID().slice(0, 8)}`);
    const leftover = `tf_leftover_${randomUUID().slice(0, 8)}`;
    await database.insert(users).values({
      id: userId,
      email: `${userId}@users.tinyfish.test`,
      name: userId,
    });
    await database.insert(accounts).values({
      id: `${TINYFISH_PROVIDER_ID}:${userId}`,
      accountId: userId,
      providerId: TINYFISH_PROVIDER_ID,
      userId,
      accessToken: leftover,
      refreshToken: "X-API-Key",
    });

    expect(await store.credentialFor(userId)).toBe(leftover);

    const rows = await database
      .select({ accessToken: accounts.accessToken })
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .limit(1);
    const stored = rows[0]?.accessToken;
    if (!stored) throw new Error("expected a migrated access token");
    expect(stored).not.toBe(leftover);
    expect(stored).not.toContain(leftover);
    expect(isSecretEnvelope(stored)).toBe(true);
    await expect(decryptSecret(key, stored)).resolves.toBe(leftover);
    expect(await store.credentialPresentationFor(userId)).toEqual({
      value: leftover,
      header: "X-API-Key",
      kind: "api_key",
    });
  });
});
