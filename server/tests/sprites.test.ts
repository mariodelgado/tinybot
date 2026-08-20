import { describe, expect, test } from "bun:test";
import { TINYFISH_APPS, tinyFishAppUrl } from "../../app/src/lib/tinyfish/apps";
import { TINYFISH_PRODUCTS } from "../../app/src/lib/tinyfish/stack";
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
  createMemorySpriteStore,
  createSpriteProvisioner,
  createSpritesClient,
  httpPortOwners,
  SPRITE_GATEWAY_NAME,
  SPRITE_GATEWAY_PORT,
  SPRITE_PRODUCTS,
  type SpriteRecord,
  type SpriteService,
  type SpriteServiceRequest,
  spriteNameFor,
  spriteServiceDefinitions,
} from "../src/sprites";
import { testEnvironment } from "./support/environment";

const encryptionKey = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const API = "https://sprites.test/v1";

function fixtureVerifier() {
  return {
    verify: async (token: string) => {
      const claims = fixtureClaimsFor(normalizeTinyFishToken(token));
      if (!claims) throw new TinyFishUnauthenticatedError();
      return claims;
    },
  };
}

type RecordedCall = {
  method: string;
  url: string;
  body?: unknown;
};

function mockSpritesApi() {
  const sprites = new Map<string, SpriteRecord>();
  const services = new Map<string, Map<string, SpriteService>>();
  const calls: RecordedCall[] = [];

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("api.sprites.dev")) {
      throw new Error("tests must not call api.sprites.dev");
    }
    const method = (init?.method ?? "GET").toUpperCase();
    const bodyText = typeof init?.body === "string" ? init.body : undefined;
    const parsed = bodyText ? (JSON.parse(bodyText) as unknown) : undefined;
    calls.push({ method, url, body: parsed });

    const spriteMatch = url.match(/\/sprites\/([^/?]+)(?:\/|$|\?)/);
    const collection = /\/sprites$/.test(new URL(url).pathname);

    if (method === "POST" && collection) {
      const name = (parsed as { name: string }).name;
      const auth = (parsed as { url_settings?: { auth?: string } }).url_settings
        ?.auth;
      if (auth !== "sprite") {
        return new Response("auth must be sprite", { status: 400 });
      }
      const record: SpriteRecord = {
        id: `spr_${name}`,
        name,
        organization: "org_test",
        url: `https://${name}-org_test.sprites.app`,
        url_settings: { auth: "sprite" },
        status: "cold",
      };
      sprites.set(name, record);
      services.set(name, new Map());
      return Response.json(record, { status: 201 });
    }

    const name = spriteMatch ? decodeURIComponent(spriteMatch[1] ?? "") : "";
    const serviceMatch = url.match(/\/services\/([^/?]+)/);

    if (method === "GET" && spriteMatch && !url.includes("/services")) {
      const record = sprites.get(name);
      return record
        ? Response.json(record)
        : new Response("missing", { status: 404 });
    }

    if (method === "GET" && url.includes("/services") && !serviceMatch) {
      return Response.json([...(services.get(name)?.values() ?? [])]);
    }

    if (method === "PUT" && serviceMatch) {
      const serviceName = decodeURIComponent(serviceMatch[1] ?? "");
      const bag = services.get(name) ?? new Map();
      const request = parsed as SpriteServiceRequest;
      const existingHttp = [...bag.values()].find(
        (service) => service.http_port != null && service.name !== serviceName,
      );
      if (request.http_port != null && existingHttp) {
        return new Response(
          JSON.stringify({
            error: "another service already has an HTTP port configured",
          }),
          { status: 409 },
        );
      }
      bag.set(serviceName, { name: serviceName, ...request });
      services.set(name, bag);
      return Response.json({ name: serviceName, ...request });
    }

    if (method === "POST" && url.includes("/exec")) {
      return new Response("ok", { status: 200 });
    }

    return new Response("unhandled", { status: 500 });
  };

  return { fetch: fetchImpl, calls, sprites };
}

