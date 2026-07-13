import { createHash } from "node:crypto";
import path from "node:path";

import type { ResolvedStore } from "./types";
import { loadGlobalConfig, loadLocalConfig } from "./storage";

function safeBranch(branch: string): string {
  const cleaned = branch.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");

  return cleaned || "detached";
}

function repoKey(repoRoot: string): string {
  return createHash("sha256").update(repoRoot).digest("hex").slice(0, 16);
}

export function resolveStore(repoRoot: string, branch: string): ResolvedStore {
  const branchDir = safeBranch(branch);
  const override = process.env.REMARQUE_STORE_DIR;

  if (override && override.trim()) {
    return {
      scope: "global",
      dir: path.join(path.resolve(override), repoKey(repoRoot), branchDir),
      source: "env",
    };
  }

  const local = loadLocalConfig(repoRoot);

  if (local && local.store.scope === "repo") {
    return {
      scope: "repo",
      dir: path.join(path.resolve(repoRoot, local.store.dir), branchDir),
      source: "local",
    };
  }

  return {
    scope: "global",
    dir: path.join(loadGlobalConfig().store.dir, repoKey(repoRoot), branchDir),
    source: local ? "local" : "global",
  };
}
