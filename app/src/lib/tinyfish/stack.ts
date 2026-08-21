/**
 * TinyFish product stack as TinyBot publishes it: unique host ports, localhost only.
 *
 * Product repos keep their native binds (8765 / 8080 / 3712). TinyBot remaps the host side so
 * one `scripts/start.sh` can run all six without collisions. Do not invent a seventh usage id.
 */

export type TinyFishUsageId =
  | "js-01"
  | "js-02"
  | "js-03"
  | "tf-01"
  | "tf-02"
  | "tf-03";

export type TinyFishProduct = {
  usageId: TinyFishUsageId;
  slug: string;
  title: string;
  oneLiner: string;
  repo: string;
  /** Service name in that product's own compose. Wrap this one, not webhook/postgres. */
  composeService: string;
  /** Host port TinyBot publishes and the start-page card opens. */
  hostPort: number;
  /**
   * Port the product already binds inside its own compose / process.
   * Remap only the host publish; do not rewrite the product repo.
   */
  nativePort: number;
  path: string;
  /** Shared contract: GET /health → 200 {ok, product, usage_id}. */
  healthPath: "/health";
  /** Lower starts first. TinyPipe is 0 so the auth socket is up before siblings. */
  startOrder: number;
  hostPortEnv: string;
  nativePortEnv: string;
};

/** TinyBot's own host binds. Product remaps must not reuse these. */
export const TINYBOT_HOST_PORTS = {
  app: 3010,
  server: 3001,
  postgres: 5432,
  computer: 4100,
  bot: 4200,
  langgraph: 4201,
  supervisor: 4500,
} as const;

export const TINYPIPE_MCP_URL = "http://127.0.0.1:3712/mcp";
export const TINYFISH_FIXTURE_ISSUER = "https://issuer.fixtures.tinyfish.test";

export const TINYFISH_PRODUCTS: readonly TinyFishProduct[] = [
  {
    usageId: "js-01",
    slug: "tinytail",
    title: "TinyTail",
    oneLiner: "As-of Explorer — long-tail facts, read-only",
    repo: "mariodelgado/js-01-long-tail-dataset",
    composeService: "ltdf",
    hostPort: 18765,
    nativePort: 8765,
    path: "/ui",
    healthPath: "/health",
    startOrder: 1,
    hostPortEnv: "TINYTAIL_HOST_PORT",
    nativePortEnv: "TINYTAIL_PORT",
  },
  {
    usageId: "js-02",
    slug: "tinypulse",
    title: "TinyPulse",
    oneLiner: "Event Feed — NE Asia LNG, graph is read-only",
    repo: "mariodelgado/js-02-physical-events",
    composeService: "feed",
    hostPort: 18082,
    nativePort: 8080,
    path: "/ui",
    healthPath: "/health",
    startOrder: 2,
    hostPortEnv: "TINYPULSE_HOST_PORT",
    nativePortEnv: "TINYPULSE_PORT",
  },
  {
    usageId: "js-03",
    slug: "tinyweb",
    title: "TinyWeb",
    oneLiner: "Governed Fetch — deny-list still wins",
    repo: "mariodelgado/js-03-governed-web",
    composeService: "tinyfish-web",
    hostPort: 18766,
    nativePort: 8765,
    path: "/ui",
    healthPath: "/health",
    startOrder: 3,
    hostPortEnv: "TINYWEB_HOST_PORT",
    nativePortEnv: "TINYWEB_PORT",
  },
  {
    usageId: "tf-01",
    slug: "tinywatch",
    title: "TinyWatch",
    oneLiner: "Watch / When / Do — T1 required",
    repo: "mariodelgado/tf-01-trigger-rules",
    composeService: "engine",
    hostPort: 18081,
    nativePort: 8080,
    path: "/",
    healthPath: "/health",
    startOrder: 4,
    hostPortEnv: "TINYWATCH_HOST_PORT",
    nativePortEnv: "TINYWATCH_PORT",
  },
  {
    usageId: "tf-02",
    slug: "tinykit",
    title: "TinyKit",
    oneLiner: "Recipe Gallery — failed evals cannot instantiate",
    repo: "mariodelgado/tf-02-recipe-gallery",
    composeService: "gallery",
    hostPort: 18083,
    nativePort: 8080,
    path: "/",
    healthPath: "/health",
    startOrder: 5,
    hostPortEnv: "TINYKIT_HOST_PORT",
    nativePortEnv: "TINYKIT_PORT",
  },
  {
    usageId: "tf-03",
    slug: "tinypipe",
    title: "TinyPipe",
    oneLiner: "Auth + usage console — fixture CIMD, credit pool",
    repo: "mariodelgado/tf-03-mcp-distribution",
    composeService: "tinyfish-web",
    hostPort: 3712,
    nativePort: 3712,
    path: "/ui",
    healthPath: "/health",
    startOrder: 0,
    hostPortEnv: "TINYPIPE_HOST_PORT",
    nativePortEnv: "TINYPIPE_PORT",
  },
];

export function tinyFishProductUrl(product: {
  hostPort: number;
  path: string;
}): string {
  const path = product.path.startsWith("/") ? product.path : `/${product.path}`;
  return `http://127.0.0.1:${product.hostPort}${path}`;
}

/** GET /health on the remapped host port — the consume-path probe, not the UI. */
export function tinyFishProductHealthUrl(product: {
  hostPort: number;
  healthPath?: string;
}): string {
  const path = product.healthPath ?? "/health";
  return `http://127.0.0.1:${product.hostPort}${path}`;
}

export function tinyFishProductBySlug(
  slug: string,
): TinyFishProduct | undefined {
  return TINYFISH_PRODUCTS.find((product) => product.slug === slug);
}

export function productsInStartOrder(): TinyFishProduct[] {
  return [...TINYFISH_PRODUCTS].sort((a, b) => a.startOrder - b.startOrder);
}

export function allStackHostPorts(): number[] {
  return [
    ...Object.values(TINYBOT_HOST_PORTS),
    ...TINYFISH_PRODUCTS.map((product) => product.hostPort),
  ];
}

export function duplicateNumbers(values: readonly number[]): number[] {
  const seen = new Set<number>();
  const duplicates = new Set<number>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates];
}
