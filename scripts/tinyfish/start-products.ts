/**
 * Start the six TinyFish products with unique host ports. TinyPipe is first.
 *
 * Preferred: wrap each product's own compose after a sibling checkout or a
 * gitignored `.tinyfish-siblings/` clone. Fallback: `docker-compose.tinyfish.yml`
 * git-context builds. Product source is never committed into TinyBot.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import {
  productsInStartOrder,
  TINYFISH_FIXTURE_ISSUER,
  TINYPIPE_MCP_URL,
  type TinyFishProduct,
  tinyFishProductUrl,
} from "../../app/src/lib/tinyfish/stack";
import {
  COMPOSE_FILE_PAIRS,
  type ComposeService,
  candidateCheckoutDirs,
  remapComposeServices,
  siblingRepoDirName,
} from "./ports";

const ROOT = resolve(import.meta.dir, "../..");
const SIBLINGS = join(ROOT, ".tinyfish-siblings");
const RUN_DIR = join(SIBLINGS, ".run");
const OVERLAY = join(ROOT, "docker-compose.tinyfish.yml");
const ASKPASS = join(ROOT, "scripts/tinyfish/gh-askpass.sh");
const PROJECT_PREFIX = "tinybot";
const OVERLAY_PROJECT = "tinybot-tinyfish";

function info(message: string) {
  console.log(message);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function hasDocker(): boolean {
  return Bun.spawnSync(["docker", "compose", "version"], {
    stdout: "ignore",
    stderr: "ignore",
  }).success;
}

function findComposeFiles(dir: string): string[] {
  for (const [primary, extra] of COMPOSE_FILE_PAIRS) {
    const main = join(dir, primary);
    if (!existsSync(main)) {
      continue;
    }
    const files = [main];
    const override = join(dir, extra);
    if (existsSync(override)) {
      files.push(override);
    }
    return files;
  }
  return [];
}

function existingCheckout(product: TinyFishProduct): string | undefined {
  for (const dir of candidateCheckoutDirs(ROOT, product.repo)) {
    if (existsSync(dir) && findComposeFiles(dir).length > 0) {
      return dir;
    }
  }
  return undefined;
}

async function cloneSibling(
  product: TinyFishProduct,
): Promise<string | undefined> {
  const dest = join(SIBLINGS, siblingRepoDirName(product.repo));
  if (existsSync(dest) && findComposeFiles(dest).length > 0) {
    return dest;
  }
  mkdirSync(SIBLINGS, { recursive: true });
  info(`  cloning ${product.repo} into .tinyfish-siblings/ (not committed)`);
  const proc = Bun.spawn(
    ["gh", "repo", "clone", product.repo, dest, "--", "--depth", "1"],
    {
      cwd: ROOT,
      stdout: "inherit",
      stderr: "inherit",
      env: { ...process.env, GIT_ASKPASS: ASKPASS, GIT_TERMINAL_PROMPT: "0" },
    },
  );
  const status = await proc.exited;
  if (status !== 0 || findComposeFiles(dest).length === 0) {
    return undefined;
  }
  return dest;
}

async function dockerCompose(
  args: string[],
  options: { cwd?: string; env?: Record<string, string> } = {},
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["docker", "compose", ...args], {
    cwd: options.cwd ?? ROOT,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      GIT_ASKPASS: ASKPASS,
      GIT_TERMINAL_PROMPT: "0",
      ...options.env,
    },
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const ok = (await proc.exited) === 0;
  return { ok, stdout, stderr };
}

async function renderComposeJson(
  projectDir: string,
  files: string[],
): Promise<Record<string, unknown> | undefined> {
  const args = ["--project-directory", projectDir];
  for (const file of files) {
    args.push("-f", file);
  }
  args.push("config", "--format", "json");
  const result = await dockerCompose(args, { cwd: projectDir });
  if (!result.ok) {
    return undefined;
  }
  try {
    return JSON.parse(result.stdout) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function injectTinyPipePointer(service: ComposeService) {
  const extra = {
    TINYFISH_MCP_URL: "http://host.docker.internal:3712/mcp",
    TINYFISH_ISSUER: TINYFISH_FIXTURE_ISSUER,
  };
  if (Array.isArray(service.environment)) {
    const keys = new Set(
      service.environment.map((entry) => String(entry).split("=")[0]),
    );
    const next = [...service.environment];
    for (const [key, value] of Object.entries(extra)) {
      if (!keys.has(key)) {
        next.push(`${key}=${value}`);
      }
    }
    service.environment = next;
  } else {
    service.environment = { ...(service.environment ?? {}), ...extra };
  }

  const hosts = Array.isArray(service.extra_hosts)
    ? [...service.extra_hosts]
    : [];
  if (!hosts.some((host) => String(host).includes("host.docker.internal"))) {
    hosts.push("host.docker.internal:host-gateway");
  }
  service.extra_hosts = hosts;
}

async function startWrapped(
  product: TinyFishProduct,
  checkout: string,
  files: string[],
): Promise<boolean> {
  const rendered = await renderComposeJson(checkout, files);
  if (
    !rendered ||
    typeof rendered.services !== "object" ||
    !rendered.services
  ) {
    info(`  ${product.title}: could not render ${files[0]}`);
    return false;
  }
  const services = remapComposeServices(
    rendered.services as Record<string, ComposeService>,
    product,
  );
  if (product.usageId !== "tf-03") {
    for (const service of Object.values(services)) {
      injectTinyPipePointer(service);
    }
  }
  mkdirSync(RUN_DIR, { recursive: true });
  const rewritten = join(RUN_DIR, `${product.slug}.yml`);
  writeFileSync(
    rewritten,
    stringifyYaml({
      ...rendered,
      services,
      name: `${PROJECT_PREFIX}-${product.slug}`,
    }),
  );
  info(
    `  ${product.title}: wrapping ${files[0]} → 127.0.0.1:${product.hostPort}`,
  );
  const up = await dockerCompose(
    [
      "--project-directory",
      checkout,
      "-p",
      `${PROJECT_PREFIX}-${product.slug}`,
      "-f",
      rewritten,
      "up",
      "-d",
      "--build",
    ],
    { cwd: checkout },
  );
  if (!up.ok) {
    console.error(up.stderr || up.stdout);
    return false;
  }
  return true;
}

async function startOverlayService(product: TinyFishProduct): Promise<boolean> {
  info(
    `  ${product.title}: git-context fallback from docker-compose.tinyfish.yml :${product.hostPort}`,
  );
  const up = await dockerCompose(
    ["-p", OVERLAY_PROJECT, "-f", OVERLAY, "up", "-d", "--build", product.slug],
    {
      env: {
        TINYFISH_MCP_URL: "http://host.docker.internal:3712/mcp",
        TINYFISH_ISSUER: TINYFISH_FIXTURE_ISSUER,
      },
    },
  );
  if (!up.ok) {
    console.error(up.stderr || up.stdout);
    return false;
  }
  return true;
}

async function waitForTinyPipe(product: TinyFishProduct) {
  const url = tinyFishProductUrl(product);
  info(`  waiting for TinyPipe at ${url} (auth socket ${TINYPIPE_MCP_URL})`);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(3000) });
      info("  TinyPipe ready");
      return;
    } catch {
      try {
        const socket = await Bun.connect({
          hostname: "127.0.0.1",
          port: product.hostPort,
        });
        socket.end();
        info("  TinyPipe accepted a connection on :3712");
        return;
      } catch {
        await Bun.sleep(2000);
      }
    }
  }
  fail(
    "TinyPipe did not become reachable on 127.0.0.1:3712. Sign-in and the six cards need it up first.",
  );
}

async function startProduct(product: TinyFishProduct): Promise<void> {
  let checkout = existingCheckout(product);
  if (!checkout) {
    checkout = await cloneSibling(product);
  }
  if (checkout) {
    const files = findComposeFiles(checkout);
    if (files.length > 0 && (await startWrapped(product, checkout, files))) {
      return;
    }
  }
  if (await startOverlayService(product)) {
    return;
  }
  fail(
    `${product.title} did not start. Need Docker plus GitHub access to ${product.repo} (sibling checkout, gh clone into .tinyfish-siblings/, or git-context build).`,
  );
}

async function down() {
  if (!hasDocker()) {
    info("Docker is not available; nothing to stop.");
    return;
  }
  for (const product of productsInStartOrder()) {
    await dockerCompose(["-p", `${PROJECT_PREFIX}-${product.slug}`, "down"]);
  }
  await dockerCompose(["-p", OVERLAY_PROJECT, "-f", OVERLAY, "down"]);
  info("TinyFish products stopped.");
}

async function main() {
  if (process.argv.includes("--down")) {
    await down();
    return;
  }
  if (process.env.OPENBOT_SKIP_TINYFISH_PRODUCTS === "1") {
    info("Skipping TinyFish products (OPENBOT_SKIP_TINYFISH_PRODUCTS=1).");
    return;
  }
  if (!hasDocker()) {
    fail(
      "Docker is required to start TinyPipe and the five sibling products. Install Docker, or set OPENBOT_SKIP_TINYFISH_PRODUCTS=1 to start TinyBot only.",
    );
  }

  info("TinyFish products (TinyPipe first)");
  for (const product of productsInStartOrder()) {
    await startProduct(product);
    if (product.usageId === "tf-03") {
      await waitForTinyPipe(product);
    }
  }

  info("Card URLs:");
  for (const product of productsInStartOrder()) {
    info(`  ${product.title}: ${tinyFishProductUrl(product)}`);
  }
}

if (import.meta.main) {
  await main();
}
