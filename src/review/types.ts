import type { ResolveOptions } from "../anchor";
import type { StorageBackend } from "../store/backend";
import type { Author, GeneralComment, Session, Side, Thread } from "../protocol";

export interface ReviewContext {
  backend: StorageBackend;
  repoRoot: string;
  branch: string;
  hasHead: boolean;
  resolve: ResolveOptions;
}

export interface OpenOptions {
  cwd?: string;
  backend?: StorageBackend;
  resolve?: ResolveOptions;
}

export interface CommentInput {
  file: string;
  line: number;
  endLine?: number;
  side?: Side;
  body: string;
  author?: Author;
}

export interface GeneralCommentInput {
  body: string;
}

export interface BatchInput {
  comments?: CommentInput[];
  general?: GeneralCommentInput[];
  author?: Author;
}

export interface BatchResult {
  threads: Thread[];
  generalComments: GeneralComment[];
}

export interface ApplyAction {
  id: string;
  reply?: string;
  status?: "open" | "resolved" | "dismissed";
  note?: string;
}

export interface ApplyResult {
  applied: string[];
  notFound: string[];
}

export interface SessionSummary {
  session: Session;
  current: boolean;
  total: number;
  open: number;
}

export interface SideContent {
  content: string | null;
  blobSha: string | null;
}

export interface DiffRefs {
  base: string;
  compare: string;
}

export type SideContentReader = (file: string, side: Side) => Promise<SideContent>;

export type ReviewItem = Thread | GeneralComment;
