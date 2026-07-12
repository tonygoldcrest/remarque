import { describe, it, expect } from "vitest";
import { parsePatch } from "../src/tui/parse";
import {
  buildDisplayRows,
  chunkStarts,
  computeUnits,
  navigate,
  threadStarts,
  seekIndex,
  selectionKey,
  fileList,
} from "../src/tui/model";
import type { DisplayRow } from "../src/tui/model";
import type { DiffFile, ResolvedThread, ReviewState, StructuredDiff } from "../src/protocol";

const patch = [
  "diff --git a/f b/f",
  "index e69..abc 100644",
  "--- a/f",
  "+++ b/f",
  "@@ -1,3 +1,4 @@",
  " a",
  "-b",
  "+B",
  "+C",
  " c",
  "",
].join("\n");

describe("parsePatch", () => {
  const rows = parsePatch(patch);

  it("emits a hunk header then aligned split rows", () => {
    expect(rows[0]).toEqual({ kind: "hunk", header: "@@ -1,3 +1,4 @@" });
    const lines = rows.filter((r) => r.kind === "line");
    expect(lines).toEqual([
      {
        kind: "line",
        left: { num: 1, text: "a", type: "context" },
        right: { num: 1, text: "a", type: "context" },
      },
      {
        kind: "line",
        left: { num: 2, text: "b", type: "del" },
        right: { num: 2, text: "B", type: "add" },
      },
      {
        kind: "line",
        left: { num: null, text: "", type: "empty" },
        right: { num: 3, text: "C", type: "add" },
      },
      {
        kind: "line",
        left: { num: 3, text: "c", type: "context" },
        right: { num: 4, text: "c", type: "context" },
      },
    ]);
  });
});

function thread(
  id: string,
  line: number | null,
  status: ResolvedThread["status"],
  messages = 1,
): ResolvedThread {
  return {
    id,
    sessionId: "s",
    file: "f",
    side: "new",
    anchor: {
      blobSha: "x",
      line: line ?? 1,
      endLine: line ?? 1,
      lineText: "",
      before: [],
      after: [],
    },
    status,
    resolution: null,
    messages: Array.from({ length: messages }, (_, i) => ({
      id: `m${i}`,
      author: i % 2 === 0 ? ("human" as const) : ("agent" as const),
      body: `msg ${i}`,
      at: "t",
    })),
    createdAt: "t",
    updatedAt: "t",
    currentLine: line,
    currentEndLine: line,
  };
}

describe("buildDisplayRows", () => {
  const file: DiffFile = { file: "f", oldFile: null, status: "modified", patch };

  it("inserts a comment row after its anchored new-side line", () => {
    const state: ReviewState = {
      schemaVersion: 1,
      session: null,
      threads: [thread("t1", 2, "open")],
      generalComments: [],
    };
    const rows = buildDisplayRows(file, state);
    const i = rows.findIndex((r) => r.kind === "comment");
    expect(i).toBeGreaterThan(0);
    const prev = rows[i - 1];
    expect(prev.kind === "line" && prev.right.num).toBe(2);
  });

  it("expands a multi-message thread into one row per message, first marked head", () => {
    const state: ReviewState = {
      schemaVersion: 1,
      session: null,
      threads: [thread("t3", 2, "open", 3)],
      generalComments: [],
    };
    const rows = buildDisplayRows(file, state);
    const starts = rows.filter((r) => r.kind === "comment" && r.tone === "start");
    const rules = rows.filter((r) => r.kind === "comment" && r.tone === "rule");
    expect(starts).toHaveLength(3);
    expect(rules).toHaveLength(2);
    expect(starts[0].kind === "comment" && starts[0].tone === "start" && starts[0].head).toBe(true);
    expect(starts[1].kind === "comment" && starts[1].tone === "start" && starts[1].head).toBe(
      false,
    );
  });

  it("wraps a long comment onto multiple rows that each fit the pane width", () => {
    const long =
      "this is a very long review comment that should wrap across several lines instead of being clipped at the pane boundary";
    const state: ReviewState = {
      schemaVersion: 1,
      session: null,
      threads: [
        {
          ...thread("t4", 2, "open"),
          messages: [{ id: "m", author: "human", body: long, at: "t" }],
        },
      ],
      generalComments: [],
    };
    const comments = buildDisplayRows(file, state, { old: 30, new: 30 }).filter(
      (r) => r.kind === "comment",
    );
    expect(comments.length).toBeGreaterThan(1);
    for (const c of comments) {
      if (c.kind !== "comment") continue;
      const len =
        c.tone === "start" ? c.lead.length + c.author.length + 1 + c.body.length : c.text.length;
      expect(len).toBeLessThanOrEqual(30);
    }
  });

  it("appends outdated threads that no longer anchor", () => {
    const state: ReviewState = {
      schemaVersion: 1,
      session: null,
      threads: [thread("t2", null, "outdated")],
      generalComments: [],
    };
    const rows = buildDisplayRows(file, state);
    const last = rows[rows.length - 1];
    expect(last.kind).toBe("comment");
  });
});

