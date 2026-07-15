import React from "react";
import { Box, Text } from "ink";
import { selectionKey, type DisplayRow, type FileSection } from "../../model/index.js";
import type { SideTokens } from "../../highlight/index.js";
import theme from "../../theme.js";
import { fit } from "../helpers.js";
import { langForFile } from "../../highlight/index.js";
import { StatusLine } from "../status-line/index.js";
import { SideRow } from "../side-row/index.js";
import { FileRow } from "../file-row/index.js";
import { Composer, DeleteRequest, Focus } from "../../types.js";
import { paneWidths, contentHeight } from "../../helpers.js";

interface Props {
  base: string;
  compare: string;
  sections: FileSection[];
  currentFile: string | null;
  rows: DisplayRow[];
  rowIndex: number;
  highlights?: SideTokens;
  focus: Focus;
  general?: boolean;
  width: number;
  height: number;
  scrollTop?: number;
  input?: Composer | null;
  confirm?: DeleteRequest | null;
  message?: string | null;
}

function fileTree(sections: FileSection[], currentFile: string | null, width: number) {
  const nodes: React.ReactElement[] = [];

  for (const section of sections) {
    if (section.title) {
      if (nodes.length > 0) {
        nodes.push(<Text key={`${section.title}-space`}> </Text>);
      }

      nodes.push(
        <Text key={section.title} color={theme.sectionTitle} bold>
          {fit(section.title, width)}
        </Text>,
      );
    }

    for (const entry of section.files) {
      nodes.push(
        <FileRow
          key={entry.file}
          entry={entry}
          selected={entry.file === currentFile}
          width={width}
          indent={section.title ? 1 : 0}
        />,
      );
    }
  }

  return nodes;
}

export function Panel(props: Props): React.ReactElement {
  const { sections, rows, rowIndex, focus, width, height } = props;

  const { filesW, removedW, addedW } = paneWidths(width);

  const bodyH = Math.max(1, height - 2);
  const contentH = contentHeight(height);
  const scrollTop = Math.max(
    0,
    Math.min(props.scrollTop ?? 0, Math.max(0, rows.length - contentH)),
  );
  const visible = rows
    .slice(scrollTop, scrollTop + contentH)
    .map((row, i) => ({ row, index: scrollTop + i }));
  const lang = props.currentFile ? langForFile(props.currentFile) : null;
  const cursorGroup = rows[rowIndex] ? selectionKey(rows[rowIndex], rowIndex) : null;
  const isSelected = (row: DisplayRow, idx: number) =>
    cursorGroup != null && selectionKey(row, idx) === cursorGroup;

  const fileCount = sections.reduce((n, s) => n + s.files.length, 0);
  const tree = fileTree(sections, props.currentFile, filesW - 2);
  const paneBorder = (f: Focus) => (focus === f ? theme.borderActive : theme.border);

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box height={1}>
        <Text color="cyan" bold>
          {fit(` remarque — ${props.base}..${props.compare}  (${fileCount} files)`, width)}
        </Text>
      </Box>

      <Box height={bodyH}>
        <Box width={filesW} borderStyle="round" borderColor={theme.border} flexDirection="column">
          {tree.length === 0 ? <Text color={theme.hunk}>(no files)</Text> : tree.slice(0, contentH)}
        </Box>

        {props.general ? (
          <Box
            width={removedW + addedW}
            borderStyle="round"
            borderColor={theme.borderActive}
            flexDirection="column"
          >
            {visible.map(({ row, index }) => (
              <SideRow
                key={index}
                row={row}
                width={removedW + addedW - 2}
                side="new"
                selected={isSelected(row, index)}
                focused
                lang={null}
                lineTokens={null}
              />
            ))}
          </Box>
        ) : (
          <>
            <Box
              width={removedW}
              borderStyle="round"
              borderColor={paneBorder("removed")}
              flexDirection="column"
            >
              {rows.length === 0 ? (
                <Text color={theme.hunk}>(no changes)</Text>
              ) : (
                visible
                  .filter(({ row }) => row.kind !== "hunk")
                  .map(({ row, index }) => (
                    <SideRow
                      key={index}
                      row={row}
                      width={removedW - 2}
                      side="old"
                      selected={isSelected(row, index)}
                      focused={focus === "removed"}
                      lang={lang}
                      lineTokens={props.highlights?.old ?? null}
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
                <Text color={theme.hunk}> </Text>
              ) : (
                visible
                  .filter(({ row }) => row.kind !== "hunk")
                  .map(({ row, index }) => (
                    <SideRow
                      key={index}
                      row={row}
                      width={addedW - 2}
                      side="new"
                      selected={isSelected(row, index)}
                      focused={focus === "added"}
                      lang={lang}
                      lineTokens={props.highlights?.new ?? null}
                    />
                  ))
              )}
            </Box>
          </>
        )}
      </Box>

      <Box height={1}>
        <StatusLine
          width={width}
          confirm={props.confirm}
          input={props.input}
          message={props.message}
        />
      </Box>
    </Box>
  );
}
