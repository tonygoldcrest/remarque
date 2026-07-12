import type {
  DiffFile,
  DiffFileStatus,
  Message,
  ResolvedThread,
  ReviewState,
  StructuredDiff,
  ThreadStatus,
} from "../protocol";
import { parsePatch, type Row } from "./parse";

export interface FileEntry {
  file: string;
  status: DiffFileStatus;
  open: number;
  total: number;
}

export type DisplayRow =
  | { kind: "hunk"; header: string }
  | Extract<Row, { kind: "line" }>
  | { kind: "comment"; thread: ResolvedThread; tone: "rule"; text: string }
  | { kind: "comment"; thread: ResolvedThread; tone: "cont"; msgKey: string; text: string }
  | {
      kind: "comment";
      thread: ResolvedThread;
      tone: "start";
      msgKey: string;
      head: boolean;
      lead: string;
      author: string;
      body: string;
    };

const STATUS_ICON: Record<ThreadStatus, string> = {
  open: "●",
  resolved: "✓",
  dismissed: "✕",
  outdated: "●",
};

export interface PaneInner {
  old: number;
  new: number;
}

export function selectionKey(row: DisplayRow, index: number): string {
  if (row.kind === "comment" && row.tone !== "rule") return `m:${row.msgKey}`;
  return `x:${index}`;
}

export interface Unit {
  f: number;
  l: number;
}

export interface Viewport {
  row: number;
  top: number;
}

export function computeUnits(rows: DisplayRow[]): { units: Unit[]; unitOf: number[] } {
  const units: Unit[] = [];
  const unitOf = new Array<number>(rows.length).fill(-1);
  let i = 0;
  while (i < rows.length) {
    const r = rows[i];
    if (r.kind === "line") {
      unitOf[i] = units.length;
      units.push({ f: i, l: i });
      i += 1;
    } else if (r.kind === "comment" && r.tone !== "rule") {
      const key = r.msgKey;
      const f = i;
      while (i < rows.length) {
        const rr = rows[i];
        if (rr.kind === "comment" && rr.tone !== "rule" && rr.msgKey === key) {
          unitOf[i] = units.length;
          i += 1;
        } else break;
      }
      units.push({ f, l: i - 1 });
    } else {
      i += 1;
    }
  }
  return { units, unitOf };
}

function clampTop(t: number, maxTop: number): number {
  return Math.max(0, Math.min(t, maxTop));
}

function revealDown(top: number, u: Unit, contentH: number, maxTop: number): number {
  let t = top;
  if (u.f < t || u.f > t + contentH - 1) t = u.f;
  if (u.l - u.f + 1 <= contentH && u.l > t + contentH - 1) t = u.l - contentH + 1;
  return clampTop(t, maxTop);
}

function revealUp(top: number, u: Unit, contentH: number, maxTop: number): number {
  let t = top;
  if (u.l > t + contentH - 1) t = u.l - contentH + 1;
  if (u.f < t && u.l - u.f + 1 <= contentH) t = u.f;
  return clampTop(t, maxTop);
}

export function navigate(
  rows: DisplayRow[],
  units: Unit[],
  unitOf: number[],
  cur: Viewport,
  dir: number,
  contentH: number,
): Viewport {
  if (units.length === 0) return cur;
  const maxTop = Math.max(0, rows.length - contentH);
  const u = cur.row >= 0 && cur.row < rows.length ? unitOf[cur.row] : -1;
  if (u < 0) {
    let best = 0;
    let bd = Infinity;
    for (let k = 0; k < units.length; k++) {
      const d = Math.abs(units[k].f - cur.row);
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    const nu = units[best];
    return { row: nu.f, top: revealDown(cur.top, nu, contentH, maxTop) };
  }
  const cu = units[u];
  if (dir > 0) {
    if (cu.l > cur.top + contentH - 1) {
      const nt =
        cu.l - cu.f + 1 <= contentH
          ? cu.l - contentH + 1
          : Math.min(cu.l - contentH + 1, cur.top + contentH);
      const capped = clampTop(nt, maxTop);
      if (capped > cur.top) return { row: cu.f, top: capped };
    }
    if (u >= units.length - 1) return { row: cu.f, top: revealDown(cur.top, cu, contentH, maxTop) };
    const nu = units[u + 1];
    return { row: nu.f, top: revealDown(cur.top, nu, contentH, maxTop) };
  }
  if (cu.f < cur.top) {
    const nt = cu.l - cu.f + 1 <= contentH ? cu.f : Math.max(cu.f, cur.top - contentH);
    const capped = clampTop(nt, maxTop);
    if (capped < cur.top) return { row: cu.f, top: capped };
  }
  if (u <= 0) return { row: cu.f, top: revealUp(cur.top, cu, contentH, maxTop) };
  const pu = units[u - 1];
  return { row: pu.f, top: revealUp(cur.top, pu, contentH, maxTop) };
}

function isChangeRow(row: DisplayRow | undefined): boolean {
  return !!row && row.kind === "line" && (row.left.type === "del" || row.right.type === "add");
}

function prevLineIsChange(rows: DisplayRow[], i: number): boolean {
  for (let k = i - 1; k >= 0; k--) {
    if (rows[k].kind === "comment") continue;
    return isChangeRow(rows[k]);
  }
  return false;
}

export function chunkStarts(rows: DisplayRow[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (isChangeRow(rows[i]) && !prevLineIsChange(rows, i)) out.push(i);
  }
  return out;
}

export function threadStarts(rows: DisplayRow[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.kind === "comment" && r.tone === "start" && r.head) out.push(i);
  }
  return out;
}

