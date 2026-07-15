import type {
  DiffFile,
  GeneralComment,
  Message,
  ResolvedThread,
  ReviewState,
} from "../../protocol.js";
import { parsePatch } from "../parse/index.js";
import type { DisplayRow, PaneInner } from "./types.js";
import { COMPOSE_HINT, GENERAL_FILE, NO_WRAP, STATUS_ICON } from "./constants.js";
import { contContentWidth, startContentWidth } from "./layout.js";
import { wrapWords } from "./wrap.js";

export function selectionKey(row: DisplayRow, index: number): string {
  if (row.kind === "comment") {
    return `m:${row.msgKey}`;
  }

  return `x:${index}`;
}

function composeMessage(
  out: DisplayRow[],
  thread: ResolvedThread,
  message: Message,
  isThreadStart: boolean,
  width: number,
): void {
  const lead = isThreadStart ? `${STATUS_ICON[thread.status]}` : "";
  const author = `${message.author}:`;
  const w = Math.max(8, width);
  const firstWidth = Math.max(1, startContentWidth(w, lead) - author.length - 1);
  const chunks = wrapWords(message.body, firstWidth, contContentWidth(w));
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
    out.push({ kind: "comment", thread, tone: "cont", msgKey, text: chunks[i] });
  }
}

function pushRule(out: DisplayRow[], thread: ResolvedThread, tone: "top" | "bottom"): void {
  out.push({ kind: "thread-separator", thread, text: "", tone });
}

function emitThread(out: DisplayRow[], thread: ResolvedThread, width: number): void {
  pushRule(out, thread, "top");
  thread.messages.forEach((message, i) => composeMessage(out, thread, message, i === 0, width));
  pushRule(out, thread, "bottom");
}

function generalAsThread(g: GeneralComment): ResolvedThread {
  return {
    id: g.id,
    sessionId: g.sessionId,
    file: GENERAL_FILE,
    side: "new",
    anchor: { blobSha: "", line: 0, endLine: 0, lineText: "", before: [], after: [] },
    status: g.status,
    resolution: g.resolution,
    messages: g.messages,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    currentLine: null,
    currentEndLine: null,
  };
}

export function buildGeneralRows(state: ReviewState, width: number): DisplayRow[] {
  const out: DisplayRow[] = [];

  for (const g of state.generalComments) {
    emitThread(out, generalAsThread(g), width);
  }

  out.push({ kind: "compose", text: COMPOSE_HINT });

  return out;
}

function threadsByLine(threads: ResolvedThread[]): Map<string, ResolvedThread[]> {
  const byLine = new Map<string, ResolvedThread[]>();

  for (const t of threads) {
    if (t.currentLine == null) {
      continue;
    }

    const key = `${t.side}:${t.currentLine}`;
    const list = byLine.get(key) ?? [];

    list.push(t);
    byLine.set(key, list);
  }

  return byLine;
}

function lineKeys(row: Extract<DisplayRow, { kind: "line" }>): string[] {
  const keys: string[] = [];

  if (row.right.num != null) {
    keys.push(`new:${row.right.num}`);
  }

  if (row.left.num != null) {
    keys.push(`old:${row.left.num}`);
  }

  return keys;
}

export function buildDisplayRows(
  file: DiffFile,
  state: ReviewState,
  inner: PaneInner = NO_WRAP,
): DisplayRow[] {
  const threads = state.threads.filter((t) => t.file === file.file);
  const widthFor = (t: ResolvedThread) => (t.side === "old" ? inner.old : inner.new);
  const byLine = threadsByLine(threads);
  const placed = new Set<string>();
  const out: DisplayRow[] = [];

  for (const row of parsePatch(file.patch)) {
    out.push(row);

    if (row.kind !== "line") {
      continue;
    }

    for (const key of lineKeys(row)) {
      for (const t of byLine.get(key) ?? []) {
        emitThread(out, t, widthFor(t));
        placed.add(t.id);
      }
    }
  }

  for (const t of threads) {
    if (!placed.has(t.id)) {
      emitThread(out, t, widthFor(t));
    }
  }

  return out;
}
