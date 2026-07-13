import React from "react";
import { Text } from "ink";
import { FileEntry } from "../../model";
import { STATUS_COLOR, STATUS_MARK } from "./constants";
import { fileLabel } from "./helpers";
import theme from "../../theme";

export const FileRow = React.memo(function FileRow({
  entry,
  selected,
  width,
  indent,
}: {
  entry: FileEntry;
  selected: boolean;
  width: number;
  indent: number;
}) {
  const bg = selected ? theme.fileSelBg : undefined;
  const threads = entry.total > 0 ? `●${entry.total}` : "";
  const mark = STATUS_MARK[entry.status] ?? "M";
  const right = threads ? `${threads} ${mark}` : mark;
  const room = Math.max(1, width - indent - right.length - 1);
  const { name, dir, gap } = fileLabel(entry.file, room);

  return (
    <Text backgroundColor={bg} wrap="truncate">
      {" ".repeat(indent)}
      <Text color={theme.comment} bold={selected}>
        {name}
      </Text>
      {dir ? (
        <Text color={theme.hunk} italic>
          {` ${dir}`}
        </Text>
      ) : null}
      {`${gap} `}
      {threads ? <Text color={theme.hunk}>{`${threads} `}</Text> : null}
      <Text color={STATUS_COLOR[entry.status]} bold>
        {mark}
      </Text>
    </Text>
  );
});
