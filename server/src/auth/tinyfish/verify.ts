import {
  assertIssuer,
  claimsFromUnknown,
  fixtureClaimsFor,
  isPhase1TinyFishToken,
  normalizeTinyFishToken,
  TINYFISH_UNAUTHENTICATED,
  TinyFishUnauthenticatedError,
  TinyFishUnavailableError,
  type TinyFishClaims,
} from "./claims";

export type TinyFishVerifier = {
  verify: (token: string) => Promise<TinyFishClaims>;
};

type FetchLike = typeof fetch;

/**
 * Verify a TinyFish MCP credential.
 *
 * Prefers `@tinyfish/web/auth` when that package can be imported (no clone of TinyPipe).
 * Otherwise POSTs `TINYFISH_MCP_URL` with the Bearer on a protected MCP method. There is no
 * Phase 1 method named `verify`. TinyBot never calls `record_usage` for sign-in.
 */
export function createTinyFishVerifier(options: {
  mcpUrl: string;
  issuer?: string;
  fetch?: FetchLike;
  inProcessVerify?: (input: {
    token: string;
    iss?: string;
  }) => Promise<unknown> | unknown;
}): TinyFishVerifier {
  const fetchImpl = options.fetch ?? fetch;

  return {
    verify: async (rawToken) => {
      const token = normalizeTinyFishToken(rawToken);
      if (!isPhase1TinyFishToken(token)) {
        throw new TinyFishUnauthenticatedError(
          "TinyFish Phase 1 tokens are opaque tfk.* keyring entries, not JWTs.",
        );
      }

      const inProcess =
        options.inProcessVerify ?? (await loadInProcessVerify());
      if (inProcess) {
        try {
          const claims = claimsFromUnknown(
            await inProcess({ token, iss: options.issuer }),
          );
          if (!claims) {
            throw new TinyFishUnauthenticatedError();
          }
          return assertIssuer(claims, options.issuer);
        } catch (error) {
          if (error instanceof TinyFishUnauthenticatedError) throw error;
          throw new TinyFishUnauthenticatedError(
            error instanceof Error
              ? error.message
              : "TinyFish credential was not accepted.",
          );
        }
      }

      const remote = await verifyAtTinyPipe(fetchImpl, options.mcpUrl, token);
      const claims =
        claimsFromUnknown(remote) ?? fixtureClaimsFor(token) ?? null;
      if (!claims) {
        throw new TinyFishUnauthenticatedError();
      }
      return assertIssuer(claims, options.issuer);
    },
  };
}

async function loadInProcessVerify(): Promise<
  | ((input: { token: string; iss?: string }) => Promise<unknown> | unknown)
  | undefined
> {
  try {
    const imported = (await dynamicImport("@tinyfish/web/auth")) as {
      verify?: (input: { token: string; iss?: string }) => unknown;
    };
    return typeof imported.verify === "function" ? imported.verify : undefined;
  } catch {
    return undefined;
  }
}

function dynamicImport(specifier: string): Promise<unknown> {
  // The package is optional and is not on the public registry. A static import would fail typecheck.
  return (Function("s", "return import(s)") as (s: string) => Promise<unknown>)(
    specifier,
  );
}

async function verifyAtTinyPipe(
  fetchImpl: FetchLike,
  mcpUrl: string,
  token: string,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(mcpUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        // A protected method: missing/non-fixture credentials come back as -32013.
        // Sign-in is not a product call and must not record_usage.
        method: "tasks/get",
        params: {
          taskId: "tinybot-signin",
          _meta: { "io.tinyfish/credential": token },
        },
      }),
    });
  } catch {
    throw new TinyFishUnavailableError();
  }

  if (response.status === 401 || response.status === 403) {
    throw new TinyFishUnauthenticatedError();
  }
  if (!response.ok) {
    throw new TinyFishUnavailableError(
      `TinyPipe returned HTTP ${response.status}.`,
    );
  }

  const body = (await response.json().catch(() => null)) as {
    result?: unknown;
    error?: { code?: number; message?: string };
  } | null;

  if (body?.error?.code === TINYFISH_UNAUTHENTICATED) {
    throw new TinyFishUnauthenticatedError(
      body.error.message ?? "TinyFish credential was not accepted.",
    );
  }

  return body?.result ?? body;
}
