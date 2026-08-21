import {
  TINYBOT_HOST_PORTS,
  TINYFISH_PRODUCTS,
  type TinyFishProduct,
} from "../../app/src/lib/tinyfish/stack";

export type ComposePort =
  | string
  | number
  | {
      target?: number | string;
      published?: number | string;
      host_ip?: string;
      protocol?: string;
      mode?: string;
    };

export type ComposeService = {
  ports?: ComposePort[];
  environment?: Record<string, unknown> | string[];
  extra_hosts?: string[] | Record<string, string>;
  [key: string]: unknown;
};

const UI_SERVICE_NAMES = new Set([
  "app",
  "web",
  "ui",
  "frontend",
  "server",
  "api",
]);

export function parsePortNumber(
  value: number | string | undefined,
): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }
  return undefined;
}

/**
 * Parse a Compose short-form binding such as `8080`, `8080:8080`, or `127.0.0.1:8080:8080/tcp`.
 */
export function parsePortBinding(binding: string): {
  hostIp?: string;
  published?: number;
  target: number;
} {
  const noProto = binding.trim().replace(/\/(tcp|udp)$/i, "");
  const parts = noProto.split(":");
  if (parts.length === 1) {
    return { target: Number.parseInt(parts[0] ?? "", 10) };
  }
  if (parts.length === 2) {
    return {
      published: Number.parseInt(parts[0] ?? "", 10),
      target: Number.parseInt(parts[1] ?? "", 10),
    };
  }
  return {
    hostIp: parts.slice(0, -2).join(":"),
    published: Number.parseInt(parts[parts.length - 2] ?? "", 10),
    target: Number.parseInt(parts[parts.length - 1] ?? "", 10),
  };
}

export function publishedAndTarget(port: ComposePort): {
  published?: number;
  target?: number;
} {
  if (typeof port === "number") {
    return { target: port, published: port };
  }
  if (typeof port === "string") {
    const parsed = parsePortBinding(port);
    return { published: parsed.published, target: parsed.target };
  }
  return {
    published: parsePortNumber(port.published),
    target: parsePortNumber(port.target),
  };
}

export function isLikelyUiService(
  serviceName: string,
  ports: ComposePort[] | undefined,
  product: TinyFishProduct,
): boolean {
  const lower = serviceName.toLowerCase();
  if (lower === product.composeService.toLowerCase()) {
    return true;
  }
  if (
    lower === product.slug ||
    lower === product.title.toLowerCase() ||
    UI_SERVICE_NAMES.has(lower)
  ) {
    return true;
  }
  for (const port of ports ?? []) {
    const { published, target } = publishedAndTarget(port);
    if (
      target === product.nativePort ||
      published === product.nativePort ||
      published === product.hostPort
    ) {
      return true;
    }
  }
  return false;
}

export function uiPublishBinding(product: TinyFishProduct): string {
  return `127.0.0.1:${product.hostPort}:${product.nativePort}`;
}

/**
 * Keep one loopback publish for the mini-app; drop other host publishes so sibling
 * Postgres / 8080 / 8765 cannot collide with TinyBot or the other products.
 */
export function remapComposeServices(
  services: Record<string, ComposeService>,
  product: TinyFishProduct,
): Record<string, ComposeService> {
  const entries = Object.entries(services);
  const named = entries.find(
    ([name]) => name.toLowerCase() === product.composeService.toLowerCase(),
  )?.[0];
  const uiName =
    named ??
    entries.find(([name, service]) =>
      isLikelyUiService(name, service.ports, product),
    )?.[0] ??
    entries[0]?.[0];

  const next: Record<string, ComposeService> = {};
  for (const [name, service] of entries) {
    const copy: ComposeService = { ...service };
    if (name === uiName) {
      copy.ports = [uiPublishBinding(product)];
    } else if (copy.ports) {
      delete copy.ports;
    }
    next[name] = copy;
  }
  return next;
}

export function reservedHostPortsFor(product: TinyFishProduct): number[] {
  return [
    ...Object.values(TINYBOT_HOST_PORTS),
    ...TINYFISH_PRODUCTS.filter((item) => item.slug !== product.slug).map(
      (item) => item.hostPort,
    ),
  ];
}

export function hostPortsFromComposeYaml(yamlText: string): number[] {
  const ports: number[] = [];
  const pattern =
    /127\.0\.0\.1:\$\{[A-Z0-9_]+:-(\d+)\}:\$\{[A-Z0-9_]+:-(\d+)\}/g;
  for (const match of yamlText.matchAll(pattern)) {
    ports.push(Number.parseInt(match[1] ?? "", 10));
  }
  return ports;
}

export function siblingRepoDirName(repo: string): string {
  const name = repo.split("/")[1];
  if (!name) {
    throw new Error(`TinyFish repo '${repo}' is missing a name.`);
  }
  return name;
}

export function candidateCheckoutDirs(
  root: string,
  repo: string,
  env: Record<string, string | undefined> = process.env,
): string[] {
  const basename = siblingRepoDirName(repo);
  const dirs = [
    env.TINYFISH_SIBLINGS_DIR
      ? `${env.TINYFISH_SIBLINGS_DIR.replace(/\/$/, "")}/${basename}`
      : undefined,
    `${root}/../${basename}`,
    `${root}/.tinyfish-siblings/${basename}`,
  ];
  return dirs.filter((dir): dir is string => Boolean(dir));
}

export const COMPOSE_FILE_PAIRS = [
  ["docker-compose.yml", "docker-compose.override.yml"],
  ["docker-compose.yaml", "docker-compose.override.yaml"],
  ["compose.yml", "compose.override.yml"],
  ["compose.yaml", "compose.override.yaml"],
] as const;
