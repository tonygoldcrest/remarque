import { resolveAnchor } from "../anchor/index.js";
import {
  SCHEMA_VERSION,
  WORKING_TREE,
  type ResolvedThread,
  type ReviewState,
  type Thread,
} from "../protocol.js";
import type { ReviewContext, SideContentReader } from "./types.js";
import { effectiveBase, sideContentReader } from "./contents.js";

async function resolveThread(
  ctx: ReviewContext,
  thread: Thread,
  readSide: SideContentReader,
): Promise<ResolvedThread> {
  const { content, blobSha } = await readSide(thread.file, thread.side);
  const pos = resolveAnchor(thread.anchor, content, blobSha, ctx.resolve);
  const outdated = pos === null && thread.status === "open";

  return {
    ...thread,
    status: outdated ? "outdated" : thread.status,
    currentLine: pos?.line ?? null,
    currentEndLine: pos?.endLine ?? null,
  };
}

export async function buildState(ctx: ReviewContext, fileFilter?: string): Promise<ReviewState> {
  const store = await ctx.backend.read();
  const current = store.currentSessionId;
  const session = store.sessions.find((s) => s.id === current) ?? null;
  const base = await effectiveBase(ctx, session?.base ?? "HEAD");
  const readSide = sideContentReader(ctx, { base, compare: session?.compare ?? WORKING_TREE });
  const threads: ResolvedThread[] = [];

  for (const thread of store.threads) {
    if (current && thread.sessionId !== current) {
      continue;
    }

    if (fileFilter && thread.file !== fileFilter) {
      continue;
    }

    threads.push(await resolveThread(ctx, thread, readSide));
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    session,
    threads,
    generalComments: store.generalComments.filter((g) => !current || g.sessionId === current),
  };
}
