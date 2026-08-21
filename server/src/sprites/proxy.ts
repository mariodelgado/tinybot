import type { Context } from "hono";
import type { AppVariables } from "../auth/guards";
import { copyForwardHeaders } from "../tinyfish/forward";
import { spriteProductBySlug } from "./products";
import type { SpriteAssignmentStore } from "./store";

export function createSpriteProxyHandler(options: {
  assignments: SpriteAssignmentStore;
  token?: string;
  fetch?: typeof fetch;
}) {
  const doFetch = options.fetch ?? fetch;

  return async (context: Context<{ Variables: AppVariables }>) => {
    if (!options.token) {
      return context.json(
        { error: "Sprites are not configured on this deployment." },
        503,
      );
    }

    const actor = context.var.actor;
    const userId = actor.tinyfishUserId ?? actor.id;
    const assignment = await options.assignments.get(userId);
    if (!assignment?.url) {
      return context.json(
        { error: "No Sprite is assigned to this user." },
        404,
      );
    }

    const slug = context.req.param("slug");
    const product = slug ? spriteProductBySlug(slug) : undefined;
    if (!product) {
      return context.json({ error: "Unknown TinyFish product." }, 404);
    }

    const rest = context.req.path.replace(
      new RegExp(`^/api/sprite/apps/${slug}`),
      "",
    );
    const suffix = rest.length > 0 ? rest : product.path;
    const upstream = new URL(
      `/${product.slug}${suffix.startsWith("/") ? suffix : `/${suffix}`}`,
      assignment.url.endsWith("/") ? assignment.url : `${assignment.url}/`,
    );
    const incoming = new URL(context.req.url);
    upstream.search = incoming.search;

    const headers = copyForwardHeaders(context.req.raw.headers);
    headers.set("Authorization", `Bearer ${options.token}`);

    const method = context.req.method;
    const body =
      method === "GET" || method === "HEAD"
        ? undefined
        : await context.req.arrayBuffer();

    const response = await doFetch(upstream, { method, headers, body });
    const outbound = new Headers(response.headers);
    outbound.delete("set-cookie");
    return new Response(response.body, {
      status: response.status,
      headers: outbound,
    });
  };
}
