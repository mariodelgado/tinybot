/**
 * TinyFish product catalog shown on the TinyBot start page.
 *
 * Defaults are the remapped TinyBot host ports. Override a URL with
 * `VITE_TINYFISH_<USAGE>_URL` (for example `VITE_TINYFISH_JS_01_URL`) when a
 * process is bound somewhere else. Cards show Unreachable if that process is down.
 */

import {
  TINYFISH_PRODUCTS,
  type TinyFishUsageId,
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

export const TINYFISH_APPS: readonly TinyFishApp[] = TINYFISH_PRODUCTS.map(
  (product) => ({
    usageId: product.usageId,
    slug: product.slug,
    title: product.title,
    oneLiner: product.oneLiner,
    defaultUrl: tinyFishProductUrl(product),
    repo: product.repo,
    path: product.path,
  }),
);

export type TinyFishSpriteHint = {
  url?: string;
};

export function tinyFishSpriteProxyPath(app: TinyFishApp): string {
  const path = app.path.startsWith("/") ? app.path : `/${app.path}`;
  return `/api/sprite/apps/${app.slug}${path}`;
}

const ENV_URL_KEYS: Record<TinyFishUsageId, string> = {
  "js-01": "VITE_TINYFISH_JS_01_URL",
  "js-02": "VITE_TINYFISH_JS_02_URL",
  "js-03": "VITE_TINYFISH_JS_03_URL",
  "tf-01": "VITE_TINYFISH_TF_01_URL",
  "tf-02": "VITE_TINYFISH_TF_02_URL",
  "tf-03": "VITE_TINYFISH_TF_03_URL",
};

function envUrlOverride(usageId: TinyFishUsageId): string | undefined {
  const key = ENV_URL_KEYS[usageId];
  const env = (import.meta as ImportMeta & { env?: Record<string, unknown> })
    .env;
  const value = env?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

/**
 * Resolved embed URL. A signed-in Sprite assignment uses TinyBot's authenticated
 * proxy. Otherwise the remapped localhost catalog (or a VITE override).
 */
export function tinyFishAppUrl(
  app: TinyFishApp,
  sprite?: TinyFishSpriteHint | null,
): string {
  if (sprite?.url) {
    return tinyFishSpriteProxyPath(app);
  }
  return envUrlOverride(app.usageId) ?? app.defaultUrl;
}

export function tinyFishAppBySlug(slug: string): TinyFishApp | undefined {
  return TINYFISH_APPS.find((app) => app.slug === slug);
}

export function tinyFishAppPath(app: TinyFishApp): `/apps/${string}` {
  return `/apps/${app.slug}`;
}
