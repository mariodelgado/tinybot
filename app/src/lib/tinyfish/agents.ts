/**
 * Package-provided TinyFish coworkers: the 11 board slugs, TinyPing first.
 * Platform backends (TinyPipe, TinyTail, TinyWeb, TinyKit) are not empty-state agents.
 */

import { boardProductsInStartOrder } from "./stack";

export const TINYFISH_DEFAULT_AGENT_IDS = boardProductsInStartOrder().map(
  (product) => product.slug,
);

export const TINYFISH_DEFAULT_AGENT_NAMES = boardProductsInStartOrder().map(
  (product) => product.title,
);

type ListedAgent = {
  id: string;
  name: string;
  mine?: boolean;
  visibility?: string;
};

export function exploreTinyFishAgents<T extends ListedAgent>(
  agents: T[] | undefined,
): T[] {
  const explore = (agents ?? []).filter(
    (agent) => !agent.mine && agent.visibility === "public",
  );
  const rank = new Map(
    TINYFISH_DEFAULT_AGENT_IDS.map((id, index) => [id, index]),
  );
  return [...explore].sort((left, right) => {
    const leftRank = rank.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rank.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank;
  });
}

/** Composer fallback: TinyPing, then the rest of the board in start order. */
export function composerFallbackAgent<T extends ListedAgent>(
  agents: T[] | undefined,
): T | undefined {
  const explore = exploreTinyFishAgents(agents);
  return explore[0] ?? agents?.[0];
}
