import { describe, expect, test } from "bun:test";
import {
  TINYFISH_DEFAULT_AGENT_IDS,
  TINYFISH_DEFAULT_AGENT_NAMES,
  composerFallbackAgent,
  exploreTinyFishAgents,
} from "../src/lib/tinyfish/agents";

const leftover = [
  { id: "general-assistant", name: "General Assistant" },
  { id: "knowledge", name: "Knowledge" },
  { id: "risk-analyst", name: "Risk Analyst" },
];

function publicRoster() {
  return TINYFISH_DEFAULT_AGENT_IDS.map((id, index) => ({
    id,
    name: TINYFISH_DEFAULT_AGENT_NAMES[index] ?? id,
    mine: false,
    visibility: "public" as const,
  }));
}

describe("empty roster / default explore", () => {
  test("lists the six TinyFish products in start order", () => {
    expect(TINYFISH_DEFAULT_AGENT_IDS).toEqual([
      "tinypipe",
      "tinytail",
      "tinypulse",
      "tinyweb",
      "tinywatch",
      "tinykit",
    ]);
    expect(TINYFISH_DEFAULT_AGENT_NAMES).toEqual([
      "TinyPipe",
      "TinyTail",
      "TinyPulse",
      "TinyWeb",
      "TinyWatch",
      "TinyKit",
    ]);

    const shuffled = [...publicRoster()].reverse();
    const explore = exploreTinyFishAgents(shuffled);
    expect(explore.map((agent) => agent.id)).toEqual([
      ...TINYFISH_DEFAULT_AGENT_IDS,
    ]);
    expect(explore.map((agent) => agent.name)).toEqual([
      ...TINYFISH_DEFAULT_AGENT_NAMES,
    ]);
  });

  test("composer fallback prefers TinyPipe, then the others in start order", () => {
    expect(composerFallbackAgent(publicRoster())?.id).toBe("tinypipe");
    expect(composerFallbackAgent(publicRoster())?.name).toBe("TinyPipe");
    expect(
      composerFallbackAgent(
        publicRoster().filter((agent) => agent.id !== "tinypipe"),
      )?.id,
    ).toBe("tinytail");
  });

  test("does not treat leftover OpenBot sample ids as the default explore set", () => {
    const mixed = [
      ...leftover.map((agent) => ({
        ...agent,
        mine: false,
        visibility: "public" as const,
      })),
      ...publicRoster(),
    ];
    const explore = exploreTinyFishAgents(mixed);
    expect(explore.map((agent) => agent.name).slice(0, 6)).toEqual([
      ...TINYFISH_DEFAULT_AGENT_NAMES,
    ]);
    expect(composerFallbackAgent(mixed)?.id).toBe("tinypipe");
  });

  test("an empty personal roster still shows the six public products", () => {
    const agents = [
      ...publicRoster(),
      {
        id: "mine-only",
        name: "Personal",
        mine: true,
        visibility: "private" as const,
      },
    ];
    const explore = exploreTinyFishAgents(agents);
    expect(explore).toHaveLength(6);
    expect(explore.every((agent) => !agent.mine)).toBe(true);
    expect(explore.map((agent) => agent.name)).toEqual([
      ...TINYFISH_DEFAULT_AGENT_NAMES,
    ]);
  });
});
