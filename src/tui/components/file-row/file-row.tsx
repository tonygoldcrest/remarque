import React from "react";
import { Text } from "ink";
import { FileEntry } from "../../model";
import { STATUS_MARK } from "./constants";
import theme from "../../theme";

export const FileRow = React.memo(function FileRow({
  entry,
  selected,
  width,
}: {
  entry: FileEntry;
  selected: boolean;
  width: number;
}) {
  const mark = entry.general ? "◆" : STATUS_MARK[entry.status];
  const name = entry.general ? "general" : entry.file;
  const segs: { text: string; color?: string }[] = [{ text: `${mark} ` }];

  if (entry.open > 0) {
    segs.push({ text: `●${entry.open} `, color: theme.comment });
  }

  if (entry.resolved > 0) {
    segs.push({ text: `✓${entry.resolved} `, color: theme.ok });
  }

  if (entry.dismissed > 0) {
    segs.push({ text: `✕${entry.dismissed} `, color: theme.hunk });
  }

  segs.push({ text: name });
  const used = segs.reduce((n, s) => n + s.text.length, 0);

  if (used < width) {
    segs.push({ text: " ".repeat(width - used) });
  }

  return (
    <Text backgroundColor={selected ? theme.fileSelBg : undefined} bold={selected} wrap="truncate">
      {segs.map((s, i) => (
        <Text key={i} color={s.color}>
          {s.text}
        </Text>
      ))}
    </Text>
  );
});
