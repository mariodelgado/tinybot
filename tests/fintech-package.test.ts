import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadTenantPackage } from "../server/src/tenant-package";

const fintechDirectory = join(import.meta.dir, "..", "examples", "fintech");

const TINYFISH_AGENT_IDS = [
  "tinypipe",
  "tinytail",
  "tinypulse",
  "tinyweb",
  "tinywatch",
  "tinykit",
] as const;

const OPENBOT_SAMPLE_IDS = [
  "general-assistant",
  "knowledge",
  "risk-analyst",
] as const;

test("includes the complete fintech deployment package example", () => {
  for (const fileName of [
    "brand.yaml",
    "agents.yaml",
    "channels.yaml",
    "model.yaml",
    "knowledge.yaml",
  ]) {
    expect(existsSync(join(fintechDirectory, fileName))).toBe(true);
  }

  expect(readFileSync(join(fintechDirectory, "brand.yaml"), "utf8")).toContain(
    "id: openbot",
  );
  expect(readFileSync(join(fintechDirectory, "model.yaml"), "utf8")).toContain(
    "default_model: stealth/ox-alpha",
  );
});

test("seeds exactly the six TinyFish products as built-in agents", async () => {
  const tenantPackage = await loadTenantPackage(fintechDirectory);
  const ids = tenantPackage.agents.map((agent) => agent.id);

  expect(ids).toEqual([...TINYFISH_AGENT_IDS]);
  expect(tenantPackage.agents).toHaveLength(6);
  expect(tenantPackage.agents.every((agent) => agent.type === "built_in")).toBe(
    true,
  );
  for (const leftover of OPENBOT_SAMPLE_IDS) {
    expect(ids).not.toContain(leftover);
  }
  expect(tenantPackage.channels.map((channel) => channel.id)).toEqual([
    ...TINYFISH_AGENT_IDS,
  ]);
});
