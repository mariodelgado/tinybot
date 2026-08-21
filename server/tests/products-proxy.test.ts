import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import {
  createMemoryTinyFishSessionStore,
  createTinyFishAuthService,
  FIXTURE_ISSUER,
  fixtureClaimsFor,
  normalizeTinyFishToken,
  TINYFISH_SESSION_COOKIE,
  TinyFishUnauthenticatedError,
} from "../src/auth/tinyfish";
import { createMemoryTinyFishProfileStore } from "../src/auth/tinyfish/profiles";
import { loadConfig } from "../src/config";
import {
  callProductBackend,
  productBackendTools,
} from "../src/tinyfish/backend";
import { localProductUpstream } from "../src/tinyfish/products-proxy";
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

function appWithProducts(
  fetchImpl: typeof fetch,
  env?: Record<string, string | undefined>,
) {
  const profiles = createMemoryTinyFishProfileStore();
  const service = createTinyFishAuthService({
    verifier: fixtureVerifier(),
    profiles,
    sessions: createMemoryTinyFishSessionStore(encryptionKey),
    rolesForUser: async () => ["user"],
  });
  const app = createApp(
    loadConfig({
      ...testEnvironment(),
      OPENBOT_DEV_NO_AUTH: undefined,
      TINYFISH_MCP_URL: "http://127.0.0.1:3712/mcp",
      TINYFISH_ISSUER: FIXTURE_ISSUER,
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
    undefined,
    { fetch: fetchImpl, ...(env ? { env } : {}) },
  );
  return { app, service };
}

async function signIn(app: ReturnType<typeof createApp>, token: string) {
  return app.request("http://openbot.local/api/auth/tinyfish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

function cookieFrom(response: Response): string {
  const header = response.headers.get("set-cookie") ?? "";
  const match = header.match(new RegExp(`${TINYFISH_SESSION_COOKIE}=([^;]+)`));
  if (!match?.[1]) {
    throw new Error("TinyFish session cookie was not set.");
  }
  return `${TINYFISH_SESSION_COOKIE}=${match[1]}`;
}

describe("local product upstream", () => {
  test("maps a known slug onto the remapped loopback host port", () => {
    expect(localProductUpstream("tinypipe", "/mcp")?.href).toBe(
      "http://127.0.0.1:3712/mcp",
    );
    expect(localProductUpstream("tinytail", "/v1/as-of")?.href).toBe(
      "http://127.0.0.1:18765/v1/as-of",
    );
    expect(localProductUpstream("tinypulse", "/health")?.href).toBe(
      "http://127.0.0.1:18082/health",
    );
    expect(localProductUpstream("tinyweb", "/health")?.href).toBe(
      "http://127.0.0.1:18766/health",
    );
    expect(localProductUpstream("tinywatch", "/health")?.href).toBe(
      "http://127.0.0.1:18081/health",
    );
    expect(localProductUpstream("tinykit", "/health")?.href).toBe(
      "http://127.0.0.1:18083/health",
    );
  });

  test("unknown slug has no upstream", () => {
    expect(localProductUpstream("tinyseventh", "/health")).toBeUndefined();
    expect(localProductUpstream("openbot", "/")).toBeUndefined();
  });

  test("TINYFISH_<SLUG>_URL / VITE_TINYFISH_<USAGE>_URL replace the loopback origin", () => {
    expect(
      localProductUpstream("tinypipe", "/mcp", "", {
        TINYFISH_TINYPIPE_URL: "https://tf-tinypipe.fly.dev",
      })?.href,
    ).toBe("https://tf-tinypipe.fly.dev/mcp");
    expect(
      localProductUpstream("tinytail", "/v1/as-of", "", {
        VITE_TINYFISH_JS_01_URL: "https://tf-tinytail.fly.dev",
      })?.href,
    ).toBe("https://tf-tinytail.fly.dev/v1/as-of");
  });
});

describe("product API proxy", () => {
  test("unknown slug is 404", async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error("must not forward an unknown slug");
    };
    const { app } = appWithProducts(fetchImpl);
    const signed = await signIn(app, "tfk.alice");
    const response = await app.request(
      "http://openbot.local/api/products/tinyseventh/health",
      { headers: { cookie: cookieFrom(signed) } },
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Unknown TinyFish product.",
    });
  });

  test("unauthenticated proxy is 401", async () => {
    const { app } = appWithProducts(async () => new Response("no"));
    const response = await app.request(
      "http://openbot.local/api/products/tinypipe/mcp",
    );
    expect(response.status).toBe(401);
  });

  test("forwards the signed-in TinyFish Bearer to 127.0.0.1:hostPort", async () => {
    const calls: { url: string; authorization?: string | null }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("api.sprites.dev") || url.includes("openrouter.ai")) {
        throw new Error("product proxy must stay on localhost");
      }
      const headers = new Headers(init?.headers);
      calls.push({
        url,
        authorization: headers.get("authorization"),
      });
      return new Response(JSON.stringify({ ok: true, product: "tinypipe" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const { app } = appWithProducts(fetchImpl);
    const signed = await signIn(app, "tfk.alice");
    const response = await app.request(
      "http://openbot.local/api/products/tinypipe/mcp",
      {
        method: "POST",
        headers: {
          cookie: cookieFrom(signed),
          "content-type": "application/json",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
      },
    );
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("http://127.0.0.1:3712/mcp");
    expect(calls[0]?.authorization).toBe("Bearer tfk.alice");
  });

  test("TinyTail forwards to the remapped host port, not the native 8765", async () => {
    const urls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      urls.push(String(input));
      return new Response("[]", { status: 200 });
    };
    const { app } = appWithProducts(fetchImpl);
    const signed = await signIn(app, "tfk.alice");
    const response = await app.request(
      "http://openbot.local/api/products/tinytail/v1/as-of",
      { headers: { cookie: cookieFrom(signed) } },
    );
    expect(response.status).toBe(200);
    expect(urls).toEqual(["http://127.0.0.1:18765/v1/as-of"]);
  });

  test("TINYFISH_<SLUG>_URL sends the proxy to Fly, not localhost", async () => {
    const calls: { url: string; authorization?: string | null }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("127.0.0.1")) {
        throw new Error("Fly override must not fall back to localhost");
      }
      const headers = new Headers(init?.headers);
      calls.push({ url, authorization: headers.get("authorization") });
      return new Response("ok", { status: 200 });
    };
    const { app } = appWithProducts(fetchImpl, {
      TINYFISH_TINYPIPE_URL: "https://tf-tinypipe.fly.dev",
    });
    const signed = await signIn(app, "tfk.alice");
    const response = await app.request(
      "http://openbot.local/api/products/tinypipe/mcp",
      {
        method: "POST",
        headers: {
          cookie: cookieFrom(signed),
          "content-type": "application/json",
        },
        body: "{}",
      },
    );
    expect(response.status).toBe(200);
    expect(calls[0]?.url).toBe("https://tf-tinypipe.fly.dev/mcp");
    expect(calls[0]?.authorization).toBe("Bearer tfk.alice");
  });

  test("an unreachable Fly origin is 502, not a thrown failure", async () => {
    const { app } = appWithProducts(async () => {
      throw new Error("tf-tinypipe.fly.dev is not live yet");
    });
    const signed = await signIn(app, "tfk.alice");
    const response = await app.request(
      "http://openbot.local/api/products/tinypipe/health",
      { headers: { cookie: cookieFrom(signed) } },
    );
    expect(response.status).toBe(502);
  });
});

describe("product backend client", () => {
  test("TinyPipe defaults to POST /mcp and TinyTail to GET /v1/as-of", async () => {
    const calls: {
      url: string;
      method: string;
      authorization?: string | null;
    }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        method: (init?.method ?? "GET").toUpperCase(),
        authorization: headers.get("authorization"),
      });
      return new Response("ok", { status: 200 });
    };

    await callProductBackend(
      { slug: "tinypipe", bearer: "tfk.alice", body: { ping: true } },
      fetchImpl,
    );
    await callProductBackend(
      { slug: "tinytail", bearer: "tfk.alice" },
      fetchImpl,
    );
    await callProductBackend(
      { slug: "tinykit", bearer: "tfk.alice" },
      fetchImpl,
    );

    expect(calls).toEqual([
      {
        url: "http://127.0.0.1:3712/mcp",
        method: "POST",
        authorization: "Bearer tfk.alice",
      },
      {
        url: "http://127.0.0.1:18765/v1/as-of",
        method: "GET",
        authorization: "Bearer tfk.alice",
      },
      {
        url: "http://127.0.0.1:18083/",
        method: "GET",
        authorization: "Bearer tfk.alice",
      },
    ]);
  });

  test("unknown slug is 404 and does not fetch", async () => {
    let called = false;
    const result = await callProductBackend(
      { slug: "tinyseventh" },
      async () => {
        called = true;
        return new Response("no");
      },
    );
    expect(result.status).toBe(404);
    expect(called).toBe(false);
  });

  test("only the six built-in slugs get the product-backend tool", () => {
    expect(
      productBackendTools({ botId: "tinypipe", actorId: "tfu_alice" }).map(
        (tool) => tool.name,
      ),
    ).toEqual(["call_product_backend"]);
    expect(
      productBackendTools({ botId: "general-assistant", actorId: "tfu_alice" }),
    ).toEqual([]);
  });
});
