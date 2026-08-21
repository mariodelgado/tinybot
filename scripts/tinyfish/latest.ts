/**
 * Take the latest product code as a linked service checkout.
 *
 * Clone/fetch the default branch, or the open consume-contract PR when that
 * branch has no TINYBOT.md. Never copy product files into the TinyBot tree.
 */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { siblingRepoDirName } from "./ports";

export const CONSUME_CONTRACT_FILE = "TINYBOT.md";

export type ProductPr = {
  number: number;
  headRefName: string;
  title: string;
  files?: string[];
};

export type ProductRefChoice = {
  ref: string;
  source: "default" | "consume-pr";
};

export function isConsumeContractPr(pr: ProductPr): boolean {
  if (
    pr.files?.some(
      (path) => path === CONSUME_CONTRACT_FILE || path.endsWith("/TINYBOT.md"),
    )
  ) {
    return true;
  }
  return /consume[- ]contract|TINYBOT\.md/i.test(pr.title);
}

export function pickProductRef(input: {
  defaultBranch: string;
  defaultHasTinybotMd: boolean;
  openPrs: ProductPr[];
}): ProductRefChoice {
  if (input.defaultHasTinybotMd) {
    return { ref: input.defaultBranch, source: "default" };
  }
  const pr = input.openPrs.find(isConsumeContractPr);
  if (pr) {
    return { ref: pr.headRefName, source: "consume-pr" };
  }
  return { ref: input.defaultBranch, source: "default" };
}

export function isOwnedSiblingCache(
  dir: string,
  root: string,
  env: Record<string, string | undefined> = {},
): boolean {
  const normalized = resolve(dir);
  const configured = env.TINYFISH_SIBLINGS_DIR
    ? resolve(env.TINYFISH_SIBLINGS_DIR)
    : resolve(root, ".tinyfish-siblings");
  return normalized === configured || normalized.startsWith(`${configured}/`);
}

export type ProductRepoClient = {
  defaultBranch: (repo: string) => Promise<string>;
  hasFile: (repo: string, ref: string, path: string) => Promise<boolean>;
  listOpenPrs: (repo: string) => Promise<ProductPr[]>;
};

export async function resolveProductCheckoutRef(
  repo: string,
  client: ProductRepoClient,
): Promise<ProductRefChoice> {
  let defaultBranch = "main";
  try {
    defaultBranch = await client.defaultBranch(repo);
  } catch {
    defaultBranch = "main";
  }
  let defaultHasTinybotMd = false;
  try {
    defaultHasTinybotMd = await client.hasFile(
      repo,
      defaultBranch,
      CONSUME_CONTRACT_FILE,
    );
  } catch {
    defaultHasTinybotMd = false;
  }
  let openPrs: ProductPr[] = [];
  if (!defaultHasTinybotMd) {
    try {
      openPrs = await client.listOpenPrs(repo);
    } catch {
      openPrs = [];
    }
  }
  return pickProductRef({
    defaultBranch,
    defaultHasTinybotMd,
    openPrs,
  });
}

export function createGhProductRepoClient(options: {
  run: (
    args: string[],
    extra?: { cwd?: string },
  ) => Promise<{ ok: boolean; stdout: string; stderr: string }>;
}): ProductRepoClient {
  return {
    defaultBranch: async (repo) => {
      const result = await options.run([
        "repo",
        "view",
        repo,
        "--json",
        "defaultBranchRef",
      ]);
      if (!result.ok) return "main";
      const parsed = JSON.parse(result.stdout) as {
        defaultBranchRef?: { name?: string };
      };
      return parsed.defaultBranchRef?.name || "main";
    },
    hasFile: async (repo, ref, path) => {
      const result = await options.run([
        "api",
        `repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`,
      ]);
      return result.ok;
    },
    listOpenPrs: async (repo) => {
      const withFiles = await options.run([
        "pr",
        "list",
        "--repo",
        repo,
        "--state",
        "open",
        "--limit",
        "50",
        "--json",
        "number,title,headRefName,files",
      ]);
      const raw = withFiles.ok
        ? withFiles.stdout
        : (
            await options.run([
              "pr",
              "list",
              "--repo",
              repo,
              "--state",
              "open",
              "--limit",
              "50",
              "--json",
              "number,title,headRefName",
            ])
          ).stdout;
      if (!raw.trim()) return [];
      const rows = JSON.parse(raw) as Array<{
        number: number;
        title: string;
        headRefName: string;
        files?: Array<{ path?: string } | string>;
      }>;
      return rows.map((row) => ({
        number: row.number,
        title: row.title,
        headRefName: row.headRefName,
        files: row.files?.map((file) =>
          typeof file === "string" ? file : (file.path ?? ""),
        ),
      }));
    },
  };
}

export function siblingCacheDir(root: string, repo: string): string {
  return join(root, ".tinyfish-siblings", siblingRepoDirName(repo));
}

export function isGitRepo(dir: string): boolean {
  return existsSync(join(dir, ".git"));
}
