import type { ThreadStatus } from "../../protocol";
import type { PaneInner } from "./types";

export const GENERAL_FILE = " general";

export const COMPOSE_HINT = "+ add a general comment";

export const STATUS_ICON: Record<ThreadStatus, string> = {
  open: "●",
  resolved: "✓",
  dismissed: "✕",
  outdated: "●",
};

export const NO_WRAP: PaneInner = { old: 200, new: 200 };
