import fs from "node:fs";
import path from "node:path";

import type { GlobalConfig, LocalConfig } from "./types.js";
import { globalConfigPath, globalDataDefault, localConfigPath } from "./paths.js";

function isMissingFile(e: unknown): boolean {
  return (e as NodeJS.ErrnoException).code === "ENOENT";
}

function writeDefaultGlobalConfig(file: string): GlobalConfig {
  const config: GlobalConfig = { store: { dir: globalDataDefault() } };

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");

  return config;
}

export function loadGlobalConfig(): GlobalConfig {
  const file = globalConfigPath();

  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as GlobalConfig;
  } catch (e) {
    if (!isMissingFile(e)) {
      throw e;
    }

    return writeDefaultGlobalConfig(file);
  }
}

export function loadLocalConfig(repoRoot: string): LocalConfig | null {
  try {
    return JSON.parse(fs.readFileSync(localConfigPath(repoRoot), "utf8")) as LocalConfig;
  } catch (e) {
    if (isMissingFile(e)) {
      return null;
    }

    throw e;
  }
}

export function saveLocalConfig(repoRoot: string, config: LocalConfig): void {
  fs.writeFileSync(localConfigPath(repoRoot), JSON.stringify(config, null, 2) + "\n");
}
