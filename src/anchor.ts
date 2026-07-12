import type { Anchor } from "./protocol";

export const DEFAULT_CONTEXT_LINES = 3;
export const DEFAULT_FUZZY_THRESHOLD = 0.6;

export interface CaptureInput {
  content: string;
  blobSha: string;
  line: number;
  endLine: number;
  contextLines?: number;
}

export function captureAnchor(input: CaptureInput): Anchor {
  const n = input.contextLines ?? DEFAULT_CONTEXT_LINES;
  const lines = splitLines(input.content);
  const li = clamp(input.line, 1, Math.max(lines.length, 1)) - 1;
  const ei = clamp(input.endLine, input.line, Math.max(lines.length, 1)) - 1;
  return {
    blobSha: input.blobSha,
    line: input.line,
    endLine: input.endLine,
    lineText: lines[li] ?? "",
    before: lines.slice(Math.max(0, li - n), li),
    after: lines.slice(ei + 1, ei + 1 + n),
  };
}

export interface ResolveOptions {
  fuzzyThreshold?: number;
}

export interface ResolvedPosition {
  line: number;
  endLine: number;
}

export function resolveAnchor(
  anchor: Anchor,
  currentContent: string | null,
  currentBlobSha: string | null,
  opts: ResolveOptions = {},
): ResolvedPosition | null {
  if (currentContent === null) return null;
  const span = anchor.endLine - anchor.line;

  if (currentBlobSha !== null && currentBlobSha === anchor.blobSha) {
    return { line: anchor.line, endLine: anchor.line + span };
  }

  const lines = splitLines(currentContent);
  if (lines.length === 0) return null;

  const threshold = opts.fuzzyThreshold ?? DEFAULT_FUZZY_THRESHOLD;

  let best = { index: -1, score: -1, exact: false };
  for (let i = 0; i < lines.length; i++) {
    const lineScore = sim(anchor.lineText, lines[i]);
    const ctxScore = contextScore(anchor, lines, i);
    const total = combine(lineScore, ctxScore, anchor);
    const exact = lineScore === 1 && ctxScore >= 0.5;
    if (
      total > best.score ||
      (total === best.score &&
        Math.abs(i + 1 - anchor.line) < Math.abs(best.index + 1 - anchor.line))
    ) {
      best = { index: i, score: total, exact };
    }
  }

  if (best.index < 0) return null;
  if (best.exact || best.score >= threshold) {
    const line = best.index + 1;
    return { line, endLine: line + span };
  }
  return null;
}

function contextScore(anchor: Anchor, lines: string[], i: number): number {
  let sum = 0;
  let count = 0;
  for (let k = 0; k < anchor.before.length; k++) {
    const want = anchor.before[anchor.before.length - 1 - k];
    const got = lines[i - 1 - k];
    if (got === undefined) continue;
    sum += sim(want, got);
    count++;
  }
  for (let k = 0; k < anchor.after.length; k++) {
    const got = lines[i + 1 + k];
    if (got === undefined) continue;
    sum += sim(anchor.after[k], got);
    count++;
  }
  return count === 0 ? 0 : sum / count;
}

function combine(lineScore: number, ctxScore: number, anchor: Anchor): number {
  const hasContext = anchor.before.length > 0 || anchor.after.length > 0;
  if (!hasContext) return lineScore;
  return 0.6 * lineScore + 0.4 * ctxScore;
}

export function splitLines(content: string): string[] {
  const lines = content.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export function sim(a: string, b: string): number {
  const x = a.trim();
  const y = b.trim();
  if (x === y) return 1;
  if (x.length === 0 || y.length === 0) return 0;
  const dist = levenshtein(x, y);
  return 1 - dist / Math.max(x.length, y.length);
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
