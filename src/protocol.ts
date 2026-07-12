export const SCHEMA_VERSION = 1;

export type Side = "new" | "old";

export type Author = "human" | "agent";

export type ThreadStatus = "open" | "resolved" | "dismissed" | "outdated";

export interface Anchor {
  blobSha: string;
  line: number;
  endLine: number;
  lineText: string;
  before: string[];
  after: string[];
}

export interface Message {
  id: string;
  author: Author;
  body: string;
  at: string;
}

export interface Resolution {
  note: string | null;
  by: Author;
  at: string;
}

export interface Thread {
  id: string;
  sessionId: string;
  file: string;
  side: Side;
  anchor: Anchor;
  status: ThreadStatus;
  resolution: Resolution | null;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface GeneralComment {
  id: string;
  sessionId: string;
  status: Exclude<ThreadStatus, "outdated">;
  resolution: Resolution | null;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  repoRoot: string;
  branch: string;
  base: string;
  compare: string;
  createdAt: string;
}

export interface ReviewStore {
  schemaVersion: number;
  sessions: Session[];
  currentSessionId: string | null;
  threads: Thread[];
  generalComments: GeneralComment[];
}

export interface ResolvedThread extends Thread {
  currentLine: number | null;
  currentEndLine: number | null;
}

export interface ReviewState {
  schemaVersion: number;
  session: Session | null;
  threads: ResolvedThread[];
  generalComments: GeneralComment[];
}

export interface WatchEvent {
  type: "change";
  at: string;
  state: ReviewState;
}

export type DiffFileStatus = "added" | "modified" | "deleted" | "renamed" | "copied";

export interface DiffFile {
  file: string;
  oldFile: string | null;
  status: DiffFileStatus;
  patch: string;
}

export interface StructuredDiff {
  base: string;
  compare: string;
  files: DiffFile[];
}

export function emptyStore(): ReviewStore {
  return {
    schemaVersion: SCHEMA_VERSION,
    sessions: [],
    currentSessionId: null,
    threads: [],
    generalComments: [],
  };
}
