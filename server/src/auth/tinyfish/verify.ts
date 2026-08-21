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
import {
  classifyTinyFishCredential,
  defaultHeaderForToken,
  liveClaimsFor,
  OFFICIAL_TINYFISH_MCP_URL,
  OFFICIAL_TINYFISH_ORIGIN,
  OFFICIAL_TINYFISH_WALLET_PATH,
  type TinyFishCredentialHeader,
  type TinyFishPresentedCredential,
} from "./credential";

export type TinyFishVerifier = {
  verify: (
    token: string,
    presentation?: { header?: TinyFishCredentialHeader },
  ) => Promise<TinyFishClaims>;
};

type FetchLike = typeof fetch;

/**
 * Verify a TinyFish credential.
 *
 * Fixtures (`tfk.*`) stay on TinyPipe / `@tinyfish/web/auth` for local CI.
 * Live `tf_…` API keys and MCP OAuth tokens are checked at official TinyFish
 * (X-API-Key or Authorization Bearer). TinyBot never logs the secret and
 * never calls `record_usage` for sign-in.
 */
export function createTinyFishVerifier(options: {
  mcpUrl: string;
  issuer?: string;
  fetch?: FetchLike;
  officialOrigin?: string;
  inProcessVerify?: (input: {
    token: string;
    iss?: string;
  }) => Promise<unknown> | unknown;
}): TinyFishVerifier {
  const fetchImpl = options.fetch ?? fetch;
  const officialOrigin = (
    options.officialOrigin ?? OFFICIAL_TINYFISH_ORIGIN
  ).replace(/\/+$/, "");

  return {
    verify: async (rawToken, presentation) => {
      const token = normalizeTinyFishToken(rawToken);
      const kind = classifyTinyFishCredential(token);
      if (!kind) {
        throw new TinyFishUnauthenticatedError();
      }

      const header = presentation?.header ?? defaultHeaderForToken(token);
      const presented: TinyFishPresentedCredential = {
        value: token,
        header,
        kind,
      };

      if (kind === "fixture") {
        return verifyFixture(options, fetchImpl, presented);
      }
      return verifyOfficial(fetchImpl, officialOrigin, presented);
    },
  };
}

async function verifyFixture(
  options: {
    mcpUrl: string;
    issuer?: string;
    inProcessVerify?: (input: {
      token: string;
      iss?: string;
    }) => Promise<unknown> | unknown;
  },
  fetchImpl: FetchLike,
  presented: TinyFishPresentedCredential,
): Promise<TinyFishClaims> {
  const token = presented.value;
  if (!isPhase1TinyFishToken(token)) {
    throw new TinyFishUnauthenticatedError();
  }

  const inProcess = options.inProcessVerify ?? (await loadInProcessVerify());
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

  const remote = await verifyAtTinyPipe(fetchImpl, options.mcpUrl, presented);
  const claims = claimsFromUnknown(remote) ?? fixtureClaimsFor(token) ?? null;
  if (!claims) {
    throw new TinyFishUnauthenticatedError();
  }
  return assertIssuer(claims, options.issuer);
}

async function verifyOfficial(
  fetchImpl: FetchLike,
  officialOrigin: string,
  presented: TinyFishPresentedCredential,
): Promise<TinyFishClaims> {
  const remote =
    presented.kind === "api_key"
      ? await verifyAtOfficialWallet(fetchImpl, officialOrigin, presented)
      : await verifyAtOfficialMcp(fetchImpl, officialOrigin, presented);
  return claimsFromUnknown(remote) ?? liveClaimsFor(presented.value);
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

function officialAuthHeaders(
  presented: TinyFishPresentedCredential,
): Record<string, string> {
  if (presented.header === "X-API-Key") {
    return { "X-API-Key": presented.value };
  }
  return { Authorization: `Bearer ${presented.value}` };
}

async function verifyAtTinyPipe(
  fetchImpl: FetchLike,
  mcpUrl: string,
  presented: TinyFishPresentedCredential,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(mcpUrl, {
      method: "POST",
      headers: {
        ...officialAuthHeaders(presented),
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
          _meta: { "io.tinyfish/credential": presented.value },
        },
      }),
    });
  } catch {
    throw new TinyFishUnavailableError();
  }

  return readAuthResponse(response, "tinypipe");
}

async function verifyAtOfficialWallet(
  fetchImpl: FetchLike,
  officialOrigin: string,
  presented: TinyFishPresentedCredential,
): Promise<unknown> {
  const url = `${officialOrigin}${OFFICIAL_TINYFISH_WALLET_PATH}`;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: officialAuthHeaders(presented),
    });
  } catch {
    throw new TinyFishUnavailableError();
  }
  return readAuthResponse(response, "wallet");
}

async function verifyAtOfficialMcp(
  fetchImpl: FetchLike,
  officialOrigin: string,
  presented: TinyFishPresentedCredential,
): Promise<unknown> {
  const url =
    officialOrigin === OFFICIAL_TINYFISH_ORIGIN
      ? OFFICIAL_TINYFISH_MCP_URL
      : `${officialOrigin}/mcp`;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        ...officialAuthHeaders(presented),
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "tinybot", version: "0.0.0" },
        },
      }),
    });
  } catch {
    throw new TinyFishUnavailableError();
  }
  return readAuthResponse(response, "mcp");
}

function readAuthResponse(
  response: Response,
  surface: "tinypipe" | "wallet" | "mcp",
): Promise<unknown> {
  if (response.status === 401) {
    throw new TinyFishUnauthenticatedError();
  }
  if (response.status === 403 && surface === "tinypipe") {
    throw new TinyFishUnauthenticatedError();
  }
  if (!response.ok && !isAcceptedNonOk(response.status, surface)) {
    if (response.status === 403) {
      // Official credit / plan gates are not auth gates.
      return response.json().catch(() => ({}));
    }
    throw new TinyFishUnavailableError(
      `TinyFish returned HTTP ${response.status}.`,
    );
  }

  return response
    .json()
    .catch(() => null)
    .then((body) => interpretAuthBody(body, surface));
}

function isAcceptedNonOk(
  status: number,
  surface: "tinypipe" | "wallet" | "mcp",
) {
  // Legacy accounts are not on wallet billing; the key is still valid.
  return surface === "wallet" && status === 404;
}

function interpretAuthBody(
  body: unknown,
  surface: "tinypipe" | "wallet" | "mcp",
): unknown {
  const record = body as {
    result?: unknown;
    error?: { code?: number | string; message?: string };
  } | null;
  if (record?.error?.code === TINYFISH_UNAUTHENTICATED) {
    throw new TinyFishUnauthenticatedError(
      record.error.message ?? "TinyFish credential was not accepted.",
    );
  }
  if (surface !== "tinypipe" && isOfficialAuthError(record?.error?.code)) {
    throw new TinyFishUnauthenticatedError();
  }
  if (
    surface === "wallet" &&
    record &&
    typeof record === "object" &&
    "error" in record &&
    (record.error as { code?: string } | undefined)?.code ===
      "FEATURE_NOT_AVAILABLE"
  ) {
    return {};
  }
  return record?.result ?? body;
}

function isOfficialAuthError(code: number | string | undefined): boolean {
  return code === "MISSING_API_KEY" || code === "INVALID_API_KEY";
}
