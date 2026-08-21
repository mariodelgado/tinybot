/**
 * TinyFish product catalog shown on the TinyBot start page.
 *
 * One card per TinyBot primitive: the eleven board products, then TinyPipe,
 * TinyTail, TinyWeb, TinyKit after TinyPrior. Defaults are the remapped TinyBot
 * host ports. Override with `TINYFISH_<SLUG>_URL` or `VITE_TINYFISH_<USAGE>_URL`
 * (Fly). Cards show Unreachable if that process is down; they still open the
 * shell route.
 */

import {
  type EnvBag,
  resolveProductCardUrl,
  resolveProductHealthUrl,
} from "./origins";
import {
  primitiveProductsInCardOrder,
  type TinyFishUsageId,
  tinyFishProductBySlug,
  tinyFishProductUrl,
} from "./stack";

export type { TinyFishUsageId };

export type TinyFishApp = {
  usageId: TinyFishUsageId;
  slug: string;
  title: string;
  oneLiner: string;
  defaultUrl: string;
  repo: string;
  path: string;
};

export const TINYFISH_APPS: readonly TinyFishApp[] =
  primitiveProductsInCardOrder().map((product) => ({
    usageId: product.usageId,
    slug: product.slug,
    title: product.title,
    oneLiner: product.oneLiner,
    defaultUrl: tinyFishProductUrl(product),
    repo: product.repo,
    path: product.path,
  }));

export type TinyFishSpriteHint = {
  url?: string;
};

export function tinyFishSpriteProxyPath(app: TinyFishApp): string {
  const path = app.path.startsWith("/") ? app.path : `/${app.path}`;
  return `/api/sprite/apps/${app.slug}${path}`;
}

function readEnvBag(explicit?: EnvBag): EnvBag {
  if (explicit) return explicit;
  const vite = (import.meta as ImportMeta & { env?: Record<string, unknown> })
    .env;
  const fromVite: EnvBag = {};
  for (const [key, value] of Object.entries(vite ?? {})) {
    if (typeof value === "string") {
      fromVite[key] = value;
    }
  }
  const fromProcess =
    typeof process !== "undefined" ? (process.env as EnvBag) : {};
  return { ...fromProcess, ...fromVite };
}

/**
 * Resolved embed URL. A signed-in Sprite assignment uses TinyBot's authenticated
 * proxy. Otherwise a Fly/env override, or the remapped localhost catalog.
 */
export function tinyFishAppUrl(
  app: TinyFishApp,
  sprite?: TinyFishSpriteHint | null,
  env?: EnvBag,
): string {
  if (sprite?.url) {
    return tinyFishSpriteProxyPath(app);
  }
  const product = tinyFishProductBySlug(app.slug);
  return product
    ? resolveProductCardUrl(product, readEnvBag(env))
    : app.defaultUrl;
}

export function tinyFishAppBySlug(slug: string): TinyFishApp | undefined {
  return TINYFISH_APPS.find((app) => app.slug === slug);
}

export function tinyFishAppPath(app: TinyFishApp): `/apps/${string}` {
  return `/apps/${app.slug}`;
}

/** Card / wait probe: GET /health on the origin (Fly override or remapped host). */
export function tinyFishAppHealthUrl(
  app: TinyFishApp,
  sprite?: TinyFishSpriteHint | null,
  env?: EnvBag,
): string {
  if (sprite?.url) {
    return `/api/sprite/apps/${app.slug}/health`;
  }
  const product = tinyFishProductBySlug(app.slug);
  return product
    ? resolveProductHealthUrl(product, readEnvBag(env))
    : `http://127.0.0.1/${app.slug}/health`;
}

/** How TinyBot agents consume a product backend when there is no Sprite. */
export function tinyFishProductApiPath(
  slug: string,
  path = "/",
): `/api/products/${string}` {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `/api/products/${slug}${suffix}`;
}
