import * as git from "../git";
import { JsonBackend } from "../store/json-backend";
import { resolveStore } from "../config";
import type {
  Author,
  GeneralComment,
  ReviewState,
  ReviewStore,
  Session,
  StructuredDiff,
  Thread,
} from "../protocol";
import type {
  ApplyAction,
  ApplyResult,
  BatchInput,
  BatchResult,
  CommentInput,
  OpenOptions,
  ReviewContext,
  ReviewItem,
  SessionSummary,
} from "./types";
import * as sessions from "./sessions";
import * as items from "./items";
import { plainDiff, structuredDiff } from "./diff";
import { buildState } from "./state";
import { newMessage, now } from "./helpers";

export class Review {
  private constructor(private readonly ctx: ReviewContext) {}

  static async open(opts: OpenOptions = {}): Promise<Review> {
    const cwd = opts.cwd ?? process.cwd();
    const info = await git.repoInfo(cwd);

    if (!info) {
      throw new Error(`not inside a git repository: ${cwd}`);
    }

    return new Review({
      backend: opts.backend ?? new JsonBackend(resolveStore(info.root, info.branch).dir),
      repoRoot: info.root,
      branch: info.branch,
      hasHead: info.hasHead,
      resolve: opts.resolve ?? {},
    });
  }

  get repoRoot(): string {
    return this.ctx.repoRoot;
  }

  get branch(): string {
    return this.ctx.branch;
  }

  location(): string {
    return this.ctx.backend.location();
  }

  read(): Promise<ReviewStore> {
    return this.ctx.backend.read();
  }

  currentSession(): Promise<Session | null> {
    return sessions.currentSession(this.ctx);
  }

  listSessions(): Promise<SessionSummary[]> {
    return sessions.listSessions(this.ctx);
  }

  startSession(opts: { base?: string; compare?: string } = {}): Promise<Session> {
    return sessions.startSession(this.ctx, opts);
  }

  switchSession(id: string): Promise<Session> {
    return sessions.switchSession(this.ctx, id);
  }

  resumeLast(): Promise<Session> {
    return sessions.resumeLastSession(this.ctx);
  }

  async addComment(input: CommentInput): Promise<Thread> {
    const { threads } = await this.addBatch({ comments: [input] });

    return threads[0];
  }

  async addGeneralComment(opts: { body: string; author?: Author }): Promise<GeneralComment> {
    const { generalComments } = await this.addBatch({
      general: [{ body: opts.body }],
      author: opts.author,
    });

    return generalComments[0];
  }

  addBatch(input: BatchInput): Promise<BatchResult> {
    return items.addBatch(this.ctx, input);
  }

  applyBatch(opts: { actions: ApplyAction[]; author?: Author }): Promise<ApplyResult> {
    return items.applyBatch(this.ctx, opts);
  }

  reply(id: string, opts: { body: string; author?: Author }): Promise<ReviewItem> {
    return items.updateItem(this.ctx, id, (item) => {
      item.messages.push(newMessage(opts.author ?? "human", opts.body));
    });
  }

  resolve(id: string, opts: { note?: string; author?: Author } = {}): Promise<ReviewItem> {
    return this.close(id, "resolved", opts.note ?? null, opts.author ?? "agent");
  }

  dismiss(id: string, opts: { reason?: string; author?: Author } = {}): Promise<ReviewItem> {
    return this.close(id, "dismissed", opts.reason ?? null, opts.author ?? "human");
  }

  private close(
    id: string,
    status: "resolved" | "dismissed",
    note: string | null,
    author: Author,
  ): Promise<ReviewItem> {
    return items.updateItem(this.ctx, id, (item) => {
      item.status = status;
      item.resolution = { note, by: author, at: now() };
    });
  }

  reopen(id: string): Promise<ReviewItem> {
    return items.updateItem(this.ctx, id, (item) => {
      item.status = "open";
      item.resolution = null;
    });
  }

  continueThread(id: string, opts: { body: string; author?: Author }): Promise<ReviewItem> {
    return items.updateItem(this.ctx, id, (item) => {
      item.messages.push(newMessage(opts.author ?? "human", opts.body));
      item.status = "open";
      item.resolution = null;
    });
  }

  deleteThread(id: string): Promise<boolean> {
    return items.deleteItem(this.ctx, id);
  }

  getItem(id: string): Promise<ReviewItem | null> {
    return items.getItem(this.ctx, id);
  }

  diff(paths: string[] = []): Promise<string> {
    return plainDiff(this.ctx, paths);
  }

  diffFiles(opts: { whole?: boolean } = {}): Promise<StructuredDiff> {
    return structuredDiff(this.ctx, opts);
  }

  state(fileFilter?: string): Promise<ReviewState> {
    return buildState(this.ctx, fileFilter);
  }
}
