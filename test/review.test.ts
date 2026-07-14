import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { Review } from "../src/review/index.js";
import { JsonBackend } from "../src/store/json-backend/index.js";

function tmpRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), "review-test-"));
  const run = (args: string[]) => execFileSync("git", args, { cwd: dir });
  run(["init", "-q"]);
  run(["config", "user.email", "t@t.co"]);
  run(["config", "user.name", "t"]);
  return { dir, run };
}

function openReview(dir: string) {
  return Review.open({ cwd: dir, backend: new JsonBackend(path.join(dir, ".review")) });
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

  it("includes untracked files as added, alongside modified and deleted", async () => {
    const { dir, run } = tmpRepo();
    writeFileSync(path.join(dir, "keep.txt"), "a\nb\nc\n");
    writeFileSync(path.join(dir, "gone.txt"), "x\ny\n");
    run(["add", "."]);
    run(["commit", "-qm", "init"]);
    writeFileSync(path.join(dir, "keep.txt"), "a\nB\nc\n");
    run(["rm", "-q", "gone.txt"]);
    writeFileSync(path.join(dir, "fresh.txt"), "new1\nnew2\n");

    const review = await openReview(dir);
    const structured = await review.diffFiles();
    const byFile = new Map(structured.files.map((f) => [f.file, f]));

    expect([...byFile.keys()].sort()).toEqual(["fresh.txt", "gone.txt", "keep.txt"]);
    expect(byFile.get("gone.txt")!.status).toBe("deleted");
    expect(byFile.get("fresh.txt")!.status).toBe("added");
    expect(byFile.get("fresh.txt")!.patch).toContain("+new1");
    expect(byFile.get("fresh.txt")!.patch).toContain("+new2");

    const raw = await review.diff();
    expect(raw).toContain("fresh.txt");
    expect(raw).toContain("+new1");
  });

  it("diff --json is hunk-based by default and full-file with whole:true", async () => {
    const { dir, run } = tmpRepo();
    writeFileSync(
      path.join(dir, "big.txt"),
      Array.from({ length: 60 }, (_, i) => i + 1).join("\n") + "\n",
    );
    run(["add", "."]);
    run(["commit", "-qm", "init"]);
    writeFileSync(
      path.join(dir, "big.txt"),
      Array.from({ length: 60 }, (_, i) => (i === 29 ? "THIRTY" : String(i + 1))).join("\n") + "\n",
    );

    const review = await openReview(dir);
    const hunk = (await review.diffFiles()).files[0].patch.split("\n").length;
    const whole = (await review.diffFiles({ whole: true })).files[0].patch.split("\n").length;
    expect(hunk).toBeLessThan(whole);
    expect(whole).toBeGreaterThan(60);
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

  it("submits a whole review in one batch, anchored and attributed", async () => {
    const { dir, run } = tmpRepo();
    writeFileSync(path.join(dir, "a.txt"), "1\n2\n3\n4\n5\n");
    writeFileSync(path.join(dir, "b.txt"), "x\ny\n");
    run(["add", "."]);
    run(["commit", "-qm", "init"]);
    writeFileSync(path.join(dir, "a.txt"), "1\n2 CHANGED\n3\n4\n5\n");

    const review = await openReview(dir);
    await review.startSession({ base: "HEAD" });
    const res = await review.addBatch({
      author: "agent",
      comments: [
        { file: "a.txt", line: 2, body: "one" },
        { file: "a.txt", line: 4, body: "two" },
        { file: "b.txt", line: 1, body: "three" },
      ],
      general: [{ body: "overall" }],
    });

    expect(res.threads).toHaveLength(3);
    expect(res.generalComments).toHaveLength(1);

    const store = await review.read();
    expect(store.threads).toHaveLength(3);
    expect(store.generalComments).toHaveLength(1);
    expect(store.threads.every((t) => t.messages[0].author === "agent")).toBe(true);
    expect(store.generalComments[0].messages[0].author).toBe("agent");

    const state = await review.state();
    const byBody = new Map(state.threads.map((t) => [t.messages[0].body, t]));
    expect(byBody.get("one")!.currentLine).toBe(2);
    expect(byBody.get("two")!.currentLine).toBe(4);
  });

  it("applies replies and resolutions to many threads in one batch", async () => {
    const { dir, run } = tmpRepo();
    writeFileSync(path.join(dir, "a.txt"), "1\n2\n3\n");
    run(["add", "."]);
    run(["commit", "-qm", "init"]);

    const review = await openReview(dir);
    const t1 = await review.addComment({ file: "a.txt", line: 1, body: "one", author: "human" });
    const t2 = await review.addComment({ file: "a.txt", line: 2, body: "two", author: "human" });
    const g = await review.addGeneralComment({ body: "overall", author: "human" });

    const res = await review.applyBatch({
      author: "agent",
      actions: [
        { id: t1.id.slice(0, 8), reply: "fixed", status: "resolved" },
        { id: t2.id, status: "dismissed", note: "wontfix" },
        { id: g.id, reply: "added tests" },
        { id: "deadbeef", reply: "nope" },
      ],
    });

    expect(res.applied.sort()).toEqual([t1.id, t2.id, g.id].sort());
    expect(res.notFound).toEqual(["deadbeef"]);

    const store = await review.read();
    const a = store.threads.find((t) => t.id === t1.id)!;
    expect(a.status).toBe("resolved");
    expect(a.messages.map((m) => m.body)).toEqual(["one", "fixed"]);
    expect(a.messages[1].author).toBe("agent");
    const b = store.threads.find((t) => t.id === t2.id)!;
    expect(b.status).toBe("dismissed");
    expect(b.resolution?.note).toBe("wontfix");
    expect(store.generalComments[0].messages.map((m) => m.body)).toEqual([
      "overall",
      "added tests",
    ]);
  });

  it("stores each session in its own file behind a sessions manifest", async () => {
    const { dir, run } = tmpRepo();
    writeFileSync(path.join(dir, "a.txt"), "1\n2\n");
    run(["add", "."]);
    run(["commit", "-qm", "init"]);

    const review = await openReview(dir);
    const s1 = await review.startSession({ base: "HEAD" });
    await review.addComment({ file: "a.txt", line: 1, body: "one" });
    const s2 = await review.startSession({ base: "HEAD" });
    await review.addGeneralComment({ body: "overall" });

    const storeDir = path.join(dir, ".review");
    const readJson = (name: string) => JSON.parse(readFileSync(path.join(storeDir, name), "utf8"));

    const manifest = readJson("sessions.json");
    expect(manifest.sessions.map((s: { id: string }) => s.id)).toEqual([s1.id, s2.id]);
    expect(manifest.currentSessionId).toBe(s2.id);
    expect(manifest.sessions.every((s: { createdAt?: string }) => s.createdAt)).toBe(true);

    const first = readJson(`${s1.id}.json`);
    const second = readJson(`${s2.id}.json`);
    expect(first.threads).toHaveLength(1);
    expect(first.generalComments).toHaveLength(0);
    expect(second.threads).toHaveLength(0);
    expect(second.generalComments).toHaveLength(1);

    const resumed = await review.resumeLast();
    expect(resumed.id).toBe(s2.id);
  });

  it("anchors new-side comments against the compare ref, not the working tree", async () => {
    const { dir, run } = tmpRepo();
    const sha = () => execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir }).toString().trim();

    writeFileSync(path.join(dir, "f.txt"), "one\ntwo\nthree\n");
    run(["add", "."]);
    run(["commit", "-qm", "base"]);
    const base = sha();

    writeFileSync(path.join(dir, "f.txt"), "one\nTWO CHANGED\nthree\n");
    run(["add", "."]);
    run(["commit", "-qm", "compare"]);
    const compare = sha();

    writeFileSync(path.join(dir, "f.txt"), "totally\ndifferent\nworking tree\n");

    const review = await openReview(dir);
    await review.startSession({ base, compare });
    const t = await review.addComment({ file: "f.txt", line: 2, body: "?" });

    const found = (await review.state()).threads.find((x) => x.id === t.id)!;
    expect(found.anchor.lineText).toBe("TWO CHANGED");
    expect(found.currentLine).toBe(2);
    expect(found.status).toBe("open");
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

  it("reports staging status and stages/unstages files, keeping the first entry intact", async () => {
    const { dir, run } = tmpRepo();
    writeFileSync(path.join(dir, "a.txt"), "a\n");
    writeFileSync(path.join(dir, "b.txt"), "b\n");
    run(["add", "-A"]);
    run(["commit", "-qm", "init"]);
    writeFileSync(path.join(dir, "a.txt"), "a changed\n");
    writeFileSync(path.join(dir, "b.txt"), "b changed\n");
    writeFileSync(path.join(dir, "c.txt"), "untracked\n");

    const review = await openReview(dir);
    expect(await review.stagingStatus()).toEqual({
      staged: [],
      unstaged: ["a.txt", "b.txt", "c.txt"],
    });

    await review.stageFiles(["a.txt"]);
    expect(await review.stagingStatus()).toEqual({
      staged: ["a.txt"],
      unstaged: ["b.txt", "c.txt"],
    });

    await review.unstageFiles(["a.txt"]);
    expect((await review.stagingStatus()).staged).toEqual([]);
  });
});
