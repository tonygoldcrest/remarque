import { describe, it, expect } from "vitest";
import type { Key } from "ink";

import { composerIntent, editValue } from "../src/tui/app/helpers.js";
import { wrapWords } from "../src/tui/model/wrap.js";
import type { DisplayRow, FileEntry } from "../src/tui/model/index.js";
import type { ResolvedThread } from "../src/protocol.js";

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

function entry(): FileEntry {
  return {
    file: "f",
    oldFile: null,
    status: "modified",
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
    expect(composerIntent(commentRow, "added", false, entry())).toEqual({
      open: { mode: "reply", threadId: "t1" },
    });
    expect(composerIntent(commentRow, "added", true, entry())).toEqual({
      open: { mode: "reply", threadId: "t1" },
    });
  });

  it("opens a general composer anywhere in the general pane", () => {
    const compose: DisplayRow = { kind: "compose", text: "+ add a general comment" };

    expect(composerIntent(compose, "added", true, entry())).toEqual({
      open: { mode: "general" },
    });
    expect(composerIntent(undefined, "added", true, null)).toEqual({
      open: { mode: "general" },
    });
  });

  it("opens a new thread composer on a numbered diff line", () => {
    expect(composerIntent(lineRow, "added", false, entry())).toEqual({
      open: { mode: "new", file: "f", side: "new", line: 3 },
    });
  });

  it("notices when the focused side has no line", () => {
    expect(composerIntent(lineRow, "removed", false, entry())).toEqual({
      notice: "no removed line here",
    });
  });

  it("notices on non-line rows and bails without a file entry", () => {
    const hunk: DisplayRow = { kind: "hunk", header: "@@" };

    expect(composerIntent(hunk, "added", false, entry())).toEqual({
      notice: "select a diff line to comment",
    });
    expect(composerIntent(lineRow, "added", false, null)).toBeNull();
  });
});

function key(overrides: Partial<Key> = {}): Key {
  return {
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    pageDown: false,
    pageUp: false,
    return: false,
    escape: false,
    ctrl: false,
    shift: false,
    tab: false,
    backspace: false,
    delete: false,
    meta: false,
    ...overrides,
  };
}

describe("editValue", () => {
  it("appends typed characters", () => {
    expect(editValue("a", "b", key())).toBe("ab");
  });

  it("removes one character on backspace or delete", () => {
    expect(editValue("abc", "", key({ delete: true }))).toBe("ab");
    expect(editValue("abc", "", key({ backspace: true }))).toBe("ab");
  });

  it("treats a coalesced chunk of DEL bytes as that many deletions", () => {
    expect(editValue("abcd", "\u007F\u007F\u007F", key())).toBe("a");
  });

  it("never lets control characters into the value", () => {
    expect(editValue("a", "x\u0007y\u001B", key())).toBe("axy");
  });

  it("flattens pasted newlines and tabs to spaces", () => {
    expect(editValue("", "line1\nline2\tend", key())).toBe("line1 line2 end");
  });

  it("ignores ctrl and meta chords", () => {
    expect(editValue("abc", "r", key({ ctrl: true }))).toBe("abc");
    expect(editValue("abc", "r", key({ meta: true }))).toBe("abc");
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
