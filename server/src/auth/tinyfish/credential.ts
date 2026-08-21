/**
 * How a TinyFish credential is presented and forwarded.
 *
 * Official: X-API-Key or Authorization Bearer with a tf_… API key
 * (agent.tinyfish.ai/api-keys) or an OAuth MCP token for
 * https://agent.tinyfish.ai/mcp. Fixtures stay tfk.* for local CI.
 * Never log the secret.
 */

import { createHash } from "node:crypto";
import {
  isPhase1TinyFishToken,
  normalizeTinyFishToken,
  type TinyFishClaims,
} from "./claims";

export const OFFICIAL_TINYFISH_ORIGIN = "https://agent.tinyfish.ai";
export const OFFICIAL_TINYFISH_MCP_URL = "https://agent.tinyfish.ai/mcp";
export const OFFICIAL_TINYFISH_WALLET_PATH = "/v1/wallet";
export const OFFICIAL_TINYFISH_ISSUER = "https://agent.tinyfish.ai";
export const OFFICIAL_TINYFISH_CLIENT = "https://agent.tinyfish.ai/mcp";

export type TinyFishCredentialHeader = "X-API-Key" | "Authorization";
export type TinyFishCredentialKind = "fixture" | "api_key" | "mcp_token";

export type TinyFishPresentedCredential = {
  value: string;
  header: TinyFishCredentialHeader;
  kind: TinyFishCredentialKind;
};

export function isTinyFishApiKey(token: string): boolean {
  return token.startsWith("tf_") && token.length > 3 && !token.includes(" ");
}

export function isTinyFishMcpToken(token: string): boolean {
  return (
    token.length > 0 &&
    !token.includes(" ") &&
    !isPhase1TinyFishToken(token) &&
    !isTinyFishApiKey(token)
  );
}

export function classifyTinyFishCredential(
  token: string,
): TinyFishCredentialKind | null {
  if (isPhase1TinyFishToken(token)) return "fixture";
  if (isTinyFishApiKey(token)) return "api_key";
  if (isTinyFishMcpToken(token)) return "mcp_token";
  return null;
}

export function defaultHeaderForToken(
  token: string,
): TinyFishCredentialHeader {
  return isTinyFishApiKey(token) ? "X-API-Key" : "Authorization";
}

export function presentedCredentialFromHeaders(
  headers: Headers,
): TinyFishPresentedCredential | null {
  const apiKey = headers.get("X-API-Key")?.trim() ?? "";
  if (apiKey) {
    const value = normalizeTinyFishToken(apiKey);
    const kind = classifyTinyFishCredential(value);
    if (!kind) return null;
    return { value, header: "X-API-Key", kind };
  }
  const authorization = headers.get("Authorization")?.trim() ?? "";
  if (authorization) {
    const value = normalizeTinyFishToken(authorization);
    const kind = classifyTinyFishCredential(value);
    if (!kind) return null;
    return { value, header: "Authorization", kind };
  }
  return null;
}

export function presentedCredentialFromSignIn(
  headers: Headers,
  bodyToken?: string,
): TinyFishPresentedCredential | null {
  const fromHeaders = presentedCredentialFromHeaders(headers);
  const body = bodyToken ? normalizeTinyFishToken(bodyToken) : "";
  if (body) {
    const kind = classifyTinyFishCredential(body);
    if (!kind) return null;
    return {
      value: body,
      header: fromHeaders?.header ?? defaultHeaderForToken(body),
      kind,
    };
  }
  return fromHeaders;
}

/** Stable profile id for a live key, same idea as tfk.alice → tfu_alice. */
export function liveTinyFishUserId(token: string): string {
  const digest = createHash("sha256").update(token).digest("hex").slice(0, 16);
  return `tfu_${digest}`;
}

export function liveClaimsFor(token: string): TinyFishClaims {
  return {
    tinyfish_user_id: liveTinyFishUserId(token),
    iss: OFFICIAL_TINYFISH_ISSUER,
    issuer: OFFICIAL_TINYFISH_ISSUER,
    client_id: OFFICIAL_TINYFISH_CLIENT,
  };
}

export function applyTinyFishCredential(
  headers: Headers,
  credential: TinyFishPresentedCredential,
): void {
  if (credential.header === "X-API-Key") {
    headers.set("X-API-Key", credential.value);
    headers.delete("Authorization");
    return;
  }
  headers.set("Authorization", `Bearer ${credential.value}`);
  headers.delete("X-API-Key");
}

export function incomingOfficialCredential(headers: Headers): boolean {
  const apiKey = headers.get("X-API-Key")?.trim();
  const authorization = headers.get("Authorization")?.trim();
  return Boolean(apiKey || authorization);
}

export function presentationFromStoredValue(
  value: string,
  header?: TinyFishCredentialHeader,
): TinyFishPresentedCredential {
  const kind = classifyTinyFishCredential(value) ?? "mcp_token";
  return {
    value,
    header: header ?? defaultHeaderForToken(value),
    kind,
  };
}
