import fs from "node:fs";
import path from "node:path";

export function isInsideRepo(repoRoot: string, dir: string): boolean {
  const rel = path.relative(repoRoot, path.resolve(repoRoot, dir));

  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function readGitignore(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
      throw e;
    }

    return "";
  }
}

export function addToGitignore(repoRoot: string, dir: string): boolean {
  const rel = path.relative(repoRoot, path.resolve(repoRoot, dir));
  const entry = `${rel.replace(/\\/g, "/")}/`;
  const file = path.join(repoRoot, ".gitignore");
  const contents = readGitignore(file);
  const lines = contents.split("\n").map((l) => l.trim());

  if (lines.includes(entry) || lines.includes(rel) || lines.includes(`/${entry}`)) {
    return false;
  }

  const prefix = contents.length > 0 && !contents.endsWith("\n") ? "\n" : "";

  fs.appendFileSync(file, `${prefix}${entry}\n`);

  return true;
}
