import React from "react";
import { Box, Text } from "ink";
import { selectionKey, type DisplayRow, type FileEntry } from "../../model";
import theme from "../../theme";
import { fit } from "../helpers";
import { langForFile } from "../../highlight";
import { StatusLine } from "../status-line";
import { SideRow } from "../side-row";
import { FileRow } from "../file-row";
import { Composer, DeleteRequest, Focus } from "../../types";
import { paneWidths, contentHeight } from "../../helpers";

interface Props {
  base: string;
  compare: string;
  files: FileEntry[];
  fileIndex: number;
  currentFile: string | null;
  rows: DisplayRow[];
  rowIndex: number;
  focus: Focus;
  general?: boolean;
  width: number;
  height: number;
  scrollTop?: number;
  input?: Composer | null;
  confirm?: DeleteRequest | null;
  message?: string | null;
}

export function Panel(props: Props): React.ReactElement {
  const { files, fileIndex, rows, rowIndex, focus, width, height } = props;

  const { filesW, removedW, addedW } = paneWidths(width);

  const bodyH = Math.max(1, height - 2);
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

  const paneBorder = (f: Focus) => (focus === f ? theme.borderActive : theme.border);

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box height={1}>
        <Text color="cyan" bold>
          {fit(
            ` remarque — ${props.base}..${props.compare}  (${files.filter((f) => !f.general).length} files)`,
            width,
          )}
        </Text>
      </Box>

      <Box height={bodyH}>
        <Box
          width={filesW}
          borderStyle="round"
          borderColor={paneBorder("files")}
          flexDirection="column"
        >
          {files.length === 0 ? (
            <Text color={theme.hunk}>(no files)</Text>
          ) : (
            files
              .slice(0, contentH)
              .map((f, i) => (
                <FileRow key={f.file} entry={f} selected={i === fileIndex} width={filesW - 2} />
              ))
          )}
        </Box>

        {props.general ? (
          <Box
            width={removedW + addedW}
            borderStyle="round"
            borderColor={focus === "files" ? theme.border : theme.borderActive}
            flexDirection="column"
          >
            {visible.map((row, i) => (
              <SideRow
                key={scrollTop + i}
                row={row}
                width={removedW + addedW - 2}
                side="new"
                selected={isSelected(row, scrollTop + i)}
                focused={focus !== "files"}
                lang={null}
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
                <Text color={theme.hunk}> </Text>
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
