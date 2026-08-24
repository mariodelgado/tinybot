import { describe, expect, test } from "bun:test";
import { revealStoredAccessToken } from "../src/auth/tinyfish/access-token";
import {
  decryptSecret,
  encryptSecret,
  isSecretEnvelope,
} from "../src/credentials";

const key = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const otherKey = Buffer.alloc(32, 1).toString("base64");

describe("TinyFish access token encryption", () => {
  test("encrypts a live key as a versioned AES-GCM envelope and restores it", async () => {
    const token = "tf_must_not_appear_in_ciphertext";
    const envelope = await encryptSecret(key, token);

    expect(isSecretEnvelope(envelope)).toBe(true);
    expect(envelope).not.toContain(token);
    expect(JSON.parse(envelope)).toEqual({
      version: 1,
      iv: expect.any(String),
      ciphertext: expect.any(String),
    });
    await expect(decryptSecret(key, envelope)).resolves.toBe(token);
    expect(isSecretEnvelope(token)).toBe(false);
  });

  test("migrates leftover plaintext by persisting ciphertext and returning the original token", async () => {
    const leftover = "tf_leftover_plaintext_row";
    const persisted: string[] = [];

    const revealed = await revealStoredAccessToken(
      key,
      leftover,
      async (ciphertext) => {
        persisted.push(ciphertext);
      },
    );

    expect(revealed).toBe(leftover);
    expect(persisted).toHaveLength(1);
    const stored = persisted[0];
    if (!stored) throw new Error("expected migrated ciphertext");
    expect(stored).not.toBe(leftover);
    expect(stored).not.toContain(leftover);
    expect(isSecretEnvelope(stored)).toBe(true);
    await expect(decryptSecret(key, stored)).resolves.toBe(leftover);
  });

  test("decrypts an existing envelope without rewriting it", async () => {
    const token = "tf_already_encrypted";
    const envelope = await encryptSecret(key, token);
    const persisted: string[] = [];

    await expect(
      revealStoredAccessToken(key, envelope, async (ciphertext) => {
        persisted.push(ciphertext);
      }),
    ).resolves.toBe(token);
    expect(persisted).toEqual([]);
  });

  test("fails closed on a corrupt envelope instead of treating it as leftover plaintext", async () => {
    const corrupt = JSON.stringify({
      version: 1,
      iv: Buffer.alloc(12, 2).toString("base64"),
      ciphertext: Buffer.alloc(16, 3).toString("base64"),
    });
    const persisted: string[] = [];

    try {
      await revealStoredAccessToken(key, corrupt, async (ciphertext) => {
        persisted.push(ciphertext);
      });
      throw new Error("expected decrypt to fail closed");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(String(error)).toContain(
        "Stored TinyFish access token could not be decrypted",
      );
      expect(String(error)).not.toContain(corrupt);
    }
    expect(persisted).toEqual([]);
  });

  test("fails closed when KEY_ENCRYPTION_KEY cannot decrypt an existing envelope", async () => {
    const token = "tf_wrong_key";
    const envelope = await encryptSecret(key, token);
    const persisted: string[] = [];

    try {
      await revealStoredAccessToken(otherKey, envelope, async (ciphertext) => {
        persisted.push(ciphertext);
      });
      throw new Error("expected decrypt to fail closed");
    } catch (error) {
      expect(String(error)).toContain(
        "Stored TinyFish access token could not be decrypted",
      );
      expect(String(error)).not.toContain(token);
    }
    expect(persisted).toEqual([]);
  });
});
