import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type {
  SpriteAssignment,
  SpriteAssignmentStore,
} from "../../sprites/store";
import type { AuthenticatedActor } from "../guards";
import type { OpenBotRole } from "../roles";
import {
  TINYFISH_SESSION_COOKIE,
  TinyFishUnauthenticatedError,
  TinyFishUnavailableError,
} from "./claims";
import type { TinyFishProfile, TinyFishProfileStore } from "./profiles";
import type { TinyFishSessionStore } from "./sessions";
import type { TinyFishVerifier } from "./verify";

export type TinyFishAuthService = {
  signIn: (
    token: string,
  ) => Promise<{ profile: TinyFishProfile; cookie: string }>;
  actorFromHeaders: (headers: Headers) => Promise<AuthenticatedActor | null>;
  writeSessionCookie: (context: Context, cookie: string) => void;
  signOut: (context: Context) => Promise<void>;
};

export function createTinyFishAuthService(options: {
  verifier: TinyFishVerifier;
  profiles: TinyFishProfileStore;
  sessions: TinyFishSessionStore;
  rolesForUser: (userId: string) => Promise<OpenBotRole[]>;
  /**
   * Optional per-user Sprite. Must not throw out to the sign-in caller — the
   * provisioner turns Fly failures into `status: "error"`.
   */
  provisionSprite?: (
    tinyfishUserId: string,
  ) => Promise<SpriteAssignment | null>;
  sprites?: SpriteAssignmentStore;
}): TinyFishAuthService {
  return {
    signIn: async (token) => {
      const claims = await options.verifier.verify(token);
      const profile = await options.profiles.upsert(claims, token);
      const cookie = await options.sessions.create(profile.id);
      let sprite = profile.sprite;
      if (options.provisionSprite) {
        sprite =
          (await options.provisionSprite(profile.tinyfishUserId)) ?? undefined;
      } else if (options.sprites) {
        sprite =
          (await options.sprites.get(profile.tinyfishUserId)) ?? undefined;
      }
      return {
        profile: sprite ? { ...profile, sprite } : profile,
        cookie,
      };
    },
    actorFromHeaders: async (headers) => {
      const userId = await options.sessions.userIdFor(
        cookieFromHeaders(headers),
      );
      if (!userId) return null;
      const roles = await options.rolesForUser(userId);
      const role = roles.includes("admin")
        ? "admin"
        : roles.includes("user")
          ? "user"
          : undefined;
      if (!role) return null;
      const profile = await options.profiles.get(userId);
      const sprite =
        profile?.sprite ??
        (options.sprites
          ? ((await options.sprites.get(profile?.tinyfishUserId ?? userId)) ??
            undefined)
          : undefined);
      return {
        id: userId,
        email: profile?.email ?? `${userId}@users.tinyfish.test`,
        name: profile?.name ?? userId,
        role,
        tinyfishUserId: profile?.tinyfishUserId ?? userId,
        ...(profile?.iss ? { iss: profile.iss } : {}),
        ...(profile?.clientId ? { clientId: profile.clientId } : {}),
        ...(sprite ? { sprite } : {}),
      };
    },
    writeSessionCookie: (context, cookie) => {
      setCookie(context, TINYFISH_SESSION_COOKIE, cookie, {
        httpOnly: true,
        path: "/",
        sameSite: "Lax",
        secure: context.req.url.startsWith("https://"),
      });
    },
    signOut: async (context) => {
      await options.sessions.revoke(
        getCookie(context, TINYFISH_SESSION_COOKIE),
      );
      deleteCookie(context, TINYFISH_SESSION_COOKIE, { path: "/" });
    },
  };
}

export function isTinyFishAuthError(
  error: unknown,
): error is TinyFishUnauthenticatedError | TinyFishUnavailableError {
  return (
    error instanceof TinyFishUnauthenticatedError ||
    error instanceof TinyFishUnavailableError
  );
}

function cookieFromHeaders(headers: Headers): string | undefined {
  const cookie = headers.get("cookie");
  if (!cookie) return undefined;
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === TINYFISH_SESSION_COOKIE) {
      return rest.join("=");
    }
  }
  return undefined;
}
