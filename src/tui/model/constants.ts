import type { ThreadStatus } from "../../protocol.js";
import type { PaneInner } from "./types.js";

export const GENERAL_FILE = " general";

export const COMPOSE_HINT = "+ add a general comment";

export const STATUS_ICON: Record<ThreadStatus, string> = {
  open: "●",
  resolved: "✓",
  dismissed: "✕",
  outdated: "●",
};

export const NO_WRAP: PaneInner = { old: 200, new: 200 };

export const BORDER_WIDTH = 2;
export const LEAD_PAD_LEFT = 1;
export const THREAD_PAD_LEFT = 1;
export const CONT_PAD_LEFT = LEAD_PAD_LEFT + 3;
export const PAD_RIGHT = 1;

export const THREAD_LINE = "│";
export const BORDER_BAR = "│";
export const BORDER_DASH = "─";
export const BORDER_CORNERS = {
  top: { left: "╭", right: "╮" },
  bottom: { left: "╰", right: "╯" },
};
