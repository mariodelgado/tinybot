import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import {
  createMemoryTinyFishProfileStore,
  createMemoryTinyFishSessionStore,
  createTinyFishAuthService,
  createTinyFishVerifier,
  fixtureClaimsFor,
  FIXTURE_CIMD,
  FIXTURE_ISSUER,
  liveClaimsFor,
  liveTinyFishUserId,
  normalizeTinyFishToken,
  OFFICIAL_TINYFISH_CLIENT,
  OFFICIAL_TINYFISH_ISSUER,
  TinyFishUnauthenticatedError,
  TINYFISH_SESSION_COOKIE,
} from "../src/auth/tinyfish";
import { loadConfig } from "../src/config";
import { testEnvironment } from "./support/environment";

const encryptionKey = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

function fixtureVerifier() {
  return {
    verify: async (token: string) => {
      const claims = fixtureClaimsFor(normalizeTinyFishToken(token));
      if (!claims) throw new TinyFishUnauthenticatedError();
      return claims;
    },
  };
}

function tinyFishAuth() {
  const profiles = createMemoryTinyFishProfileStore();
  return {
    profiles,
    service: createTinyFishAuthService({
      verifier: fixtureVerifier(),
      profiles,
      sessions: createMemoryTinyFishSessionStore(encryptionKey),
      rolesForUser: async () => ["user"],
    }),
  };
}

function appWithTinyFish(
  service: ReturnType<typeof tinyFishAuth>["service"],
  environment: Record<string, string | undefined> = {},
) {
  return createApp(
    loadConfig({
      ...testEnvironment(),
      OPENBOT_DEV_NO_AUTH: undefined,
      ...environment,
    }),
    undefined,
    { rolesForUser: async () => ["user"] },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    service,
  );
}

function tinyFishApp() {
  const { profiles, service } = tinyFishAuth();
  return { app: appWithTinyFish(service), profiles };
}

