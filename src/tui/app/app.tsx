import React, { useCallback, useMemo, useState } from "react";
import { render, Text, useApp, useInput } from "ink";

import type { Review } from "../../review";
import { WORKING_TREE } from "../../protocol";
import { buildDisplayRows, buildGeneralRows, computeUnits, fileList, fileSections } from "../model";
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
import { useStaging } from "./use-staging";
import { useTerminalSize } from "./use-terminal-size";
import { useViewport } from "./use-viewport";

export function App({ review }: { review: Review }): React.ReactElement {
  const { exit } = useApp();
  const { columns, rows: termRows } = useTerminalSize();
  const [message, setMessage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [generalOpen, setGeneralOpen] = useState(false);
  const [focus, setFocus] = useState<Focus>("added");

  const onError = useCallback((e: Error) => setMessage(`error: ${e.message}`), []);
  const { structured, state, reloadAll, reloadThreads } = useReviewData(review, onError);
  const staging = useStaging({
    review,
    available: structured?.compare === WORKING_TREE,
    onError,
  });

  const sections = useMemo(
    () => (structured && state ? fileSections(fileList(structured, state), staging.groups) : []),
    [structured, state, staging.groups],
  );
  const files = useMemo(() => sections.flatMap((s) => s.files), [sections]);
  const fileIndex = Math.max(
    0,
    files.findIndex((f) => f.file === selectedFile),
  );
  const currentEntry = files[fileIndex] ?? null;

  const rows = useMemo(() => {
    if (!structured || !state) {
      return [];
    }

    const { removedW, addedW } = paneWidths(columns);

    if (generalOpen) {
      return buildGeneralRows(state, removedW + addedW - 2);
    }

    const file = currentEntry && structured.files.find((f) => f.file === currentEntry.file);

    return file ? buildDisplayRows(file, state, { old: removedW - 2, new: addedW - 2 }) : [];
  }, [structured, state, currentEntry, generalOpen, columns]);

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

  const selectFile = (dir: number) => {
    if (files.length > 0) {
      setSelectedFile(files[(fileIndex + dir + files.length) % files.length].file);
      setGeneralOpen(false);
      viewport.reset();
    }
  };

  const toggleGeneral = () => {
    setGeneralOpen(!generalOpen);
    viewport.reset();
  };

  const jump = useJump({
    rows,
    onJump: viewport.jumpTo,
    onFile: selectFile,
    onMiss: setMessage,
  });

  const selectedThread = () => {
    const row = rows[viewport.boundedRow];

    return row && row.kind === "comment" ? row.thread : null;
  };

  const reload = () => {
    setMessage("reloading…");
    Promise.all([reloadAll(), staging.refresh()])
      .then(() => setMessage("reloaded"))
      .catch(onError);
  };

  const cycleFocus = () => {
    if (!generalOpen) {
      setFocus(focus === "added" ? "removed" : "added");
    }
  };

  const commentAtCursor = () => {
    const intent = composerIntent(rows[viewport.boundedRow], focus, generalOpen, currentEntry);

    if (!intent) {
      return;
    }

    if ("notice" in intent) {
      return setMessage(intent.notice);
    }

    composer.open(intent.open);
  };

  const deleteAtCursor = () => {
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

  const toggleStaging = () => {
    if (!currentEntry || generalOpen) {
      return setMessage("select a file to stage");
    }

    staging.toggle(currentEntry).then(setMessage).catch(onError);
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

    if (key.ctrl && ch === "g") {
      return toggleGeneral();
    }

    if (key.tab) {
      return cycleFocus();
    }

    if (key.upArrow || key.downArrow || ch === "j" || ch === "k") {
      return viewport.move(key.upArrow || ch === "k" ? -1 : 1);
    }

    if (ch === "-") {
      return toggleStaging();
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
      sections={sections}
      currentFile={currentEntry?.file ?? null}
      rows={rows}
      rowIndex={viewport.boundedRow}
      scrollTop={viewport.pos.top}
      focus={focus}
      general={generalOpen}
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
