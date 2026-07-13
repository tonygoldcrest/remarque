import { describe, it, expect } from "vitest";

import { composerIntent } from "../src/tui/app/helpers";
import { wrapWords } from "../src/tui/model/wrap";
import type { DisplayRow, FileEntry } from "../src/tui/model";
import type { ResolvedThread } from "../src/protocol";

const thread: ResolvedThread = {
  id: "t1",
  sessionId: "s",
  file: "f",
  side: "new",
  anchor: { blobSha: "x", line: 1, endLine: 1, lineText: "", before: [], after: [] },
  status: "open",
  resolution: null,
  messages: [{ id: "m", author: "human", body: "hi", at: "t" }],
  createdAt: "t",
  updatedAt: "t",
  currentLine: 1,
  currentEndLine: 1,
};

function entry(general: boolean): FileEntry {
  return {
    file: general ? " general" : "f",
    status: "modified",
    general,
    open: 0,
    resolved: 0,
    dismissed: 0,
    total: 0,
  };
}

const commentRow: DisplayRow = {
  kind: "comment",
  thread,
  tone: "start",
  msgKey: "t1:m",
  head: true,
  lead: "● ",
  author: "human:",
  body: "hi",
};

const lineRow: DisplayRow = {
  kind: "line",
  left: { num: null, text: "", type: "empty" },
  right: { num: 3, text: "added", type: "add" },
};

describe("composerIntent", () => {
  it("replies when the cursor is on a comment row", () => {
    expect(composerIntent(commentRow, "added", entry(false))).toEqual({
      open: { mode: "reply", threadId: "t1" },
    });
    expect(composerIntent(commentRow, "added", entry(true))).toEqual({
      open: { mode: "reply", threadId: "t1" },
    });
  });

  it("opens a general composer on the compose row and anywhere else in the general pane", () => {
    const compose: DisplayRow = { kind: "compose", text: "+ add a general comment" };

    expect(composerIntent(compose, "added", entry(true))).toEqual({
      open: { mode: "general" },
    });
    expect(composerIntent(undefined, "added", entry(true))).toEqual({
      open: { mode: "general" },
    });
  });

  it("opens a new thread composer on a numbered diff line", () => {
    expect(composerIntent(lineRow, "added", entry(false))).toEqual({
      open: { mode: "new", file: "f", side: "new", line: 3 },
    });
  });

  it("notices when the focused side has no line", () => {
    expect(composerIntent(lineRow, "removed", entry(false))).toEqual({
      notice: "no removed line here",
    });
  });

  it("notices on non-line rows and bails without a file entry", () => {
    const hunk: DisplayRow = { kind: "hunk", header: "@@" };

    expect(composerIntent(hunk, "added", entry(false))).toEqual({
      notice: "select a diff line to comment",
    });
    expect(composerIntent(lineRow, "added", null)).toBeNull();
  });
});

describe("wrapWords", () => {
  it("keeps short text on one line", () => {
    expect(wrapWords("hello world", 20, 20)).toEqual(["hello world"]);
  });

  it("wraps at word boundaries using the rest width after the first line", () => {
    expect(wrapWords("one two three four", 8, 11)).toEqual(["one two", "three four"]);
  });

  it("hard-splits words longer than the line", () => {
    expect(wrapWords("abcdefghij", 4, 4)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("returns a single empty line for empty text", () => {
    expect(wrapWords("", 10, 10)).toEqual([""]);
  });
});
