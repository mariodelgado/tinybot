/**
 * TinyFish Phase 1 identity, as TinyPipe states it.
 *
 * Tokens are opaque `tfk.*` keyring entries, not JWTs. TinyBot does not mint a verifier, fetch
 * CIMD, or talk to JWKS. Claims come from `@tinyfish/web/auth` when that package is present, from
 * TinyPipe after it accepts a credential, or from this fixture table only after that accept.
 */

export const FIXTURE_ISSUER = "https://issuer.fixtures.tinyfish.test";
export const FIXTURE_CIMD = "https://cimd.fixtures.tinyfish.test/client.json";

/** JSON-RPC code TinyPipe uses when the credential is missing or not a fixture. */
export const TINYFISH_UNAUTHENTICATED = -32013;

export const TINYFISH_PROVIDER_ID = "tinyfish";
export const TINYFISH_SESSION_COOKIE = "tinybot_tinyfish_session";
export const TINYFISH_SESSION_LABEL = "tinyfish-session";

export type TinyFishClaims = {
  tinyfish_user_id: string;
  iss: string;
  /** Deprecated alias of `iss`. Kept so either name from TinyPipe is enough. */
  issuer: string;
  client_id: string;
};

/**
 * Documented Phase 1 fixtures. Used only after TinyPipe (or `@tinyfish/web/auth`) has accepted the
 * token. This is not an auth gate: an unknown token that TinyPipe rejected never reaches here.
 */
export const PHASE1_FIXTURES: Readonly<Record<string, TinyFishClaims>> = {
  "tfk.alice": {
    tinyfish_user_id: "tfu_alice",
    iss: FIXTURE_ISSUER,
    issuer: FIXTURE_ISSUER,
    client_id: FIXTURE_CIMD,
  },
  "tfk.exhausted": {
    tinyfish_user_id: "tfu_exhausted",
    iss: FIXTURE_ISSUER,
    issuer: FIXTURE_ISSUER,
    client_id: FIXTURE_CIMD,
  },
};

export function normalizeTinyFishToken(raw: string): string {
  return raw
    .trim()
    .replace(/^Bearer\s+/i, "")
    .trim();
}

/** Phase 1 keyring entries start with `tfk.`. JWTs are refused rather than decoded. */
export function isPhase1TinyFishToken(token: string): boolean {
  return token.startsWith("tfk.") && token.length > 4 && !token.includes(" ");
}

export function claimsFromUnknown(value: unknown): TinyFishClaims | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const tinyfishUserId =
    typeof record.tinyfish_user_id === "string"
      ? record.tinyfish_user_id.trim()
      : "";
  const iss =
    typeof record.iss === "string" && record.iss.trim()
      ? record.iss.trim()
      : typeof record.issuer === "string"
        ? record.issuer.trim()
        : "";
  const clientId =
    typeof record.client_id === "string" ? record.client_id.trim() : "";
  if (!tinyfishUserId || !iss || !clientId) {
    return null;
  }
  return {
    tinyfish_user_id: tinyfishUserId,
    iss,
    issuer: iss,
    client_id: clientId,
  };
}

export function fixtureClaimsFor(token: string): TinyFishClaims | null {
  return PHASE1_FIXTURES[token] ?? null;
}

export function assertIssuer(
  claims: TinyFishClaims,
  expected?: string,
): TinyFishClaims {
  if (expected && claims.iss !== expected) {
    throw new TinyFishUnauthenticatedError(
      "The credential's issuer does not match TINYFISH_ISSUER.",
    );
  }
  return claims;
}

export class TinyFishUnauthenticatedError extends Error {
  readonly status = 401;

  constructor(message = "TinyFish credential was not accepted.") {
    super(message);
    this.name = "TinyFishUnauthenticatedError";
  }
}

export class TinyFishUnavailableError extends Error {
  readonly status = 503;

  constructor(message = "TinyPipe is not reachable.") {
    super(message);
    this.name = "TinyFishUnavailableError";
  }
}
