import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TINYFISH_APPS } from "../app/src/lib/tinyfish/apps";
import {
  allStackHostPorts,
  duplicateNumbers,
  productsInStartOrder,
  TINYBOT_HOST_PORTS,
  TINYFISH_FIXTURE_ISSUER,
  TINYFISH_PRODUCTS,
  TINYPIPE_MCP_URL,
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

test("TinyBot and the six product host ports are unique", () => {
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

test("catalog defaults match the remapped TinyBot host ports", () => {
  const expected = {
    tinytail: "http://127.0.0.1:18765/ui",
    tinypulse: "http://127.0.0.1:18082/ui",
    tinyweb: "http://127.0.0.1:18766/ui",
    tinywatch: "http://127.0.0.1:18081/",
    tinykit: "http://127.0.0.1:18083/",
    tinypipe: "http://127.0.0.1:3712/ui",
  };

  expect(TINYFISH_PRODUCTS).toHaveLength(6);
  expect(TINYFISH_APPS).toHaveLength(6);
  for (const product of TINYFISH_PRODUCTS) {
    const url = tinyFishProductUrl(product);
    expect(url).toBe(expected[product.slug as keyof typeof expected]);
    expect(
      TINYFISH_APPS.find((app) => app.slug === product.slug)?.defaultUrl,
    ).toBe(url);
    expect(product.repo).toStartWith("mariodelgado/");
  }
});

test("TinyPipe starts first and remains the auth socket on 3712", () => {
  const order = productsInStartOrder();
  expect(order[0]?.slug).toBe("tinypipe");
  expect(order[0]?.hostPort).toBe(3712);
  expect(TINYPIPE_MCP_URL).toBe("http://127.0.0.1:3712/mcp");
  expect(TINYFISH_FIXTURE_ISSUER).toBe("https://issuer.fixtures.tinyfish.test");
});

test("compose overlay publishes each product on its remapped loopback port", () => {
  const compose = readFileSync(
    join(root, "docker-compose.tinyfish.yml"),
    "utf8",
  );
  const published = hostPortsFromComposeYaml(compose);

  expect(published).toEqual([3712, 18765, 18082, 18766, 18081, 18083]);
  expect(duplicateNumbers(published)).toEqual([]);
  expect(
    published.some((port) => Object.values(TINYBOT_HOST_PORTS).includes(port)),
  ).toBe(false);

  for (const product of TINYFISH_PRODUCTS) {
    expect(compose).toContain(
      `\${${product.hostPortEnv}:-${product.hostPort}}:\${${product.nativePortEnv}:-${product.nativePort}}`,
    );
    expect(compose).toContain(`https://github.com/${product.repo}.git`);
    expect(compose).toContain(`${product.slug}:`);
  }

  expect(compose).toContain("depends_on:");
  expect(compose.match(/depends_on:\n\s+- tinypipe/g)?.length).toBe(5);
  expect(compose).toContain("TINYFISH_MCP_URL");
  expect(compose).not.toContain("record_usage");
});

test("catalog uses the verified compose service and GET /health on the remapped host port", () => {
  const expected = {
    tinypipe: { composeService: "tinyfish-web", hostPort: 3712 },
    tinytail: { composeService: "ltdf", hostPort: 18765 },
    tinypulse: { composeService: "feed", hostPort: 18082 },
    tinyweb: { composeService: "tinyfish-web", hostPort: 18766 },
    tinywatch: { composeService: "engine", hostPort: 18081 },
    tinykit: { composeService: "gallery", hostPort: 18083 },
  } as const;

  for (const product of TINYFISH_PRODUCTS) {
    const want = expected[product.slug as keyof typeof expected];
    expect(product.composeService).toBe(want.composeService);
    expect(product.healthPath).toBe("/health");
    expect(tinyFishProductHealthUrl(product)).toBe(
      `http://127.0.0.1:${want.hostPort}/health`,
    );
  }
});

test("wrapping TinyPulse publishes feed, not webhook or postgres", () => {
  const tinypulse = TINYFISH_PRODUCTS.find(
    (product) => product.slug === "tinypulse",
  );
  if (!tinypulse) {
    throw new Error("tinypulse missing from catalog");
  }

  const rewritten = remapComposeServices(
    {
      feed: { ports: ["8080:8080"] },
      webhook: { ports: ["8081:8081"] },
      postgres: { ports: ["5432:5432"] },
      sidecar: { ports: ["8090:8090"] },
    },
    tinypulse,
  );

  expect(rewritten.feed?.ports).toEqual([uiPublishBinding(tinypulse)]);
  expect(rewritten.feed?.ports).toEqual(["127.0.0.1:18082:8080"]);
  expect(rewritten.webhook?.ports).toBeUndefined();
  expect(rewritten.postgres?.ports).toBeUndefined();
  expect(rewritten.sidecar?.ports).toBeUndefined();
});

test("wrapping TinyWatch publishes engine, not the webhook sidecar", () => {
  const tinywatch = TINYFISH_PRODUCTS.find(
    (product) => product.slug === "tinywatch",
  );
  if (!tinywatch) {
    throw new Error("tinywatch missing from catalog");
  }

  const rewritten = remapComposeServices(
    {
      engine: { ports: ["8080:8080"] },
      webhook: { ports: ["8081:8081"] },
      postgres: { ports: ["5432:5432"] },
    },
    tinywatch,
  );

  expect(rewritten.engine?.ports).toEqual(["127.0.0.1:18081:8080"]);
  expect(rewritten.webhook?.ports).toBeUndefined();
  expect(rewritten.postgres?.ports).toBeUndefined();
});

test("named compose service wins over another service that also binds the native port", () => {
  const tinypulse = TINYFISH_PRODUCTS.find(
    (product) => product.slug === "tinypulse",
  );
  if (!tinypulse) {
    throw new Error("tinypulse missing from catalog");
  }

  const rewritten = remapComposeServices(
    {
      webhook: { ports: ["8080:8080"] },
      feed: { ports: ["8080:8080"] },
    },
    tinypulse,
  );

  expect(rewritten.feed?.ports).toEqual(["127.0.0.1:18082:8080"]);
  expect(rewritten.webhook?.ports).toBeUndefined();
});

test("start-products waits on GET /health, not a UI path", () => {
  const start = readFileSync(
    join(root, "scripts/tinyfish/start-products.ts"),
    "utf8",
  );
  expect(start).toContain("async function waitForTinyPipe");
  expect(start).toContain("resolveProductHealthUrl(product, process.env)");
  expect(
    start.indexOf("resolveProductHealthUrl(product, process.env)"),
  ).toBeLessThan(start.indexOf("TinyPipe ready"));
});

test("sibling checkouts stay outside the TinyBot tree unless cached gitignored", () => {
  const dirs = candidateCheckoutDirs(
    "/workspace",
    "mariodelgado/tf-03-mcp-distribution",
    {
      TINYFISH_SIBLINGS_DIR: "/tmp/tinyfish-siblings",
    },
  );
  expect(dirs).toEqual([
    "/tmp/tinyfish-siblings/tf-03-mcp-distribution",
    "/workspace/../tf-03-mcp-distribution",
    "/workspace/.tinyfish-siblings/tf-03-mcp-distribution",
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
});
