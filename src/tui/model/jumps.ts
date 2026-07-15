import type { DisplayRow } from "./types.js";

function isChangeRow(row: DisplayRow | undefined): boolean {
  return !!row && row.kind === "line" && (row.left.type === "del" || row.right.type === "add");
}

function prevLineIsChange(rows: DisplayRow[], i: number): boolean {
  for (let k = i - 1; k >= 0; k--) {
    if (rows[k].kind === "comment" || rows[k].kind === "thread-separator") {
      continue;
    }

    return isChangeRow(rows[k]);
  }

  return false;
}

export function chunkStarts(rows: DisplayRow[]): number[] {
  const out: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    if (isChangeRow(rows[i]) && !prevLineIsChange(rows, i)) {
      out.push(i);
    }
  }

  return out;
}

export function threadStarts(rows: DisplayRow[]): number[] {
  const out: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (row.kind === "comment" && row.tone === "start" && row.head) {
      out.push(i);
    }
  }

  return out;
}

export function seekIndex(indices: number[], from: number, dir: number): number | null {
  if (indices.length === 0) {
    return null;
  }

  if (dir > 0) {
    return indices.find((i) => i > from) ?? indices[0];
  }

  for (let k = indices.length - 1; k >= 0; k--) {
    if (indices[k] < from) {
      return indices[k];
    }
  }

  return indices[indices.length - 1];
}
