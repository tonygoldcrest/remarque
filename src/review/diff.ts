import * as git from "../git/index.js";
import { WORKING_TREE } from "../protocol.js";
import type { DiffFile, DiffFileStatus, Session, StructuredDiff } from "../protocol.js";
import type { ReviewContext } from "./types.js";
import { FULL_FILE_CONTEXT } from "./constants.js";
import { effectiveBase, sideContent } from "./contents.js";
import { sessionForRead } from "./sessions.js";

function addedFilePatch(file: string, content: string): string {
  const header = [`diff --git a/${file} b/${file}`, "new file mode 100644"];

  if (content.includes("\x00")) {
    return [...header, `Binary files /dev/null and b/${file} differ`, ""].join("\n");
  }

  const hadTrailingNewline = content.endsWith("\n");
  const body = hadTrailingNewline ? content.slice(0, -1) : content;
  const lines = body.length === 0 ? [] : body.split("\n");
  const patch = [
    ...header,
    "--- /dev/null",
    `+++ b/${file}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((l) => `+${l}`),
  ];

  if (!hadTrailingNewline && lines.length > 0) {
    patch.push("\\ No newline at end of file");
  }

  return patch.join("\n") + "\n";
}

function statusFromCode(code: string): DiffFileStatus {
  switch (code) {
    case "A":
      return "added";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    default:
      return "modified";
  }
}

async function untrackedInScope(ctx: ReviewContext, paths: string[] = []): Promise<string[]> {
  const untracked = await git.untrackedFiles(ctx.repoRoot);

  return paths.length ? untracked.filter((f) => paths.includes(f)) : untracked;
}

async function untrackedAsPatch(ctx: ReviewContext, file: string, base: string): Promise<string> {
  const { content } = await sideContent(ctx, file, "new", { base, compare: WORKING_TREE });

  return addedFilePatch(file, content ?? "");
}

async function readSession(ctx: ReviewContext): Promise<{ session: Session; base: string }> {
  const store = await ctx.backend.read();
  const session = sessionForRead(ctx, store);
  const base = await effectiveBase(ctx, session.base);

  return { session, base };
}

export async function plainDiff(ctx: ReviewContext, paths: string[] = []): Promise<string> {
  const { session, base } = await readSession(ctx);

  let out = await git.diff(ctx.repoRoot, base, session.compare, paths);

  if (session.compare === WORKING_TREE) {
    for (const file of await untrackedInScope(ctx, paths)) {
      const patch = await untrackedAsPatch(ctx, file, base);

      out += (out && !out.endsWith("\n") ? "\n" : "") + patch;
    }
  }

  return out;
}

function parseNameStatusLine(line: string): { file: string; oldFile: string | null; code: string } {
  const parts = line.split("\t");
  const code = parts[0];
  const renamed = code[0] === "R" || code[0] === "C";

  return {
    code,
    oldFile: renamed ? parts[1] : null,
    file: renamed ? parts[2] : parts[1],
  };
}

export async function structuredDiff(
  ctx: ReviewContext,
  opts: { whole?: boolean } = {},
): Promise<StructuredDiff> {
  const { session, base } = await readSession(ctx);
  const context = opts.whole ? FULL_FILE_CONTEXT : undefined;
  const nameStatus = await git.nameStatus(ctx.repoRoot, base, session.compare);
  const files: DiffFile[] = [];

  for (const line of nameStatus.split("\n")) {
    if (!line.trim()) {
      continue;
    }

    const { file, oldFile, code } = parseNameStatusLine(line);
    const paths = oldFile ? [oldFile, file] : [file];

    files.push({
      file,
      oldFile,
      status: statusFromCode(code[0]),
      patch: await git.diff(ctx.repoRoot, base, session.compare, paths, context),
    });
  }

  if (session.compare === WORKING_TREE) {
    for (const file of await untrackedInScope(ctx)) {
      files.push({
        file,
        oldFile: null,
        status: "added",
        patch: await untrackedAsPatch(ctx, file, base),
      });
    }
  }

  return { base: session.base, compare: session.compare, files };
}
