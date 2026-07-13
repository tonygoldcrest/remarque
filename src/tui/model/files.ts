import type { ReviewState, StructuredDiff, ThreadStatus } from "../../protocol";
import type { FileEntry, StatusCounts } from "./types";
import { GENERAL_FILE } from "./constants";

function isUnresolved(item: { status: ThreadStatus }): boolean {
  return item.status === "open" || item.status === "outdated";
}

function counts(items: { status: ThreadStatus }[]): StatusCounts {
  return {
    open: items.filter(isUnresolved).length,
    resolved: items.filter((item) => item.status === "resolved").length,
    dismissed: items.filter((item) => item.status === "dismissed").length,
    total: items.length,
  };
}

export function fileList(diff: StructuredDiff, state: ReviewState): FileEntry[] {
  const entries: FileEntry[] = diff.files.map((f) => ({
    file: f.file,
    status: f.status,
    general: false,
    ...counts(state.threads.filter((t) => t.file === f.file)),
  }));
  const general: FileEntry = {
    file: GENERAL_FILE,
    status: "modified",
    general: true,
    ...counts(state.generalComments),
  };

  return [general, ...entries.filter((e) => e.total > 0), ...entries.filter((e) => e.total === 0)];
}
