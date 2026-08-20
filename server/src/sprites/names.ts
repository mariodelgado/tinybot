import { createHash } from "node:crypto";

const PREFIX = "tinybot-";
/** Fly sprite names have to stay DNS-label safe. Keep well under 63. */
const MAX_NAME_LENGTH = 40;

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

function sanitizeBody(userId: string): string {
  return userId
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Deterministic Sprite name for a TinyFish user.
 *
 * `tfu_alice` → `tinybot-tfu-alice`. Underscores fold to hyphens. Anything that is not a
 * lowercase `[a-z0-9_]` id (or that already contains `-`, which would collide with that fold)
 * gets a short hash so two users never share a name.
 */
export function spriteNameFor(tinyfishUserId: string): string {
  const id = tinyfishUserId.trim();
  const hash = fingerprint(id);
  const body = sanitizeBody(id);
  const simpleUnderscoreId = /^[a-z0-9_]+$/.test(id);
  const core = simpleUnderscoreId && body ? body : `${body || "user"}-${hash}`;
  const name = `${PREFIX}${core}`;
  if (name.length <= MAX_NAME_LENGTH) {
    return name;
  }
  return `${PREFIX}${hash}`;
}
