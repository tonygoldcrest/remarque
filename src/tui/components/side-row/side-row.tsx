import React from "react";
import { Text } from "ink";
import { layoutCommentCont, layoutCommentStart, layoutSeparator } from "../../model/index.js";
import type { DisplayRow } from "../../model/index.js";
import type { Token } from "../../highlight/index.js";
import theme from "../../theme.js";
import { clip, fit } from "../helpers.js";
import { statusColor } from "./helpers.js";
import { SpanLine } from "../span-line/index.js";
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
    return null;
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

    const spans =
      row.tone === "cont" ? layoutCommentCont(row, width) : layoutCommentStart(row, width);

    return (
      <SpanLine
        spans={spans}
        statusHex={statusColor(row.thread.status)}
        selected={selected && focused}
      />
    );
  }

  if (row.kind === "thread-separator") {
    if (row.thread.side !== side) {
      return <Text> </Text>;
    }

    return (
      <SpanLine
        spans={layoutSeparator(row, width)}
        statusHex={statusColor(row.thread.status)}
        selected={selected && focused}
      />
    );
  }

  const cell = side === "old" ? row.left : row.right;
  const tokens = cell.num != null ? (lineTokens?.[cell.num - 1] ?? null) : null;

  return (
    <CodeCell cell={cell} width={width} cursor={selected && focused} lang={lang} tokens={tokens} />
  );
});
