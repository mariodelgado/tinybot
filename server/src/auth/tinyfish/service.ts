import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AuthenticatedActor } from "../guards";
import type { OpenBotRole } from "../roles";
import {
  TinyFishUnauthenticatedError,
  TinyFishUnavailableError,
  TINYFISH_SESSION_COOKIE,
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
}): TinyFishAuthService {
  return {
    signIn: async (token) => {
      const claims = await options.verifier.verify(token);
      const profile = await options.profiles.upsert(claims, token);
      const cookie = await options.sessions.create(profile.id);
      return { profile, cookie };
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
      return {
        id: userId,
        email: profile?.email ?? `${userId}@users.tinyfish.test`,
        name: profile?.name ?? userId,
        role,
        tinyfishUserId: profile?.tinyfishUserId ?? userId,
        ...(profile?.iss ? { iss: profile.iss } : {}),
        ...(profile?.clientId ? { clientId: profile.clientId } : {}),
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
