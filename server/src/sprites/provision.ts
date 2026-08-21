import type { SpritesClient } from "./client";
import { bootstrapExecCommand, spriteServiceDefinitions } from "./gateway";
import { spriteNameFor } from "./names";
import { SPRITE_GATEWAY_NAME } from "./products";
import type { SpriteAssignment, SpriteAssignmentStore } from "./store";

export type SpriteProvisioner = {
  ensure: (tinyfishUserId: string) => Promise<SpriteAssignment | null>;
};

/**
 * Create-or-reuse one Sprite per TinyFish user. No-op when the Fly token is unset.
 * Failures become `status: "error"` — they must not fail TinyFish sign-in.
 */
export function createSpriteProvisioner(options: {
  client?: SpritesClient;
  assignments: SpriteAssignmentStore;
}): SpriteProvisioner {
  return {
    ensure: async (tinyfishUserId) => {
      if (!options.client) {
        return null;
      }
      const name = spriteNameFor(tinyfishUserId);
      try {
        const sprite = await ensureSprite(options.client, name);
        await ensureServices(options.client, name);
        const assignment: SpriteAssignment = {
          name: sprite.name,
          id: sprite.id,
          url: sprite.url,
          status: sprite.status,
        };
        await options.assignments.save(tinyfishUserId, assignment);
        return assignment;
      } catch {
        const failed: SpriteAssignment = { name, status: "error" };
        await options.assignments.save(tinyfishUserId, failed);
        return failed;
      }
    },
  };
}

async function ensureSprite(client: SpritesClient, name: string) {
  const existing = await client.getSprite(name);
  if (existing) {
    return existing;
  }
  return client.createSprite(name);
}

async function ensureServices(client: SpritesClient, name: string) {
  const services = await client.listServices(name);
  if (services.some((service) => service.name === SPRITE_GATEWAY_NAME)) {
    return;
  }
  await client.exec(name, bootstrapExecCommand());
  for (const service of spriteServiceDefinitions()) {
    await client.putService(name, service.name, service.body);
  }
}
