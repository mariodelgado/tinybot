import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TINYFISH_APPS } from "../app/src/lib/tinyfish/apps";
import {
  allStackHostPorts,
  boardProductsInStartOrder,
  duplicateNumbers,
  platformProductsInStartOrder,
  productsInStartOrder,
  TINYBOT_HOST_PORTS,
  TINYFISH_FIXTURE_ISSUER,
  TINYFISH_PRODUCTS,
  TINYPIPE_MCP_URL,
  tinyFishProductBySlug,
  tinyFishProductHealthUrl,
  tinyFishProductUrl,
} from "../app/src/lib/tinyfish/stack";
import {
  candidateCheckoutDirs,
  hostPortsFromComposeYaml,
  remapComposeServices,
  uiPublishBinding,
} from "../scripts/tinyfish/ports";

const root = join(import.meta.dir, "..");

test("TinyBot and product host ports are unique", () => {
  const ports = allStackHostPorts();
  expect(duplicateNumbers(ports)).toEqual([]);
  expect(new Set(ports).size).toBe(ports.length);
  expect(TINYBOT_HOST_PORTS).toEqual({
    app: 3010,
    server: 3001,
    postgres: 5432,
    computer: 4100,
    bot: 4200,
    langgraph: 4201,
    supervisor: 4500,
  });
});

test("board is 11 cards TinyPing first; platform backends are not cards", () => {
  expect(TINYFISH_PRODUCTS).toHaveLength(15);
  expect(TINYFISH_APPS).toHaveLength(11);
  expect(boardProductsInStartOrder().map((product) => product.slug)).toEqual([
    "tinyping",
    "tinytrigger",
    "tinyreg",
    "tinyscout",
    "tinybrief",
    "tinydeed",
    "tinyfeed",
    "tinyfoundry",
    "tinymargin",
    "tinyatlas",
    "tinyprior",
  ]);
  expect(platformProductsInStartOrder().map((product) => product.slug)).toEqual(
    ["tinypipe", "tinytail", "tinyweb", "tinykit"],
  );
  expect(
    platformProductsInStartOrder().map((product) => product.repo),
  ).toEqual([
    "mariodelgado/tiny-pipe",
    "mariodelgado/tiny-tail",
    "mariodelgado/tiny-web",
    "mariodelgado/tiny-kit",
  ]);
  expect(
    TINYFISH_PRODUCTS.some((product) => product.slug === "tinywatch"),
  ).toBe(false);
  expect(
    TINYFISH_PRODUCTS.some((product) => product.slug === "tinypulse"),
  ).toBe(false);
  expect(tinyFishProductBySlug("tinypipe")?.usageId).toBe("tf-03");
  expect(tinyFishProductBySlug("tinytail")?.usageId).toBe("js-01");
  expect(tinyFishProductBySlug("tinyweb")?.usageId).toBe("js-03");
  expect(tinyFishProductBySlug("tinykit")?.usageId).toBe("tf-02");

  for (const product of TINYFISH_PRODUCTS) {
    expect(product.repo).toStartWith("mariodelgado/");
    expect(tinyFishProductHealthUrl(product)).toBe(
      `http://127.0.0.1:${product.hostPort}/health`,
    );
    const card = TINYFISH_APPS.find((app) => app.slug === product.slug);
    if (product.kind === "board") {
      expect(card?.defaultUrl).toBe(tinyFishProductUrl(product));
    } else {
      expect(card).toBeUndefined();
    }
  }

  expect(tinyFishProductBySlugPort("tinytrigger")).toBe(18081);
  expect(tinyFishProductBySlugPort("tinyfeed")).toBe(18082);
  expect(tinyFishProductBySlugPort("tinyping")).toBe(18101);
});

function tinyFishProductBySlugPort(slug: string): number | undefined {
  return TINYFISH_PRODUCTS.find((product) => product.slug === slug)?.hostPort;
}

test("TinyPipe starts first and remains the auth socket on 3712", () => {
  const order = productsInStartOrder();
  expect(order[0]?.slug).toBe("tinypipe");
  expect(order[0]?.hostPort).toBe(3712);
  expect(TINYPIPE_MCP_URL).toBe("http://127.0.0.1:3712/mcp");
  expect(TINYFISH_FIXTURE_ISSUER).toBe("https://issuer.fixtures.tinyfish.test");
});

test("compose overlay publishes buildable products on remapped loopback ports", () => {
  const compose = readFileSync(
    join(root, "docker-compose.tinyfish.yml"),
    "utf8",
  );
  const published = hostPortsFromComposeYaml(compose);

  expect(published).toEqual([3712, 18765, 18766, 18083, 18081, 18082]);
  expect(duplicateNumbers(published)).toEqual([]);
  expect(
    published.some((port) => Object.values(TINYBOT_HOST_PORTS).includes(port)),
  ).toBe(false);

  const overlaySlugs = [
    "tinypipe",
    "tinytail",
    "tinyweb",
    "tinykit",
    "tinytrigger",
    "tinyfeed",
  ];
  for (const slug of overlaySlugs) {
    const product = TINYFISH_PRODUCTS.find((item) => item.slug === slug);
    if (!product) throw new Error(`${slug} missing`);
    expect(compose).toContain(
      `\${${product.hostPortEnv}:-${product.hostPort}}:\${${product.nativePortEnv}:-${product.nativePort}}`,
    );
    expect(compose).toContain(`https://github.com/${product.repo}.git`);
    expect(compose).toContain(`${product.slug}:`);
  }

  expect(compose).not.toContain("tinypulse");
  expect(compose).not.toContain("tinywatch");
  expect(compose).toContain("depends_on:");
  expect(compose.match(/depends_on:\n\s+- tinypipe/g)?.length).toBe(5);
  expect(compose).toContain("TINYFISH_MCP_URL");
  expect(compose).not.toContain("record_usage");
});

