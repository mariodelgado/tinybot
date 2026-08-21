/**
 * Package-provided TinyFish coworkers: the six product slugs, in start order.
 * TinyPipe is first so an empty roster / composer fallback reaches auth first.
 */

import { productsInStartOrder } from "./stack";

export const TINYFISH_DEFAULT_AGENT_IDS = productsInStartOrder().map(
  (product) => product.slug,
);

export const TINYFISH_DEFAULT_AGENT_NAMES = productsInStartOrder().map(
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

/** Composer fallback: TinyPipe, then Tail, Pulse, Web, Watch, Kit. */
export function composerFallbackAgent<T extends ListedAgent>(
  agents: T[] | undefined,
): T | undefined {
  const explore = exploreTinyFishAgents(agents);
  return explore[0] ?? agents?.[0];
}
