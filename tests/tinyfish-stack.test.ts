import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TINYFISH_APPS } from "../app/src/lib/tinyfish/apps";
import {
  allStackHostPorts,
  boardProductsInStartOrder,
  duplicateNumbers,
  platformProductsInStartOrder,
  primitiveProductsInCardOrder,
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

test("all 15 TinyX products are start-page primitives; platform kind stays platform", () => {
  expect(TINYFISH_PRODUCTS).toHaveLength(15);
  expect(TINYFISH_APPS).toHaveLength(15);
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
  expect(primitiveProductsInCardOrder().map((product) => product.slug)).toEqual(
    [
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
      "tinypipe",
      "tinytail",
      "tinyweb",
      "tinykit",
    ],
  );
  expect(TINYFISH_APPS.map((app) => app.slug)).toEqual(
    primitiveProductsInCardOrder().map((product) => product.slug),
  );
  expect(platformProductsInStartOrder().map((product) => product.repo)).toEqual(
    [
      "mariodelgado/tiny-pipe",
      "mariodelgado/tiny-tail",
      "mariodelgado/tiny-web",
      "mariodelgado/tiny-kit",
    ],
  );
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
    expect(card?.defaultUrl).toBe(tinyFishProductUrl(product));
    if (product.kind === "platform") {
      expect(product.kind).toBe("platform");
    }
  }
  expect(
    platformProductsInStartOrder().every(
      (product) => product.kind === "platform",
    ),
  ).toBe(true);

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

test("compose overlay publishes all 15 products on remapped loopback ports", () => {
  const compose = readFileSync(
    join(root, "docker-compose.tinyfish.yml"),
    "utf8",
  );
  const published = hostPortsFromComposeYaml(compose);

  expect(TINYFISH_PRODUCTS).toHaveLength(15);
  expect(published).toHaveLength(15);
  expect(new Set(published)).toEqual(
    new Set(TINYFISH_PRODUCTS.map((product) => product.hostPort)),
  );
  expect(duplicateNumbers(published)).toEqual([]);
  expect(
    published.some((port) => Object.values(TINYBOT_HOST_PORTS).includes(port)),
  ).toBe(false);

  for (const product of TINYFISH_PRODUCTS) {
    expect(compose).toContain(
      `\${${product.hostPortEnv}:-${product.hostPort}}:\${${product.nativePortEnv}:-${product.nativePort}}`,
    );
    expect(compose).toContain(`https://github.com/${product.repo}.git`);
    expect(compose).toMatch(new RegExp(`^  ${product.slug}:`, "m"));
  }

  expect(compose).not.toContain("tinypulse");
  expect(compose).not.toContain("tinywatch");
  expect(compose).toContain("depends_on:");
  expect(compose.match(/depends_on:\n\s+- tinypipe/g)?.length).toBe(14);
  expect(compose).toContain("TINYFISH_MCP_URL");
  expect(compose).not.toContain("record_usage");
});

test("all 15 compose services are remappable onto their host ports", () => {
  expect(TINYFISH_PRODUCTS).toHaveLength(15);
  for (const product of TINYFISH_PRODUCTS) {
    const rewritten = remapComposeServices(
      {
        [product.composeService]: {
          ports: [`${product.nativePort}:${product.nativePort}`],
        },
        webhook: { ports: ["8081:8081"] },
        postgres: { ports: ["5432:5432"] },
      },
      product,
    );
    expect(rewritten[product.composeService]?.ports).toEqual([
      uiPublishBinding(product),
    ]);
    expect(rewritten.webhook?.ports).toBeUndefined();
    expect(rewritten.postgres?.ports).toBeUndefined();
  }
});

test("catalog uses the verified compose service and GET /health", () => {
  const expected = {
    tinypipe: { composeService: "tinyfish-web", hostPort: 3712 },
    tinytail: { composeService: "ltdf", hostPort: 18765 },
    tinyweb: { composeService: "tinyfish-web", hostPort: 18766 },
    tinykit: { composeService: "gallery", hostPort: 18083 },
    tinyping: { composeService: "tinyping", hostPort: 18101 },
    tinytrigger: { composeService: "engine", hostPort: 18081 },
    tinyreg: { composeService: "tinyreg", hostPort: 18102 },
    tinyscout: { composeService: "tinyscout", hostPort: 18103 },
    tinybrief: { composeService: "tinybrief", hostPort: 18104 },
    tinydeed: { composeService: "tinydeed", hostPort: 18105 },
    tinyfeed: { composeService: "feed", hostPort: 18082 },
    tinyfoundry: { composeService: "tinyfoundry", hostPort: 18106 },
    tinymargin: { composeService: "tinymargin", hostPort: 18107 },
    tinyatlas: { composeService: "tinyatlas", hostPort: 18108 },
    tinyprior: { composeService: "tinyprior", hostPort: 18109 },
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
  const dirs = candidateCheckoutDirs("/workspace", "mariodelgado/tiny-pipe", {
    TINYFISH_SIBLINGS_DIR: "/tmp/tinyfish-siblings",
  });
  expect(dirs).toEqual([
    "/tmp/tinyfish-siblings/tiny-pipe",
    "/workspace/../tiny-pipe",
    "/workspace/.tinyfish-siblings/tiny-pipe",
  ]);
});

const UNDEPLOYED_BOARD_SLUGS = [
  "tinyping",
  "tinyreg",
  "tinyscout",
  "tinybrief",
  "tinydeed",
  "tinyfoundry",
  "tinymargin",
  "tinyatlas",
  "tinyprior",
] as const;

test("documents TINYFISH_<SLUG>_URL for the 9 board apps not on Fly yet", () => {
  const envExample = readFileSync(join(root, ".env.example"), "utf8");
  const tinybot = readFileSync(join(root, "TINYBOT.md"), "utf8");
  const start = readFileSync(join(root, "scripts/start.sh"), "utf8");
  expect(UNDEPLOYED_BOARD_SLUGS).toHaveLength(9);
  for (const slug of UNDEPLOYED_BOARD_SLUGS) {
    const key = `TINYFISH_${slug.toUpperCase()}_URL`;
    expect(envExample).toContain(key);
    expect(tinybot).toContain(key);
    expect(start).toContain(key);
  }
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
  expect(start).toContain("TINYFISH_TINYREG_URL");
  expect(start).toContain("TINYFISH_TINYPRIOR_URL");
  expect(start).toContain("VITE_TINYFISH_TINY_PING_URL");
  expect(start).not.toContain("TINYPULSE");
  expect(start).not.toContain("TINYWATCH");
  expect(start).not.toContain("TinyPulse");
  expect(start).not.toContain("TinyWatch");
});
