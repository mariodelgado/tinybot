import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { userSprites } from "../db/schema/sprites";

export type SpriteAssignmentStatus =
  | "cold"
  | "warm"
  | "running"
  | "error"
  | "unconfigured";

export type SpriteAssignment = {
  name: string;
  id?: string;
  url?: string;
  status: SpriteAssignmentStatus;
};

export type SpriteAssignmentStore = {
  save: (userId: string, assignment: SpriteAssignment) => Promise<void>;
  get: (userId: string) => Promise<SpriteAssignment | null>;
};

export function createMemorySpriteStore(): SpriteAssignmentStore {
  const rows = new Map<string, SpriteAssignment>();
  return {
    save: async (userId, assignment) => {
      rows.set(userId, assignment);
    },
    get: async (userId) => rows.get(userId) ?? null,
  };
}

export function createDatabaseSpriteStore(
  database: Database,
): SpriteAssignmentStore {
  return {
    save: async (userId, assignment) => {
      const now = new Date();
      await database
        .insert(userSprites)
        .values({
          userId,
          spriteName: assignment.name,
          spriteId: assignment.id,
          spriteUrl: assignment.url,
          status: assignment.status,
        })
        .onConflictDoUpdate({
          target: userSprites.userId,
          set: {
            spriteName: assignment.name,
            spriteId: assignment.id,
            spriteUrl: assignment.url,
            status: assignment.status,
            updatedAt: now,
          },
        });
    },
    get: async (userId) => {
      const rows = await database
        .select()
        .from(userSprites)
        .where(eq(userSprites.userId, userId))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return {
        name: row.spriteName,
        status: row.status as SpriteAssignmentStatus,
        ...(row.spriteId ? { id: row.spriteId } : {}),
        ...(row.spriteUrl ? { url: row.spriteUrl } : {}),
      };
    },
  };
}
