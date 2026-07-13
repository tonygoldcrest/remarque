import type { Review, ReviewItem } from "../../review";
import type { DisplayRow, FileEntry } from "../model";
import type { Focus } from "../types";
import type { ComposerIntent, StatusKey } from "./types";

export function composerIntent(
  row: DisplayRow | undefined,
  focus: Focus,
  entry: FileEntry | null,
): ComposerIntent {
  if (!entry) {
    return null;
  }

  if (row && row.kind === "comment" && row.tone !== "rule") {
    return { open: { mode: "reply", threadId: row.thread.id } };
  }

  if (row?.kind === "compose" || entry.general) {
    return { open: { mode: "general" } };
  }

  if (!row) {
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
