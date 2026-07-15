import React from "react";
import { Text } from "ink";
import theme from "../../theme.js";
import type { Span } from "../../model/index.js";
import { spanColor } from "./helpers.js";

export function SpanLine({
  spans,
  statusHex,
  selected,
}: {
  spans: Span[];
  statusHex: string;
  selected: boolean;
}) {
  return (
    <Text wrap="truncate">
      {spans.map((span, i) => (
        <Text
          key={i}
          backgroundColor={selected && span.kind !== "border" ? theme.cursorBg : undefined}
          bold={span.kind === "author"}
          color={spanColor(span.kind, statusHex)}
        >
          {span.text}
        </Text>
      ))}
    </Text>
  );
}
