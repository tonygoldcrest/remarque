import React from "react";
import { writeFileSync } from "node:fs";
import { describe, it, expect, afterAll } from "vitest";
import { render } from "ink-testing-library";

import { Panel } from "../src/tui/components/panel/index.js";
import type { DisplayRow, FileEntry } from "../src/tui/model/index.js";
import type { ResolvedThread } from "../src/protocol.js";

const thread: ResolvedThread = {
  id: "a1b2c3d4e5f6",
  sessionId: "s1",
  file: "src/app.ts",
  side: "new",
  anchor: { blobSha: "x", line: 11, endLine: 11, lineText: "", before: [], after: [] },
  status: "open",
  resolution: null,
  messages: [{ id: "m", author: "human", body: "why +1 here?", at: "t" }],
  createdAt: "t",
  updatedAt: "t",
  currentLine: 11,
  currentEndLine: 11,
};

function entry(file: string, status: FileEntry["status"], open: number, total: number): FileEntry {
  return {
    file,
    oldFile: null,
    status,
    open,
    resolved: total - open,
    dismissed: 0,
    total,
  };
}

const sections = [
  {
    title: "Unstaged (2):",
    files: [entry("src/app.ts", "modified", 2, 2), entry("README.md", "modified", 0, 1)],
  },
  {
    title: "Staged (1):",
    files: [entry("src/util.ts", "added", 0, 0)],
  },
];

const rows: DisplayRow[] = [
  { kind: "hunk", header: "@@ -10,6 +10,7 @@ function compute(a, b) {" },
  {
    kind: "line",
    left: { num: 10, text: "function compute(a, b) {", type: "context" },
    right: { num: 10, text: "function compute(a, b) {", type: "context" },
  },
  {
    kind: "line",
    left: { num: 11, text: "  return a + b", type: "del" },
    right: { num: 11, text: "  return a + b + 1", type: "add" },
  },
  {
    kind: "comment",
    thread,
    tone: "start",
    msgKey: "t:m",
    head: true,
    lead: "● ",
    author: "human:",
    body: "why +1 here?",
  },
  {
    kind: "line",
    left: { num: 12, text: "}", type: "context" },
    right: { num: 12, text: "}", type: "context" },
  },
  {
    kind: "line",
    left: { num: null, text: "", type: "empty" },
    right: { num: 13, text: "const x = 1", type: "add" },
  },
];

const ESC = String.fromCharCode(27);
const stripAnsi = (s: string) =>
  s
    .split(ESC + "[")
    .map((part, i) => (i === 0 ? part : part.replace(/^[0-9;]*m/, "")))
    .join("");
const TRUECOLOR = new RegExp(ESC + "\\[48;2;[0-9]+;[0-9]+;[0-9]+m");

describe("Panel render", () => {
  const app = render(
    <Panel
      base="HEAD"
      compare="WORKING"
      sections={sections}
      currentFile="src/app.ts"
      rows={rows}
      rowIndex={2}
      focus="added"
      width={98}
      height={18}
    />,
  );
  afterAll(() => app.unmount());
  const frame = app.lastFrame() ?? "";
  if (process.env.TUI_DUMP) {
    writeFileSync(process.env.TUI_DUMP, frame);
  }

  it("emits truecolor background codes when color is enabled", () => {
    if (!process.env.FORCE_COLOR) {
      return;
    }
    expect(frame).toMatch(TRUECOLOR);
  });

  it("lays out header, file list, diff, and thread", () => {
    const plain = stripAnsi(frame);
    expect(plain).toContain("remarque — HEAD..WORKING");
    expect(plain).toContain("Staged (1):");
    expect(plain).toContain("Unstaged (2):");
    expect(plain).toContain("app.ts src");
    expect(plain).toContain("compute(a, b)");
    expect(plain).toContain("human: why +1 here?");
  });
});
