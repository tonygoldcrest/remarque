import theme from "../../theme";

export const STATUS_MARK: Record<string, string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  copied: "C",
};

export const STATUS_COLOR: Record<string, string> = {
  added: theme.addFg,
  modified: theme.warn,
  deleted: theme.delFg,
  renamed: theme.borderActive,
  copied: theme.borderActive,
};
