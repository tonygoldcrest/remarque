import { spawn } from "node:child_process";

export class GitError extends Error {
  constructor(
    message: string,
    readonly code: number | null,
    readonly stderr: string,
  ) {
    super(message);
    this.name = "GitError";
  }
}

interface RunOptions {
  cwd: string;
  stdin?: Buffer | string;
  raw?: boolean;
}

function runGit(args: string[], opts: RunOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd: opts.cwd });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (d) => out.push(d));
    child.stderr.on("data", (d) => err.push(d));
    child.on("error", (e) => reject(new GitError(`failed to spawn git: ${e.message}`, null, "")));
    child.on("close", (code) => {
      const stdout = Buffer.concat(out);
      const stderr = Buffer.concat(err).toString("utf8");
      if (code !== 0) {
        reject(new GitError(`git ${args.join(" ")} exited with code ${code}`, code, stderr.trim()));
        return;
      }
      resolve(opts.raw ? (stdout as unknown as string) : stdout.toString("utf8").trim());
    });
    if (opts.stdin !== undefined) {
      child.stdin.end(opts.stdin);
    } else {
      child.stdin.end();
    }
  });
}

export async function repoRoot(cwd: string): Promise<string> {
  return runGit(["rev-parse", "--show-toplevel"], { cwd });
}

export async function currentBranch(cwd: string): Promise<string> {
  const branch = await runGit(["branch", "--show-current"], { cwd });
  return branch || "HEAD";
}

export async function resolveRef(cwd: string, ref: string): Promise<string> {
  return runGit(["rev-parse", "--verify", `${ref}^{commit}`], { cwd });
}

export async function diff(
  cwd: string,
  base: string,
  compare: string,
  paths: string[] = [],
  context?: number,
): Promise<string> {
  const args = ["diff"];
  if (context !== undefined) args.push(`--unified=${context}`);
  args.push(base);
  if (compare !== "WORKING") args.push(compare);
  if (paths.length) args.push("--", ...paths);
  return runGit(args, { cwd });
}

export async function hashObject(cwd: string, content: string): Promise<string> {
  return runGit(["hash-object", "--stdin"], { cwd, stdin: content });
}

export async function nameStatus(cwd: string, base: string, compare: string): Promise<string> {
  const args = ["diff", "--name-status", base];
  if (compare !== "WORKING") args.push(compare);
  return runGit(args, { cwd });
}

export async function showFile(cwd: string, ref: string, path: string): Promise<string> {
  return runGit(["show", `${ref}:${path}`], { cwd });
}

export async function untrackedFiles(cwd: string): Promise<string[]> {
  const out = await runGit(["ls-files", "--others", "--exclude-standard", "-z"], { cwd });
  return out.split("\0").filter(Boolean);
}

export async function isRepo(cwd: string): Promise<boolean> {
  try {
    await runGit(["rev-parse", "--is-inside-work-tree"], { cwd });
    return true;
  } catch {
    return false;
  }
}

export async function hasHead(cwd: string): Promise<boolean> {
  try {
    await runGit(["rev-parse", "--verify", "--quiet", "HEAD"], { cwd });
    return true;
  } catch {
    return false;
  }
}

export async function emptyTree(cwd: string): Promise<string> {
  return runGit(["mktree"], { cwd, stdin: "" });
}
