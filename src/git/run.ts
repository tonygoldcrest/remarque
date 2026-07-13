import { spawn } from "node:child_process";

import type { LenientResult, RunOptions } from "./types";

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

export function runGit(args: string[], opts: RunOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd: opts.cwd });
    const out: Buffer[] = [];
    const err: Buffer[] = [];

    child.stdout.on("data", (d) => out.push(d));
    child.stderr.on("data", (d) => err.push(d));
    child.on("error", (e) => reject(new GitError(`failed to spawn git: ${e.message}`, null, "")));
    child.on("close", (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(err).toString("utf8").trim();

        reject(new GitError(`git ${args.join(" ")} exited with code ${code}`, code, stderr));

        return;
      }

      resolve(Buffer.concat(out).toString("utf8"));
    });

    if (opts.stdin !== undefined) {
      child.stdin.end(opts.stdin);
    } else {
      child.stdin.end();
    }
  });
}

export function runGitLenient(args: string[], cwd: string): Promise<LenientResult | null> {
  return new Promise((resolve) => {
    const child = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "ignore"] });
    const out: Buffer[] = [];

    child.stdout.on("data", (d) => out.push(d));
    child.on("error", () => resolve(null));
    child.on("close", (code) => {
      resolve({ stdout: Buffer.concat(out).toString("utf8"), code });
    });
  });
}
