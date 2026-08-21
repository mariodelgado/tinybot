/**
 * Per-user Fly Sprite assignment. One Sprite per TinyFish user; TinyBot proxies to it.
 */
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const userSprites = pgTable("user_sprites", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  spriteName: text("sprite_name").notNull(),
  spriteId: text("sprite_id"),
  spriteUrl: text("sprite_url"),
  status: text("status").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
