import type { Anchor } from "../protocol";
import type { CaptureInput } from "./types";
import { DEFAULT_CONTEXT_LINES } from "./constants";
import { clamp, splitLines } from "./helpers";

export function captureAnchor(input: CaptureInput): Anchor {
  const context = input.contextLines ?? DEFAULT_CONTEXT_LINES;
  const lines = splitLines(input.content);
  const lineIndex = clamp(input.line, 1, Math.max(lines.length, 1)) - 1;
  const endIndex = clamp(input.endLine, input.line, Math.max(lines.length, 1)) - 1;

  return {
    blobSha: input.blobSha,
    line: input.line,
    endLine: input.endLine,
    lineText: lines[lineIndex] ?? "",
    before: lines.slice(Math.max(0, lineIndex - context), lineIndex),
    after: lines.slice(endIndex + 1, endIndex + 1 + context),
  };
}
