import React from "react";
import { Text } from "ink";
import { DisplayRow } from "../../model/index.js";
import type { Token } from "../../highlight/index.js";
import theme from "../../theme.js";
import { clip, fit } from "../helpers.js";
import { statusColor } from "./helpers.js";
import { CodeCell } from "../code-cell/index.js";

export const SideRow = React.memo(function SideRow({
  row,
  width,
  side,
  selected,
  focused,
  lang,
  lineTokens,
}: {
  row: DisplayRow;
  width: number;
  side: "old" | "new";
  selected: boolean;
  focused: boolean;
  lang: string | null;
  lineTokens: Token[][] | null;
}) {
  if (row.kind === "hunk") {
    return <Text> </Text>;
  }

  if (row.kind === "compose") {
    const bg = selected && focused ? theme.cursorBg : undefined;

    return (
      <Text backgroundColor={bg} color={theme.hunk} wrap="truncate">
        {fit(clip(row.text, width), width)}
      </Text>
    );
  }

  if (row.kind === "comment") {
    if (row.thread.side !== side) {
      return <Text> </Text>;
    }

    const bg = selected && focused ? theme.cursorBg : undefined;

    if (row.tone === "rule") {
      return (
        <Text backgroundColor={bg} color={theme.border} wrap="truncate">
          {fit(clip(row.text, width), width)}
        </Text>
      );
    }

    if (row.tone === "cont") {
      return (
        <Text backgroundColor={bg} color={theme.comment} wrap="truncate">
          {fit(clip(row.text, width), width)}
        </Text>
      );
    }

    const leadColor = row.head ? statusColor(row.thread.status) : theme.hunk;
    const used = row.lead.length + row.author.length + 1 + row.body.length;
    const pad = " ".repeat(Math.max(0, width - used));

    return (
      <Text wrap="truncate">
        <Text backgroundColor={bg} color={leadColor}>
          {row.lead}
        </Text>
        <Text backgroundColor={bg} bold color={theme.comment}>
          {row.author}
        </Text>
        <Text backgroundColor={bg} color={theme.comment}>{` ${row.body}${pad}`}</Text>
      </Text>
    );
  }

  const cell = side === "old" ? row.left : row.right;
  const tokens = cell.num != null ? (lineTokens?.[cell.num - 1] ?? null) : null;

  return (
    <CodeCell cell={cell} width={width} cursor={selected && focused} lang={lang} tokens={tokens} />
  );
});
