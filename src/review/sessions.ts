import { randomUUID } from "node:crypto";

import { WORKING_TREE, type ReviewStore, type Session } from "../protocol";
import type { ReviewContext, SessionSummary } from "./types";
import { now } from "./helpers";

export async function currentSession(ctx: ReviewContext): Promise<Session | null> {
  const store = await ctx.backend.read();

  return store.sessions.find((s) => s.id === store.currentSessionId) ?? null;
}

export async function listSessions(ctx: ReviewContext): Promise<SessionSummary[]> {
  const store = await ctx.backend.read();

  return store.sessions.map((session) => {
    const items = [
      ...store.threads.filter((t) => t.sessionId === session.id),
      ...store.generalComments.filter((g) => g.sessionId === session.id),
    ];

    return {
      session,
      current: session.id === store.currentSessionId,
      total: items.length,
      open: items.filter((item) => item.status === "open").length,
    };
  });
}

export async function startSession(
  ctx: ReviewContext,
  opts: { base?: string; compare?: string } = {},
): Promise<Session> {
  const session: Session = {
    id: randomUUID(),
    repoRoot: ctx.repoRoot,
    branch: ctx.branch,
    base: opts.base ?? "HEAD",
    compare: opts.compare ?? WORKING_TREE,
    createdAt: now(),
  };

  await ctx.backend.update((store) => {
    store.sessions.push(session);
    store.currentSessionId = session.id;
  });

  return session;
}

export async function switchSession(ctx: ReviewContext, id: string): Promise<Session> {
  let target: Session | undefined;

  await ctx.backend.update((store) => {
    target = store.sessions.find((s) => s.id === id || s.id.startsWith(id));

    if (!target) {
      throw new Error(`no session with id ${id}`);
    }

    store.currentSessionId = target.id;
  });

  return target!;
}

export async function resumeLastSession(ctx: ReviewContext): Promise<Session> {
  const store = await ctx.backend.read();

  if (store.sessions.length === 0) {
    return startSession(ctx);
  }

  return switchSession(ctx, store.sessions[store.sessions.length - 1].id);
}

export async function ensureSession(ctx: ReviewContext): Promise<Session> {
  return (await currentSession(ctx)) ?? (await startSession(ctx));
}

/** The current session, or an ephemeral HEAD..WORKING one for read-only commands. */
export function sessionForRead(ctx: ReviewContext, store: ReviewStore): Session {
  const current = store.sessions.find((s) => s.id === store.currentSessionId);

  if (current) {
    return current;
  }

  return {
    id: "ephemeral",
    repoRoot: ctx.repoRoot,
    branch: ctx.branch,
    base: "HEAD",
    compare: WORKING_TREE,
    createdAt: now(),
  };
}
