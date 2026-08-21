/**
 * In-sprite listen ports match TinyBot's remapped host ports so two products that both
 * natively bind 8080 or 8765 do not collide inside one Sprite.
 */

import { TINYFISH_PRODUCTS } from "../../../app/src/lib/tinyfish/stack";

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

export const SPRITE_PRODUCTS: readonly SpriteProduct[] = TINYFISH_PRODUCTS.map(
  (product) => ({
    slug: product.slug,
    usageId: product.usageId,
    listenPort: product.hostPort,
    path: product.path,
    startOrder: product.startOrder,
  }),
);

export function spriteProductBySlug(slug: string): SpriteProduct | undefined {
  return SPRITE_PRODUCTS.find((product) => product.slug === slug);
}

export function spriteProductsInStartOrder(): SpriteProduct[] {
  return [...SPRITE_PRODUCTS].sort((a, b) => a.startOrder - b.startOrder);
}
