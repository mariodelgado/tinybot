/**
 * How empty-state TinyFish agents call a product backend.
 *
 * Consume path is /api/products/:slug/* → 127.0.0.1:<hostPort>.
 * Do not invent product routes. TinyPipe POSTs /mcp, TinyTail uses /v1/as-of,
 * other slugs pass the path through.
 */

import { z } from "zod";
import { tinyFishProductBySlug } from "../../../app/src/lib/tinyfish/stack";
import type { GrantedTool } from "../plugins/tools";
import { copyForwardHeaders } from "./forward";
import { localProductUpstream } from "./products-proxy";

const TINYFISH_AGENT_IDS = new Set([
  "tinypipe",
  "tinytail",
  "tinypulse",
  "tinyweb",
  "tinywatch",
  "tinykit",
]);

const DEFAULT_CALL: Record<string, { path: string; method: string }> = {
  tinypipe: { path: "/mcp", method: "POST" },
  tinytail: { path: "/v1/as-of", method: "GET" },
};

export type ProductBackendCall = {
  slug: string;
  path?: string;
  method?: string;
  body?: unknown;
  query?: string;
  bearer?: string;
};

export async function callProductBackend(
  input: ProductBackendCall,
  doFetch: typeof fetch = fetch,
): Promise<{ status: number; text: string }> {
  const product = tinyFishProductBySlug(input.slug);
  if (!product) {
    return { status: 404, text: "Unknown TinyFish product." };
  }
  const fallback = DEFAULT_CALL[input.slug] ?? { path: "/", method: "GET" };
  const path = input.path?.trim() || fallback.path;
  const method = (input.method?.trim() || fallback.method).toUpperCase();
  const upstream = localProductUpstream(input.slug, path, input.query ?? "");
  if (!upstream) {
    return { status: 404, text: "Unknown TinyFish product." };
  }

  const headers = copyForwardHeaders(new Headers());
  headers.set("content-type", "application/json");
  if (input.bearer) {
    headers.set("Authorization", `Bearer ${input.bearer}`);
  }

  const hasBody =
    method !== "GET" && method !== "HEAD" && input.body !== undefined;
  const response = await doFetch(upstream, {
    method,
    headers,
    body: hasBody ? JSON.stringify(input.body) : undefined,
  });
  return { status: response.status, text: await response.text() };
}

export function productBackendTools(options: {
  botId: string;
  credentialFor?: (actorId: string) => Promise<string | undefined>;
  actorId: string;
  fetch?: typeof fetch;
}): GrantedTool[] {
  if (!TINYFISH_AGENT_IDS.has(options.botId)) {
    return [];
  }
  const slug = options.botId;
  const fallback = DEFAULT_CALL[slug] ?? { path: "/", method: "GET" };
  return [
    {
      name: "call_product_backend",
      description: [
        `Call the ${slug} backend through TinyBot's /api/products/${slug} proxy.`,
        `Default ${fallback.method} ${fallback.path}.`,
        "Pass path/method to reach another route on that product. Do not invent a seventh product.",
        "Gates stay in the product: read-only Tail, no facility mint, deny-list wins, T1 required, failed evals cannot instantiate, fixture CIMD only.",
      ].join(" "),
      parameters: z.object({
        path: z.string().optional(),
        method: z.string().optional(),
        body: z.unknown().optional(),
        query: z.string().optional(),
      }),
      execute: async (args: unknown) => {
        const parsed =
          args && typeof args === "object" && !Array.isArray(args)
            ? (args as {
                path?: unknown;
                method?: unknown;
                body?: unknown;
                query?: unknown;
              })
            : {};
        const bearer = options.credentialFor
          ? await options.credentialFor(options.actorId)
          : undefined;
        const result = await callProductBackend(
          {
            slug,
            path: typeof parsed.path === "string" ? parsed.path : undefined,
            method:
              typeof parsed.method === "string" ? parsed.method : undefined,
            body: parsed.body,
            query: typeof parsed.query === "string" ? parsed.query : undefined,
            bearer,
          },
          options.fetch,
        );
        return result.text || `HTTP ${result.status}`;
      },
    },
  ];
}
