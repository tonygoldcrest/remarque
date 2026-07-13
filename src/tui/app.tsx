import React, { useEffect, useMemo, useState } from "react";
import { render, Text, useApp, useInput } from "ink";
import { watch as fsWatch, mkdirSync, type FSWatcher } from "node:fs";
import path from "node:path";

import type { Review } from "../review";
import type { ReviewState, Side, StructuredDiff } from "../protocol";
import {
  buildDisplayRows,
  chunkStarts,
  computeUnits,
  fileList,
  navigate,
  seekIndex,
  threadStarts,
} from "./model";
import { Panel, contentHeight, paneWidths, type Focus } from "./ui";
import { enterFullscreen } from "./screen";

const ORDER: Focus[] = ["files", "removed", "added"];

function watchStore(storeFile: string, onChange: () => void): FSWatcher {
  const dir = path.dirname(storeFile);
  mkdirSync(dir, { recursive: true });
  const base = path.basename(storeFile);
  let timer: NodeJS.Timeout | null = null;
  return fsWatch(dir, (_event, filename) => {
    if (filename && filename.toString() !== base) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, 60);
  });
}

function App({ review }: { review: Review }): React.ReactElement {
  const { exit } = useApp();
  const [dims, setDims] = useState({
    w: process.stdout.columns || 80,
    h: process.stdout.rows || 24,
  });
  const [structured, setStructured] = useState<StructuredDiff | null>(null);
  const [state, setState] = useState<ReviewState | null>(null);
  const [fileIndex, setFileIndex] = useState(0);
  const [pos, setPos] = useState({ row: 0, top: 0 });
  const [focus, setFocus] = useState<Focus>("files");
  const [input, setInput] = useState<{
    mode: "new" | "reply";
    file?: string;
    side?: Side;
    line?: number;
    threadId?: string;
    value: string;
  } | null>(null);
  const [confirm, setConfirm] = useState<{ threadId: string; label: string } | null>(null);
  const [pending, setPending] = useState<"]" | "[" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reloadAll = useMemo(
    () => async () => {
      setStructured(await review.diffFiles({ whole: true }));
      setState(await review.state());
    },
    [review],
  );
  const reloadThreads = useMemo(
    () => async () => {
      setState(await review.state());
    },
    [review],
  );

  useEffect(() => {
    reloadAll().catch((e: Error) => setMessage(`error: ${e.message}`));
  }, [reloadAll]);

  useEffect(() => {
    const w = watchStore(review.location(), () => {
      reloadThreads().catch(() => undefined);
    });
    return () => w.close();
  }, [review, reloadThreads]);

  useEffect(() => {
    const onResize = () =>
      setDims({ w: process.stdout.columns || 80, h: process.stdout.rows || 24 });
    process.stdout.on("resize", onResize);
    return () => {
      process.stdout.off("resize", onResize);
    };
  }, []);

  const files = useMemo(
    () => (structured && state ? fileList(structured, state) : []),
    [structured, state],
  );
  const currentFile = files[fileIndex]?.file ?? null;
  const rows = useMemo(() => {
    if (!structured || !state || !currentFile) return [];
    const f = structured.files.find((x) => x.file === currentFile);
    if (!f) return [];
    const { removedW, addedW } = paneWidths(dims.w);
    return buildDisplayRows(f, state, { old: removedW - 2, new: addedW - 2 });
  }, [structured, state, currentFile, dims.w]);

  const height = Math.max(6, dims.h - 1);
  const { units, unitOf } = useMemo(() => computeUnits(rows), [rows]);
  const boundedRow = Math.min(pos.row, Math.max(0, rows.length - 1));
  const contentH = contentHeight(height);

  useEffect(() => {
    setPos((p) => {
      const row = Math.min(p.row, Math.max(0, rows.length - 1));
      const top = Math.max(0, Math.min(p.top, Math.max(0, rows.length - contentH)));
      return row === p.row && top === p.top ? p : { row, top };
    });
  }, [rows.length, contentH]);

  useInput((ch, key) => {
    if (confirm) {
      if (ch === "y" || ch === "Y") {
        const id = confirm.threadId;
        setConfirm(null);
        review
          .deleteThread(id)
          .then(() => {
            setMessage("comment deleted");
            return reloadThreads();
          })
          .catch((e: Error) => setMessage(`error: ${e.message}`));
      } else {
        setConfirm(null);
      }
      return;
    }

    if (input) {
      if (key.return) {
        const body = input.value.trim();
        const submitted = input;
        setInput(null);
        if (body) {
          const done = () => {
            setMessage(submitted.mode === "reply" ? "reply added" : "comment added");
            return reloadThreads();
          };
          const fail = (e: Error) => setMessage(`error: ${e.message}`);
          if (submitted.mode === "reply" && submitted.threadId) {
            review.continueThread(submitted.threadId, { body }).then(done).catch(fail);
          } else if (submitted.file && submitted.side && submitted.line != null) {
            review
              .addComment({
                file: submitted.file,
                side: submitted.side,
                line: submitted.line,
                body,
              })
              .then(done)
              .catch(fail);
          }
        }
        return;
      }
      if (key.escape) return setInput(null);
      if (key.backspace || key.delete) {
        return setInput((p) => (p ? { ...p, value: p.value.slice(0, -1) } : p));
      }
      if (ch && !key.ctrl && !key.meta) {
        return setInput((p) => (p ? { ...p, value: p.value + ch } : p));
      }
      return;
    }

    if (pending) {
      const dir = pending === "]" ? 1 : -1;
      setPending(null);
      if (ch === "c" || ch === "t") {
        const indices = ch === "c" ? chunkStarts(rows) : threadStarts(rows);
        const target = seekIndex(indices, boundedRow, dir);
        if (target == null) return setMessage(ch === "c" ? "no more chunks" : "no more threads");
        if (focus === "files") setFocus("added");
        setPos(() => {
          const top = Math.max(
            0,
            Math.min(target - Math.floor(contentH / 2), Math.max(0, rows.length - contentH)),
          );
          return { row: target, top };
        });
        return;
      }
    }
    if (ch === "]" || ch === "[") return setPending(ch);

    if (ch === "q") return exit();
    if (key.ctrl && ch === "r") {
      setMessage("reloading…");
      reloadAll()
        .then(() => setMessage("reloaded"))
        .catch((e: Error) => setMessage(`error: ${e.message}`));
      return;
    }
    if (key.tab) {
      const i = ORDER.indexOf(focus);
      setFocus(ORDER[(i + (key.shift ? -1 : 1) + ORDER.length) % ORDER.length]);
      return;
    }
    if (key.upArrow || key.downArrow) {
      const d = key.upArrow ? -1 : 1;
      if (focus === "files") {
        setFileIndex((i) => Math.max(0, Math.min(files.length - 1, i + d)));
        setPos({ row: 0, top: 0 });
      } else {
        setPos((p) => navigate(rows, units, unitOf, p, d, contentH));
      }
      return;
    }
    if (ch === "c") {
      if (focus === "files") return;
      const row = rows[boundedRow];
      if (!row) return;
      if (row.kind === "comment") {
        setInput({ mode: "reply", threadId: row.thread.id, value: "" });
        return;
      }
      if (row.kind !== "line") return setMessage("select a diff line to comment");
      const side: Side = focus === "removed" ? "old" : "new";
      const cell = focus === "removed" ? row.left : row.right;
      if (cell.num == null) return setMessage(`no ${focus} line here`);
      if (!currentFile) return;
      setInput({ mode: "new", file: currentFile, side, line: cell.num, value: "" });
      return;
    }
    if (ch === "d") {
      if (focus === "files") return;
      const row = rows[boundedRow];
      if (!row || row.kind !== "comment") return setMessage("select a comment to delete");
      setConfirm({ threadId: row.thread.id, label: "delete this comment?" });
      return;
    }
    if (ch === "r" || ch === "x" || ch === "o") {
      const row = rows[boundedRow];
      if (focus === "files" || !row || row.kind !== "comment") {
        return setMessage("select a comment first");
      }
      const id = row.thread.id;
      const run =
        ch === "r"
          ? { verb: "resolved", act: () => review.resolve(id, { author: "human" }) }
          : ch === "x"
            ? { verb: "dismissed", act: () => review.dismiss(id, { author: "human" }) }
            : { verb: "reopened", act: () => review.reopen(id) };
      run
        .act()
        .then(() => {
          setMessage(run.verb);
          return reloadThreads();
        })
        .catch((e: Error) => setMessage(`error: ${e.message}`));
    }
  });

  if (!structured || !state) {
    return <Text color="cyan">loading review…</Text>;
  }

  return (
    <Panel
      base={structured.base}
      compare={structured.compare}
      files={files}
      fileIndex={fileIndex}
      currentFile={currentFile}
      rows={rows}
      rowIndex={boundedRow}
      scrollTop={pos.top}
      focus={focus}
      width={dims.w}
      height={height}
      input={input}
      confirm={confirm ? { label: confirm.label } : null}
      message={message}
    />
  );
}

export function runApp(review: Review): Promise<void> {
  const restore = enterFullscreen();
  const { waitUntilExit } = render(<App review={review} />);
  return waitUntilExit().finally(restore);
}
