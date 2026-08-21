/**
 * Thin fetch client for the Fly Sprites HTTP API.
 *
 * Matches https://api.sprites.dev/v1 (the same contract `@fly/sprites` wraps). Fetch is
 * injected so tests never touch api.sprites.dev.
 */

export const SPRITES_API_BASE = "https://api.sprites.dev/v1";

export type SpriteUrlAuth = "sprite" | "public";

export type SpriteRecord = {
  id: string;
  name: string;
  organization?: string;
  url: string;
  url_settings: { auth: SpriteUrlAuth };
  status: "cold" | "warm" | "running";
  created_at?: string;
  updated_at?: string;
};

export type SpriteServiceRequest = {
  cmd: string;
  args: string[];
  env?: Record<string, string>;
  dir?: string;
  needs?: string[];
  http_port?: number;
};

export type SpriteService = SpriteServiceRequest & {
  name: string;
  http_port?: number | null;
};

export type SpritesClient = {
  getSprite: (name: string) => Promise<SpriteRecord | null>;
  createSprite: (name: string) => Promise<SpriteRecord>;
  listServices: (name: string) => Promise<SpriteService[]>;
  putService: (
    name: string,
    serviceName: string,
    body: SpriteServiceRequest,
  ) => Promise<void>;
  exec: (name: string, cmd: string) => Promise<void>;
};

export function spritesTokenFrom(
  environment: Record<string, string | undefined>,
): string | undefined {
  const token =
    environment.SPRITES_TOKEN?.trim() || environment.SPRITE_TOKEN?.trim();
  return token ? token : undefined;
}

export function createSpritesClient(options: {
  token: string;
  apiUrl?: string;
  fetch?: typeof fetch;
}): SpritesClient {
  const apiUrl = (options.apiUrl ?? SPRITES_API_BASE).replace(/\/$/, "");
  const doFetch = options.fetch ?? fetch;

  async function request(
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    return doFetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${options.token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  }

  return {
    getSprite: async (name) => {
      const response = await request(`/sprites/${encodeURIComponent(name)}`);
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(`Sprites GET ${name} failed (${response.status}).`);
      }
      return (await response.json()) as SpriteRecord;
    },
    createSprite: async (name) => {
      const response = await request("/sprites", {
        method: "POST",
        body: JSON.stringify({
          name,
          url_settings: { auth: "sprite" },
        }),
      });
      if (!response.ok) {
        throw new Error(`Sprites create ${name} failed (${response.status}).`);
      }
      return (await response.json()) as SpriteRecord;
    },
    listServices: async (name) => {
      const response = await request(
        `/sprites/${encodeURIComponent(name)}/services`,
      );
      if (response.status === 404) return [];
      if (!response.ok) {
        throw new Error(
          `Sprites list services ${name} failed (${response.status}).`,
        );
      }
      return (await response.json()) as SpriteService[];
    },
    putService: async (name, serviceName, body) => {
      const response = await request(
        `/sprites/${encodeURIComponent(name)}/services/${encodeURIComponent(serviceName)}`,
        { method: "PUT", body: JSON.stringify(body) },
      );
      if (!response.ok) {
        throw new Error(
          `Sprites PUT service ${serviceName} failed (${response.status}).`,
        );
      }
    },
    exec: async (name, cmd) => {
      const response = await request(
        `/sprites/${encodeURIComponent(name)}/exec?cmd=${encodeURIComponent(cmd)}`,
        { method: "POST" },
      );
      if (!response.ok) {
        throw new Error(`Sprites exec ${name} failed (${response.status}).`);
      }
    },
  };
}
