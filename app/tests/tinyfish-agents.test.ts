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
  { id: "tinypipe", name: "TinyPipe" },
  { id: "tinywatch", name: "TinyWatch" },
  { id: "tinypulse", name: "TinyPulse" },
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
  test("lists the 11 board products, TinyPing first", () => {
    expect(TINYFISH_DEFAULT_AGENT_IDS).toEqual([
      "tinyping",
      "tinytrigger",
      "tinyreg",
      "tinyscout",
      "tinybrief",
      "tinydeed",
      "tinyfeed",
      "tinyfoundry",
      "tinymargin",
      "tinyatlas",
      "tinyprior",
    ]);
    expect(TINYFISH_DEFAULT_AGENT_NAMES).toEqual([
      "TinyPing",
      "TinyTrigger",
      "TinyReg",
      "TinyScout",
      "TinyBrief",
      "TinyDeed",
      "TinyFeed",
      "TinyFoundry",
      "TinyMargin",
      "TinyAtlas",
      "TinyPrior",
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

  test("composer fallback prefers TinyPing, then the others in start order", () => {
    expect(composerFallbackAgent(publicRoster())?.id).toBe("tinyping");
    expect(composerFallbackAgent(publicRoster())?.name).toBe("TinyPing");
    expect(
      composerFallbackAgent(
        publicRoster().filter((agent) => agent.id !== "tinyping"),
      )?.id,
    ).toBe("tinytrigger");
  });

  test("does not treat leftover OpenBot samples or old six-only ids as the default explore set", () => {
    const mixed = [
      ...leftover.map((agent) => ({
        ...agent,
        mine: false,
        visibility: "public" as const,
      })),
      ...publicRoster(),
    ];
    const explore = exploreTinyFishAgents(mixed);
    expect(explore.map((agent) => agent.name).slice(0, 11)).toEqual([
      ...TINYFISH_DEFAULT_AGENT_NAMES,
    ]);
    expect(composerFallbackAgent(mixed)?.id).toBe("tinyping");
  });

  test("an empty personal roster still shows the 11 public board products", () => {
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
    expect(explore).toHaveLength(11);
    expect(explore.every((agent) => !agent.mine)).toBe(true);
    expect(explore.map((agent) => agent.name)).toEqual([
      ...TINYFISH_DEFAULT_AGENT_NAMES,
    ]);
  });
});
