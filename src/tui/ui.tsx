import React from "react";
import { Box, Text } from "ink";

import type { DisplayRow, FileEntry } from "./model";
import { selectionKey } from "./model";
import { tokenize, clipTokens, langForFile } from "./highlight";

export type Focus = "files" | "removed" | "added";

export function contentHeight(height: number): number {
  return Math.max(1, Math.max(1, height - 3) - 2);
}

export function paneWidths(width: number): { filesW: number; removedW: number; addedW: number } {
  const filesW = Math.max(16, Math.floor(width * 0.2));
  const rest = width - filesW;
  const removedW = Math.floor(rest / 2);
  const addedW = rest - removedW;
  return { filesW, removedW, addedW };
}

export const COLORS = {
  addBg: "#16402a",
  delBg: "#48232b",
  addFg: "#3fb950",
  delFg: "#f85149",
  cursorBg: "#26364f",
  fileSelBg: "#22272e",
  hunk: "#7d8590",
  comment: "#e6edf3",
  ok: "#3fb950",
  warn: "#d29922",
  border: "#6e7681",
  borderActive: "#2f81f7",
};

function statusColor(status: string): string {
  if (status === "resolved") return COLORS.ok;
  if (status === "outdated") return COLORS.warn;
  return COLORS.hunk;
}

export interface PanelProps {
  base: string;
  compare: string;
  files: FileEntry[];
  fileIndex: number;
  currentFile: string | null;
  rows: DisplayRow[];
  rowIndex: number;
  focus: Focus;
  width: number;
  height: number;
  scrollTop?: number;
  input?: {
    mode: "new" | "reply";
    file?: string;
    side?: string;
    line?: number;
    value: string;
  } | null;
  confirm?: { label: string } | null;
  message?: string | null;
}

type Cell = Extract<DisplayRow, { kind: "line" }>["left"];

function clip(s: string, w: number): string {
  return s.length > w ? s.slice(0, Math.max(0, w)) : s;
}
function pad(s: string, w: number): string {
  return s.length >= w ? s : s + " ".repeat(w - s.length);
}
function fit(s: string, w: number): string {
  return pad(clip(s, w), w);
}

const STATUS_MARK: Record<string, string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  copied: "C",
};

const FileRow = React.memo(function FileRow({
  entry,
  selected,
  width,
}: {
  entry: FileEntry;
  selected: boolean;
  width: number;
}) {
  const badge = entry.open > 0 ? `●${entry.open} ` : "";
  return (
    <Text backgroundColor={selected ? COLORS.fileSelBg : undefined} bold={selected} wrap="truncate">
      {fit(`${STATUS_MARK[entry.status]} ${badge}${entry.file}`, width)}
    </Text>
  );
});

function CodeCell({
  cell,
  width,
  cursor,
  lang,
}: {
  cell: Cell;
  width: number;
  cursor: boolean;
  lang: string | null;
}) {
  const num = (cell.num == null ? "" : String(cell.num)).padStart(4);
  const sign = cell.type === "add" ? "+" : cell.type === "del" ? "-" : " ";
  const bg = cursor
    ? COLORS.cursorBg
    : cell.type === "add"
      ? COLORS.addBg
      : cell.type === "del"
        ? COLORS.delBg
        : undefined;
  const signColor =
    cell.type === "add" ? COLORS.addFg : cell.type === "del" ? COLORS.delFg : undefined;
  const codeW = Math.max(0, width - 6);
  const tokens =
    cell.type === "empty"
      ? [{ text: " ".repeat(codeW) }]
      : clipTokens(tokenize(cell.text, lang), codeW);
  return (
    <Text wrap="truncate">
      <Text backgroundColor={bg} color={COLORS.hunk}>{`${num} `}</Text>
      <Text backgroundColor={bg} color={signColor}>
        {sign}
      </Text>
      {tokens.map((t, i) => (
        <Text key={i} backgroundColor={bg} color={t.color}>
          {t.text}
        </Text>
      ))}
    </Text>
  );
}

const SideRow = React.memo(function SideRow({
  row,
  width,
  side,
  selected,
  focused,
  lang,
}: {
  row: DisplayRow;
  width: number;
  side: "old" | "new";
  selected: boolean;
  focused: boolean;
  lang: string | null;
}) {
  if (row.kind === "hunk") {
    return <Text> </Text>;
  }
  if (row.kind === "comment") {
    if (row.thread.side !== side) return <Text> </Text>;
    const bg = selected && focused ? COLORS.cursorBg : undefined;
    if (row.tone === "rule") {
      return (
        <Text backgroundColor={bg} color={COLORS.border} wrap="truncate">
          {fit(clip(row.text, width), width)}
        </Text>
      );
    }
    if (row.tone === "cont") {
      return (
        <Text backgroundColor={bg} color={COLORS.comment} wrap="truncate">
          {fit(clip(row.text, width), width)}
        </Text>
      );
    }
    const leadColor = row.head ? statusColor(row.thread.status) : COLORS.hunk;
    const used = row.lead.length + row.author.length + 1 + row.body.length;
    const pad = " ".repeat(Math.max(0, width - used));
    return (
      <Text wrap="truncate">
        <Text backgroundColor={bg} color={leadColor}>
          {row.lead}
        </Text>
        <Text backgroundColor={bg} bold color={COLORS.comment}>
          {row.author}
        </Text>
        <Text backgroundColor={bg} color={COLORS.comment}>{` ${row.body}${pad}`}</Text>
      </Text>
    );
  }
  const cell = side === "old" ? row.left : row.right;
  return <CodeCell cell={cell} width={width} cursor={selected && focused} lang={lang} />;
});

