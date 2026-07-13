import React, { useCallback, useMemo, useState } from "react";
import { render, Text, useApp, useInput } from "ink";

import type { Review } from "../../review";
import { buildDisplayRows, buildGeneralRows, computeUnits, fileList } from "../model";
import { enterFullscreen } from "../screen";
import type { Focus } from "../types";
import { contentHeight, paneWidths } from "../helpers";
import { Panel } from "../components/panel";
import { composerIntent, statusActions } from "./helpers";
import type { StatusKey } from "./types";
import { useComposer } from "./use-composer";
import { useConfirmDelete } from "./use-confirm-delete";
import { useJump } from "./use-jump";
import { useReviewData } from "./use-review-data";
import { useTerminalSize } from "./use-terminal-size";
import { useViewport } from "./use-viewport";

export function App({ review }: { review: Review }): React.ReactElement {
  const { exit } = useApp();
  const { columns, rows: termRows } = useTerminalSize();
  const [message, setMessage] = useState<string | null>(null);
  const [fileIndex, setFileIndex] = useState(0);
  const [focus, setFocus] = useState<Focus>("files");

  const onError = useCallback((e: Error) => setMessage(`error: ${e.message}`), []);
  const { structured, state, reloadAll, reloadThreads } = useReviewData(review, onError);

  const files = useMemo(
    () => (structured && state ? fileList(structured, state) : []),
    [structured, state],
  );
  const currentEntry = files[fileIndex] ?? null;
  const isGeneral = currentEntry?.general ?? false;

  const rows = useMemo(() => {
    if (!structured || !state || !currentEntry) {
      return [];
    }

    const { removedW, addedW } = paneWidths(columns);

    if (currentEntry.general) {
      return buildGeneralRows(state, removedW + addedW - 2);
    }

    const file = structured.files.find((f) => f.file === currentEntry.file);

    return file ? buildDisplayRows(file, state, { old: removedW - 2, new: addedW - 2 }) : [];
  }, [structured, state, currentEntry, columns]);

  const height = Math.max(6, termRows - 1);
  const contentH = contentHeight(height);
  const { units, unitOf } = useMemo(() => computeUnits(rows), [rows]);
  const viewport = useViewport({ rows, units, unitOf, contentH });

  const refreshThreads = useCallback(
    (notice: string) => {
      setMessage(notice);

      return reloadThreads();
    },
    [reloadThreads],
  );

  const composer = useComposer({ review, onSubmitted: refreshThreads, onError });
  const confirmDelete = useConfirmDelete({
    review,
    onDeleted: () => refreshThreads("comment deleted"),
    onError,
  });
  const jump = useJump({
    rows,
    onJump: (target) => {
      if (focus === "files") {
        setFocus("added");
      }

      viewport.jumpTo(target);
    },
    onMiss: setMessage,
  });

  const selectedThread = () => {
    const row = rows[viewport.boundedRow];

    return focus !== "files" && row && row.kind === "comment" ? row.thread : null;
  };

  const reload = () => {
    setMessage("reloading…");
    reloadAll()
      .then(() => setMessage("reloaded"))
      .catch(onError);
  };

  const cycleFocus = (backwards: boolean) => {
    const order: Focus[] = isGeneral ? ["files", "added"] : ["files", "removed", "added"];
    const current = isGeneral && focus === "removed" ? "added" : focus;
    const next = order.indexOf(current) + (backwards ? -1 : 1);

    setFocus(order[(next + order.length) % order.length]);
  };

  const moveSelection = (dir: number) => {
    if (focus !== "files") {
      return viewport.move(dir);
    }

    if (files.length > 0) {
      setFileIndex((i) => (i + dir + files.length) % files.length);
      viewport.reset();
    }
  };

  const commentAtCursor = () => {
    if (focus === "files") {
      return;
    }

    const intent = composerIntent(rows[viewport.boundedRow], focus, currentEntry);

    if (!intent) {
      return;
    }

    if ("notice" in intent) {
      return setMessage(intent.notice);
    }

    composer.open(intent.open);
  };

  const deleteAtCursor = () => {
    if (focus === "files") {
      return;
    }

    const thread = selectedThread();

    if (!thread) {
      return setMessage("select a comment to delete");
    }

    confirmDelete.requestDelete(thread.id);
  };

  const setStatusAtCursor = (statusKey: StatusKey) => {
    const thread = selectedThread();

    if (!thread) {
      return setMessage("select a comment first");
    }

    const { verb, act } = statusActions[statusKey];

    act(review, thread.id)
      .then(() => refreshThreads(verb))
      .catch(onError);
  };

  useInput((ch, key) => {
    if (confirmDelete.handleKey(ch)) {
      return;
    }

    if (composer.handleKey(ch, key)) {
      return;
    }

    if (jump.handleKey(ch, viewport.boundedRow)) {
      return;
    }

    if (ch === "q") {
      return exit();
    }

    if (key.ctrl && ch === "r") {
      return reload();
    }

    if (key.tab) {
      return cycleFocus(!!key.shift);
    }

    if (key.upArrow || key.downArrow) {
      return moveSelection(key.upArrow ? -1 : 1);
    }

    if (ch === "c") {
      return commentAtCursor();
    }

    if (ch === "d") {
      return deleteAtCursor();
    }

    if (ch === "r" || ch === "x" || ch === "o") {
      setStatusAtCursor(ch);
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
      currentFile={currentEntry?.file ?? null}
      rows={rows}
      rowIndex={viewport.boundedRow}
      scrollTop={viewport.pos.top}
      focus={focus}
      general={isGeneral}
      width={columns}
      height={height}
      input={composer.composer}
      confirm={confirmDelete.request}
      message={message}
    />
  );
}

export function runApp(review: Review): Promise<void> {
  const restore = enterFullscreen();
  const { waitUntilExit } = render(<App review={review} />);

  return waitUntilExit().finally(restore);
}
