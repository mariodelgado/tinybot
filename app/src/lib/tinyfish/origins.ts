/**
 * Where TinyBot talks to a product: localhost remap, or a URL override (Fly).
 *
 * Products are linked services, not packages. Do not vendor their trees.
 * Unset env keeps 127.0.0.1:<hostPort> for scripts/start.sh.
 */

import {
  TINYFISH_PRODUCTS,
  type TinyFishProduct,
  type TinyFishUsageId,
  tinyFishProductBySlug,
  tinyFishProductHealthUrl,
  tinyFishProductUrl,
} from "./stack";

/** Optional Fly Machine names (sjc, one each, --ha=false). Not defaults. */
export const TINYFISH_FLY_MACHINES = {
  tinypipe: {
    app: "tf-tinypipe",
    url: "https://tf-tinypipe.fly.dev",
    mcpPublic: "https://tf-tinypipe.fly.dev/mcp",
    mcpInternal: "http://tf-tinypipe.internal:8080/mcp",
  },
  tinytail: { app: "tf-tinytail", url: "https://tf-tinytail.fly.dev" },
  tinyweb: { app: "tf-tinyweb", url: "https://tf-tinyweb.fly.dev" },
  tinykit: { app: "tf-tinykit", url: "https://tf-tinykit.fly.dev" },
  tinyping: { app: "tf-tinyping", url: "https://tf-tinyping.fly.dev" },
  tinytrigger: { app: "tf-tinytrigger", url: "https://tf-tinytrigger.fly.dev" },
  tinyreg: { app: "tf-tinyreg", url: "https://tf-tinyreg.fly.dev" },
  tinyscout: { app: "tf-tinyscout", url: "https://tf-tinyscout.fly.dev" },
  tinybrief: { app: "tf-tinybrief", url: "https://tf-tinybrief.fly.dev" },
  tinydeed: { app: "tf-tinydeed", url: "https://tf-tinydeed.fly.dev" },
  tinyfeed: { app: "tf-tinyfeed", url: "https://tf-tinyfeed.fly.dev" },
  tinyfoundry: { app: "tf-tinyfoundry", url: "https://tf-tinyfoundry.fly.dev" },
  tinymargin: { app: "tf-tinymargin", url: "https://tf-tinymargin.fly.dev" },
  tinyatlas: { app: "tf-tinyatlas", url: "https://tf-tinyatlas.fly.dev" },
  tinyprior: { app: "tf-tinyprior", url: "https://tf-tinyprior.fly.dev" },
} as const;

export type EnvBag = Record<string, string | undefined>;

export function slugUrlEnvKey(slug: string): string {
  return `TINYFISH_${slug.replace(/-/g, "_").toUpperCase()}_URL`;
}

export function usageUrlEnvKey(usageId: TinyFishUsageId): string {
  return `VITE_TINYFISH_${usageId.toUpperCase().replace("-", "_")}_URL`;
}

export function productUrlEnvKeys(product: {
  slug: string;
  usageId: TinyFishUsageId;
}): { slug: string; usage: string } {
  return {
    slug: slugUrlEnvKey(product.slug),
    usage: usageUrlEnvKey(product.usageId),
  };
}

function trimmed(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

/** TINYFISH_<SLUG>_URL wins over VITE_TINYFISH_<USAGE>_URL. */
export function productUrlOverride(
  product: { slug: string; usageId: TinyFishUsageId },
  env: EnvBag = {},
): string | undefined {
  const keys = productUrlEnvKeys(product);
  return trimmed(env[keys.slug]) ?? trimmed(env[keys.usage]);
}

export function isRemoteProductUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname;
    return hostname !== "127.0.0.1" && hostname !== "localhost";
  } catch {
    return false;
  }
}

export function resolveProductOrigin(
  product: TinyFishProduct,
  env: EnvBag = {},
): string {
  const override = productUrlOverride(product, env);
  if (!override) {
    return `http://127.0.0.1:${product.hostPort}`;
  }
  try {
    return new URL(override).origin;
  } catch {
    return override.replace(/\/+$/, "");
  }
}

export function resolveProductCardUrl(
  product: TinyFishProduct,
  env: EnvBag = {},
): string {
  const override = productUrlOverride(product, env);
  if (!override) {
    return tinyFishProductUrl(product);
  }
  try {
    const url = new URL(override);
    if (url.pathname === "/" || url.pathname === "") {
      const path = product.path.startsWith("/")
        ? product.path
        : `/${product.path}`;
      url.pathname = path;
    }
    return url.toString();
  } catch {
    return override;
  }
}

export function resolveProductHealthUrl(
  product: TinyFishProduct,
  env: EnvBag = {},
): string {
  const override = productUrlOverride(product, env);
  if (!override) {
    return tinyFishProductHealthUrl(product);
  }
  const path = product.healthPath ?? "/health";
  return `${resolveProductOrigin(product, env)}${path}`;
}

export function productUpstream(
  slug: string,
  restPath: string,
  search = "",
  env: EnvBag = {},
): URL | undefined {
  const product = tinyFishProductBySlug(slug);
  if (!product) return undefined;
  const suffix = restPath.length > 0 ? restPath : "/";
  const path = suffix.startsWith("/") ? suffix : `/${suffix}`;
  const origin = resolveProductOrigin(product, env);
  const upstream = new URL(`${origin}${path}`);
  if (search) {
    upstream.search = search.startsWith("?") ? search.slice(1) : search;
  }
  return upstream;
}

export function productsUsingRemoteUrl(env: EnvBag = {}): TinyFishProduct[] {
  return TINYFISH_PRODUCTS.filter((product) =>
    isRemoteProductUrl(productUrlOverride(product, env)),
  );
}
