import path from "node:path";
import { homedir } from "node:os";

function baseDir(xdgVar: string, winVar: string, ...unixFallback: string[]): string {
  const xdg = process.env[xdgVar];

  if (xdg && xdg.trim()) {
    return xdg;
  }

  if (process.platform === "win32" && process.env[winVar]) {
    return process.env[winVar] as string;
  }

  return path.join(homedir(), ...unixFallback);
}

const CONFIG_HOME = baseDir("XDG_CONFIG_HOME", "APPDATA", ".config");
const STATE_HOME = baseDir("XDG_STATE_HOME", "LOCALAPPDATA", ".local", "state");

export function globalConfigPath(): string {
  return path.join(CONFIG_HOME, "remarque", "remarque.config.json");
}

export function globalDataDefault(): string {
  return path.join(STATE_HOME, "remarque");
}

export function localConfigPath(repoRoot: string): string {
  return path.join(repoRoot, "remarque.config.json");
}
