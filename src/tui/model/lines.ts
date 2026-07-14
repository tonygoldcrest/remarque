import type { DisplayRow } from "./types.js";

export interface SideLines {
  old: string[];
  new: string[];
}

export function sideLines(rows: DisplayRow[]): SideLines {
  const oldLines: string[] = [];
  const newLines: string[] = [];

  for (const row of rows) {
    if (row.kind !== "line") {
      continue;
    }

    if (row.left.num != null) {
      oldLines[row.left.num - 1] = row.left.text;
    }

    if (row.right.num != null) {
      newLines[row.right.num - 1] = row.right.text;
    }
  }

  for (let i = 0; i < oldLines.length; i++) {
    oldLines[i] ??= "";
  }

  for (let i = 0; i < newLines.length; i++) {
    newLines[i] ??= "";
  }

  return { old: oldLines, new: newLines };
}
