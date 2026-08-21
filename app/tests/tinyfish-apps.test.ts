import { describe, expect, test } from "bun:test";
import {
  TINYFISH_APPS,
  type TinyFishUsageId,
  tinyFishAppBySlug,
  tinyFishAppHealthUrl,
  tinyFishAppPath,
  tinyFishAppUrl,
  tinyFishProductApiPath,
} from "../src/lib/tinyfish/apps";

const expected = [
  {
    usageId: "tiny-ping" as const,
    slug: "tinyping",
    title: "TinyPing",
    defaultUrl: "http://127.0.0.1:18101/ui",
  },
  {
    usageId: "tiny-trigger" as const,
    slug: "tinytrigger",
    title: "TinyTrigger",
    defaultUrl: "http://127.0.0.1:18081/",
  },
  {
    usageId: "tiny-reg" as const,
    slug: "tinyreg",
    title: "TinyReg",
    defaultUrl: "http://127.0.0.1:18102/ui",
  },
  {
    usageId: "tiny-scout" as const,
    slug: "tinyscout",
    title: "TinyScout",
    defaultUrl: "http://127.0.0.1:18103/ui",
  },
  {
    usageId: "tiny-brief" as const,
    slug: "tinybrief",
    title: "TinyBrief",
    defaultUrl: "http://127.0.0.1:18104/ui",
  },
  {
    usageId: "tiny-deed" as const,
    slug: "tinydeed",
    title: "TinyDeed",
    defaultUrl: "http://127.0.0.1:18105/ui",
  },
  {
    usageId: "tiny-feed" as const,
    slug: "tinyfeed",
    title: "TinyFeed",
    defaultUrl: "http://127.0.0.1:18082/ui",
  },
  {
    usageId: "tiny-foundry" as const,
    slug: "tinyfoundry",
    title: "TinyFoundry",
    defaultUrl: "http://127.0.0.1:18106/ui",
  },
  {
    usageId: "tiny-margin" as const,
    slug: "tinymargin",
    title: "TinyMargin",
    defaultUrl: "http://127.0.0.1:18107/ui",
  },
  {
    usageId: "tiny-atlas" as const,
    slug: "tinyatlas",
    title: "TinyAtlas",
    defaultUrl: "http://127.0.0.1:18108/ui",
  },
  {
    usageId: "tiny-prior" as const,
    slug: "tinyprior",
    title: "TinyPrior",
    defaultUrl: "http://127.0.0.1:18109/ui",
  },
];

describe("TinyFish start-page catalog", () => {
  test("has the 11 board products, TinyPing first, and no platform cards", () => {
    expect(TINYFISH_APPS).toHaveLength(11);
    expect(TINYFISH_APPS.map((app) => app.slug)).toEqual(
      expected.map((app) => app.slug),
    );
    expect(TINYFISH_APPS[0]?.slug).toBe("tinyping");

    for (const [index, app] of TINYFISH_APPS.entries()) {
      expect(app.title).toBe(expected[index].title);
      expect(app.defaultUrl).toBe(expected[index].defaultUrl);
      expect(app.slug).toBe(expected[index].slug);
      expect(app.usageId).toBe(expected[index].usageId);
    }

    expect(tinyFishAppBySlug("tinypipe")).toBeUndefined();
    expect(tinyFishAppBySlug("tinytail")).toBeUndefined();
    expect(tinyFishAppBySlug("tinyweb")).toBeUndefined();
    expect(tinyFishAppBySlug("tinykit")).toBeUndefined();
    expect(tinyFishAppBySlug("tinywatch")).toBeUndefined();
    expect(tinyFishAppBySlug("tinypulse")).toBeUndefined();

    const usageIds = new Set<TinyFishUsageId>(
      TINYFISH_APPS.map((app) => app.usageId),
    );
    expect(usageIds.size).toBe(11);
  });

  test("maps each board product onto an in-app /apps/$product route", () => {
    for (const app of TINYFISH_APPS) {
      expect(tinyFishAppBySlug(app.slug)).toEqual(app);
      expect(tinyFishAppPath(app)).toBe(`/apps/${app.slug}`);
    }
    expect(tinyFishAppBySlug("unknown")).toBeUndefined();
  });

  test("uses the TinyBot proxy path when a Sprite URL is present", () => {
    const tinyping = tinyFishAppBySlug("tinyping");
    const tinyfeed = tinyFishAppBySlug("tinyfeed");
    if (!tinyping || !tinyfeed) {
      throw new Error("catalog is missing products");
    }
    expect(tinyFishAppUrl(tinyping, null, {})).toBe(
      "http://127.0.0.1:18101/ui",
    );
    expect(
      tinyFishAppUrl(tinyping, {
        url: "https://tinybot-tfu-alice-org.sprites.app",
      }),
    ).toBe("/api/sprite/apps/tinyping/ui");
    expect(
      tinyFishAppUrl(tinyfeed, {
        url: "https://tinybot-tfu-alice-org.sprites.app",
      }),
    ).toBe("/api/sprite/apps/tinyfeed/ui");
  });

  test("card probe is GET /health on the remapped host port, not the UI path", () => {
    const tinyping = tinyFishAppBySlug("tinyping");
    const tinytrigger = tinyFishAppBySlug("tinytrigger");
    const tinyfeed = tinyFishAppBySlug("tinyfeed");
    if (!tinyping || !tinytrigger || !tinyfeed) {
      throw new Error("catalog is missing products");
    }
    expect(tinyFishAppHealthUrl(tinyping, null, {})).toBe(
      "http://127.0.0.1:18101/health",
    );
    expect(tinyFishAppHealthUrl(tinytrigger, null, {})).toBe(
      "http://127.0.0.1:18081/health",
    );
    expect(tinyFishAppHealthUrl(tinyfeed, null, {})).toBe(
      "http://127.0.0.1:18082/health",
    );
    expect(
      tinyFishAppHealthUrl(tinyping, { url: "https://x.sprites.app" }),
    ).toBe("/api/sprite/apps/tinyping/health");
  });

  test("consume path is /api/products/:slug/*", () => {
    expect(tinyFishProductApiPath("tinyping", "/health")).toBe(
      "/api/products/tinyping/health",
    );
    expect(tinyFishProductApiPath("tinypipe", "/mcp")).toBe(
      "/api/products/tinypipe/mcp",
    );
    expect(tinyFishProductApiPath("tinytail", "/v1/as-of")).toBe(
      "/api/products/tinytail/v1/as-of",
    );
  });

  test("Fly / env overrides replace localhost remap on cards and health", () => {
    const tinyping = tinyFishAppBySlug("tinyping");
    if (!tinyping) throw new Error("catalog is missing tinyping");
    const env = { TINYFISH_TINYPING_URL: "https://tf-tinyping.fly.dev" };
    expect(tinyFishAppUrl(tinyping, null, env)).toBe(
      "https://tf-tinyping.fly.dev/ui",
    );
    expect(tinyFishAppHealthUrl(tinyping, null, env)).toBe(
      "https://tf-tinyping.fly.dev/health",
    );
    expect(
      tinyFishAppUrl(tinyping, null, {
        VITE_TINYFISH_TINY_PING_URL: "https://tf-tinyping.fly.dev/ui",
      }),
    ).toBe("https://tf-tinyping.fly.dev/ui");
    expect(tinyFishAppUrl(tinyping, null, {})).toBe(
      "http://127.0.0.1:18101/ui",
    );
  });
});
