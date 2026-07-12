import { spawnSync } from "node:child_process";
import path from "node:path";

const SKILLS_PKG = "skills@1";

export function bundledRoot(): string {
  return path.join(__dirname, "..");
}

const isWindows = process.platform === "win32";

function quoteArg(arg: string): string {
  return /[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

export function runSkills(args: string[]): number {
  const argv = ["--yes", SKILLS_PKG, "add", bundledRoot(), ...args];
  const result = isWindows
    ? spawnSync("npx", argv.map(quoteArg), { stdio: "inherit", shell: true })
    : spawnSync("npx", argv, { stdio: "inherit" });
  if (result.error) {
    const err = result.error as NodeJS.ErrnoException;
    const hint = err.code === "ENOENT" ? " (is Node/npx installed and on your PATH?)" : "";
    process.stderr.write(`remarque: could not run npx${hint}: ${err.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}

const HELP = `Usage: remarque skills <command> [options]

Install remarque's review skills into your coding agents. This wraps the
vercel-labs "skills" installer (run via npx) and points it at the skills
bundled inside remarque, so there is no extra repo to add.

Commands:
  add [options]   install the bundled skills (interactive by default)
  list            list the bundled skills without installing

Options after 'add' pass straight through to \`skills add\`:
  remarque skills add                        pick agents and skills interactively
  remarque skills add -y                      accept defaults, no prompts
  remarque skills add -g -a claude-code       install globally for Claude Code
  remarque skills add -s remarque-address     install one skill by name

Run \`remarque skills add --help\` for the installer's full flag list.`;

export function handleSkills(args: string[]): number {
  const [sub, ...rest] = args;
  if (!sub || sub === "-h" || sub === "--help") {
    process.stdout.write(HELP + "\n");
    return 0;
  }
  if (sub === "list") return runSkills(["--list", ...rest]);
  if (sub === "add") return runSkills(rest);
  return runSkills([sub, ...rest]);
}
