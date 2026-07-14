import React from "react";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";

import { App } from "../src/tui/app/index.js";
import type { Review } from "../src/review/index.js";
import type { GeneralComment, ReviewState, StructuredDiff } from "../src/protocol.js";

const patch = ["@@ -1,2 +1,2 @@", " context", "-old line", "+new line", ""].join("\n");

const diff: StructuredDiff = {
  base: "HEAD",
  compare: "WORKING",
  files: [{ file: "src/app.ts", oldFile: null, status: "modified", patch }],
};

const emptyState: ReviewState = {
  schemaVersion: 1,
  session: null,
  threads: [],
  generalComments: [],
};

function mockReview(overrides: Partial<Record<keyof Review, unknown>> = {}): Review {
  const dir = mkdtempSync(path.join(tmpdir(), "remarque-test-"));
  return {
    diffFiles: async () => diff,
    state: async () => emptyState,
    stagingStatus: async () => ({ staged: [], unstaged: ["src/app.ts"] }),
    location: () => path.join(dir, "store", "review.json"),
    addGeneralComment: vi.fn(async () => ({})),
    ...overrides,
  } as unknown as Review;
}

const tick = () => new Promise((r) => setTimeout(r, 50));

describe("general pane", () => {
  it("is hidden from the file tree and opens with ctrl+g", async () => {
    const { stdin, lastFrame, unmount } = render(<App review={mockReview()} />);
    await tick();
    expect(lastFrame()).toContain("app.ts");
    expect(lastFrame()).not.toContain("add a general comment");

    stdin.write("\u0007");
    await tick();
    expect(lastFrame()).toContain("add a general comment");

    stdin.write("\u0007");
    await tick();
    expect(lastFrame()).not.toContain("add a general comment");
    unmount();
  });

  it("offers a navigable compose row below existing threads for a separate comment", async () => {
    const existing: GeneralComment = {
      id: "g1",
      sessionId: "s",
      status: "open",
      resolution: null,
      messages: [{ id: "m", author: "human", body: "first thread", at: "t" }],
      createdAt: "t",
      updatedAt: "t",
    };
    const review = mockReview({
      state: async (): Promise<ReviewState> => ({ ...emptyState, generalComments: [existing] }),
    });
    const { stdin, lastFrame, unmount } = render(<App review={review} />);
    await tick();

    stdin.write("\u0007");
    await tick();
    expect(lastFrame()).toContain("add a general comment");

    stdin.write("\u001B[B");
    await tick();
    stdin.write("\u001B[B");
    await tick();
    stdin.write("c");
    await tick();
    expect(lastFrame()).toContain("general comment ›");

    stdin.write("second thread");
    await tick();
    stdin.write("\r");
    await tick();

    expect(review.addGeneralComment).toHaveBeenCalledWith({ body: "second thread" });
    unmount();
  });

  it("creates a general comment with c from the empty pane", async () => {
    const review = mockReview();
    const { stdin, lastFrame, unmount } = render(<App review={review} />);
    await tick();

    stdin.write("\u0007");
    await tick();
    stdin.write("c");
    await tick();
    expect(lastFrame()).toContain("general comment ›");

    stdin.write("needs docs");
    await tick();
    stdin.write("\r");
    await tick();

    expect(review.addGeneralComment).toHaveBeenCalledWith({ body: "needs docs" });
    unmount();
  });
});
