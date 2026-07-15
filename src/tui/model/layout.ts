import {
  BORDER_BAR,
  BORDER_CORNERS,
  BORDER_DASH,
  BORDER_WIDTH,
  CONT_PAD_LEFT,
  LEAD_PAD_LEFT,
  PAD_RIGHT,
  THREAD_LINE,
  THREAD_PAD_LEFT,
} from "./constants.js";
import type { DisplayRow, Span } from "./types.js";

type StartRow = Extract<DisplayRow, { kind: "comment"; tone: "start" }>;
type ContRow = Extract<DisplayRow, { kind: "comment"; tone: "cont" }>;
type SeparatorRow = Extract<DisplayRow, { kind: "thread-separator" }>;

function gap(n: number): Span {
  return { text: " ".repeat(Math.max(0, n)), kind: "gap" };
}

export function contentWidth(width: number, padLeft: number): number {
  return Math.max(1, width - BORDER_WIDTH - padLeft - PAD_RIGHT);
}

export function startContentWidth(width: number, lead: string): number {
  return contentWidth(width, LEAD_PAD_LEFT + (lead || THREAD_LINE).length + THREAD_PAD_LEFT);
}

export function contContentWidth(width: number): number {
  return contentWidth(width, LEAD_PAD_LEFT + THREAD_LINE.length + CONT_PAD_LEFT);
}

export function layoutCommentStart(row: StartRow, width: number): Span[] {
  const region = startContentWidth(width, row.lead);
  const used = row.author.length + 1 + row.body.length;

  const spans: Span[] = [{ text: BORDER_BAR, kind: "border" }, gap(LEAD_PAD_LEFT)];

  if (row.lead) {
    spans.push({ text: row.lead, kind: "status" });
  } else {
    spans.push({ text: THREAD_LINE, kind: "thread-line" });
  }

  spans.push(gap(THREAD_PAD_LEFT));
  spans.push({ text: row.author, kind: "author" });
  spans.push({ text: ` ${row.body}`, kind: "body" });
  spans.push(gap(Math.max(0, region - used) + PAD_RIGHT));
  spans.push({ text: BORDER_BAR, kind: "border" });

  return spans;
}

export function layoutCommentCont(row: ContRow, width: number): Span[] {
  const region = contContentWidth(width);
  const text = row.text.length > region ? row.text.slice(0, region) : row.text;

  return [
    { text: BORDER_BAR, kind: "border" },
    gap(LEAD_PAD_LEFT),
    { text: THREAD_LINE, kind: "thread-line" },
    gap(CONT_PAD_LEFT),
    { text, kind: "body" },
    gap(region - text.length + PAD_RIGHT),
    { text: BORDER_BAR, kind: "border" },
  ];
}

export function layoutSeparator(row: SeparatorRow, width: number): Span[] {
  const corner = BORDER_CORNERS[row.tone];

  return [
    { text: corner.left, kind: "border" },
    { text: BORDER_DASH.repeat(Math.max(0, width - BORDER_WIDTH)), kind: "rule" },
    { text: corner.right, kind: "border" },
  ];
}