async function signIn(app: ReturnType<typeof createApp>, token: string) {
  return app.request("http://openbot.local/api/auth/tinyfish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

function cookieFrom(response: Response): string {
  const header =
    response.headers.get("set-cookie") ??
    response.headers.get("Set-Cookie") ??
    "";
  const match = header.match(new RegExp(`${TINYFISH_SESSION_COOKIE}=([^;]+)`));
  if (!match?.[1]) {
    throw new Error("TinyFish session cookie was not set.");
  }
  return `${TINYFISH_SESSION_COOKIE}=${match[1]}`;
}

describe("TinyFish credential verification", () => {
  test("accepts a fixture after TinyPipe accepts it, and maps tfk.alice to tfu_alice", async () => {
    const verifier = createTinyFishVerifier({
      mcpUrl: "http://127.0.0.1:3712/mcp",
      issuer: FIXTURE_ISSUER,
      fetch: async () =>
        new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} }), {
          status: 200,
        }),
    });

    await expect(verifier.verify("Bearer tfk.alice")).resolves.toEqual(
      fixtureClaimsFor("tfk.alice"),
    );
  });

  test("refuses a non-fixture TinyPipe rejection as 401", async () => {
    const verifier = createTinyFishVerifier({
      mcpUrl: "http://127.0.0.1:3712/mcp",
      fetch: async () =>
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            error: { code: -32013, message: "unauthenticated" },
          }),
          { status: 200 },
        ),
    });

    await expect(verifier.verify("tfk.unknown")).rejects.toBeInstanceOf(
      TinyFishUnauthenticatedError,
    );
  });

  test("refuses a JWT-shaped token at official MCP, not TinyPipe", async () => {
    const urls: string[] = [];
    const verifier = createTinyFishVerifier({
      mcpUrl: "http://127.0.0.1:3712/mcp",
      fetch: async (input) => {
        urls.push(String(input));
        return new Response("no", { status: 401 });
      },
    });

    await expect(
      verifier.verify("eyJhbGciOiJub25lIn0.eyJzdWIiOiJhIn0.x"),
    ).rejects.toBeInstanceOf(TinyFishUnauthenticatedError);
    expect(urls).toEqual(["https://agent.tinyfish.ai/mcp"]);
  });

  test("accepts a mocked tf_ API key and maps it to a live user", async () => {
    const headers: Record<string, string | null>[] = [];
    const verifier = createTinyFishVerifier({
      mcpUrl: "http://127.0.0.1:3712/mcp",
      issuer: FIXTURE_ISSUER,
      fetch: async (input, init) => {
        const url = String(input);
        const sent = new Headers(init?.headers);
        headers.push({
          url,
          authorization: sent.get("Authorization"),
          apiKey: sent.get("X-API-Key"),
        });
        if (url === "https://agent.tinyfish.ai/v1/wallet") {
          return Response.json({
            tinyfish_user_id: "tfu_live",
            iss: "https://agent.tinyfish.ai",
            client_id: "https://agent.tinyfish.ai/mcp",
          });
        }
        return new Response("no", { status: 500 });
      },
    });

    await expect(verifier.verify("tf_live_mock")).resolves.toEqual({
      tinyfish_user_id: "tfu_live",
      iss: "https://agent.tinyfish.ai",
      issuer: "https://agent.tinyfish.ai",
      client_id: "https://agent.tinyfish.ai/mcp",
    });
    expect(headers).toEqual([
      {
        url: "https://agent.tinyfish.ai/v1/wallet",
        authorization: null,
        apiKey: "tf_live_mock",
      },
    ]);
  });

  test("accepts a mocked MCP Bearer token at official MCP", async () => {
    const verifier = createTinyFishVerifier({
      mcpUrl: "http://127.0.0.1:3712/mcp",
      fetch: async (input, init) => {
        const sent = new Headers(init?.headers);
        expect(String(input)).toBe("https://agent.tinyfish.ai/mcp");
        expect(sent.get("Authorization")).toBe("Bearer mcp.live.token");
        expect(sent.get("X-API-Key")).toBeNull();
        return Response.json({
          jsonrpc: "2.0",
          id: 1,
          result: {
            tinyfish_user_id: "tfu_mcp",
            iss: "https://agent.tinyfish.ai",
            client_id: "https://agent.tinyfish.ai/mcp",
          },
        });
      },
    });

    await expect(
      verifier.verify("mcp.live.token", { header: "Authorization" }),
    ).resolves.toMatchObject({ tinyfish_user_id: "tfu_mcp" });
  });

  test("does not put a live key in the error message", async () => {
    const verifier = createTinyFishVerifier({
      mcpUrl: "http://127.0.0.1:3712/mcp",
      fetch: async () => new Response("no", { status: 401 }),
    });
    const key = "tf_must_not_appear_in_errors";
    try {
      await verifier.verify(key);
      throw new Error("expected 401");
    } catch (error) {
      expect(error).toBeInstanceOf(TinyFishUnauthenticatedError);
      expect(String(error)).not.toContain(key);
    }
  });
});

describe("TinyFish profile upsert", () => {
  test("alice creates tfu_alice, a second alice reuses it, exhausted is a different profile", async () => {
    const store = createMemoryTinyFishProfileStore();

    const alice = fixtureClaimsFor("tfk.alice");
    const exhaustedClaims = fixtureClaimsFor("tfk.exhausted");
    if (!alice || !exhaustedClaims) {
      throw new Error("Phase 1 fixtures must include alice and exhausted.");
    }

    const first = await store.upsert(alice);
    expect(first).toMatchObject({
      id: "tfu_alice",
      tinyfishUserId: "tfu_alice",
      iss: FIXTURE_ISSUER,
      clientId: FIXTURE_CIMD,
    });

    const second = await store.upsert(alice);
    expect(second.id).toBe(first.id);
    expect(second.tinyfishUserId).toBe("tfu_alice");

    const exhausted = await store.upsert(exhaustedClaims);
    expect(exhausted.id).toBe("tfu_exhausted");
    expect(exhausted.tinyfishUserId).toBe("tfu_exhausted");
    expect(exhausted.id).not.toBe(first.id);
  });

  test("a live key creates a user the same way tfk.alice does", async () => {
    const store = createMemoryTinyFishProfileStore();
    const key = "tf_live_mock";
    const claims = liveClaimsFor(key);

    const first = await store.upsert(claims, {
      value: key,
      header: "X-API-Key",
      kind: "api_key",
    });
    expect(first.id).toBe(liveTinyFishUserId(key));
    expect(first.tinyfishUserId).toBe(first.id);
    expect(first.iss).toBe(OFFICIAL_TINYFISH_ISSUER);
    expect(first.clientId).toBe(OFFICIAL_TINYFISH_CLIENT);

    const second = await store.upsert(claims, {
      value: key,
      header: "X-API-Key",
      kind: "api_key",
    });
    expect(second.id).toBe(first.id);
    expect(await store.credentialFor(first.id)).toBe(key);
    expect(await store.credentialPresentationFor(first.id)).toEqual({
      value: key,
      header: "X-API-Key",
      kind: "api_key",
    });
  });
});

