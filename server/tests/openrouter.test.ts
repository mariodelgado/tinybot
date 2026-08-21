import { describe, expect, spyOn, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyOpenRouterEnvironment,
  createOpenRouterFallbackFetch,
  installOpenRouterFallbackFetch,
  isOpenRouterEnabled,
  OPENROUTER_BASE_URL,
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_FALLBACK_MODEL,
  resolveInferenceSettings,
} from "../src/inference/openrouter";

const TEST_KEY = "test-openrouter-key";
const COMPLETIONS = `${OPENROUTER_BASE_URL}/chat/completions`;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function completionRequest(model = OPENROUTER_DEFAULT_MODEL) {
  return {
    method: "POST" as const,
    headers: {
      authorization: `Bearer ${TEST_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "hello" }],
    }),
  };
}

describe("OpenRouter inference settings", () => {
  test("OPENROUTER_API_KEY sets the OpenRouter base URL and Ox Alpha default", () => {
    const settings = resolveInferenceSettings({
      OPENROUTER_API_KEY: TEST_KEY,
    });

    expect(settings).toEqual({
      openRouter: true,
      baseUrl: OPENROUTER_BASE_URL,
      defaultModel: OPENROUTER_DEFAULT_MODEL,
      fallbackModel: OPENROUTER_FALLBACK_MODEL,
    });

    const applied = applyOpenRouterEnvironment({
      OPENROUTER_API_KEY: TEST_KEY,
      OPENAI_BASE_URL: "https://gateway.internal/v1",
      BOT_PROVIDER: "anthropic",
    });
    expect(applied.OPENAI_API_KEY).toBe(TEST_KEY);
    expect(applied.OPENAI_BASE_URL).toBe(OPENROUTER_BASE_URL);
    expect(applied.BOT_PROVIDER).toBe("openai");
    expect(applied.BOT_MODEL).toBe(OPENROUTER_DEFAULT_MODEL);
  });

  test("accepts OPENAI_API_KEY only when OPENAI_BASE_URL already points at OpenRouter", () => {
    expect(
      isOpenRouterEnabled({
        OPENAI_API_KEY: TEST_KEY,
        OPENAI_BASE_URL: OPENROUTER_BASE_URL,
      }),
    ).toBe(true);
    expect(
      isOpenRouterEnabled({
        OPENAI_API_KEY: TEST_KEY,
        OPENAI_BASE_URL: "https://gateway.internal/v1",
      }),
    ).toBe(false);
  });

  test("does not enable OpenRouter or call openrouter.ai when the key is unset", () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(typeof input === "string" ? input : input.toString());
      throw new Error("fetch should not run when OpenRouter is unset");
    }) as typeof fetch;

    try {
      const environment = {
        OPENAI_API_KEY: "local-dev-key",
        OPENAI_BASE_URL: "https://gateway.internal/v1",
        BOT_MODEL: "gpt-4.1",
      };
      const fetchBeforeInstall = globalThis.fetch;
      expect(isOpenRouterEnabled(environment)).toBe(false);
      expect(resolveInferenceSettings(environment).baseUrl).toBe(
        "https://gateway.internal/v1",
      );
      expect(applyOpenRouterEnvironment(environment)).toEqual(environment);
      installOpenRouterFallbackFetch(environment);
      expect(globalThis.fetch).toBe(fetchBeforeInstall);
      expect(calls).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("OpenRouter one-shot fallback", () => {
  test("retries Ox Alpha HTTP 503 once on Grok 4.6", async () => {
    const models: string[] = [];
    const urls: string[] = [];
    const logs: string[] = [];
    const info = spyOn(console, "info").mockImplementation((value) => {
      logs.push(String(value));
    });

    const mockFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      urls.push(url);
      const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string };
      models.push(body.model ?? "");
      if (body.model === OPENROUTER_DEFAULT_MODEL) {
        return jsonResponse(503, { error: { message: "unavailable" } });
      }
      return jsonResponse(200, {
        choices: [{ message: { content: "from grok" } }],
      });
    }) as typeof fetch;

    try {
      const fetchWithFallback = createOpenRouterFallbackFetch(mockFetch);
      const response = await fetchWithFallback(
        COMPLETIONS,
        completionRequest(),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        choices: [{ message: { content: "from grok" } }],
      });
      expect(urls).toEqual([COMPLETIONS, COMPLETIONS]);
      expect(models).toEqual([
        OPENROUTER_DEFAULT_MODEL,
        OPENROUTER_FALLBACK_MODEL,
      ]);
      expect(logs.some((line) => line.includes("inference-fallback"))).toBe(
        true,
      );
      expect(
        logs.some((line) => line.includes(OPENROUTER_FALLBACK_MODEL)),
      ).toBe(true);
      expect(logs.join("\n")).not.toContain(TEST_KEY);
      expect(logs.join("\n")).not.toContain(`${["sk", "or"].join("-")}-`);
    } finally {
      info.mockRestore();
    }
  });

  test("does not retry Ox Alpha HTTP 401", async () => {
    const models: string[] = [];
    const mockFetch = (async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string };
      models.push(body.model ?? "");
      return jsonResponse(401, { error: { message: "invalid key" } });
    }) as typeof fetch;

    const fetchWithFallback = createOpenRouterFallbackFetch(mockFetch);
    const response = await fetchWithFallback(COMPLETIONS, completionRequest());
    expect(response.status).toBe(401);
    expect(models).toEqual([OPENROUTER_DEFAULT_MODEL]);
  });

  test("does not retry Ox Alpha HTTP 403", async () => {
    const models: string[] = [];
    const mockFetch = (async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string };
      models.push(body.model ?? "");
      return jsonResponse(403, { error: { message: "forbidden" } });
    }) as typeof fetch;

    const fetchWithFallback = createOpenRouterFallbackFetch(mockFetch);
    const response = await fetchWithFallback(COMPLETIONS, completionRequest());
    expect(response.status).toBe(403);
    expect(models).toEqual([OPENROUTER_DEFAULT_MODEL]);
  });

  test("retries an empty OpenRouter completion once on Grok 4.6", async () => {
    const models: string[] = [];
    const mockFetch = (async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string };
      models.push(body.model ?? "");
      if (body.model === OPENROUTER_DEFAULT_MODEL) {
        return jsonResponse(200, { choices: [] });
      }
      return jsonResponse(200, {
        choices: [{ message: { content: "from grok" } }],
      });
    }) as typeof fetch;

    const fetchWithFallback = createOpenRouterFallbackFetch(mockFetch);
    const response = await fetchWithFallback(COMPLETIONS, completionRequest());
    expect(response.status).toBe(200);
    expect(models).toEqual([
      OPENROUTER_DEFAULT_MODEL,
      OPENROUTER_FALLBACK_MODEL,
    ]);
  });
});

describe("OpenRouter fixtures stay mock-only", () => {
  test("this suite does not contain a live OpenRouter key prefix", () => {
    const liveKeyPrefix = `${["sk", "or"].join("-")}-`;
    const source = readFileSync(import.meta.path, "utf8");
    expect(source).not.toContain(liveKeyPrefix);
    expect(source).toContain("https://openrouter.ai/api/v1");
    expect(TEST_KEY).toBe("test-openrouter-key");
  });

  test(".env.example documents OpenRouter without a real key", () => {
    const example = readFileSync(
      join(import.meta.dir, "..", "..", ".env.example"),
      "utf8",
    );
    expect(example).toContain("OPENROUTER_API_KEY=");
    expect(example).toContain("stealth/ox-alpha");
    expect(example).toContain("x-ai/grok-4.6");
    expect(example).not.toContain(`${["sk", "or"].join("-")}-`);
    expect(example).toMatch(/Never commit a real key/i);
  });

  test("start.sh forces the OpenRouter base URL from OPENROUTER_API_KEY", () => {
    const start = readFileSync(
      join(import.meta.dir, "..", "..", "scripts", "start.sh"),
      "utf8",
    );
    expect(start).toContain("OPENROUTER_API_KEY");
    expect(start).toContain("https://openrouter.ai/api/v1");
    expect(start).toContain("stealth/ox-alpha");
    expect(start).not.toContain(`${["sk", "or"].join("-")}-`);
  });
});