describe("chunk and thread jumps", () => {
  const file: DiffFile = { file: "f", oldFile: null, status: "modified", patch };

  it("finds one chunk start (the changed block) and the thread starts", () => {
    const state: ReviewState = {
      schemaVersion: 1,
      session: null,
      threads: [thread("t1", 2, "open"), thread("t2", 3, "open")],
      generalComments: [],
    };
    const rows = buildDisplayRows(file, state);
    const chunks = chunkStarts(rows);
    const threads = threadStarts(rows);
    expect(chunks.length).toBe(1);
    expect(threads.length).toBe(2);
    expect(rows[chunks[0]].kind).toBe("line");
    expect(rows[threads[0]].kind).toBe("comment");
  });

  it("seekIndex moves forward and backward, returning null past the ends", () => {
    const idx = [2, 5, 9];
    expect(seekIndex(idx, 0, 1)).toBe(2);
    expect(seekIndex(idx, 2, 1)).toBe(5);
    expect(seekIndex(idx, 9, 1)).toBeNull();
    expect(seekIndex(idx, 9, -1)).toBe(5);
    expect(seekIndex(idx, 2, -1)).toBeNull();
  });
});

describe("row stepping and per-comment selection", () => {
  const file: DiffFile = { file: "f", oldFile: null, status: "modified", patch };

  it("selectionKey groups every wrapped line of one comment together", () => {
    const long = "wrap ".repeat(40).trim();
    const state: ReviewState = {
      schemaVersion: 1,
      session: null,
      threads: [
        {
          ...thread("t1", 2, "open"),
          messages: [{ id: "m", author: "human", body: long, at: "t" }],
        },
      ],
      generalComments: [],
    };
    const rows = buildDisplayRows(file, state, { old: 24, new: 24 });
    const commentRows = rows
      .map((r, i) => ({ r, i }))
      .filter((x) => x.r.kind === "comment" && x.r.tone !== "rule");
    expect(commentRows.length).toBeGreaterThan(1);
    const keys = new Set(commentRows.map((x) => selectionKey(x.r, x.i)));
    expect(keys.size).toBe(1);
  });
});

describe("navigation by unit", () => {
  const t = thread("nav", 1, "open");
  const line = (n: number): DisplayRow => ({
    kind: "line",
    left: { num: n, text: "x", type: "context" },
    right: { num: n, text: "x", type: "context" },
  });
  const start = (key: string): DisplayRow => ({
    kind: "comment",
    thread: t,
    tone: "start",
    msgKey: key,
    head: true,
    lead: "● ",
    author: "h:",
    body: "b",
  });
  const cont = (key: string, s: string): DisplayRow => ({
    kind: "comment",
    thread: t,
    tone: "cont",
    msgKey: key,
    text: s,
  });

  it("moves one unit per press and scrolls the viewport", () => {
    const rows = [line(1), line(2), line(3), line(4), line(5)];
    const { units, unitOf } = computeUnits(rows);
    expect(units).toHaveLength(5);
    let v = { row: 0, top: 0 };
    v = navigate(rows, units, unitOf, v, 1, 3);
    expect(v.row).toBe(1);
    v = navigate(rows, units, unitOf, v, 1, 3);
    expect(v.row).toBe(2);
    v = navigate(rows, units, unitOf, v, 1, 3);
    expect(v).toEqual({ row: 3, top: 2 });
  });

  it("brings a clipped comment fully into view before advancing", () => {
    const rows = [line(1), start("k"), cont("k", "a"), cont("k", "b"), line(2)];
    const { units, unitOf } = computeUnits(rows);
    let v = { row: 1, top: 0 };
    v = navigate(rows, units, unitOf, v, 1, 3);
    expect(v).toEqual({ row: 1, top: 1 });
    v = navigate(rows, units, unitOf, v, 1, 3);
    expect(v.row).toBe(4);
  });

  it("sub-scrolls an oversized comment in window-fitting chunks", () => {
    const rows = [
      line(1),
      start("k"),
      cont("k", "a"),
      cont("k", "b"),
      cont("k", "c"),
      cont("k", "d"),
      line(2),
    ];
    const { units, unitOf } = computeUnits(rows);
    let v = { row: 1, top: 0 };
    v = navigate(rows, units, unitOf, v, 1, 3);
    expect(v).toEqual({ row: 1, top: 3 });
    v = navigate(rows, units, unitOf, v, 1, 3);
    expect(v.row).toBe(6);
  });
});

describe("fileList", () => {
  it("counts unresolved threads per file", () => {
    const diff: StructuredDiff = {
      base: "HEAD",
      compare: "WORKING",
      files: [{ file: "f", oldFile: null, status: "modified", patch }],
    };
    const state: ReviewState = {
      schemaVersion: 1,
      session: null,
      threads: [thread("a", 2, "open"), thread("b", 3, "resolved")],
      generalComments: [],
    };
    expect(fileList(diff, state)).toEqual([{ file: "f", status: "modified", open: 1, total: 2 }]);
  });
});
