import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import * as git from "./git";
import { captureAnchor, resolveAnchor, type ResolveOptions } from "./anchor";
import { JsonBackend } from "./store/json-backend";
import { resolveStore } from "./config";
import type { StorageBackend } from "./store/backend";
import {
  SCHEMA_VERSION,
  type Author,
  type DiffFile,
  type DiffFileStatus,
  type GeneralComment,
  type Message,
  type ResolvedThread,
  type ReviewState,
  type ReviewStore,
  type Session,
  type Side,
  type StructuredDiff,
  type Thread,
} from "./protocol";

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

export interface SessionSummary {
  session: Session;
  current: boolean;
  total: number;
  open: number;
}

const FULL_FILE_CONTEXT = 1_000_000;

function now(): string {
  return new Date().toISOString();
}

function addedFilePatch(file: string, content: string): string {
  const header = [`diff --git a/${file} b/${file}`, "new file mode 100644"];
  if (content.includes("\u0000")) {
    return [...header, `Binary files /dev/null and b/${file} differ`, ""].join("\n");
  }
  const hadTrailingNewline = content.endsWith("\n");
  const body = hadTrailingNewline ? content.slice(0, -1) : content;
  const lines = body.length === 0 ? [] : body.split("\n");
  const patch = [
    ...header,
    "--- /dev/null",
    `+++ b/${file}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((l) => `+${l}`),
  ];
  if (!hadTrailingNewline && lines.length > 0) patch.push("\\ No newline at end of file");
  return patch.join("\n") + "\n";
}

function newMessage(author: Author, body: string): Message {
  return { id: randomUUID(), author, body, at: now() };
}

export class Review {
  private constructor(
    private readonly backend: StorageBackend,
    readonly repoRoot: string,
    readonly branch: string,
    private readonly resolveOpts: ResolveOptions,
  ) {}

  static async open(opts: OpenOptions = {}): Promise<Review> {
    const cwd = opts.cwd ?? process.cwd();
    if (!(await git.isRepo(cwd))) {
      throw new Error(`not inside a git repository: ${cwd}`);
    }
    const root = await git.repoRoot(cwd);
    const branch = await git.currentBranch(cwd);
    const backend = opts.backend ?? new JsonBackend(resolveStore(root, branch).file);
    return new Review(backend, root, branch, opts.resolve ?? {});
  }

  location(): string {
    return this.backend.location();
  }

  read(): Promise<ReviewStore> {
    return this.backend.read();
  }

  async currentSession(): Promise<Session | null> {
    const store = await this.backend.read();
    return store.sessions.find((s) => s.id === store.currentSessionId) ?? null;
  }

  async listSessions(): Promise<SessionSummary[]> {
    const store = await this.backend.read();
    return store.sessions.map((s) => {
      const items = [
        ...store.threads.filter((t) => t.sessionId === s.id),
        ...store.generalComments.filter((g) => g.sessionId === s.id),
      ];
      return {
        session: s,
        current: s.id === store.currentSessionId,
        total: items.length,
        open: items.filter((x) => x.status === "open").length,
      };
    });
  }

  async startSession(opts: { base?: string; compare?: string } = {}): Promise<Session> {
    const branch = await git.currentBranch(this.repoRoot);
    const session: Session = {
      id: randomUUID(),
      repoRoot: this.repoRoot,
      branch,
      base: opts.base ?? "HEAD",
      compare: opts.compare ?? "WORKING",
      createdAt: now(),
    };
    await this.backend.update((store) => {
      store.sessions.push(session);
      store.currentSessionId = session.id;
    });
    return session;
  }

  async switchSession(id: string): Promise<Session> {
    let target: Session | undefined;
    await this.backend.update((store) => {
      target = store.sessions.find((s) => s.id === id || s.id.startsWith(id));
      if (!target) throw new Error(`no session with id ${id}`);
      store.currentSessionId = target.id;
    });
    return target!;
  }

  async resumeLast(): Promise<Session> {
    const store = await this.backend.read();
    if (store.sessions.length === 0) return this.startSession();
    return this.switchSession(store.sessions[store.sessions.length - 1].id);
  }

  private async ensureSession(): Promise<Session> {
    return (await this.currentSession()) ?? (await this.startSession());
  }

  private async effectiveBase(base: string): Promise<string> {
    if (base !== "HEAD") return base;
    if (await git.hasHead(this.repoRoot)) return "HEAD";
    return git.emptyTree(this.repoRoot);
  }

  private async sideContent(
    file: string,
    side: Side,
    base: string,
  ): Promise<{ content: string | null; blobSha: string | null }> {
    if (side === "old") {
      try {
        const content = await git.showFile(this.repoRoot, base, file);
        return { content, blobSha: await git.hashObject(this.repoRoot, content) };
      } catch {
        return { content: null, blobSha: null };
      }
    }
    try {
      const content = await fs.readFile(path.join(this.repoRoot, file), "utf8");
      return { content, blobSha: await git.hashObject(this.repoRoot, content) };
    } catch {
      return { content: null, blobSha: null };
    }
  }

  async addComment(input: CommentInput): Promise<Thread> {
    const side: Side = input.side ?? "new";
    const author: Author = input.author ?? "human";
    const endLine = input.endLine ?? input.line;

    const session = await this.ensureSession();
    const base = await this.effectiveBase(session.base);
    const { content, blobSha } = await this.sideContent(input.file, side, base);
    const anchor = captureAnchor({
      content: content ?? "",
      blobSha: blobSha ?? "",
      line: input.line,
      endLine,
    });

    const thread: Thread = {
      id: randomUUID(),
      sessionId: session.id,
      file: input.file,
      side,
      anchor,
      status: "open",
      resolution: null,
      messages: [newMessage(author, input.body)],
      createdAt: now(),
      updatedAt: now(),
    };

    await this.backend.update((s) => {
      s.threads.push(thread);
    });
    return thread;
  }

  async addGeneralComment(opts: { body: string; author?: Author }): Promise<GeneralComment> {
    const author = opts.author ?? "human";
    const session = await this.ensureSession();
    let gc!: GeneralComment;
    await this.backend.update((s) => {
      gc = {
        id: randomUUID(),
        sessionId: session.id,
        status: "open",
        resolution: null,
        messages: [newMessage(author, opts.body)],
        createdAt: now(),
        updatedAt: now(),
      };
      s.generalComments.push(gc);
    });
    return gc;
  }

  async reply(
    id: string,
    opts: { body: string; author?: Author },
  ): Promise<Thread | GeneralComment> {
    const author = opts.author ?? "human";
    let target: Thread | GeneralComment | undefined;
    await this.backend.update((s) => {
      const item = findById(s, id);
      if (!item) throw new Error(`no thread with id ${id}`);
      item.messages.push(newMessage(author, opts.body));
      item.updatedAt = now();
      target = item;
    });
    return target!;
  }

  async resolve(
    id: string,
    opts: { note?: string; author?: Author } = {},
  ): Promise<Thread | GeneralComment> {
    return this.setStatus(id, "resolved", opts.note ?? null, opts.author ?? "agent");
  }

  async dismiss(
    id: string,
    opts: { reason?: string; author?: Author } = {},
  ): Promise<Thread | GeneralComment> {
    return this.setStatus(id, "dismissed", opts.reason ?? null, opts.author ?? "human");
  }

  private async setStatus(
    id: string,
    status: "resolved" | "dismissed",
    note: string | null,
    author: Author,
  ): Promise<Thread | GeneralComment> {
    let target: Thread | GeneralComment | undefined;
    await this.backend.update((s) => {
      const item = findById(s, id);
      if (!item) throw new Error(`no thread with id ${id}`);
      item.status = status;
      item.resolution = { note, by: author, at: now() };
      item.updatedAt = now();
      target = item;
    });
    return target!;
  }

  async reopen(id: string): Promise<Thread | GeneralComment> {
    let target: Thread | GeneralComment | undefined;
    await this.backend.update((s) => {
      const item = findById(s, id);
      if (!item) throw new Error(`no thread with id ${id}`);
      item.status = "open";
      item.resolution = null;
      item.updatedAt = now();
      target = item;
    });
    return target!;
  }

  async continueThread(
    id: string,
    opts: { body: string; author?: Author },
  ): Promise<Thread | GeneralComment> {
    const author = opts.author ?? "human";
    let target: Thread | GeneralComment | undefined;
    await this.backend.update((s) => {
      const item = findById(s, id);
      if (!item) throw new Error(`no thread with id ${id}`);
      item.messages.push(newMessage(author, opts.body));
      item.status = "open";
      item.resolution = null;
      item.updatedAt = now();
      target = item;
    });
    return target!;
  }

  async deleteThread(id: string): Promise<boolean> {
    let removed = false;
    await this.backend.update((s) => {
      const before = s.threads.length + s.generalComments.length;
      s.threads = s.threads.filter((t) => !(t.id === id || t.id.startsWith(id)));
      s.generalComments = s.generalComments.filter((g) => !(g.id === id || g.id.startsWith(id)));
      removed = s.threads.length + s.generalComments.length < before;
    });
    return removed;
  }

  async getItem(id: string): Promise<Thread | GeneralComment | null> {
    return findById(await this.backend.read(), id) ?? null;
  }

  async diff(paths: string[] = []): Promise<string> {
    const store = await this.backend.read();
    const session = await this.sessionForRead(store);
    const base = await this.effectiveBase(session.base);
    let out = await git.diff(this.repoRoot, base, session.compare, paths);
    if (session.compare === "WORKING") {
      for (const file of await this.untrackedInScope(paths)) {
        const { content } = await this.sideContent(file, "new", base);
        out += (out && !out.endsWith("\n") ? "\n" : "") + addedFilePatch(file, content ?? "");
      }
    }
    return out;
  }

  async diffFiles(opts: { whole?: boolean } = {}): Promise<StructuredDiff> {
    const store = await this.backend.read();
    const session = await this.sessionForRead(store);
    const base = await this.effectiveBase(session.base);
    const context = opts.whole ? FULL_FILE_CONTEXT : undefined;
    const raw = await git.nameStatus(this.repoRoot, base, session.compare);

    const files: DiffFile[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      const parts = line.split("\t");
      const code = parts[0];
      const renamed = code[0] === "R" || code[0] === "C";
      const oldFile = renamed ? parts[1] : null;
      const file = renamed ? parts[2] : parts[1];
      const paths = oldFile ? [oldFile, file] : [file];
      files.push({
        file,
        oldFile,
        status: statusFromCode(code[0]),
        patch: await git.diff(this.repoRoot, base, session.compare, paths, context),
      });
    }

    if (session.compare === "WORKING") {
      for (const file of await this.untrackedInScope()) {
        const { content } = await this.sideContent(file, "new", base);
        files.push({
          file,
          oldFile: null,
          status: "added",
          patch: addedFilePatch(file, content ?? ""),
        });
      }
    }

    return { base: session.base, compare: session.compare, files };
  }

  private async untrackedInScope(paths: string[] = []): Promise<string[]> {
    const untracked = await git.untrackedFiles(this.repoRoot);
    return paths.length ? untracked.filter((f) => paths.includes(f)) : untracked;
  }

  async state(fileFilter?: string): Promise<ReviewState> {
    const store = await this.backend.read();
    const current = store.currentSessionId;
    const session = store.sessions.find((s) => s.id === current) ?? null;
    const base = await this.effectiveBase(session?.base ?? "HEAD");

    const resolved: ResolvedThread[] = [];
    for (const t of store.threads) {
      if (current && t.sessionId !== current) continue;
      if (fileFilter && t.file !== fileFilter) continue;
      const { content, blobSha } = await this.sideContent(t.file, t.side, base);
      const pos = resolveAnchor(t.anchor, content, blobSha, this.resolveOpts);
      const found = pos !== null;
      resolved.push({
        ...t,
        status: !found && t.status === "open" ? "outdated" : t.status,
        currentLine: pos?.line ?? null,
        currentEndLine: pos?.endLine ?? null,
      });
    }

    return {
      schemaVersion: SCHEMA_VERSION,
      session,
      threads: resolved,
      generalComments: store.generalComments.filter((g) => !current || g.sessionId === current),
    };
  }

  private async sessionForRead(store: ReviewStore): Promise<Session> {
    const current = store.sessions.find((s) => s.id === store.currentSessionId);
    if (current) return current;
    const branch = await git.currentBranch(this.repoRoot);
    return {
      id: "ephemeral",
      repoRoot: this.repoRoot,
      branch,
      base: "HEAD",
      compare: "WORKING",
      createdAt: now(),
    };
  }
}

function statusFromCode(code: string): DiffFileStatus {
  switch (code) {
    case "A":
      return "added";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    default:
      return "modified";
  }
}

function findById(store: ReviewStore, id: string): Thread | GeneralComment | undefined {
  return (
    store.threads.find((t) => t.id === id || t.id.startsWith(id)) ??
    store.generalComments.find((g) => g.id === id || g.id.startsWith(id))
  );
}
