import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";

function baseDir(xdgVar: string, winVar: string, ...unixFallback: string[]): string {
  const xdg = process.env[xdgVar];
  if (xdg && xdg.trim()) return xdg;
  if (process.platform === "win32" && process.env[winVar]) {
    return process.env[winVar] as string;
  }
  return path.join(homedir(), ...unixFallback);
}

const CONFIG_HOME = baseDir("XDG_CONFIG_HOME", "APPDATA", ".config");
const STATE_HOME = baseDir("XDG_STATE_HOME", "LOCALAPPDATA", ".local", "state");

export type StoreScope = "repo" | "global";

export type LocalConfig = {
  store: { scope: "repo"; dir: string } | { scope: "global" };
};

export interface GlobalConfig {
  store: { dir: string };
}

export interface ResolvedStore {
  scope: StoreScope;
  dir: string;
  file: string;
  source: "env" | "local" | "global";
}

export function globalConfigPath(): string {
  return path.join(CONFIG_HOME, "remarque", "remarque.config.json");
}

export function globalDataDefault(): string {
  return path.join(STATE_HOME, "remarque");
}

export function localConfigPath(repoRoot: string): string {
  return path.join(repoRoot, "remarque.config.json");
}

export function loadGlobalConfig(): GlobalConfig {
  const file = globalConfigPath();
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as GlobalConfig;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    const cfg: GlobalConfig = { store: { dir: globalDataDefault() } };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
    return cfg;
  }
}

export function loadLocalConfig(repoRoot: string): LocalConfig | null {
  try {
    return JSON.parse(fs.readFileSync(localConfigPath(repoRoot), "utf8")) as LocalConfig;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export function saveLocalConfig(repoRoot: string, config: LocalConfig): void {
  fs.writeFileSync(localConfigPath(repoRoot), JSON.stringify(config, null, 2) + "\n");
}

function safeBranch(branch: string): string {
  const cleaned = branch.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "detached";
}

function repoKey(repoRoot: string): string {
  return createHash("sha256").update(repoRoot).digest("hex").slice(0, 16);
}

export function resolveStore(repoRoot: string, branch: string): ResolvedStore {
  const branchFile = `${safeBranch(branch)}.json`;

  const override = process.env.REMARQUE_STORE_DIR;
  if (override && override.trim()) {
    const dir = path.resolve(override);
    return {
      scope: "global",
      dir,
      file: path.join(dir, repoKey(repoRoot), branchFile),
      source: "env",
    };
  }

  const local = loadLocalConfig(repoRoot);
  if (local && local.store.scope === "repo") {
    const dir = path.resolve(repoRoot, local.store.dir);
    return { scope: "repo", dir, file: path.join(dir, branchFile), source: "local" };
  }

  const global = loadGlobalConfig();
  const dir = global.store.dir;
  return {
    scope: "global",
    dir,
    file: path.join(dir, repoKey(repoRoot), branchFile),
    source: local ? "local" : "global",
  };
}

export function isInsideRepo(repoRoot: string, dir: string): boolean {
  const rel = path.relative(repoRoot, path.resolve(repoRoot, dir));
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

export function addToGitignore(repoRoot: string, dir: string): boolean {
  const rel = path.relative(repoRoot, path.resolve(repoRoot, dir));
  const entry = `${rel.replace(/\\/g, "/")}/`;
  const file = path.join(repoRoot, ".gitignore");
  let contents = "";
  try {
    contents = fs.readFileSync(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const lines = contents.split("\n").map((l) => l.trim());
  if (lines.includes(entry) || lines.includes(rel) || lines.includes(`/${entry}`)) return false;
  const prefix = contents.length > 0 && !contents.endsWith("\n") ? "\n" : "";
  fs.appendFileSync(file, `${prefix}${entry}\n`);
  return true;
}
