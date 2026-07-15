import theme from "../../theme.js";
import type { SpanKind } from "../../model/index.js";

export function spanColor(kind: SpanKind, statusHex: string): string | undefined {
  switch (kind) {
    case "border":
    case "thread-line":
    case "rule":
      return theme.border;
    case "status":
      return statusHex;
    case "author":
    case "body":
      return theme.comment;
    default:
      return undefined;
  }
}
