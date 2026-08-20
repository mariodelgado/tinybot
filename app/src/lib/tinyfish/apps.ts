/**
 * TinyFish product catalog shown on the TinyBot start page.
 *
 * URLs are localhost defaults. Several products share :8080 / :8765 today; do not rewrite those
 * repos. Override a URL here, or with `VITE_TINYFISH_<USAGE>_URL` (for example
 * `VITE_TINYFISH_JS_01_URL`), when the process is bound to a different port.
 */

export type TinyFishUsageId =
  | "js-01"
  | "js-02"
  | "js-03"
  | "tf-01"
  | "tf-02"
  | "tf-03";

export type TinyFishApp = {
  usageId: TinyFishUsageId;
  slug: string;
  title: string;
  oneLiner: string;
  defaultUrl: string;
  repo: string;
};

export const TINYFISH_APPS: readonly TinyFishApp[] = [
  {
    usageId: "js-01",
    slug: "tinytail",
    title: "TinyTail",
    oneLiner: "As-of Explorer — long-tail facts, read-only",
    defaultUrl: "http://127.0.0.1:8765/ui",
    repo: "mariodelgado/js-01-long-tail-dataset",
  },
  {
    usageId: "js-02",
    slug: "tinypulse",
    title: "TinyPulse",
    oneLiner: "Event Feed — NE Asia LNG, graph is read-only",
    defaultUrl: "http://127.0.0.1:8080/ui",
    repo: "mariodelgado/js-02-physical-events",
  },
  {
    usageId: "js-03",
    slug: "tinyweb",
    title: "TinyWeb",
    oneLiner: "Governed Fetch — deny-list still wins",
    defaultUrl: "http://127.0.0.1:8765/ui",
    repo: "mariodelgado/js-03-governed-web",
  },
  {
    usageId: "tf-01",
    slug: "tinywatch",
    title: "TinyWatch",
    oneLiner: "Watch / When / Do — T1 required",
    defaultUrl: "http://127.0.0.1:8080/",
    repo: "mariodelgado/tf-01-trigger-rules",
  },
  {
    usageId: "tf-02",
    slug: "tinykit",
    title: "TinyKit",
    oneLiner: "Recipe Gallery — failed evals cannot instantiate",
    defaultUrl: "http://127.0.0.1:8080/",
    repo: "mariodelgado/tf-02-recipe-gallery",
  },
  {
    usageId: "tf-03",
    slug: "tinypipe",
    title: "TinyPipe",
    oneLiner: "Auth + usage console — fixture CIMD, credit pool",
    defaultUrl: "http://127.0.0.1:3712/ui",
    repo: "mariodelgado/tf-03-mcp-distribution",
  },
];

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

/** Resolved embed URL: env override if set, otherwise the catalog default. */
export function tinyFishAppUrl(app: TinyFishApp): string {
  return envUrlOverride(app.usageId) ?? app.defaultUrl;
}

export function tinyFishAppBySlug(slug: string): TinyFishApp | undefined {
  return TINYFISH_APPS.find((app) => app.slug === slug);
}

export function tinyFishAppPath(app: TinyFishApp): `/apps/${string}` {
  return `/apps/${app.slug}`;
}
