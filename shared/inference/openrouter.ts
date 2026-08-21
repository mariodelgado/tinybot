/**
 * TinyBot inference through OpenRouter's OpenAI-compatible API.
 *
 * One client: the existing OpenAI-shaped path (`OPENAI_BASE_URL` + chat completions).
 * Ox Alpha is first; a retryable failure is tried once on Grok 4.6. 401/403 are not retried.
 * The key is never logged.
 */

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const OPENROUTER_DEFAULT_MODEL = "stealth/ox-alpha";
export const OPENROUTER_FALLBACK_MODEL = "x-ai/grok-4.6";

export type InferenceSettings = {
  openRouter: boolean;
  baseUrl?: string;
  defaultModel: string;
  fallbackModel: string;
};

export function isOpenRouterBaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return new URL(value).hostname === "openrouter.ai";
  } catch {
    return false;
  }
}

export function isOpenRouterEnabled(
  environment: Record<string, string | undefined>,
): boolean {
  return resolveInferenceSettings(environment).openRouter;
}

export function resolveInferenceSettings(
  environment: Record<string, string | undefined>,
): InferenceSettings {
  const openRouterKey = environment.OPENROUTER_API_KEY?.trim();
  const openaiKey = environment.OPENAI_API_KEY?.trim();
  const configuredBase = environment.OPENAI_BASE_URL?.trim();
  const openRouter =
    Boolean(openRouterKey) ||
    (Boolean(openaiKey) && isOpenRouterBaseUrl(configuredBase));

  if (openRouter) {
    return {
      openRouter: true,
      baseUrl: OPENROUTER_BASE_URL,
      defaultModel: environment.BOT_MODEL?.trim() || OPENROUTER_DEFAULT_MODEL,
      fallbackModel: OPENROUTER_FALLBACK_MODEL,
    };
  }

  return {
    openRouter: false,
    ...(configuredBase ? { baseUrl: configuredBase } : {}),
    defaultModel: environment.BOT_MODEL?.trim() || OPENROUTER_DEFAULT_MODEL,
    fallbackModel: OPENROUTER_FALLBACK_MODEL,
  };
}

export function resolveOpenRouterApiKey(
  environment: Record<string, string | undefined>,
): string | undefined {
  const dedicated = environment.OPENROUTER_API_KEY?.trim();
  if (dedicated) return dedicated;
  if (
    isOpenRouterBaseUrl(environment.OPENAI_BASE_URL) &&
    environment.OPENAI_API_KEY?.trim()
  ) {
    return environment.OPENAI_API_KEY.trim();
  }
  return undefined;
}

/**
 * Point the existing OpenAI-compatible env at OpenRouter when a dedicated key is present.
 * Does not invent a second client.
 */
export function applyOpenRouterEnvironment(
  environment: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const key = resolveOpenRouterApiKey(environment);
  if (!key) {
    return environment;
  }
  return {
    ...environment,
    OPENAI_API_KEY: key,
    OPENAI_BASE_URL: OPENROUTER_BASE_URL,
    BOT_PROVIDER: "openai",
    BOT_MODEL: environment.BOT_MODEL?.trim() || OPENROUTER_DEFAULT_MODEL,
  };
}

export function isRetryableInferenceStatus(status: number): boolean {
  if (status === 401 || status === 403) return false;
  return status === 408 || status === 429 || status >= 500;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function requestBodyText(init?: RequestInit): string | undefined {
  if (!init?.body) return undefined;
  if (typeof init.body === "string") return init.body;
  if (init.body instanceof Uint8Array) {
    return new TextDecoder().decode(init.body);
  }
  if (init.body instanceof ArrayBuffer) {
    return new TextDecoder().decode(init.body);
  }
  return undefined;
}

function modelFromBody(body: string | undefined): string | undefined {
  if (!body) return undefined;
  try {
    const parsed = JSON.parse(body) as { model?: unknown };
    return typeof parsed.model === "string" ? parsed.model : undefined;
  } catch {
    return undefined;
  }
}

function withModel(body: string, model: string): string {
  const parsed = JSON.parse(body) as Record<string, unknown>;
  parsed.model = model;
  return JSON.stringify(parsed);
}

async function responseLooksUnavailable(response: Response): Promise<boolean> {
  if (isRetryableInferenceStatus(response.status)) return true;
  if (response.status === 401 || response.status === 403) return false;
  if (response.status !== 200) return false;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return false;
  const clone = response.clone();
  try {
    const body = (await clone.json()) as {
      error?: unknown;
      choices?: unknown[];
    };
    if (body.error) return true;
    if (Array.isArray(body.choices) && body.choices.length === 0) return true;
    return false;
  } catch {
    return true;
  }
}

function logInference(event: Record<string, string>) {
  console.info(JSON.stringify(event));
}

function logFallback(from: string, to: string, reason: string) {
  logInference({
    type: "inference-fallback",
    from,
    to,
    reason,
  });
}

function logServed(model: string) {
  logInference({
    type: "inference-served",
    model,
  });
}

/**
 * OpenAI-compatible fetch: one retry on Grok 4.6 when Ox Alpha fails.
 * Pass-through for anything that is not POST /chat/completions.
 */
export function createOpenRouterFallbackFetch(
  baseFetch: typeof fetch = fetch,
  models: {
    defaultModel?: string;
    fallbackModel?: string;
  } = {},
): typeof fetch {
  const defaultModel = models.defaultModel ?? OPENROUTER_DEFAULT_MODEL;
  const fallbackModel = models.fallbackModel ?? OPENROUTER_FALLBACK_MODEL;

  const wrapped: typeof fetch = async (input, init) => {
    const url = requestUrl(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method !== "POST" || !url.includes("/chat/completions")) {
      return baseFetch(input, init);
    }

    const body = requestBodyText(init);
    const requested = modelFromBody(body) ?? defaultModel;

    let first: Response;
    try {
      first = await baseFetch(input, init);
    } catch (error) {
      if (requested === fallbackModel) throw error;
      logFallback(requested, fallbackModel, "network");
      if (!body) throw error;
      const retry = await baseFetch(input, {
        ...init,
        body: withModel(body, fallbackModel),
      });
      logServed(fallbackModel);
      return retry;
    }

    if (requested === fallbackModel) {
      logServed(requested);
      return first;
    }
    if (first.status === 401 || first.status === 403) return first;
    if (!(await responseLooksUnavailable(first))) {
      logServed(requested);
      return first;
    }

    logFallback(requested, fallbackModel, `http-${first.status}`);
    if (!body) return first;
    const retry = await baseFetch(input, {
      ...init,
      body: withModel(body, fallbackModel),
    });
    logServed(fallbackModel);
    return retry;
  };
  wrapped.preconnect =
    typeof baseFetch.preconnect === "function"
      ? baseFetch.preconnect.bind(baseFetch)
      : () => undefined;
  return wrapped;
}

export function installOpenRouterFallbackFetch(
  environment: Record<string, string | undefined> = process.env,
) {
  if (!resolveInferenceSettings(environment).openRouter) {
    return;
  }
  globalThis.fetch = createOpenRouterFallbackFetch(globalThis.fetch);
}
