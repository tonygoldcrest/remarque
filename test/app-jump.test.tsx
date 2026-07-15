import React from "react";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";

import { App } from "../src/tui/app/index.js";
import type { Review } from "../src/review/index.js";
import type { ResolvedThread, ReviewState, StructuredDiff } from "../src/protocol.js";

const patchA = ["@@ -1,1 +1,1 @@", "-a", "+AAA_MARKER", ""].join("\n");
const linesB = Array.from({ length: 50 }, (_, i) => `+line ${i + 1}`);
const patchB = ["@@ -0,0 +1,50 @@", ...linesB, ""].join("\n");

const diff: StructuredDiff = {
  base: "HEAD",
  compare: "WORKING",
  files: [
    { file: "a.txt", oldFile: null, status: "modified", patch: patchA },
    { file: "b.txt", oldFile: null, status: "modified", patch: patchB },
  ],
};

const threadOnB: ResolvedThread = {
  id: "t1",
  sessionId: "s",
  file: "b.txt",
  side: "new",
  anchor: { blobSha: "x", line: 40, endLine: 40, lineText: "", before: [], after: [] },
  status: "open",
  resolution: null,
  messages: [{ id: "m", author: "human", body: "deep comment", at: "t" }],
  createdAt: "t",
  updatedAt: "t",
  currentLine: 40,
  currentEndLine: 40,
};

const state: ReviewState = {
  schemaVersion: 1,
  session: null,
  threads: [threadOnB],
  generalComments: [],
};

const tick = () => new Promise((r) => setTimeout(r, 50));

describe("thread jumps across files", () => {
  it("lands on the thread when the next comment lives in another file", async () => {
    const review = {
      diffFiles: async () => diff,
      state: async () => state,
      stagingStatus: async () => ({ staged: [], unstaged: ["a.txt", "b.txt"] }),
      location: () => path.join(mkdtempSync(path.join(tmpdir(), "remarque-test-")), "store"),
    } as unknown as Review;

    const { stdin, lastFrame, unmount } = render(<App review={review} />);
    await tick();
    expect(lastFrame()).toContain("AAA_MARKER");
    expect(lastFrame()).not.toContain("deep comment");

    stdin.write("]");
    await tick();
    stdin.write("t");
    await tick();

    expect(lastFrame()).toContain("line 40");
    expect(lastFrame()).toContain("deep comment");
    unmount();
  });
});