test("catalog uses the verified compose service and GET /health", () => {
  const expected = {
    tinypipe: { composeService: "tinyfish-web", hostPort: 3712 },
    tinytail: { composeService: "ltdf", hostPort: 18765 },
    tinyfeed: { composeService: "feed", hostPort: 18082 },
    tinyweb: { composeService: "tinyfish-web", hostPort: 18766 },
    tinytrigger: { composeService: "engine", hostPort: 18081 },
    tinykit: { composeService: "gallery", hostPort: 18083 },
  } as const;

  for (const [slug, want] of Object.entries(expected)) {
    const product = TINYFISH_PRODUCTS.find((item) => item.slug === slug);
    if (!product) throw new Error(`${slug} missing`);
    expect(product.composeService).toBe(want.composeService);
    expect(product.healthPath).toBe("/health");
    expect(tinyFishProductHealthUrl(product)).toBe(
      `http://127.0.0.1:${want.hostPort}/health`,
    );
  }
});

test("wrapping TinyFeed publishes feed, not webhook or postgres", () => {
  const tinyfeed = TINYFISH_PRODUCTS.find(
    (product) => product.slug === "tinyfeed",
  );
  if (!tinyfeed) {
    throw new Error("tinyfeed missing from catalog");
  }

  const rewritten = remapComposeServices(
    {
      feed: { ports: ["8080:8080"] },
      webhook: { ports: ["8081:8081"] },
      postgres: { ports: ["5432:5432"] },
      sidecar: { ports: ["8090:8090"] },
    },
    tinyfeed,
  );

  expect(rewritten.feed?.ports).toEqual([uiPublishBinding(tinyfeed)]);
  expect(rewritten.feed?.ports).toEqual(["127.0.0.1:18082:8080"]);
  expect(rewritten.webhook?.ports).toBeUndefined();
  expect(rewritten.postgres?.ports).toBeUndefined();
  expect(rewritten.sidecar?.ports).toBeUndefined();
});

test("wrapping TinyTrigger publishes engine, not the webhook sidecar", () => {
  const tinytrigger = TINYFISH_PRODUCTS.find(
    (product) => product.slug === "tinytrigger",
  );
  if (!tinytrigger) {
    throw new Error("tinytrigger missing from catalog");
  }

  const rewritten = remapComposeServices(
    {
      engine: { ports: ["8080:8080"] },
      webhook: { ports: ["8081:8081"] },
      postgres: { ports: ["5432:5432"] },
    },
    tinytrigger,
  );

  expect(rewritten.engine?.ports).toEqual(["127.0.0.1:18081:8080"]);
  expect(rewritten.webhook?.ports).toBeUndefined();
  expect(rewritten.postgres?.ports).toBeUndefined();
});

test("named compose service wins over another service that also binds the native port", () => {
  const tinyfeed = TINYFISH_PRODUCTS.find(
    (product) => product.slug === "tinyfeed",
  );
  if (!tinyfeed) {
    throw new Error("tinyfeed missing from catalog");
  }

  const rewritten = remapComposeServices(
    {
      webhook: { ports: ["8080:8080"] },
      feed: { ports: ["8080:8080"] },
    },
    tinyfeed,
  );

  expect(rewritten.feed?.ports).toEqual(["127.0.0.1:18082:8080"]);
  expect(rewritten.webhook?.ports).toBeUndefined();
});

test("start-products waits on GET /health and does not fail README-only siblings", () => {
  const start = readFileSync(
    join(root, "scripts/tinyfish/start-products.ts"),
    "utf8",
  );
  expect(start).toContain("async function waitForTinyPipe");
  expect(start).toContain("resolveProductHealthUrl(product, process.env)");
  expect(
    start.indexOf("resolveProductHealthUrl(product, process.env)"),
  ).toBeLessThan(start.indexOf("TinyPipe ready"));
  expect(start).toContain("README-only is fine");
  expect(start).toContain("card may show Unreachable");
});

test("sibling checkouts stay outside the TinyBot tree unless cached gitignored", () => {
  const dirs = candidateCheckoutDirs(
    "/workspace",
    "mariodelgado/tiny-pipe",
    {
      TINYFISH_SIBLINGS_DIR: "/tmp/tinyfish-siblings",
    },
  );
  expect(dirs).toEqual([
    "/tmp/tinyfish-siblings/tiny-pipe",
    "/workspace/../tiny-pipe",
    "/workspace/.tinyfish-siblings/tiny-pipe",
  ]);
});

test("start.sh brings TinyPipe up first and wires the fixture MCP URL", () => {
  const start = readFileSync(join(root, "scripts/start.sh"), "utf8");
  expect(start).toContain("scripts/tinyfish/start-products.ts");
  expect(start).toContain("TINYFISH_MCP_URL");
  expect(start).toContain("http://127.0.0.1:3712/mcp");
  expect(start).toContain("https://issuer.fixtures.tinyfish.test");
  expect(start.indexOf("start-products.ts")).toBeLessThan(
    start.indexOf("docker compose up"),
  );
  expect(start).toContain("TINYFISH_TINYPING_URL");
  expect(start).toContain("VITE_TINYFISH_TINY_PING_URL");
  expect(start).not.toContain("TINYPULSE");
  expect(start).not.toContain("TINYWATCH");
  expect(start).not.toContain("TinyPulse");
  expect(start).not.toContain("TinyWatch");
});