export function seekIndex(indices: number[], from: number, dir: number): number | null {
  if (dir > 0) {
    for (const i of indices) if (i > from) return i;
    return null;
  }
  for (let k = indices.length - 1; k >= 0; k--) if (indices[k] < from) return indices[k];
  return null;
}

const NO_WRAP: PaneInner = { old: 200, new: 200 };

function wrapWords(text: string, firstWidth: number, restWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  let limit = firstWidth;
  const hardSplit = (word: string) => {
    let rest = word;
    while (rest.length > limit) {
      lines.push(rest.slice(0, limit));
      rest = rest.slice(limit);
      limit = restWidth;
    }
    cur = rest;
  };
  for (const word of words) {
    if (cur === "") {
      if (word.length > limit) hardSplit(word);
      else cur = word;
    } else if (cur.length + 1 + word.length <= limit) {
      cur += " " + word;
    } else {
      lines.push(cur);
      cur = "";
      limit = restWidth;
      if (word.length > limit) hardSplit(word);
      else cur = word;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines.length ? lines : [""];
}

function composeMessage(
  out: DisplayRow[],
  thread: ResolvedThread,
  message: Message,
  isThreadStart: boolean,
  width: number,
): void {
  const lead = isThreadStart ? `${STATUS_ICON[thread.status]} ` : "│ ";
  const author = `${message.author}:`;
  const cont = "│   ";
  const w = Math.max(8, width);
  const firstWidth = Math.max(1, w - lead.length - author.length - 1);
  const chunks = wrapWords(message.body, firstWidth, Math.max(1, w - cont.length));
  const msgKey = `${thread.id}:${message.id}`;
  out.push({
    kind: "comment",
    thread,
    tone: "start",
    msgKey,
    head: isThreadStart,
    lead,
    author,
    body: chunks[0] ?? "",
  });
  for (let i = 1; i < chunks.length; i++) {
    out.push({ kind: "comment", thread, tone: "cont", msgKey, text: cont + chunks[i] });
  }
}

function isUnresolved(t: ResolvedThread): boolean {
  return t.status === "open" || t.status === "outdated";
}

export function fileList(diff: StructuredDiff, state: ReviewState): FileEntry[] {
  return diff.files.map((f) => {
    const threads = state.threads.filter((t) => t.file === f.file);
    return {
      file: f.file,
      status: f.status,
      open: threads.filter(isUnresolved).length,
      total: threads.length,
    };
  });
}

function pushRule(out: DisplayRow[], t: ResolvedThread, width: number): void {
  out.push({ kind: "comment", thread: t, text: "─".repeat(Math.max(1, width)), tone: "rule" });
}

function emitThread(out: DisplayRow[], t: ResolvedThread, width: number): void {
  const prev = out[out.length - 1];
  const prevIsRule = !!prev && prev.kind === "comment" && prev.tone === "rule";
  if (!prevIsRule) pushRule(out, t, width);
  t.messages.forEach((message, i) => composeMessage(out, t, message, i === 0, width));
  pushRule(out, t, width);
}

export function buildDisplayRows(
  file: DiffFile,
  state: ReviewState,
  inner: PaneInner = NO_WRAP,
): DisplayRow[] {
  const rows = parsePatch(file.patch);
  const threads = state.threads.filter((t) => t.file === file.file);
  const widthFor = (t: ResolvedThread) => (t.side === "old" ? inner.old : inner.new);

  const byLine = new Map<string, ResolvedThread[]>();
  for (const t of threads) {
    if (t.currentLine == null) continue;
    const key = `${t.side}:${t.currentLine}`;
    const list = byLine.get(key) ?? [];
    list.push(t);
    byLine.set(key, list);
  }

  const placed = new Set<string>();
  const out: DisplayRow[] = [];
  for (const r of rows) {
    out.push(r);
    if (r.kind !== "line") continue;
    const keys: string[] = [];
    if (r.right.num != null) keys.push(`new:${r.right.num}`);
    if (r.left.num != null) keys.push(`old:${r.left.num}`);
    for (const key of keys) {
      for (const t of byLine.get(key) ?? []) {
        emitThread(out, t, widthFor(t));
        placed.add(t.id);
      }
    }
  }

  for (const t of threads) {
    if (!placed.has(t.id)) emitThread(out, t, widthFor(t));
  }
  return out;
}
