import type { SpriteServiceRequest } from "./client";
import {
  SPRITE_CADDYFILE,
  SPRITE_GATEWAY_NAME,
  SPRITE_GATEWAY_PORT,
  SPRITE_PRODUCTS,
  spriteProductsInStartOrder,
} from "./products";

const FIXTURE_ISSUER = "https://issuer.fixtures.tinyfish.test";
const TINYPIPE_MCP_URL = "http://127.0.0.1:3712/mcp";

export type NamedService = {
  name: string;
  body: SpriteServiceRequest;
};

/**
 * Caddy is the only process that owns `http_port`. Path prefix is stripped so each
 * product still sees `/ui` or `/` on its own listen port.
 */
export function spriteCaddyfile(): string {
  const handles = spriteProductsInStartOrder()
    .map(
      (product) =>
        `  handle_path /${product.slug}* {\n    reverse_proxy 127.0.0.1:${product.listenPort}\n  }`,
    )
    .join("\n");
  return `{
  admin off
}

:${SPRITE_GATEWAY_PORT} {
${handles}
  respond 404
}
`;
}

export function productServiceBody(slug: string): SpriteServiceRequest {
  const product = SPRITE_PRODUCTS.find((item) => item.slug === slug);
  if (!product) {
    throw new Error(`Unknown TinyFish product '${slug}'.`);
  }
  const env: Record<string, string> = {
    PORT: String(product.listenPort),
    TINYFISH_ISSUER: FIXTURE_ISSUER,
  };
  if (product.slug !== "tinypipe") {
    env.TINYFISH_MCP_URL = TINYPIPE_MCP_URL;
  }
  return {
    cmd: "sh",
    args: ["-c", `/home/sprite/.tinybot/run/${product.slug}.sh`],
    env,
    dir: "/home/sprite/.tinybot",
    needs: product.slug === "tinypipe" ? [] : ["tinypipe"],
  };
}

export function gatewayServiceBody(): SpriteServiceRequest {
  return {
    cmd: "caddy",
    args: ["run", "--config", SPRITE_CADDYFILE, "--adapter", "caddyfile"],
    needs: SPRITE_PRODUCTS.map((product) => product.slug),
    http_port: SPRITE_GATEWAY_PORT,
  };
}

/** TinyPipe first, then siblings, then the gateway. Exactly one `http_port`. */
export function spriteServiceDefinitions(): NamedService[] {
  return [
    ...spriteProductsInStartOrder().map((product) => ({
      name: product.slug,
      body: productServiceBody(product.slug),
    })),
    { name: SPRITE_GATEWAY_NAME, body: gatewayServiceBody() },
  ];
}

export function httpPortOwners(services: NamedService[]): string[] {
  return services
    .filter((service) => service.body.http_port !== undefined)
    .map((service) => service.name);
}

export function bootstrapExecCommand(): string {
  const caddy = spriteCaddyfile().replace(/'/g, `'\\''`);
  return [
    "mkdir -p /home/sprite/.tinybot/run",
    `printf '%s\\n' '${caddy}' > ${SPRITE_CADDYFILE}`,
    "touch /home/sprite/.tinybot/bootstrapped",
  ].join(" && ");
}
