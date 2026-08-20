import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export const TINYFISH_CREDENTIAL_STORAGE_KEY = "tinyfish.credential";

export async function signInWithGoogle() {
  const result = await authClient.signIn.social({
    provider: "google" as never,
    callbackURL: window.location.origin,
  });

  if (result.error) {
    throw new Error(result.error.message ?? "Could not start Google sign-in.");
  }
}

export async function signInWithTinyFish(token: string) {
  const response = await fetch("/api/auth/tinyfish", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (response.status === 401) {
    throw new Error("That TinyFish credential was not accepted.");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "Could not sign in with TinyFish.");
  }
  try {
    sessionStorage.setItem(TINYFISH_CREDENTIAL_STORAGE_KEY, token.trim());
  } catch {
    // Session storage is a convenience for presenting the same Bearer to a mini-app.
  }
}

export function storedTinyFishCredential(): string | null {
  try {
    return sessionStorage.getItem(TINYFISH_CREDENTIAL_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearStoredTinyFishCredential() {
  try {
    sessionStorage.removeItem(TINYFISH_CREDENTIAL_STORAGE_KEY);
  } catch {
    // Ignore quota / private-mode failures.
  }
}
