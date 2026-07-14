import type { ReviewState, StructuredDiff, ThreadStatus } from "../../protocol.js";
import type { FileEntry, FileSection, StagingGroups, StatusCounts } from "./types.js";

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
  return diff.files.map((f) => ({
    file: f.file,
    oldFile: f.oldFile,
    status: f.status,
    ...counts(state.threads.filter((t) => t.file === f.file)),
  }));
}

export function mergeOrder(prev: string[], next: string[]): string[] {
  const kept = prev.filter((f) => next.includes(f));
  const arrived = next.filter((f) => !prev.includes(f));

  return [...kept, ...arrived];
}

export function fileSections(entries: FileEntry[], groups: StagingGroups | null): FileSection[] {
  if (!groups) {
    return [{ title: null, files: entries }];
  }

  const byFile = new Map(entries.map((e) => [e.file, e]));
  const unstaged = groups.unstaged.flatMap((f) => byFile.get(f) ?? []);
  const explicitlyStaged = groups.staged.flatMap((f) => byFile.get(f) ?? []);
  const grouped = new Set([...unstaged, ...explicitlyStaged].map((e) => e.file));
  const staged = [...entries.filter((e) => !grouped.has(e.file)), ...explicitlyStaged];

  return [
    { title: `Unstaged (${unstaged.length}):`, files: unstaged },
    { title: `Staged (${staged.length}):`, files: staged },
  ];
}