describe("TinyFish sign-in HTTP", () => {
  test("unknown token is 401 and does not create a profile", async () => {
    const { app, profiles } = tinyFishApp();

    const response = await signIn(app, "tfk.unknown");

    expect(response.status).toBe(401);
    expect(await profiles.get("tfu_alice")).toBeNull();
    const me = await app.request("http://openbot.local/api/me");
    expect(me.status).toBe(401);
  });

  test("alice creates a profile, second alice upserts, exhausted is separate, session binds", async () => {
    const { app, profiles } = tinyFishApp();

    const first = await signIn(app, "tfk.alice");
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({
      user: {
        id: "tfu_alice",
        email: "tfu_alice@users.tinyfish.test",
        name: "tfu_alice",
        tinyfishUserId: "tfu_alice",
        iss: FIXTURE_ISSUER,
        clientId: FIXTURE_CIMD,
        role: "user",
      },
    });

    const second = await signIn(app, "tfk.alice");
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { user: { id: string } };
    expect(secondBody.user.id).toBe("tfu_alice");
    expect((await profiles.get("tfu_alice"))?.id).toBe("tfu_alice");

    const exhausted = await signIn(app, "tfk.exhausted");
    expect(exhausted.status).toBe(200);
    const exhaustedBody = (await exhausted.json()) as {
      user: { id: string; tinyfishUserId: string };
    };
    expect(exhaustedBody.user.id).toBe("tfu_exhausted");
    expect(exhaustedBody.user.tinyfishUserId).toBe("tfu_exhausted");

    const me = await app.request("http://openbot.local/api/me", {
      headers: { cookie: cookieFrom(first) },
    });
    expect(me.status).toBe(200);
    await expect(me.json()).resolves.toMatchObject({
      user: {
        id: "tfu_alice",
        tinyfishUserId: "tfu_alice",
        role: "user",
      },
    });
  });

  test("the start page stays gated without a TinyFish session", async () => {
    const { app } = tinyFishApp();

    const me = await app.request("http://openbot.local/api/me");
    expect(me.status).toBe(401);
    await expect(me.json()).resolves.toEqual({
      error: "Authentication required.",
    });
  });

  test("X-API-Key sign-in with a mocked live key creates a session user", async () => {
    const profiles = createMemoryTinyFishProfileStore();
    const verifier = createTinyFishVerifier({
      mcpUrl: "http://127.0.0.1:3712/mcp",
      fetch: async (input, init) => {
        const sent = new Headers(init?.headers);
        expect(String(input)).toBe("https://agent.tinyfish.ai/v1/wallet");
        expect(sent.get("X-API-Key")).toBe("tf_live_mock");
        return Response.json({
          tinyfish_user_id: "tfu_live",
          iss: OFFICIAL_TINYFISH_ISSUER,
          client_id: OFFICIAL_TINYFISH_CLIENT,
        });
      },
    });
    const service = createTinyFishAuthService({
      verifier,
      profiles,
      sessions: createMemoryTinyFishSessionStore(encryptionKey),
      rolesForUser: async () => ["user"],
    });
    const app = appWithTinyFish(service);

    const response = await app.request(
      "http://openbot.local/api/auth/tinyfish",
      {
        method: "POST",
        headers: { "X-API-Key": "tf_live_mock" },
      },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      user: {
        id: "tfu_live",
        tinyfishUserId: "tfu_live",
        iss: OFFICIAL_TINYFISH_ISSUER,
        clientId: OFFICIAL_TINYFISH_CLIENT,
        role: "user",
      },
    });
    expect((await profiles.get("tfu_live"))?.tinyfishUserId).toBe("tfu_live");
    expect(await profiles.credentialFor("tfu_live")).toBe("tf_live_mock");
  });

  test("TinyFish remains the gate when OPENBOT_DEV_NO_AUTH is also set", async () => {
    const { service } = tinyFishAuth();
    const app = appWithTinyFish(service, { OPENBOT_DEV_NO_AUTH: "true" });

    const me = await app.request("http://openbot.local/api/me");
    expect(me.status).toBe(401);
  });
});
