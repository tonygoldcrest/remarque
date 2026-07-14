import React from "react";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";

import { App } from "../src/tui/app/index.js";
import type { Review } from "../src/review/index.js";
import type { ReviewState, StructuredDiff } from "../src/protocol.js";

const patchA = ["@@ -1,1 +1,1 @@", "-a", "+AAA_MARKER", ""].join("\n");
const patchB = ["@@ -1,1 +1,1 @@", "-b", "+BBB_MARKER", ""].join("\n");

const diff: StructuredDiff = {
  base: "HEAD",
  compare: "WORKING",
  files: [
    { file: "a.txt", oldFile: null, status: "modified", patch: patchA },
    { file: "b.txt", oldFile: null, status: "modified", patch: patchB },
  ],
};

const emptyState: ReviewState = {
  schemaVersion: 1,
  session: null,
  threads: [],
  generalComments: [],
};

const tick = () => new Promise((r) => setTimeout(r, 50));

describe("file selection", () => {
  it("stays on the same file when staging reorders the list", async () => {
    let staging: { staged: string[]; unstaged: string[] } = {
      staged: [],
      unstaged: ["a.txt", "b.txt"],
    };
    const review = {
      diffFiles: async () => diff,
      state: async () => emptyState,
      stagingStatus: async () => staging,
      location: () => path.join(mkdtempSync(path.join(tmpdir(), "remarque-test-")), "store"),
    } as unknown as Review;

    const { stdin, lastFrame, unmount } = render(<App review={review} />);
    await tick();
    expect(lastFrame()).toContain("AAA_MARKER");

    stdin.write("]");
    await tick();
    stdin.write("f");
    await tick();
    expect(lastFrame()).toContain("BBB_MARKER");

    staging = { staged: ["b.txt"], unstaged: ["a.txt"] };

    stdin.write("\u0012");
    await tick();

    expect(lastFrame()).toContain("Staged (1):");
    expect(lastFrame()).toContain("BBB_MARKER");
    expect(lastFrame()).not.toContain("AAA_MARKER");
    unmount();
  });
});
