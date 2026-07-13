import type { Anchor } from "../protocol";
import type { LineMatch, ResolveOptions, ResolvedPosition } from "./types";
import { DEFAULT_FUZZY_THRESHOLD } from "./constants";
import { splitLines } from "./helpers";
import { sim } from "./similarity";

function contextScore(anchor: Anchor, lines: string[], i: number): number {
  let sum = 0;
  let count = 0;

  for (let k = 0; k < anchor.before.length; k++) {
    const want = anchor.before[anchor.before.length - 1 - k];
    const got = lines[i - 1 - k];

    if (got === undefined) {
      continue;
    }

    sum += sim(want, got);
    count++;
  }

  for (let k = 0; k < anchor.after.length; k++) {
    const got = lines[i + 1 + k];

    if (got === undefined) {
      continue;
    }

    sum += sim(anchor.after[k], got);
    count++;
  }

  return count === 0 ? 0 : sum / count;
}

function totalScore(lineScore: number, ctxScore: number, anchor: Anchor): number {
  const hasContext = anchor.before.length > 0 || anchor.after.length > 0;

  if (!hasContext) {
    return lineScore;
  }

  return 0.6 * lineScore + 0.4 * ctxScore;
}

function closerToAnchor(anchor: Anchor, i: number, best: LineMatch): boolean {
  return Math.abs(i + 1 - anchor.line) < Math.abs(best.index + 1 - anchor.line);
}

function bestMatch(anchor: Anchor, lines: string[]): LineMatch {
  let best: LineMatch = { index: -1, score: -1, exact: false };

  for (let i = 0; i < lines.length; i++) {
    const lineScore = sim(anchor.lineText, lines[i]);
    const ctxScore = contextScore(anchor, lines, i);
    const score = totalScore(lineScore, ctxScore, anchor);

    if (score > best.score || (score === best.score && closerToAnchor(anchor, i, best))) {
      best = { index: i, score, exact: lineScore === 1 && ctxScore >= 0.5 };
    }
  }

  return best;
}

export function resolveAnchor(
  anchor: Anchor,
  currentContent: string | null,
  currentBlobSha: string | null,
  opts: ResolveOptions = {},
): ResolvedPosition | null {
  if (currentContent === null) {
    return null;
  }

  const span = anchor.endLine - anchor.line;

  if (currentBlobSha !== null && currentBlobSha === anchor.blobSha) {
    return { line: anchor.line, endLine: anchor.line + span };
  }

  const lines = splitLines(currentContent);

  if (lines.length === 0) {
    return null;
  }

  const threshold = opts.fuzzyThreshold ?? DEFAULT_FUZZY_THRESHOLD;
  const best = bestMatch(anchor, lines);

  if (best.index < 0) {
    return null;
  }

  if (best.exact || best.score >= threshold) {
    const line = best.index + 1;

    return { line, endLine: line + span };
  }

  return null;
}
