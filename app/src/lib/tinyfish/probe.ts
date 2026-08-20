export type TinyFishReachability = "checking" | "online" | "offline";

const DEFAULT_TIMEOUT_MS = 1_500;

/**
 * Best-effort reachability for a localhost mini-app.
 *
 * Uses `no-cors` so a live server that does not grant CORS still counts as up. A refused
 * connection, a timeout, or any other network failure is offline. The start page still opens
 * the in-app route either way.
 */
export async function probeTinyFishApp(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Exclude<TinyFishReachability, "checking">> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    return "online";
  } catch {
    return "offline";
  } finally {
    clearTimeout(timer);
  }
}
