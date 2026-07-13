import theme from "../../theme";

export function statusColor(status: string): string {
  switch (status) {
    case "resolved":
      return theme.ok;
    case "outdated":
      return theme.warn;
    default:
      return theme.hunk;
  }
}
