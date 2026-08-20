import { describe, expect, test } from "bun:test";
import {
  TINYFISH_APPS,
  type TinyFishUsageId,
  tinyFishAppBySlug,
  tinyFishAppPath,
  tinyFishAppUrl,
} from "../src/lib/tinyfish/apps";

const expected = [
  {
    usageId: "js-01" as const,
    slug: "tinytail",
    title: "TinyTail",
    oneLiner: "As-of Explorer — long-tail facts, read-only",
    defaultUrl: "http://127.0.0.1:18765/ui",
  },
  {
    usageId: "js-02" as const,
    slug: "tinypulse",
    title: "TinyPulse",
    oneLiner: "Event Feed — NE Asia LNG, graph is read-only",
    defaultUrl: "http://127.0.0.1:18082/ui",
  },
  {
    usageId: "js-03" as const,
    slug: "tinyweb",
    title: "TinyWeb",
    oneLiner: "Governed Fetch — deny-list still wins",
    defaultUrl: "http://127.0.0.1:18766/ui",
  },
  {
    usageId: "tf-01" as const,
    slug: "tinywatch",
    title: "TinyWatch",
    oneLiner: "Watch / When / Do — T1 required",
    defaultUrl: "http://127.0.0.1:18081/",
  },
  {
    usageId: "tf-02" as const,
    slug: "tinykit",
    title: "TinyKit",
    oneLiner: "Recipe Gallery — failed evals cannot instantiate",
    defaultUrl: "http://127.0.0.1:18083/",
  },
  {
    usageId: "tf-03" as const,
    slug: "tinypipe",
    title: "TinyPipe",
    oneLiner: "Auth + usage console — fixture CIMD, credit pool",
    defaultUrl: "http://127.0.0.1:3712/ui",
  },
];

describe("TinyFish start-page catalog", () => {
  test("has exactly these six products with those default URLs", () => {
    expect(TINYFISH_APPS).toHaveLength(6);
    expect(TINYFISH_APPS.map((app) => app.usageId)).toEqual(
      expected.map((app) => app.usageId),
    );

    for (const [index, app] of TINYFISH_APPS.entries()) {
      expect(app.title).toBe(expected[index].title);
      expect(app.oneLiner).toBe(expected[index].oneLiner);
      expect(app.defaultUrl).toBe(expected[index].defaultUrl);
      expect(app.slug).toBe(expected[index].slug);
      expect(app.usageId).toBe(expected[index].usageId);
    }

    const usageIds = new Set<TinyFishUsageId>(
      TINYFISH_APPS.map((app) => app.usageId),
    );
    expect(usageIds.size).toBe(6);
  });

  test("maps each product onto an in-app /apps/$product route", () => {
    for (const app of TINYFISH_APPS) {
      expect(tinyFishAppBySlug(app.slug)).toEqual(app);
      expect(tinyFishAppPath(app)).toBe(`/apps/${app.slug}`);
    }
    expect(tinyFishAppBySlug("unknown")).toBeUndefined();
  });

  test("uses the TinyBot proxy path when a Sprite URL is present", () => {
    const tinypipe = tinyFishAppBySlug("tinypipe");
    const tinytail = tinyFishAppBySlug("tinytail");
    if (!tinypipe || !tinytail) {
      throw new Error("catalog is missing products");
    }
    expect(tinyFishAppUrl(tinypipe)).toBe("http://127.0.0.1:3712/ui");
    expect(
      tinyFishAppUrl(tinypipe, {
        url: "https://tinybot-tfu-alice-org.sprites.app",
      }),
    ).toBe("/api/sprite/apps/tinypipe/ui");
    expect(
      tinyFishAppUrl(tinytail, {
        url: "https://tinybot-tfu-alice-org.sprites.app",
      }),
    ).toBe("/api/sprite/apps/tinytail/ui");
  });
});