function PaneLabel({ text, width, active }: { text: string; width: number; active: boolean }) {
  return (
    <Box width={width} justifyContent="center">
      <Text bold={active} color={active ? COLORS.borderActive : COLORS.hunk}>
        {text}
      </Text>
    </Box>
  );
}

function statusLine(props: PanelProps, width: number): React.ReactElement {
  if (props.confirm) {
    return <Text color={COLORS.delFg}>{fit(` ${props.confirm.label} (y/N)`, width)}</Text>;
  }
  if (props.input) {
    const prefix =
      props.input.mode === "reply"
        ? ` reply › `
        : ` comment ${props.input.file} ${props.input.side}:${props.input.line} › `;
    const text = prefix + props.input.value;
    const room = Math.max(1, width - 1);
    const shown = text.length > room ? text.slice(text.length - room) : text;
    const pad = " ".repeat(Math.max(0, room - shown.length));
    return (
      <Text>
        {shown}
        <Text inverse> </Text>
        {pad}
      </Text>
    );
  }
  const help =
    " Tab pane  ↑↓ move  ]c/]t jump  c reply  r resolve  x dismiss  o reopen  d delete  ^R reload  q quit";
  if (!props.message) return <Text color={COLORS.hunk}>{fit(help, width)}</Text>;
  const msg = `  ${props.message} `;
  const isError = props.message.toLowerCase().startsWith("error");
  const maxHelp = Math.max(0, width - msg.length);
  const helpText = help.length > maxHelp ? help.slice(0, maxHelp) : help;
  const pad = " ".repeat(Math.max(0, width - helpText.length - msg.length));
  return (
    <Text>
      <Text color={COLORS.hunk}>{helpText + pad}</Text>
      <Text color={isError ? COLORS.delFg : COLORS.borderActive}>{msg}</Text>
    </Text>
  );
}

export function Panel(props: PanelProps): React.ReactElement {
  const { files, fileIndex, rows, rowIndex, focus, width, height } = props;

  const { filesW, removedW, addedW } = paneWidths(width);

  const bodyH = Math.max(1, height - 3);
  const contentH = contentHeight(height);
  const scrollTop = Math.max(
    0,
    Math.min(props.scrollTop ?? 0, Math.max(0, rows.length - contentH)),
  );
  const visible = rows.slice(scrollTop, scrollTop + contentH);
  const lang = props.currentFile ? langForFile(props.currentFile) : null;
  const cursorGroup = rows[rowIndex] ? selectionKey(rows[rowIndex], rowIndex) : null;
  const isSelected = (row: DisplayRow, idx: number) =>
    cursorGroup != null && selectionKey(row, idx) === cursorGroup;

  const paneBorder = (f: Focus) => (focus === f ? COLORS.borderActive : COLORS.border);

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box height={1}>
        <Text color="cyan" bold>
          {fit(` remarque — ${props.base}..${props.compare}  (${files.length} files)`, width)}
        </Text>
      </Box>

      <Box height={1}>
        <PaneLabel text="Files" width={filesW} active={focus === "files"} />
        <PaneLabel text="removed" width={removedW} active={focus === "removed"} />
        <PaneLabel text="added" width={addedW} active={focus === "added"} />
      </Box>

      <Box height={bodyH}>
        <Box
          width={filesW}
          borderStyle="round"
          borderColor={paneBorder("files")}
          flexDirection="column"
        >
          {files.length === 0 ? (
            <Text color={COLORS.hunk}>(no files)</Text>
          ) : (
            files
              .slice(0, contentH)
              .map((f, i) => (
                <FileRow key={f.file} entry={f} selected={i === fileIndex} width={filesW - 2} />
              ))
          )}
        </Box>

        <Box
          width={removedW}
          borderStyle="round"
          borderColor={paneBorder("removed")}
          flexDirection="column"
        >
          {rows.length === 0 ? (
            <Text color={COLORS.hunk}>(no changes)</Text>
          ) : (
            visible.map((row, i) => (
              <SideRow
                key={scrollTop + i}
                row={row}
                width={removedW - 2}
                side="old"
                selected={isSelected(row, scrollTop + i)}
                focused={focus === "removed"}
                lang={lang}
              />
            ))
          )}
        </Box>

        <Box
          width={addedW}
          borderStyle="round"
          borderColor={paneBorder("added")}
          flexDirection="column"
        >
          {rows.length === 0 ? (
            <Text color={COLORS.hunk}> </Text>
          ) : (
            visible.map((row, i) => (
              <SideRow
                key={scrollTop + i}
                row={row}
                width={addedW - 2}
                side="new"
                selected={isSelected(row, scrollTop + i)}
                focused={focus === "added"}
                lang={lang}
              />
            ))
          )}
        </Box>
      </Box>

      <Box height={1}>{statusLine(props, width)}</Box>
    </Box>
  );
}
