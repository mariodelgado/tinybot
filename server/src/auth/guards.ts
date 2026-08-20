import { eq } from "drizzle-orm";
import type { Context, MiddlewareHandler } from "hono";
import type { Database } from "../db/client";
import { userRoles } from "../db/schema";
import type { SpriteAssignment } from "../sprites/store";
import type { OpenBotRole } from "./roles";

export type AuthenticatedActor = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: OpenBotRole;
  tinyfishUserId?: string;
  iss?: string;
  clientId?: string;
  sprite?: SpriteAssignment;
};

export type AuthService = {
  handler: (request: Request) => Response | Promise<Response>;
  api: {
    getSession: (input: {
      headers: Headers;
      query: { disableCookieCache: boolean };
    }) => Promise<{
      user: {
        id: string;
        email: string;
        name?: string | null;
        image?: string | null;
      };
    } | null>;
  };
};

export type RoleRepository = {
  rolesForUser: (userId: string) => Promise<OpenBotRole[]>;
};

export type AppVariables = {
  actor: AuthenticatedActor;
};

export function createRoleRepository(database: Database): RoleRepository {
  return {
    rolesForUser: async (userId) => {
      const records = await database
        .select({ role: userRoles.role })
        .from(userRoles)
        .where(eq(userRoles.userId, userId));

      return records.map((record) => record.role);
    },
  };
}

export type TinyFishSessionReader = {
  actorFromHeaders: (headers: Headers) => Promise<AuthenticatedActor | null>;
};

export function createRequireUser(
  auth: AuthService | undefined,
  roleRepository: RoleRepository,
  tinyFish?: TinyFishSessionReader,
): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (context, next) => {
    if (tinyFish) {
      const tinyFishActor = await tinyFish.actorFromHeaders(
        context.req.raw.headers,
      );
      if (tinyFishActor) {
        context.set("actor", tinyFishActor);
        await next();
        return;
      }
    }

    const session = auth
      ? await auth.api.getSession({
          headers: context.req.raw.headers,
          query: { disableCookieCache: true },
        })
      : null;

    if (!session) {
      return context.json({ error: "Authentication required." }, 401);
    }

    const roles = await roleRepository.rolesForUser(session.user.id);
    const role = roles.includes("admin")
      ? "admin"
      : roles.includes("user")
        ? "user"
        : undefined;

    if (!role) {
      return context.json({ error: "Authorization required." }, 403);
    }

    context.set("actor", {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
      role,
    });
    await next();
  };
}

export function requireAdmin(context: Context<{ Variables: AppVariables }>) {
  if (context.var.actor.role !== "admin") {
    return context.json({ error: "Administrator access required." }, 403);
  }

  return undefined;
}
