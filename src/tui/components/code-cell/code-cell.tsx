import React from "react";
import { Text } from "ink";

import { clipTokens, tokenize } from "../../highlight";
import theme from "../../theme";
import { Cell } from "./types";

export function CodeCell({
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
    ? theme.cursorBg
    : cell.type === "add"
      ? theme.addBg
      : cell.type === "del"
        ? theme.delBg
        : undefined;
  const signColor =
    cell.type === "add" ? theme.addFg : cell.type === "del" ? theme.delFg : undefined;
  const codeW = Math.max(0, width - 6);
  const tokens =
    cell.type === "empty"
      ? [{ text: " ".repeat(codeW) }]
      : clipTokens(tokenize(cell.text, lang), codeW);

  return (
    <Text wrap="truncate">
      <Text backgroundColor={bg} color={theme.hunk}>{`${num} `}</Text>
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
