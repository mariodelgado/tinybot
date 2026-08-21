/**
 * TinyFish products as TinyBot publishes them: unique host ports, localhost only.
 *
 * Board cards are the 11 products on the start page. Platform services
 * (TinyPipe, TinyTail, TinyWeb, TinyKit) stay backends TinyBot can start and
 * proxy. Linked services, not packages — do not vendor their trees.
 */

export type TinyFishUsageId =
  | "js-01"
  | "js-03"
  | "tf-02"
  | "tf-03"
  | "tiny-ping"
  | "tiny-trigger"
  | "tiny-reg"
  | "tiny-scout"
  | "tiny-brief"
  | "tiny-deed"
  | "tiny-feed"
  | "tiny-foundry"
  | "tiny-margin"
  | "tiny-atlas"
  | "tiny-prior";

export type TinyFishProductKind = "board" | "platform";

export type TinyFishProduct = {
  usageId: TinyFishUsageId;
  slug: string;
  title: string;
  oneLiner: string;
  repo: string;
  kind: TinyFishProductKind;
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
    usageId: "tf-03",
    slug: "tinypipe",
    title: "TinyPipe",
    oneLiner: "Auth + usage — fixture CIMD, credit pool",
    repo: "mariodelgado/tiny-pipe",
    kind: "platform",
    composeService: "tinyfish-web",
    hostPort: 3712,
    nativePort: 3712,
    path: "/ui",
    healthPath: "/health",
    startOrder: 0,
    hostPortEnv: "TINYPIPE_HOST_PORT",
    nativePortEnv: "TINYPIPE_PORT",
  },
  {
    usageId: "js-01",
    slug: "tinytail",
    title: "TinyTail",
    oneLiner: "As-of store — long-tail facts, read-only",
    repo: "mariodelgado/tiny-tail",
    kind: "platform",
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
    usageId: "js-03",
    slug: "tinyweb",
    title: "TinyWeb",
    oneLiner: "Governed fetch — deny-list still wins",
    repo: "mariodelgado/tiny-web",
    kind: "platform",
    composeService: "tinyfish-web",
    hostPort: 18766,
    nativePort: 8765,
    path: "/ui",
    healthPath: "/health",
    startOrder: 2,
    hostPortEnv: "TINYWEB_HOST_PORT",
    nativePortEnv: "TINYWEB_PORT",
  },
  {
    usageId: "tf-02",
    slug: "tinykit",
    title: "TinyKit",
    oneLiner: "Recipe gallery — failed evals cannot instantiate",
    repo: "mariodelgado/tiny-kit",
    kind: "platform",
    composeService: "gallery",
    hostPort: 18083,
    nativePort: 8080,
    path: "/",
    healthPath: "/health",
    startOrder: 3,
    hostPortEnv: "TINYKIT_HOST_PORT",
    nativePortEnv: "TINYKIT_PORT",
  },
  {
    usageId: "tiny-ping",
    slug: "tinyping",
    title: "TinyPing",
    oneLiner: "Funnel — first",
    repo: "mariodelgado/tiny-ping",
    kind: "board",
    composeService: "tinyping",
    hostPort: 18101,
    nativePort: 8080,
    path: "/ui",
    healthPath: "/health",
    startOrder: 10,
    hostPortEnv: "TINYPING_HOST_PORT",
    nativePortEnv: "TINYPING_PORT",
  },
  {
    usageId: "tiny-trigger",
    slug: "tinytrigger",
    title: "TinyTrigger",
    oneLiner: "Watch / When / Do — T1 required",
    repo: "mariodelgado/tiny-trigger",
    kind: "board",
    composeService: "engine",
    hostPort: 18081,
    nativePort: 8080,
    path: "/",
    healthPath: "/health",
    startOrder: 11,
    hostPortEnv: "TINYTRIGGER_HOST_PORT",
    nativePortEnv: "TINYTRIGGER_PORT",
  },
  {
    usageId: "tiny-reg",
    slug: "tinyreg",
    title: "TinyReg",
    oneLiner: "Registry",
    repo: "mariodelgado/tiny-reg",
    kind: "board",
    composeService: "tinyreg",
    hostPort: 18102,
    nativePort: 8080,
    path: "/ui",
    healthPath: "/health",
    startOrder: 12,
    hostPortEnv: "TINYREG_HOST_PORT",
    nativePortEnv: "TINYREG_PORT",
  },
  {
    usageId: "tiny-scout",
    slug: "tinyscout",
    title: "TinyScout",
    oneLiner: "Scout",
    repo: "mariodelgado/tiny-scout",
    kind: "board",
    composeService: "tinyscout",
    hostPort: 18103,
    nativePort: 8080,
    path: "/ui",
    healthPath: "/health",
    startOrder: 13,
    hostPortEnv: "TINYSCOUT_HOST_PORT",
    nativePortEnv: "TINYSCOUT_PORT",
  },
  {
    usageId: "tiny-brief",
    slug: "tinybrief",
    title: "TinyBrief",
    oneLiner: "Brief",
    repo: "mariodelgado/tiny-brief",
    kind: "board",
    composeService: "tinybrief",
    hostPort: 18104,
    nativePort: 8080,
    path: "/ui",
    healthPath: "/health",
    startOrder: 14,
    hostPortEnv: "TINYBRIEF_HOST_PORT",
    nativePortEnv: "TINYBRIEF_PORT",
  },
  {
    usageId: "tiny-deed",
    slug: "tinydeed",
    title: "TinyDeed",
    oneLiner: "Deed",
    repo: "mariodelgado/tiny-deed",
    kind: "board",
    composeService: "tinydeed",
    hostPort: 18105,
    nativePort: 8080,
    path: "/ui",
    healthPath: "/health",
    startOrder: 15,
    hostPortEnv: "TINYDEED_HOST_PORT",
    nativePortEnv: "TINYDEED_PORT",
  },
  {
    usageId: "tiny-feed",
    slug: "tinyfeed",
    title: "TinyFeed",
    oneLiner: "Event feed — graph is read-only",
    repo: "mariodelgado/tiny-feed",
    kind: "board",
    composeService: "feed",
    hostPort: 18082,
    nativePort: 8080,
    path: "/ui",
    healthPath: "/health",
    startOrder: 16,
    hostPortEnv: "TINYFEED_HOST_PORT",
    nativePortEnv: "TINYFEED_PORT",
  },
  {
    usageId: "tiny-foundry",
    slug: "tinyfoundry",
    title: "TinyFoundry",
    oneLiner: "Foundry",
    repo: "mariodelgado/tiny-foundry",
    kind: "board",
    composeService: "tinyfoundry",
    hostPort: 18106,
    nativePort: 8080,
    path: "/ui",
    healthPath: "/health",
    startOrder: 17,
    hostPortEnv: "TINYFOUNDRY_HOST_PORT",
    nativePortEnv: "TINYFOUNDRY_PORT",
  },
  {
    usageId: "tiny-margin",
    slug: "tinymargin",
    title: "TinyMargin",
    oneLiner: "Margin",
    repo: "mariodelgado/tiny-margin",
    kind: "board",
    composeService: "tinymargin",
    hostPort: 18107,
    nativePort: 8080,
    path: "/ui",
    healthPath: "/health",
    startOrder: 18,
    hostPortEnv: "TINYMARGIN_HOST_PORT",
    nativePortEnv: "TINYMARGIN_PORT",
  },
  {
    usageId: "tiny-atlas",
    slug: "tinyatlas",
    title: "TinyAtlas",
    oneLiner: "Atlas",
    repo: "mariodelgado/tiny-atlas",
    kind: "board",
    composeService: "tinyatlas",
    hostPort: 18108,
    nativePort: 8080,
    path: "/ui",
    healthPath: "/health",
    startOrder: 19,
    hostPortEnv: "TINYATLAS_HOST_PORT",
    nativePortEnv: "TINYATLAS_PORT",
  },
  {
    usageId: "tiny-prior",
    slug: "tinyprior",
    title: "TinyPrior",
    oneLiner: "Prior",
    repo: "mariodelgado/tiny-prior",
    kind: "board",
    composeService: "tinyprior",
    hostPort: 18109,
    nativePort: 8080,
    path: "/ui",
    healthPath: "/health",
    startOrder: 20,
    hostPortEnv: "TINYPRIOR_HOST_PORT",
    nativePortEnv: "TINYPRIOR_PORT",
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

export function boardProductsInStartOrder(): TinyFishProduct[] {
  return productsInStartOrder().filter((product) => product.kind === "board");
}

export function platformProductsInStartOrder(): TinyFishProduct[] {
  return productsInStartOrder().filter(
    (product) => product.kind === "platform",
  );
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
