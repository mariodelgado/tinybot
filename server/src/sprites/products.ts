/**
 * In-sprite listen ports match TinyBot's remapped host ports so two products that both
 * natively bind 8080 or 8765 do not collide inside one Sprite.
 */

export const SPRITE_GATEWAY_NAME = "tinybot-gateway";
export const SPRITE_GATEWAY_PORT = 8080;
export const SPRITE_BOOTSTRAP_MARKER = "/home/sprite/.tinybot/bootstrapped";
export const SPRITE_CADDYFILE = "/home/sprite/.tinybot/Caddyfile";

export type SpriteProduct = {
  slug: string;
  usageId: string;
  listenPort: number;
  path: string;
  startOrder: number;
};

export const SPRITE_PRODUCTS: readonly SpriteProduct[] = [
  {
    slug: "tinytail",
    usageId: "js-01",
    listenPort: 18765,
    path: "/ui",
    startOrder: 1,
  },
  {
    slug: "tinypulse",
    usageId: "js-02",
    listenPort: 18082,
    path: "/ui",
    startOrder: 2,
  },
  {
    slug: "tinyweb",
    usageId: "js-03",
    listenPort: 18766,
    path: "/ui",
    startOrder: 3,
  },
  {
    slug: "tinywatch",
    usageId: "tf-01",
    listenPort: 18081,
    path: "/",
    startOrder: 4,
  },
  {
    slug: "tinykit",
    usageId: "tf-02",
    listenPort: 18083,
    path: "/",
    startOrder: 5,
  },
  {
    slug: "tinypipe",
    usageId: "tf-03",
    listenPort: 3712,
    path: "/ui",
    startOrder: 0,
  },
];

export function spriteProductBySlug(slug: string): SpriteProduct | undefined {
  return SPRITE_PRODUCTS.find((product) => product.slug === slug);
}

export function spriteProductsInStartOrder(): SpriteProduct[] {
  return [...SPRITE_PRODUCTS].sort((a, b) => a.startOrder - b.startOrder);
}
