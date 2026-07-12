import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { Review } from "../src/review";
import { JsonBackend } from "../src/store/json-backend";

function tmpRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), "review-test-"));
  const run = (args: string[]) => execFileSync("git", args, { cwd: dir });
  run(["init", "-q"]);
  run(["config", "user.email", "t@t.co"]);
  run(["config", "user.name", "t"]);
  return { dir, run };
}

function openReview(dir: string) {
  return Review.open({ cwd: dir, backend: new JsonBackend(path.join(dir, ".review.json")) });
}

describe("review loop", () => {
  it("anchors a comment that follows edits, then resolves it", async () => {
    const { dir, run } = tmpRepo();
    writeFileSync(path.join(dir, "app.txt"), "line1\nline2\nline3\nline4\nline5\n");
    run(["add", "app.txt"]);
    run(["commit", "-qm", "init"]);
    writeFileSync(path.join(dir, "app.txt"), "line1\nline2 CHANGED\nline3\nline4\nline5\n");

    const review = await openReview(dir);
    await review.startSession({ base: "HEAD" });
    const thread = await review.addComment({ file: "app.txt", line: 2, body: "why?" });

    writeFileSync(
      path.join(dir, "app.txt"),
      "NEW0\nNEWa\nline1\nline2 CHANGED\nline3\nline4\nline5\n",
    );

    const state = await review.state();
    const found = state.threads.find((t) => t.id === thread.id)!;
    expect(found.currentLine).toBe(4);
    expect(found.status).toBe("open");

    await review.reply(thread.id, { body: "renamed", author: "agent" });
    const resolved = await review.resolve(thread.id, { note: "done" });
    expect(resolved.status).toBe("resolved");
    expect(resolved.messages).toHaveLength(2);
  });

  it("marks a thread outdated when its content is deleted", async () => {
    const { dir, run } = tmpRepo();
    writeFileSync(path.join(dir, "f.txt"), "keep\nDELETE ME\nkeep2\n");
    run(["add", "f.txt"]);
    run(["commit", "-qm", "init"]);

    const review = await openReview(dir);
    const thread = await review.addComment({ file: "f.txt", line: 2, body: "?" });

    writeFileSync(path.join(dir, "f.txt"), "keep\nkeep2\nnothing similar at all here\n");

    const state = await review.state();
    const found = state.threads.find((t) => t.id === thread.id)!;
    expect(found.currentLine).toBeNull();
    expect(found.status).toBe("outdated");
  });

  it("persists concurrent writes without clobbering", async () => {
    const { dir, run } = tmpRepo();
    writeFileSync(path.join(dir, "c.txt"), "a\nb\nc\n");
    run(["add", "c.txt"]);
    run(["commit", "-qm", "init"]);

    const review = await openReview(dir);
    await Promise.all([
      review.addComment({ file: "c.txt", line: 1, body: "one" }),
      review.addComment({ file: "c.txt", line: 2, body: "two" }),
      review.addComment({ file: "c.txt", line: 3, body: "three" }),
    ]);

    const store = await review.read();
    expect(store.threads).toHaveLength(3);
    expect(store.threads.map((t) => t.messages[0].body).sort()).toEqual(["one", "three", "two"]);
  });

  it("produces a structured per-file diff", async () => {
    const { dir, run } = tmpRepo();
    writeFileSync(path.join(dir, "app.txt"), "a\nb\n");
    writeFileSync(path.join(dir, "keep.txt"), "k\n");
    run(["add", "."]);
    run(["commit", "-qm", "init"]);
    writeFileSync(path.join(dir, "app.txt"), "a\nB\n");
    writeFileSync(path.join(dir, "new.txt"), "n\n");
    run(["add", "new.txt"]);

    const review = await openReview(dir);
    const structured = await review.diffFiles();
    const byFile = new Map(structured.files.map((f) => [f.file, f]));

    expect([...byFile.keys()].sort()).toEqual(["app.txt", "new.txt"]);
    expect(byFile.get("app.txt")!.status).toBe("modified");
    expect(byFile.get("app.txt")!.patch).toContain("+B");
    expect(byFile.get("new.txt")!.status).toBe("added");
  });

  it("works before the first commit (diffs against the empty tree)", async () => {
    const { dir, run } = tmpRepo();
    writeFileSync(path.join(dir, "first.txt"), "hello\n");
    run(["add", "first.txt"]);

    const review = await openReview(dir);
    const structured = await review.diffFiles();
    expect(structured.files.map((f) => `${f.status} ${f.file}`)).toEqual(["added first.txt"]);

    const t = await review.addComment({ file: "first.txt", line: 1, body: "hi" });
    const state = await review.state();
    expect(state.threads.find((x) => x.id === t.id)!.currentLine).toBe(1);
  });

  it("looks up threads by short id prefix", async () => {
    const { dir, run } = tmpRepo();
    writeFileSync(path.join(dir, "d.txt"), "x\ny\n");
    run(["add", "d.txt"]);
    run(["commit", "-qm", "init"]);

    const review = await openReview(dir);
    const thread = await review.addComment({ file: "d.txt", line: 1, body: "hi" });
    const item = await review.getItem(thread.id.slice(0, 8));
    expect(item?.id).toBe(thread.id);
  });
});
