import fs from "node:fs/promises";
import path from "node:path";

import * as git from "../git/index.js";
import { WORKING_TREE, type Side } from "../protocol.js";
import type { DiffRefs, ReviewContext, SideContent, SideContentReader } from "./types.js";

export async function effectiveBase(ctx: ReviewContext, base: string): Promise<string> {
  if (base !== "HEAD") {
    return base;
  }

  if (ctx.hasHead) {
    return "HEAD";
  }

  return git.emptyTree(ctx.repoRoot);
}

function readSide(ctx: ReviewContext, file: string, side: Side, refs: DiffRefs): Promise<string> {
  if (side === "old") {
    return git.showFile(ctx.repoRoot, refs.base, file);
  }

  if (refs.compare === WORKING_TREE) {
    return fs.readFile(path.join(ctx.repoRoot, file), "utf8");
  }

  return git.showFile(ctx.repoRoot, refs.compare, file);
}

export async function sideContent(
  ctx: ReviewContext,
  file: string,
  side: Side,
  refs: DiffRefs,
): Promise<SideContent> {
  try {
    const content = await readSide(ctx, file, side, refs);

    return { content, blobSha: git.blobSha(content) };
  } catch {
    return { content: null, blobSha: null };
  }
}

export function sideContentReader(ctx: ReviewContext, refs: DiffRefs): SideContentReader {
  const cache = new Map<string, SideContent>();

  return async (file, side) => {
    const key = `${side}:${file}`;

    let hit = cache.get(key);

    if (!hit) {
      hit = await sideContent(ctx, file, side, refs);

      cache.set(key, hit);
    }

    return hit;
  };
}
