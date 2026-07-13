import type { DiffFileStatus, ResolvedThread } from "../../protocol";
import type { Row } from "../parse";

export interface FileEntry {
  file: string;
  status: DiffFileStatus;
  general: boolean;
  open: number;
  resolved: number;
  dismissed: number;
  total: number;
}

export type DisplayRow =
  | { kind: "hunk"; header: string }
  | { kind: "compose"; text: string }
  | Extract<Row, { kind: "line" }>
  | { kind: "comment"; thread: ResolvedThread; tone: "rule"; text: string }
  | { kind: "comment"; thread: ResolvedThread; tone: "cont"; msgKey: string; text: string }
  | {
      kind: "comment";
      thread: ResolvedThread;
      tone: "start";
      msgKey: string;
      head: boolean;
      lead: string;
      author: string;
      body: string;
    };

export interface PaneInner {
  old: number;
  new: number;
}

export interface Unit {
  first: number;
  last: number;
}

export interface Viewport {
  row: number;
  top: number;
}

export interface StatusCounts {
  open: number;
  resolved: number;
  dismissed: number;
  total: number;
}
