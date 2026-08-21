/**
 * Hop-by-hop headers TinyBot must not forward when proxying to a product
 * or a Sprite. Same set for both consume paths.
 */
export const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

export function copyForwardHeaders(incoming: Headers): Headers {
  const headers = new Headers();
  for (const [key, value] of incoming.entries()) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  }
  return headers;
}
