import {
  decryptSecret,
  encryptSecret,
  isSecretEnvelope,
} from "../../credentials";

/**
 * Decrypt a stored TinyFish token. Leftover plaintext is re-encrypted via
 * `persistCiphertext`. A value that looks like an envelope but will not
 * decrypt is refused rather than treated as leftover plaintext.
 */
export async function revealStoredAccessToken(
  encryptionKey: string,
  stored: string,
  persistCiphertext: (ciphertext: string) => Promise<void>,
): Promise<string> {
  if (isSecretEnvelope(stored)) {
    try {
      return await decryptSecret(encryptionKey, stored);
    } catch {
      throw new Error("Stored TinyFish access token could not be decrypted");
    }
  }
  await persistCiphertext(await encryptSecret(encryptionKey, stored));
  return stored;
}
