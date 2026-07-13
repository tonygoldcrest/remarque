import { createHash } from "node:crypto";

import { WORKING_TREE } from "../protocol";
import type { RepoInfo, StagingStatus } from "./types";
import { runGit, runGitLenient } from "./run";

export async function repoInfo(cwd: string): Promise<RepoInfo | null> {
  const result = await runGitLenient(["rev-parse", "--show-toplevel", "--abbrev-ref", "HEAD"], cwd);

  if (!result) {
    return null;
  }

  const lines = result.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines[0]) {
    return null;
  }

  return { root: lines[0], branch: lines[1] || "HEAD", hasHead: result.code === 0 };
}

export function blobSha(content: string): string {
  const body = Buffer.from(content, "utf8");

  return createHash("sha1").update(`blob ${body.length}\0`).update(body).digest("hex");
}

export function diff(
  cwd: string,
  base: string,
  compare: string,
  paths: string[] = [],
  context?: number,
): Promise<string> {
  const args = ["diff"];

  if (context !== undefined) {
    args.push(`--unified=${context}`);
  }

  args.push(base);

  if (compare !== WORKING_TREE) {
    args.push(compare);
  }

  if (paths.length) {
    args.push("--", ...paths);
  }

  return runGit(args, { cwd });
}

export function nameStatus(cwd: string, base: string, compare: string): Promise<string> {
  const args = ["diff", "--name-status", base];

  if (compare !== WORKING_TREE) {
    args.push(compare);
  }

  return runGit(args, { cwd });
}

export function showFile(cwd: string, ref: string, path: string): Promise<string> {
  return runGit(["show", `${ref}:${path}`], { cwd });
}

export async function untrackedFiles(cwd: string): Promise<string[]> {
  const out = await runGit(["ls-files", "--others", "--exclude-standard", "-z"], { cwd });

  return out.split("\0").filter(Boolean);
}

export async function emptyTree(cwd: string): Promise<string> {
  return (await runGit(["mktree"], { cwd, stdin: "" })).trim();
}

export async function stagingStatus(cwd: string): Promise<StagingStatus> {
  const out = await runGit(["status", "--porcelain", "-z"], { cwd });
  const tokens = out.split("\0");
  const status: StagingStatus = { staged: [], unstaged: [] };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (!token) {
      continue;
    }

    const index = token[0];
    const worktree = token[1];
    const file = token.slice(3);

    if (index === "R" || index === "C") {
      i++;
    }

    if (index === "?" || worktree !== " ") {
      status.unstaged.push(file);
    } else if (index !== " ") {
      status.staged.push(file);
    }
  }

  return status;
}

export async function stage(cwd: string, paths: string[]): Promise<void> {
  await runGit(["add", "--", ...paths], { cwd });
}

export async function unstage(cwd: string, paths: string[]): Promise<void> {
  await runGit(["restore", "--staged", "--", ...paths], { cwd });
}
