import type { ApplyAction, CommentInput, GeneralCommentInput } from "../review";
import type { ReviewPayload } from "./types";

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`invalid JSON payload: ${(e as Error).message}`, { cause: e });
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

function parseComment(value: unknown, index: number): CommentInput {
  const o = asRecord(value);

  if (typeof o.file !== "string" || typeof o.line !== "number" || typeof o.body !== "string") {
    throw new Error(`comments[${index}] needs file (string), line (number), and body (string)`);
  }

  return {
    file: o.file,
    line: o.line,
    endLine: typeof o.endLine === "number" ? o.endLine : undefined,
    side: o.side === "old" ? "old" : "new",
    body: o.body,
  };
}

function parseGeneralComment(value: unknown, index: number): GeneralCommentInput {
  const o = asRecord(value);

  if (typeof o.body !== "string") {
    throw new Error(`general[${index}] needs body (string)`);
  }

  return { body: o.body };
}

export function parseReviewPayload(raw: string): ReviewPayload {
  const data = parseJson(raw);
  const obj = asRecord(data);
  const rawComments = Array.isArray(data) ? data : (obj.comments ?? []);
  const rawGeneral = Array.isArray(data) ? [] : (obj.general ?? obj.generalComments ?? []);

  if (!Array.isArray(rawComments) || !Array.isArray(rawGeneral)) {
    throw new Error("payload must be an array of comments, or { comments: [...], general: [...] }");
  }

  return {
    comments: rawComments.map(parseComment),
    general: rawGeneral.map(parseGeneralComment),
  };
}

function parseActionStatus(value: unknown, index: number): ApplyAction["status"] {
  if (value === undefined) {
    return undefined;
  }

  if (value !== "open" && value !== "resolved" && value !== "dismissed") {
    throw new Error(`actions[${index}].status must be one of open, resolved, dismissed`);
  }

  return value;
}

function parseAction(value: unknown, index: number): ApplyAction {
  const o = asRecord(value);

  if (typeof o.id !== "string") {
    throw new Error(`actions[${index}] needs id (string)`);
  }

  const status = parseActionStatus(o.status, index);
  const reply = typeof o.reply === "string" ? o.reply : undefined;
  const note = [o.note, o.summary, o.reason].find((n) => typeof n === "string") as
    string | undefined;

  if (reply === undefined && status === undefined) {
    throw new Error(`actions[${index}] needs a reply and/or a status`);
  }

  return { id: o.id, reply, status, note };
}

export function parseApplyPayload(raw: string): ApplyAction[] {
  const data = parseJson(raw);
  const actions = Array.isArray(data) ? data : asRecord(data).actions;

  if (!Array.isArray(actions)) {
    throw new Error("payload must be an array of actions, or { actions: [...] }");
  }

  return actions.map(parseAction);
}
