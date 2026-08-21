import type { Context } from "hono";
import {
  type EnvBag,
  productUpstream,
} from "../../../app/src/lib/tinyfish/origins";
import { tinyFishProductBySlug } from "../../../app/src/lib/tinyfish/stack";
import type { AppVariables } from "../auth/guards";
import { copyForwardHeaders } from "./forward";

export function localProductUpstream(
  slug: string,
  restPath: string,
  search = "",
  env: EnvBag = process.env,
) {
  return productUpstream(slug, restPath, search, env);
}

export function createProductProxyHandler(options: {
  credentialFor?: (userId: string) => Promise<string | undefined>;
  fetch?: typeof fetch;
  env?: EnvBag;
}) {
  const doFetch = options.fetch ?? fetch;
  const env = options.env ?? process.env;

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
    const upstream = localProductUpstream(slug, rest, incoming.search, env);
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

    try {
      const response = await doFetch(upstream, { method, headers, body });
      const outbound = new Headers(response.headers);
      outbound.delete("set-cookie");
      return new Response(response.body, {
        status: response.status,
        headers: outbound,
      });
    } catch {
      return context.json({ error: "Product backend is unreachable." }, 502);
    }
  };
}
