import type { Context } from "hono";
import { tinyFishProductBySlug } from "../../../app/src/lib/tinyfish/stack";
import type { AppVariables } from "../auth/guards";
import { copyForwardHeaders } from "./forward";

export function localProductUpstream(
  slug: string,
  restPath: string,
  search = "",
): URL | undefined {
  const product = tinyFishProductBySlug(slug);
  if (!product) return undefined;
  const suffix = restPath.length > 0 ? restPath : "/";
  const path = suffix.startsWith("/") ? suffix : `/${suffix}`;
  const upstream = new URL(`http://127.0.0.1:${product.hostPort}${path}`);
  if (search) {
    upstream.search = search.startsWith("?") ? search.slice(1) : search;
  }
  return upstream;
}

export function createProductProxyHandler(options: {
  credentialFor?: (userId: string) => Promise<string | undefined>;
  fetch?: typeof fetch;
}) {
  const doFetch = options.fetch ?? fetch;

  return async (context: Context<{ Variables: AppVariables }>) => {
    const slug = context.req.param("slug");
    if (!slug || !tinyFishProductBySlug(slug)) {
      return context.json({ error: "Unknown TinyFish product." }, 404);
    }

    const rest = context.req.path.replace(
      new RegExp(`^/api/products/${slug}`),
      "",
    );
    const incoming = new URL(context.req.url);
    const upstream = localProductUpstream(slug, rest, incoming.search);
    if (!upstream) {
      return context.json({ error: "Unknown TinyFish product." }, 404);
    }

    const headers = copyForwardHeaders(context.req.raw.headers);
    headers.delete("cookie");
    const actor = context.var.actor;
    const bearer = actor ? await options.credentialFor?.(actor.id) : undefined;
    if (bearer) {
      headers.set("Authorization", `Bearer ${bearer}`);
    }

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
