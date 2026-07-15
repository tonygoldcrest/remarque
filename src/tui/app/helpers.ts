import type { Key } from "ink";

import type { Review, ReviewItem } from "../../review/index.js";
import type { DisplayRow, FileEntry } from "../model/index.js";
import type { Focus } from "../types.js";
import type { ComposerIntent, StatusKey } from "./types.js";

function isDeleteChunk(ch: string): boolean {
  return ch.length > 0 && [...ch].every((c) => c === "\x7f" || c === "\x08");
}

export function editValue(value: string, ch: string, key: Key): string {
  if (key.backspace || key.delete) {
    return value.slice(0, -1);
  }

  if (!ch || key.ctrl || key.meta) {
    return value;
  }

  if (isDeleteChunk(ch)) {
    return value.slice(0, -ch.length);
  }

  const clean = ch.replace(/[\r\n\t]+/g, " ").replace(/\p{C}/gu, "");

  return value + clean;
}

export function composerIntent(
  row: DisplayRow | undefined,
  focus: Focus,
  general: boolean,
  entry: FileEntry | null,
): ComposerIntent {
  if (row && row.kind === "comment") {
    return { open: { mode: "reply", threadId: row.thread.id } };
  }

  if (general) {
    return { open: { mode: "general" } };
  }

  if (!entry || !row) {
    return null;
  }

  if (row.kind !== "line") {
    return { notice: "select a diff line to comment" };
  }

  const side = focus === "removed" ? ("old" as const) : ("new" as const);
  const cell = focus === "removed" ? row.left : row.right;

  if (cell.num == null) {
    return { notice: `no ${focus} line here` };
  }

  return { open: { mode: "new", file: entry.file, side, line: cell.num } };
}

export const statusActions: Record<
  StatusKey,
  { verb: string; act: (review: Review, id: string) => Promise<ReviewItem> }
> = {
  r: { verb: "resolved", act: (review, id) => review.resolve(id, { author: "human" }) },
  x: { verb: "dismissed", act: (review, id) => review.dismiss(id, { author: "human" }) },
  o: { verb: "reopened", act: (review, id) => review.reopen(id) },
};
