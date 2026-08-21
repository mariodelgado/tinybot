import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TINYFISH_FLY_MACHINES,
  isRemoteProductUrl,
  productUrlEnvKeys,
  productUrlOverride,
  resolveProductCardUrl,
  resolveProductHealthUrl,
  resolveProductOrigin,
} from "../app/src/lib/tinyfish/origins";
import {
  TINYFISH_PRODUCTS,
  tinyFishProductBySlug,
} from "../app/src/lib/tinyfish/stack";
import {
  isConsumeContractPr,
  isOwnedSiblingCache,
  pickProductRef,
  resolveProductCheckoutRef,
} from "../scripts/tinyfish/latest";

const root = join(import.meta.dir, "..");

test("products are linked services: no vendor, submodule, or workspace install", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    workspaces?: string[];
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const names = [
    ...(pkg.workspaces ?? []),
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ].join(" ");
  expect(names).not.toContain("tiny-tail");
  expect(names).not.toContain("tiny-pipe");
  expect(names).not.toContain("tiny-kit");
  expect(names).not.toContain("tiny-web");
  expect(names).not.toContain("tinyfish-siblings");

  const gitignore = readFileSync(join(root, ".gitignore"), "utf8");
  expect(gitignore).toContain(".tinyfish-siblings/");

  const start = readFileSync(
    join(root, "scripts/tinyfish/start-products.ts"),
    "utf8",
  );
  expect(start).toContain("ensureLatestCheckout");
  expect(start).toContain("resolveProductCheckoutRef");
  expect(start).not.toContain("copyFileSync");
  expect(start).not.toContain("cp -r");
});

test("default branch with TINYBOT.md is latest; otherwise the consume-contract PR", () => {
  expect(
    pickProductRef({
      defaultBranch: "main",
      defaultHasTinybotMd: true,
      openPrs: [
        {
          number: 4,
          headRefName: "cursor/consume-contract",
          title: "Add TINYBOT.md consume contract",
          files: ["TINYBOT.md"],
        },
      ],
    }),
  ).toEqual({ ref: "main", source: "default" });

  expect(
    pickProductRef({
      defaultBranch: "main",
      defaultHasTinybotMd: false,
      openPrs: [
        { number: 1, headRefName: "docs", title: "readme" },
        {
          number: 2,
          headRefName: "cursor/tinybot-health-1a2b",
          title: "Honor PORT and GET /health",
          files: ["server.ts", "TINYBOT.md"],
        },
      ],
    }),
  ).toEqual({ ref: "cursor/tinybot-health-1a2b", source: "consume-pr" });

  expect(
    pickProductRef({
      defaultBranch: "main",
      defaultHasTinybotMd: false,
      openPrs: [
        {
          number: 3,
          headRefName: "feat/consume-contract",
          title: "consume-contract for TinyBot",
        },
      ],
    }),
  ).toEqual({ ref: "feat/consume-contract", source: "consume-pr" });

  expect(
    pickProductRef({
      defaultBranch: "main",
      defaultHasTinybotMd: false,
      openPrs: [],
    }),
  ).toEqual({ ref: "main", source: "default" });
});

test("isConsumeContractPr matches TINYBOT.md files or title", () => {
  expect(
    isConsumeContractPr({
      number: 1,
      headRefName: "x",
      title: "nits",
      files: ["README.md"],
    }),
  ).toBe(false);
  expect(
    isConsumeContractPr({
      number: 1,
      headRefName: "x",
      title: "nits",
      files: ["TINYBOT.md"],
    }),
  ).toBe(true);
});

test("resolveProductCheckoutRef falls back to main when GitHub is unavailable", async () => {
  const choice = await resolveProductCheckoutRef("mariodelgado/tiny-pipe", {
    defaultBranch: async () => {
      throw new Error("offline");
    },
    hasFile: async () => {
      throw new Error("offline");
    },
    listOpenPrs: async () => {
      throw new Error("offline");
    },
  });
  expect(choice).toEqual({ ref: "main", source: "default" });
});

test("owned sibling cache is only .tinyfish-siblings", () => {
  expect(
    isOwnedSiblingCache(
      "/workspace/.tinyfish-siblings/tiny-pipe",
      "/workspace",
      {},
    ),
  ).toBe(true);
  expect(isOwnedSiblingCache("/workspace/../tiny-pipe", "/workspace", {})).toBe(
    false,
  );
});

test("Fly / env overrides change origin; unset stays on localhost remap", () => {
  const tinypipe = tinyFishProductBySlug("tinypipe");
  const tinytail = tinyFishProductBySlug("tinytail");
  if (!tinypipe || !tinytail) throw new Error("catalog missing");

  expect(resolveProductOrigin(tinypipe)).toBe("http://127.0.0.1:3712");
  expect(resolveProductCardUrl(tinypipe)).toBe("http://127.0.0.1:3712/ui");
  expect(resolveProductHealthUrl(tinypipe)).toBe(
    "http://127.0.0.1:3712/health",
  );
  expect(isRemoteProductUrl(productUrlOverride(tinypipe, {}))).toBe(false);

  const fly = {
    TINYFISH_TINYPIPE_URL: TINYFISH_FLY_MACHINES.tinypipe.url,
    VITE_TINYFISH_JS_01_URL: TINYFISH_FLY_MACHINES.tinytail.url,
  };
  expect(resolveProductOrigin(tinypipe, fly)).toBe(
    "https://tf-tinypipe.fly.dev",
  );
  expect(resolveProductCardUrl(tinypipe, fly)).toBe(
    "https://tf-tinypipe.fly.dev/ui",
  );
  expect(resolveProductHealthUrl(tinypipe, fly)).toBe(
    "https://tf-tinypipe.fly.dev/health",
  );
  expect(resolveProductOrigin(tinytail, fly)).toBe(
    "https://tf-tinytail.fly.dev",
  );
  expect(productUrlEnvKeys(tinypipe)).toEqual({
    slug: "TINYFISH_TINYPIPE_URL",
    usage: "VITE_TINYFISH_TF_03_URL",
  });
  expect(TINYFISH_PRODUCTS.map((product) => product.slug)).not.toContain(
    "tinybot",
  );
});