function authWithSprites(fetchImpl: typeof fetch, token?: string) {
  const profiles = createMemoryTinyFishProfileStore();
  const assignments = createMemorySpriteStore();
  const client = token
    ? createSpritesClient({ token, apiUrl: API, fetch: fetchImpl })
    : undefined;
  const provisioner = createSpriteProvisioner({
    ...(client ? { client } : {}),
    assignments,
  });
  const service = createTinyFishAuthService({
    verifier: fixtureVerifier(),
    profiles,
    sessions: createMemoryTinyFishSessionStore(encryptionKey),
    rolesForUser: async () => ["user"],
    provisionSprite: (userId) => provisioner.ensure(userId),
    sprites: assignments,
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
    {
      assignments,
      ...(token ? { token } : {}),
      fetch: fetchImpl,
    },
  );
  return { app, assignments, service };
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

describe("Sprite names", () => {
  test("tfu_alice becomes a stable legal name", () => {
    expect(spriteNameFor("tfu_alice")).toBe("tinybot-tfu-alice");
    expect(spriteNameFor("tfu_alice")).toBe(spriteNameFor("tfu_alice"));
  });

  test("ugly ids are hashed and two users never collide", () => {
    const ugly = spriteNameFor("!!!User With Spaces!!!");
    expect(ugly).toMatch(/^tinybot-[a-z0-9-]+$/);
    expect(ugly.length).toBeLessThanOrEqual(40);
    expect(spriteNameFor("tfu_alice")).not.toBe(spriteNameFor("tfu-alice"));
    expect(spriteNameFor("a".repeat(80))).not.toBe(
      spriteNameFor(`b${"a".repeat(80)}`),
    );
    expect(spriteNameFor("a".repeat(80)).length).toBeLessThanOrEqual(40);
  });
});

describe("Sprite service payloads", () => {
  test("exactly one service owns http_port, and it is the gateway on 8080", () => {
    const services = spriteServiceDefinitions();
    expect(httpPortOwners(services)).toEqual([SPRITE_GATEWAY_NAME]);
    expect(
      services.find((service) => service.name === SPRITE_GATEWAY_NAME)?.body
        .http_port,
    ).toBe(SPRITE_GATEWAY_PORT);
    for (const product of SPRITE_PRODUCTS) {
      expect(
        services.find((service) => service.name === product.slug)?.body
          .http_port,
      ).toBeUndefined();
    }
  });

  test("in-sprite listen ports match the TinyBot remapped catalog", () => {
    for (const product of TINYFISH_PRODUCTS) {
      const sprite = SPRITE_PRODUCTS.find((item) => item.slug === product.slug);
      expect(sprite?.listenPort).toBe(product.hostPort);
      expect(sprite?.path).toBe(product.path);
    }
  });
});

describe("Sprite provision on TinyFish sign-in", () => {
  test("first sign-in creates a sprite with auth=sprite and stores the url", async () => {
    const api = mockSpritesApi();
    const { app } = authWithSprites(api.fetch, "test-token");

    const response = await signIn(app, "tfk.alice");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      user: { tinyfishUserId: string; sprite: { name: string; url: string } };
    };
    expect(body.user.tinyfishUserId).toBe("tfu_alice");
    expect(body.user.sprite.name).toBe("tinybot-tfu-alice");
    expect(body.user.sprite.url).toBe(
      "https://tinybot-tfu-alice-org_test.sprites.app",
    );

    const creates = api.calls.filter(
      (call) => call.method === "POST" && call.url === `${API}/sprites`,
    );
    expect(creates).toHaveLength(1);
    expect(creates[0]?.body).toEqual({
      name: "tinybot-tfu-alice",
      url_settings: { auth: "sprite" },
    });

    const puts = api.calls.filter((call) => call.method === "PUT");
    expect(puts.length).toBeGreaterThanOrEqual(7);
    const httpPorts = puts.filter(
      (call) =>
        typeof call.body === "object" &&
        call.body !== null &&
        "http_port" in call.body,
    );
    expect(httpPorts).toHaveLength(1);
    expect(httpPorts[0]?.body).toMatchObject({ http_port: 8080 });
    expect(api.calls.some((call) => call.url.includes("api.sprites.dev"))).toBe(
      false,
    );
  });

  test("second sign-in reuses the sprite and does not POST create again", async () => {
    const api = mockSpritesApi();
    const { app } = authWithSprites(api.fetch, "test-token");

    expect((await signIn(app, "tfk.alice")).status).toBe(200);
    const before = api.calls.filter(
      (call) => call.method === "POST" && call.url === `${API}/sprites`,
    ).length;
    expect((await signIn(app, "tfk.alice")).status).toBe(200);
    const after = api.calls.filter(
      (call) => call.method === "POST" && call.url === `${API}/sprites`,
    ).length;
    expect(after).toBe(before);
  });

  test("unset token signs in, makes no Sprites calls, and cards stay on localhost", async () => {
    let called = false;
    const fetchImpl: typeof fetch = async () => {
      called = true;
      throw new Error("Sprites fetch must not run without a token");
    };
    const { app } = authWithSprites(fetchImpl);

    const response = await signIn(app, "tfk.alice");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      user: { tinyfishUserId: string; sprite?: unknown };
    };
    expect(body.user.tinyfishUserId).toBe("tfu_alice");
    expect(body.user.sprite).toBeUndefined();
    expect(called).toBe(false);

    const tinypipe = TINYFISH_APPS.find(
      (appItem) => appItem.slug === "tinypipe",
    );
    if (!tinypipe) throw new Error("tinypipe missing");
    expect(tinyFishAppUrl(tinypipe)).toBe("http://127.0.0.1:3712/ui");
    expect(tinyFishAppUrl(tinypipe, { url: "https://x.sprites.app" })).toBe(
      "/api/sprite/apps/tinypipe/ui",
    );
  });
});

