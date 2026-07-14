import { randomUUID } from "node:crypto";

import { captureAnchor } from "../anchor/index.js";
import type { Author, GeneralComment, Side, Thread } from "../protocol.js";
import type {
  ApplyAction,
  ApplyResult,
  BatchInput,
  BatchResult,
  CommentInput,
  ReviewContext,
  ReviewItem,
  SideContentReader,
} from "./types.js";
import { effectiveBase, sideContentReader } from "./contents.js";
import { ensureSession } from "./sessions.js";
import { findById, newMessage, now } from "./helpers.js";

async function buildThread(
  input: CommentInput,
  sessionId: string,
  author: Author,
  readSide: SideContentReader,
): Promise<Thread> {
  const side: Side = input.side ?? "new";
  const { content, blobSha } = await readSide(input.file, side);
  const anchor = captureAnchor({
    content: content ?? "",
    blobSha: blobSha ?? "",
    line: input.line,
    endLine: input.endLine ?? input.line,
  });

  return {
    id: randomUUID(),
    sessionId,
    file: input.file,
    side,
    anchor,
    status: "open",
    resolution: null,
    messages: [newMessage(input.author ?? author, input.body)],
    createdAt: now(),
    updatedAt: now(),
  };
}

function buildGeneralComment(body: string, sessionId: string, author: Author): GeneralComment {
  return {
    id: randomUUID(),
    sessionId,
    status: "open",
    resolution: null,
    messages: [newMessage(author, body)],
    createdAt: now(),
    updatedAt: now(),
  };
}

export async function addBatch(ctx: ReviewContext, input: BatchInput): Promise<BatchResult> {
  const author = input.author ?? "human";
  const session = await ensureSession(ctx);
  const base = await effectiveBase(ctx, session.base);
  const readSide = sideContentReader(ctx, { base, compare: session.compare });
  const threads: Thread[] = [];

  for (const comment of input.comments ?? []) {
    threads.push(await buildThread(comment, session.id, author, readSide));
  }

  const generalComments = (input.general ?? []).map((g) =>
    buildGeneralComment(g.body, session.id, author),
  );

  if (threads.length || generalComments.length) {
    await ctx.backend.update((store) => {
      store.threads.push(...threads);
      store.generalComments.push(...generalComments);
    });
  }

  return { threads, generalComments };
}

function applyAction(item: ReviewItem, action: ApplyAction, author: Author): void {
  if (action.reply != null && action.reply !== "") {
    item.messages.push(newMessage(author, action.reply));
  }

  if (action.status === "resolved" || action.status === "dismissed") {
    item.status = action.status;
    item.resolution = { note: action.note ?? null, by: author, at: now() };
  } else if (action.status === "open") {
    item.status = "open";
    item.resolution = null;
  }

  item.updatedAt = now();
}

export async function applyBatch(
  ctx: ReviewContext,
  opts: { actions: ApplyAction[]; author?: Author },
): Promise<ApplyResult> {
  const author = opts.author ?? "agent";
  const applied: string[] = [];
  const notFound: string[] = [];

  await ctx.backend.update((store) => {
    for (const action of opts.actions) {
      const item = findById(store, action.id);

      if (!item) {
        notFound.push(action.id);
        continue;
      }

      applyAction(item, action, author);
      applied.push(item.id);
    }
  });

  return { applied, notFound };
}

export async function updateItem(
  ctx: ReviewContext,
  id: string,
  mutate: (item: ReviewItem) => void,
): Promise<ReviewItem> {
  let target: ReviewItem | undefined;

  await ctx.backend.update((store) => {
    const item = findById(store, id);

    if (!item) {
      throw new Error(`no thread with id ${id}`);
    }

    mutate(item);

    item.updatedAt = now();
    target = item;
  });

  return target!;
}

export async function deleteItem(ctx: ReviewContext, id: string): Promise<boolean> {
  let removed = false;

  await ctx.backend.update((store) => {
    const before = store.threads.length + store.generalComments.length;
    const keep = (item: ReviewItem) => !(item.id === id || item.id.startsWith(id));

    store.threads = store.threads.filter(keep);
    store.generalComments = store.generalComments.filter(keep);
    removed = store.threads.length + store.generalComments.length < before;
  });

  return removed;
}

export async function getItem(ctx: ReviewContext, id: string): Promise<ReviewItem | null> {
  return findById(await ctx.backend.read(), id) ?? null;
}