describe("Sprite proxy isolation", () => {
  test("unauthenticated proxy is 401", async () => {
    const api = mockSpritesApi();
    const { app } = authWithSprites(api.fetch, "test-token");
    const response = await app.request(
      "http://openbot.local/api/sprite/apps/tinypipe/ui",
    );
    expect(response.status).toBe(401);
  });

  test("session user A cannot fetch user B's sprite", async () => {
    const upstream: string[] = [];
    const api = mockSpritesApi();
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.startsWith(API)) {
        return api.fetch(input, init);
      }
      upstream.push(url);
      return new Response("ok");
    };
    const { app } = authWithSprites(fetchImpl, "test-token");

    const alice = await signIn(app, "tfk.alice");
    const exhausted = await signIn(app, "tfk.exhausted");
    expect(alice.status).toBe(200);
    expect(exhausted.status).toBe(200);

    const asAlice = await app.request(
      "http://openbot.local/api/sprite/apps/tinypipe/ui",
      { headers: { cookie: cookieFrom(alice) } },
    );
    expect(asAlice.status).toBe(200);
    expect(upstream.at(-1)).toContain("tinybot-tfu-alice");
    expect(upstream.at(-1)).not.toContain("tinybot-tfu-exhausted");

    const asExhausted = await app.request(
      "http://openbot.local/api/sprite/apps/tinypipe/ui",
      { headers: { cookie: cookieFrom(exhausted) } },
    );
    expect(asExhausted.status).toBe(200);
    expect(upstream.at(-1)).toContain("tinybot-tfu-exhausted");
  });

  test("proxy without a token is 503", async () => {
    const { app, service } = authWithSprites(async () => new Response("no"));
    const signed = await signIn(app, "tfk.alice");
    const response = await app.request(
      "http://openbot.local/api/sprite/apps/tinypipe/ui",
      { headers: { cookie: cookieFrom(signed) } },
    );
    expect(response.status).toBe(503);
    expect(await service.actorFromHeaders(new Headers())).toBeNull();
  });
});

describe("Sprites configuration", () => {
  test("SPRITES_TOKEN or SPRITE_TOKEN enables the client; unset stays local", () => {
    const base = {
      ...testEnvironment(),
    };
    expect(loadConfig(base).sprites).toBeUndefined();
    expect(
      loadConfig({ ...base, SPRITES_TOKEN: "from-sprites" }).sprites,
    ).toEqual({
      token: "from-sprites",
      apiUrl: "https://api.sprites.dev/v1",
    });
    expect(
      loadConfig({ ...base, SPRITE_TOKEN: "from-sprite" }).sprites?.token,
    ).toBe("from-sprite");
  });
});
